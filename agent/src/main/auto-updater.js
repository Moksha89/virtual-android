const EventEmitter = require('events');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const CURRENT_VERSION = require('../../../package.json').version;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // Check every 6 hours

class AutoUpdater extends EventEmitter {
  constructor(serverUrl) {
    super();
    this.serverUrl = serverUrl ? serverUrl.replace(/\/$/, '') : '';
    this.checkTimer = null;
    this.updateInfo = null;
    this.isDownloading = false;
    this.downloadedPath = null;
  }

  get currentVersion() {
    return CURRENT_VERSION;
  }

  start() {
    if (!this.serverUrl) return;
    // Check immediately on start, then every 6 hours
    this.checkForUpdate();
    this.checkTimer = setInterval(() => this.checkForUpdate(), CHECK_INTERVAL_MS);
  }

  stop() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  async checkForUpdate() {
    if (!this.serverUrl) return;
    try {
      const url = `${this.serverUrl}/api/agents/check-update?version=${encodeURIComponent(CURRENT_VERSION)}&platform=${process.platform}`;
      const response = await fetch(url, { timeout: 15000 });
      if (!response.ok) return;

      const data = await response.json();

      if (data.has_update) {
        this.updateInfo = data;
        this.emit('update-available', {
          currentVersion: CURRENT_VERSION,
          latestVersion: data.latest_version,
          downloadUrl: data.download_url,
          releaseNotes: data.release_notes,
          mandatory: data.mandatory,
        });
      } else {
        this.emit('up-to-date', { version: CURRENT_VERSION });
      }
    } catch (err) {
      // Silently ignore update check failures - don't disrupt the agent
      console.log('[AutoUpdater] Update check failed (non-critical):', err.message);
    }
  }

  async downloadAndInstall() {
    if (!this.updateInfo || this.isDownloading) return;
    if (process.platform !== 'win32') {
      this.emit('update-error', { message: 'Auto-update only supported on Windows' });
      return;
    }

    this.isDownloading = true;
    this.emit('download-started', { version: this.updateInfo.latest_version });

    try {
      const downloadUrl = this.updateInfo.download_url;
      const tmpDir = os.tmpdir();
      const fileName = `MobileManagerAgent-${this.updateInfo.latest_version}-Setup.exe`;
      const destPath = path.join(tmpDir, fileName);

      // Download the installer
      const response = await fetch(downloadUrl, { timeout: 300000 });
      if (!response.ok) {
        throw new Error(`Download failed: HTTP ${response.status}`);
      }

      const totalSize = parseInt(response.headers.get('content-length') || '0', 10);
      let downloaded = 0;

      const fileStream = fs.createWriteStream(destPath);

      await new Promise((resolve, reject) => {
        response.body.on('data', (chunk) => {
          downloaded += chunk.length;
          if (totalSize > 0) {
            const percent = Math.round((downloaded / totalSize) * 100);
            this.emit('download-progress', {
              percent,
              downloaded,
              total: totalSize,
              version: this.updateInfo.latest_version,
            });
          }
        });
        response.body.pipe(fileStream);
        response.body.on('error', reject);
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
      });

      this.downloadedPath = destPath;
      this.isDownloading = false;
      this.emit('download-complete', {
        version: this.updateInfo.latest_version,
        path: destPath,
      });
    } catch (err) {
      this.isDownloading = false;
      this.emit('update-error', { message: err.message });
    }
  }

  installNow() {
    if (!this.downloadedPath || !fs.existsSync(this.downloadedPath)) {
      this.emit('update-error', { message: 'No downloaded update found' });
      return;
    }

    // Launch the installer silently - it will replace the running app
    // /S = silent install, /CLOSEAPPLICATIONS = close running instances
    execFile(this.downloadedPath, ['/S', '/CLOSEAPPLICATIONS'], {
      detached: true,
      stdio: 'ignore',
    }).unref();

    // Quit the current app so the installer can replace it
    setTimeout(() => {
      const { app } = require('electron');
      app.quit();
    }, 1000);
  }

  openDownloadPage(shell) {
    if (this.updateInfo && this.updateInfo.download_url) {
      shell.openExternal(this.updateInfo.download_url);
    }
  }
}

module.exports = { AutoUpdater, CURRENT_VERSION };
