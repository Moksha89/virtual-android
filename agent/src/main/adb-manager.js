const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execAsync = promisify(exec);

class AdbManager {
  constructor(adbPath) {
    this.adbPath = adbPath || 'adb';
    this.lastDeviceCount = 0;
    this.deviceCache = [];
  }

  async isAvailable() {
    try {
      await execAsync(`"${this.adbPath}" version`);
      return true;
    } catch {
      return false;
    }
  }

  async getConnectedDevices() {
    try {
      const { stdout } = await execAsync(`"${this.adbPath}" devices`);
      const lines = stdout.trim().split('\n').slice(1);
      return lines
        .filter((line) => line.includes('\tdevice'))
        .map((line) => line.split('\t')[0].trim());
    } catch {
      return [];
    }
  }

  async getDeviceInfo(serial) {
    const info = {
      serial,
      model: null,
      manufacturer: null,
      androidVersion: null,
      sdkVersion: null,
      batteryLevel: null,
      batteryStatus: null,
      screenResolution: null,
      ipAddress: null,
      status: 'online',
    };

    try {
      info.model = await this.getProp(serial, 'ro.product.model');
      info.manufacturer = await this.getProp(serial, 'ro.product.manufacturer');
      info.androidVersion = await this.getProp(serial, 'ro.build.version.release');
      info.sdkVersion = await this.getProp(serial, 'ro.build.version.sdk');

      // Battery info
      try {
        const { stdout: batteryOutput } = await execAsync(
          `"${this.adbPath}" -s ${serial} shell dumpsys battery`
        );
        const levelMatch = batteryOutput.match(/level:\s*(\d+)/);
        if (levelMatch) info.batteryLevel = parseInt(levelMatch[1], 10);

        const statusMatch = batteryOutput.match(/status:\s*(\d+)/);
        if (statusMatch) {
          const statusMap = {
            '1': 'Unknown', '2': 'Charging', '3': 'Discharging',
            '4': 'Not charging', '5': 'Full',
          };
          info.batteryStatus = statusMap[statusMatch[1]] || 'Unknown';
        }
      } catch { /* Battery info not available */ }

      // Screen resolution
      try {
        const { stdout: wmOutput } = await execAsync(
          `"${this.adbPath}" -s ${serial} shell wm size`
        );
        const sizeMatch = wmOutput.match(/(\d+x\d+)/);
        if (sizeMatch) info.screenResolution = sizeMatch[1];
      } catch { /* Screen info not available */ }

      // IP address
      try {
        const { stdout: ipOutput } = await execAsync(
          `"${this.adbPath}" -s ${serial} shell "ip route | head -1"`
        );
        const ipMatch = ipOutput.match(/src\s+([\d.]+)/);
        if (ipMatch) info.ipAddress = ipMatch[1];
      } catch { /* IP info not available */ }
    } catch { /* Device info partially available */ }

    return info;
  }

  async getDevicesWithInfo() {
    const serials = await this.getConnectedDevices();
    this.lastDeviceCount = serials.length;
    const devices = await Promise.all(
      serials.map((serial) => this.getDeviceInfo(serial))
    );
    this.deviceCache = devices;
    return devices;
  }

  async getProp(serial, prop) {
    try {
      const { stdout } = await execAsync(
        `"${this.adbPath}" -s ${serial} shell getprop ${prop}`
      );
      const value = stdout.trim();
      return value || null;
    } catch {
      return null;
    }
  }

  async reboot(serial) {
    await execAsync(`"${this.adbPath}" -s ${serial} reboot`);
    return { success: true };
  }

  async installApk(serial, apkPath) {
    const { stdout } = await execAsync(
      `"${this.adbPath}" -s ${serial} install -r "${apkPath}"`
    );
    return { success: true, output: stdout };
  }

  async screenshot(serial) {
    const tmpPath = `/sdcard/screenshot_${Date.now()}.png`;
    await execAsync(`"${this.adbPath}" -s ${serial} shell screencap -p ${tmpPath}`);
    const localPath = path.join(require('os').tmpdir(), `screenshot_${serial}_${Date.now()}.png`);
    await execAsync(`"${this.adbPath}" -s ${serial} pull ${tmpPath} "${localPath}"`);
    await execAsync(`"${this.adbPath}" -s ${serial} shell rm ${tmpPath}`);

    const data = fs.readFileSync(localPath);
    fs.unlinkSync(localPath);
    return { success: true, data: data.toString('base64') };
  }

  async shell(serial, command) {
    const { stdout } = await execAsync(
      `"${this.adbPath}" -s ${serial} shell ${command}`
    );
    return stdout.trim();
  }

  async restartAdb() {
    try {
      await execAsync(`"${this.adbPath}" kill-server`);
      await new Promise((r) => setTimeout(r, 1000));
      await execAsync(`"${this.adbPath}" start-server`);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = { AdbManager };
