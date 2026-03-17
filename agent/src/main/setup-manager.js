const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const http = require('http');

const execAsync = promisify(exec);

const ADB_DOWNLOAD_URL = 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip';

class SetupManager {
  constructor(userDataPath) {
    this.userDataPath = userDataPath;
    this.platformToolsDir = path.join(userDataPath, 'platform-tools');
    this.adbPath = null;
  }

  async checkAdb() {
    // 1. Check bundled platform-tools in resources (packaged app)
    const resourcePath = path.join(process.resourcesPath || '', 'platform-tools', 'adb.exe');
    if (fs.existsSync(resourcePath)) {
      this.adbPath = resourcePath;
      return { available: true, path: resourcePath, source: 'bundled' };
    }

    // 2. Check user data directory (downloaded)
    const userDataAdb = path.join(this.platformToolsDir, 'adb.exe');
    if (fs.existsSync(userDataAdb)) {
      this.adbPath = userDataAdb;
      return { available: true, path: userDataAdb, source: 'downloaded' };
    }

    // 3. Check if adb is in system PATH
    try {
      const { stdout } = await execAsync('where adb');
      const systemAdb = stdout.trim().split('\n')[0].trim();
      if (systemAdb && fs.existsSync(systemAdb)) {
        this.adbPath = systemAdb;
        return { available: true, path: systemAdb, source: 'system' };
      }
    } catch { /* not in PATH */ }

    // 4. Check common install locations
    const commonPaths = [
      'C:\\platform-tools\\adb.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
      path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
      'C:\\Android\\platform-tools\\adb.exe',
      'C:\\adb\\adb.exe',
    ];

    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        this.adbPath = p;
        return { available: true, path: p, source: 'common' };
      }
    }

    // Also check for Linux/Mac adb (for development)
    try {
      const { stdout } = await execAsync('which adb 2>/dev/null || echo ""');
      const linuxAdb = stdout.trim();
      if (linuxAdb && fs.existsSync(linuxAdb)) {
        this.adbPath = linuxAdb;
        return { available: true, path: linuxAdb, source: 'system' };
      }
    } catch { /* not available */ }

    return { available: false, path: null, source: null };
  }

  getAdbPath() {
    return this.adbPath || 'adb';
  }

  async downloadAdb(progressCallback) {
    return new Promise((resolve, reject) => {
      progressCallback({ stage: 'downloading', percent: 0, message: 'Starting download...' });

      const zipPath = path.join(this.userDataPath, 'platform-tools.zip');

      // Ensure directory exists
      if (!fs.existsSync(this.userDataPath)) {
        fs.mkdirSync(this.userDataPath, { recursive: true });
      }

      const file = fs.createWriteStream(zipPath);
      const request = https.get(ADB_DOWNLOAD_URL, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          const proto = redirectUrl.startsWith('https') ? https : http;
          proto.get(redirectUrl, (redirectResponse) => {
            this._handleDownloadResponse(redirectResponse, file, zipPath, progressCallback, resolve, reject);
          }).on('error', reject);
          return;
        }
        this._handleDownloadResponse(response, file, zipPath, progressCallback, resolve, reject);
      });

      request.on('error', (err) => {
        fs.unlinkSync(zipPath).catch(() => {});
        reject(new Error(`Download failed: ${err.message}`));
      });
    });
  }

  _handleDownloadResponse(response, file, zipPath, progressCallback, resolve, reject) {
    const totalSize = parseInt(response.headers['content-length'] || '0', 10);
    let downloadedSize = 0;

    response.on('data', (chunk) => {
      downloadedSize += chunk.length;
      const percent = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;
      progressCallback({
        stage: 'downloading',
        percent,
        message: `Downloading ADB... ${percent}%`,
        downloaded: downloadedSize,
        total: totalSize,
      });
    });

    response.pipe(file);

    file.on('finish', async () => {
      file.close();
      try {
        progressCallback({ stage: 'extracting', percent: 0, message: 'Extracting files...' });
        await this._extractZip(zipPath);
        progressCallback({ stage: 'complete', percent: 100, message: 'ADB installed successfully!' });

        // Clean up zip
        try { fs.unlinkSync(zipPath); } catch { /* ignore */ }

        // Verify
        const result = await this.checkAdb();
        resolve(result);
      } catch (err) {
        reject(new Error(`Extraction failed: ${err.message}`));
      }
    });
  }

  async _extractZip(zipPath) {
    // Use PowerShell to extract on Windows
    if (process.platform === 'win32') {
      await execAsync(
        `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${this.userDataPath}' -Force"`
      );
    } else {
      // Linux/Mac fallback
      await execAsync(`unzip -o "${zipPath}" -d "${this.userDataPath}"`);
    }
  }
}

module.exports = { SetupManager };
