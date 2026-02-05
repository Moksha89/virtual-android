const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;
const { existsSync, createWriteStream } = require('fs');
const { spawn, exec } = require('child_process');
const axios = require('axios');
const AdmZip = require('adm-zip');
const os = require('os');

class ScrcpyManager extends EventEmitter {
  constructor(userDataPath) {
    super();
    this.userDataPath = userDataPath;
    this.toolsPath = path.join(userDataPath, 'tools');
    this.scrcpyPath = null;
    this.platform = os.platform();
    this.processes = new Map(); // serial -> process
    
    // Latest scrcpy version
    this.latestVersion = '2.4';
    
    // Platform-specific configurations
    this.platformConfig = {
      win32: {
        scrcpyExecutable: 'scrcpy.exe',
        downloadUrl: `https://github.com/Genymobile/scrcpy/releases/download/v${this.latestVersion}/scrcpy-win64-v${this.latestVersion}.zip`,
        extractFolder: `scrcpy-win64-v${this.latestVersion}`
      },
      darwin: {
        scrcpyExecutable: 'scrcpy',
        // macOS users typically install via Homebrew
        downloadUrl: null,
        extractFolder: null
      },
      linux: {
        scrcpyExecutable: 'scrcpy',
        downloadUrl: `https://github.com/Genymobile/scrcpy/releases/download/v${this.latestVersion}/scrcpy-linux-v${this.latestVersion}.tar.gz`,
        extractFolder: `scrcpy-linux-v${this.latestVersion}`
      }
    };
    
    this.config = this.platformConfig[this.platform] || this.platformConfig.linux;
    this.initializePaths();
  }
  
