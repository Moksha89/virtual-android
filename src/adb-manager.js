const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs').promises;
const { existsSync, createWriteStream } = require('fs');
const { spawn, exec } = require('child_process');
const axios = require('axios');
const AdmZip = require('adm-zip');
const os = require('os');

class AdbManager extends EventEmitter {
  constructor(userDataPath) {
    super();
    this.userDataPath = userDataPath;
    this.toolsPath = path.join(userDataPath, 'tools');
    this.adbPath = null;
    this.platform = os.platform();
    this.arch = os.arch();
    
    // Platform-specific configurations
    this.platformConfig = {
      win32: {
        adbExecutable: 'adb.exe',
        downloadUrl: 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip',
        driverUrl: 'https://dl.google.com/android/repository/usb_driver_r13-windows.zip'
      },
      darwin: {
        adbExecutable: 'adb',
        downloadUrl: 'https://dl.google.com/android/repository/platform-tools-latest-darwin.zip',
        driverUrl: null // macOS doesn't need drivers
      },
      linux: {
        adbExecutable: 'adb',
        downloadUrl: 'https://dl.google.com/android/repository/platform-tools-latest-linux.zip',
        driverUrl: null // Linux doesn't need drivers
      }
    };
    
    this.config = this.platformConfig[this.platform] || this.platformConfig.linux;
    this.initializePaths();
  }
  
  async initializePaths() {
    // Ensure tools directory exists
    try {
      await fs.mkdir(this.toolsPath, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    // Set ADB path
    const platformToolsPath = path.join(this.toolsPath, 'platform-tools');
    this.adbPath = path.join(platformToolsPath, this.config.adbExecutable);
  }
  
  getAdbPath() {
    return this.adbPath;
  }
  
  async isInstalled() {
    if (!this.adbPath) {
      await this.initializePaths();
    }
    return existsSync(this.adbPath);
  }
  
  async getVersion() {
    if (!await this.isInstalled()) {
      return null;
    }
    
    return new Promise((resolve, reject) => {
      exec(`"${this.adbPath}" version`, (error, stdout, stderr) => {
        if (error) {
          resolve(null);
          return;
        }
        
        const match = stdout.match(/Android Debug Bridge version ([\d.]+)/);
        if (match) {
          resolve(match[1]);
        } else {
          resolve('unknown');
        }
      });
    });
  }
  
  async download(progressCallback) {
    const downloadUrl = this.config.downloadUrl;
    const zipPath = path.join(this.toolsPath, 'platform-tools.zip');
    
    this.emit('download-start', { type: 'adb' });
    
    try {
      // Download the zip file
      const response = await axios({
        method: 'get',
        url: downloadUrl,
        responseType: 'stream',
        onDownloadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          if (progressCallback) {
            progressCallback(progress);
          }
          this.emit('download-progress', { type: 'adb', progress });
        }
      });
      
      // Save to file
      const writer = createWriteStream(zipPath);
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      // Extract the zip
      this.emit('extracting', { type: 'adb' });
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(this.toolsPath, true);
      
      // Clean up zip file
      await fs.unlink(zipPath);
      
      // Make executable on Unix systems
      if (this.platform !== 'win32') {
        await fs.chmod(this.adbPath, 0o755);
        // Also make fastboot executable
        const fastbootPath = path.join(this.toolsPath, 'platform-tools', 'fastboot');
        if (existsSync(fastbootPath)) {
          await fs.chmod(fastbootPath, 0o755);
        }
      }
      
      this.emit('download-complete', { type: 'adb' });
      return true;
    } catch (error) {
      this.emit('download-error', { type: 'adb', error: error.message });
      throw error;
    }
  }
  
  async installUsbDrivers(progressCallback) {
    // Only needed on Windows
    if (this.platform !== 'win32') {
      return { success: true, message: 'USB drivers not needed on this platform' };
    }
    
    const driverUrl = this.config.driverUrl;
    const zipPath = path.join(this.toolsPath, 'usb_driver.zip');
    const driverPath = path.join(this.toolsPath, 'usb_driver');
    
    try {
      // Download driver package
      const response = await axios({
        method: 'get',
        url: driverUrl,
        responseType: 'stream',
        onDownloadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          if (progressCallback) {
            progressCallback(progress);
          }
        }
      });
      
      const writer = createWriteStream(zipPath);
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      
      // Extract
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(this.toolsPath, true);
      
      // Clean up
      await fs.unlink(zipPath);
      
      // Return path to driver for manual installation
      return {
        success: true,
        driverPath: driverPath,
        message: 'USB drivers downloaded. Please install manually via Device Manager.'
      };
    } catch (error) {
      throw error;
    }
  }
  
  async checkForUpdates() {
    // Check if there's a newer version available
    // For now, we'll just check if the current version is installed
    const installed = await this.isInstalled();
    if (!installed) {
      return { updateAvailable: true, message: 'ADB not installed' };
    }
    
    // In a real implementation, you would check against a version API
    return { updateAvailable: false, currentVersion: await this.getVersion() };
  }
  