  async initializePaths() {
    try {
      await fs.mkdir(this.toolsPath, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    // Set scrcpy path
    const scrcpyFolder = path.join(this.toolsPath, 'scrcpy');
    this.scrcpyPath = path.join(scrcpyFolder, this.config.scrcpyExecutable);
  }
  
  getScrcpyPath() {
    return this.scrcpyPath;
  }
  
  async isInstalled() {
    if (!this.scrcpyPath) {
      await this.initializePaths();
    }
    
    // Check bundled scrcpy
    if (existsSync(this.scrcpyPath)) {
      return true;
    }
    
    // Check system scrcpy
    return new Promise((resolve) => {
      exec('scrcpy --version', (error) => {
        if (!error) {
          this.scrcpyPath = 'scrcpy'; // Use system scrcpy
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }
  
  async getVersion() {
    if (!await this.isInstalled()) {
      return null;
    }
    
    return new Promise((resolve) => {
      exec(`"${this.scrcpyPath}" --version`, (error, stdout, stderr) => {
        if (error) {
          resolve(null);
          return;
        }
        
        const output = stdout || stderr;
        const match = output.match(/scrcpy ([\d.]+)/);
        if (match) {
          resolve(match[1]);
        } else {
          resolve('unknown');
        }
      });
    });
  }
  
  async download(progressCallback) {
    if (this.platform === 'darwin') {
      throw new Error('Please install scrcpy via Homebrew: brew install scrcpy');
    }
    
    const downloadUrl = this.config.downloadUrl;
    const isZip = downloadUrl.endsWith('.zip');
    const archivePath = path.join(this.toolsPath, isZip ? 'scrcpy.zip' : 'scrcpy.tar.gz');
    
    this.emit('download-start', { type: 'scrcpy' });
    
    try {
      // Download the archive
      const response = await axios({
        method: 'get',
        url: downloadUrl,
        responseType: 'stream',
        onDownloadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          if (progressCallback) {
            progressCallback(progress);
          }
          this.emit('download-progress', { type: 'scrcpy', progress });
        }
      });
      
      const writer = createWriteStream(archivePath);
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      // Extract
      this.emit('extracting', { type: 'scrcpy' });
      
      if (isZip) {
        const zip = new AdmZip(archivePath);
        zip.extractAllTo(this.toolsPath, true);
        
        // Rename extracted folder to 'scrcpy'
        const extractedPath = path.join(this.toolsPath, this.config.extractFolder);
        const targetPath = path.join(this.toolsPath, 'scrcpy');
        
        // Remove existing scrcpy folder if exists
        if (existsSync(targetPath)) {
          await fs.rm(targetPath, { recursive: true });
        }
        
        await fs.rename(extractedPath, targetPath);
      } else {
        // For tar.gz on Linux
        const tar = require('tar');
        await tar.extract({
          file: archivePath,
          cwd: this.toolsPath
        });
        
        const extractedPath = path.join(this.toolsPath, this.config.extractFolder);
        const targetPath = path.join(this.toolsPath, 'scrcpy');
        
        if (existsSync(targetPath)) {
          await fs.rm(targetPath, { recursive: true });
        }
        
        await fs.rename(extractedPath, targetPath);
      }
      
      // Clean up archive
      await fs.unlink(archivePath);
      
      // Make executable on Unix
      if (this.platform !== 'win32') {
        await fs.chmod(this.scrcpyPath, 0o755);
      }
      
      this.emit('download-complete', { type: 'scrcpy' });
      return true;
    } catch (error) {
      this.emit('download-error', { type: 'scrcpy', error: error.message });
      throw error;
    }
  }
  
  async checkForUpdates() {
    const installed = await this.isInstalled();
    if (!installed) {
      return { updateAvailable: true, message: 'scrcpy not installed' };
    }
    
    const currentVersion = await this.getVersion();
    const updateAvailable = currentVersion !== this.latestVersion;
    
    return {
      updateAvailable,
      currentVersion,
      latestVersion: this.latestVersion
    };
  }
  
  async startStream(serial, adbPath, options = {}) {
    if (!await this.isInstalled()) {
      throw new Error('scrcpy is not installed');
    }
    
    // Default options
    const defaultOptions = {
      maxSize: 1280,
      bitRate: 4000000,
      maxFps: 30,
      turnScreenOff: false,
      stayAwake: true,
      showTouches: false,
      fullscreen: false,
      borderless: true,
      alwaysOnTop: false,
      noControl: false,
      noDisplay: false,
      recordFormat: null,
      recordFile: null,
      crop: null,
      rotation: null,
      encoder: null,
      displayId: null,
      windowTitle: null,
      windowX: null,
      windowY: null,
      windowWidth: null,
      windowHeight: null,
      pushTarget: null,
      renderDriver: null,
      noMipmaps: false,
      codecOptions: null,
      forceAdbForward: false,
      disableScreensaver: true,
      shortcutMod: null,
      verbosity: 'warn'
    };
    
    const opts = { ...defaultOptions, ...options };
    
    // Build command arguments
    const args = [
      '--serial', serial
    ];
    
    // Add ADB path if provided
    if (adbPath) {
      args.push('--adb', adbPath);
    }
    
    // Video options
    if (opts.maxSize) args.push('--max-size', opts.maxSize.toString());
    if (opts.bitRate) args.push('--bit-rate', opts.bitRate.toString());
    if (opts.maxFps) args.push('--max-fps', opts.maxFps.toString());
    
    // Display options
    if (opts.turnScreenOff) args.push('--turn-screen-off');
    if (opts.stayAwake) args.push('--stay-awake');
    if (opts.showTouches) args.push('--show-touches');
    if (opts.fullscreen) args.push('--fullscreen');
    if (opts.borderless) args.push('--window-borderless');
    if (opts.alwaysOnTop) args.push('--always-on-top');
    if (opts.noControl) args.push('--no-control');
    if (opts.noDisplay) args.push('--no-display');
    if (opts.disableScreensaver) args.push('--disable-screensaver');
    
    // Recording
    if (opts.recordFile) {
      args.push('--record', opts.recordFile);
      if (opts.recordFormat) {
        args.push('--record-format', opts.recordFormat);
      }
    }
    
    // Crop
    if (opts.crop) {
      args.push('--crop', opts.crop);
    }
    
    // Rotation (0, 1, 2, 3 for 0°, 90°, 180°, 270°)
    if (opts.rotation !== null) {
      args.push('--rotation', opts.rotation.toString());
    }
    
    // Encoder
    if (opts.encoder) {
      args.push('--encoder', opts.encoder);
    }
    
    // Display ID (for multi-display devices)
    if (opts.displayId !== null) {
      args.push('--display', opts.displayId.toString());
    }
    
    // Window options
    if (opts.windowTitle) args.push('--window-title', opts.windowTitle);
    if (opts.windowX !== null) args.push('--window-x', opts.windowX.toString());
    if (opts.windowY !== null) args.push('--window-y', opts.windowY.toString());
    if (opts.windowWidth !== null) args.push('--window-width', opts.windowWidth.toString());
    if (opts.windowHeight !== null) args.push('--window-height', opts.windowHeight.toString());
    
    // Verbosity
    if (opts.verbosity) {
      args.push('--verbosity', opts.verbosity);
    }
    
    // Start scrcpy process
    const scrcpyProcess = spawn(this.scrcpyPath, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Store process reference
    this.processes.set(serial, scrcpyProcess);
    
    // Handle process events
    scrcpyProcess.stdout.on('data', (data) => {
      this.emit('stream-output', { serial, data: data.toString() });
    });
    
    scrcpyProcess.stderr.on('data', (data) => {
      const message = data.toString();
      this.emit('stream-error', { serial, error: message });
      
      // Check for common errors
      if (message.includes('Could not find any ADB device')) {
        this.emit('device-not-found', { serial });
      } else if (message.includes('Device is unauthorized')) {
        this.emit('device-unauthorized', { serial });
      }
    });
    
    scrcpyProcess.on('close', (code) => {
      this.processes.delete(serial);
      this.emit('stream-closed', { serial, code });
    });
    
    scrcpyProcess.on('error', (error) => {
      this.processes.delete(serial);
      this.emit('stream-error', { serial, error: error.message });
    });
    
    return {
      process: scrcpyProcess,
      serial,
      options: opts
    };
  }
  
  async stopStream(serial) {
    const process = this.processes.get(serial);
    if (process) {
      process.kill('SIGTERM');
      this.processes.delete(serial);
      return true;
    }
    return false;
  }
  
  async stopAllStreams() {
    for (const [serial, process] of this.processes) {
      process.kill('SIGTERM');
    }
    this.processes.clear();
  }
  
  isStreaming(serial) {
    return this.processes.has(serial);
  }
  
  getActiveStreams() {
    return Array.from(this.processes.keys());
  }
  
  // Get available encoders for a device
  async getEncoders(serial, adbPath) {
    return new Promise((resolve) => {
      const args = ['--serial', serial, '--list-encoders'];
      if (adbPath) {
        args.push('--adb', adbPath);
      }
      
      exec(`"${this.scrcpyPath}" ${args.join(' ')}`, (error, stdout, stderr) => {
        if (error) {
          resolve([]);
          return;
        }
        
        const encoders = [];
        const lines = (stdout + stderr).split('\n');
        
        for (const line of lines) {
          const match = line.match(/--encoder\s+'([^']+)'/);
          if (match) {
            encoders.push(match[1]);
          }
        }
        
        resolve(encoders);
      });
    });
  }
  
  // Get available displays for a device
  async getDisplays(serial, adbPath) {
    return new Promise((resolve) => {
      const args = ['--serial', serial, '--list-displays'];
      if (adbPath) {
        args.push('--adb', adbPath);
      }
      
      exec(`"${this.scrcpyPath}" ${args.join(' ')}`, (error, stdout, stderr) => {
        if (error) {
          resolve([{ id: 0, name: 'Default' }]);
          return;
        }
        
        const displays = [];
        const lines = (stdout + stderr).split('\n');
        
        for (const line of lines) {
          const match = line.match(/--display\s+(\d+)/);
          if (match) {
            displays.push({
              id: parseInt(match[1]),
              name: `Display ${match[1]}`
            });
          }
        }
        
        if (displays.length === 0) {
          displays.push({ id: 0, name: 'Default' });
        }
        
        resolve(displays);
      });
    });
  }
}

module.exports = ScrcpyManager;