  async startServer() {
    if (!await this.isInstalled()) {
      throw new Error('ADB is not installed');
    }
    
    return new Promise((resolve, reject) => {
      exec(`"${this.adbPath}" start-server`, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ success: true, output: stdout || stderr });
      });
    });
  }
  
  async stopServer() {
    if (!await this.isInstalled()) {
      throw new Error('ADB is not installed');
    }
    
    return new Promise((resolve, reject) => {
      exec(`"${this.adbPath}" kill-server`, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ success: true, output: stdout || stderr });
      });
    });
  }
  
  async getDevices() {
    if (!await this.isInstalled()) {
      return [];
    }
    
    return new Promise((resolve, reject) => {
      exec(`"${this.adbPath}" devices -l`, (error, stdout, stderr) => {
        if (error) {
          resolve([]);
          return;
        }
        
        const devices = [];
        const lines = stdout.split('\n').slice(1); // Skip header
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('*')) continue;
          
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            const serial = parts[0];
            const status = parts[1];
            
            // Parse additional info
            const info = {};
            for (let i = 2; i < parts.length; i++) {
              const [key, value] = parts[i].split(':');
              if (key && value) {
                info[key] = value;
              }
            }
            
            devices.push({
              serial,
              status,
              model: info.model || 'Unknown',
              device: info.device || 'Unknown',
              product: info.product || 'Unknown',
              transportId: info.transport_id || null
            });
          }
        }
        
        resolve(devices);
      });
    });
  }
  
  async executeCommand(serial, command) {
    if (!await this.isInstalled()) {
      throw new Error('ADB is not installed');
    }
    
    return new Promise((resolve, reject) => {
      const fullCommand = serial 
        ? `"${this.adbPath}" -s ${serial} ${command}`
        : `"${this.adbPath}" ${command}`;
      
      exec(fullCommand, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }
  
  async shell(serial, command) {
    return this.executeCommand(serial, `shell ${command}`);
  }
  
  async getDeviceProperty(serial, property) {
    try {
      const result = await this.shell(serial, `getprop ${property}`);
      return result.stdout.trim();
    } catch (error) {
      return null;
    }
  }
  
  async getDeviceDetails(serial) {
    const properties = [
      'ro.product.model',
      'ro.product.brand',
      'ro.product.manufacturer',
      'ro.build.version.release',
      'ro.build.version.sdk',
      'ro.serialno',
      'ro.product.device'
    ];
    
    const details = {};
    
    for (const prop of properties) {
      const value = await this.getDeviceProperty(serial, prop);
      const key = prop.split('.').pop();
      details[key] = value;
    }
    
    // Get screen resolution
    try {
      const wmSize = await this.shell(serial, 'wm size');
      const match = wmSize.stdout.match(/Physical size: (\d+x\d+)/);
      if (match) {
        details.screenSize = match[1];
      }
    } catch (error) {
      details.screenSize = 'Unknown';
    }
    
    // Get battery info
    try {
      const batteryInfo = await this.shell(serial, 'dumpsys battery');
      const levelMatch = batteryInfo.stdout.match(/level: (\d+)/);
      const statusMatch = batteryInfo.stdout.match(/status: (\d+)/);
      
      if (levelMatch) {
        details.batteryLevel = parseInt(levelMatch[1]);
      }
      if (statusMatch) {
        const statusCodes = { 1: 'Unknown', 2: 'Charging', 3: 'Discharging', 4: 'Not charging', 5: 'Full' };
        details.batteryStatus = statusCodes[statusMatch[1]] || 'Unknown';
      }
    } catch (error) {
      details.batteryLevel = null;
      details.batteryStatus = 'Unknown';
    }
    
    return details;
  }
  
  // Input methods
  async tap(serial, x, y) {
    return this.shell(serial, `input tap ${Math.round(x)} ${Math.round(y)}`);
  }
  
  async swipe(serial, x1, y1, x2, y2, duration = 300) {
    return this.shell(serial, `input swipe ${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2)} ${Math.round(y2)} ${duration}`);
  }
  
  async inputText(serial, text) {
    // Escape special characters for shell
    const escaped = text.replace(/(['"\\$`])/g, '\\$1').replace(/ /g, '%s');
    return this.shell(serial, `input text "${escaped}"`);
  }
  
  async keyEvent(serial, keyCode) {
    return this.shell(serial, `input keyevent ${keyCode}`);
  }
  
  // Common key events
  async pressBack(serial) {
    return this.keyEvent(serial, 4);
  }
  
  async pressHome(serial) {
    return this.keyEvent(serial, 3);
  }
  
  async pressRecent(serial) {
    return this.keyEvent(serial, 187);
  }
  
  async pressPower(serial) {
    return this.keyEvent(serial, 26);
  }
  
  async pressVolumeUp(serial) {
    return this.keyEvent(serial, 24);
  }
  
  async pressVolumeDown(serial) {
    return this.keyEvent(serial, 25);
  }
  
  // Get current foreground app
  async getCurrentApp(serial) {
    try {
      const result = await this.shell(serial, 'dumpsys window | grep mCurrentFocus');
      const match = result.stdout.match(/mCurrentFocus=Window\{[^}]+ ([^\s/]+)/);
      if (match) {
        return match[1];
      }
      return null;
    } catch (error) {
      return null;
    }
  }
  
  // Screenshot
  async takeScreenshot(serial, outputPath) {
    const tempPath = '/sdcard/screenshot.png';
    await this.shell(serial, `screencap -p ${tempPath}`);
    await this.executeCommand(serial, `pull ${tempPath} "${outputPath}"`);
    await this.shell(serial, `rm ${tempPath}`);
    return outputPath;
  }
}

module.exports = AdbManager;
