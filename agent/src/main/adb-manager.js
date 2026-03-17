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

  async tap(serial, x, y) {
    await execAsync(`"${this.adbPath}" -s ${serial} shell input tap ${Math.round(x)} ${Math.round(y)}`);
    return { success: true };
  }

  async swipe(serial, x1, y1, x2, y2, duration = 300) {
    await execAsync(
      `"${this.adbPath}" -s ${serial} shell input swipe ${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2)} ${Math.round(y2)} ${duration}`
    );
    return { success: true };
  }

  async keyevent(serial, keycode) {
    await execAsync(`"${this.adbPath}" -s ${serial} shell input keyevent ${keycode}`);
    return { success: true };
  }

  async inputText(serial, text) {
    // Escape special characters for shell
    const escaped = text.replace(/(["'`\\$!&|;()<> ])/g, '\\$1');
    await execAsync(`"${this.adbPath}" -s ${serial} shell input text "${escaped}"`);
    return { success: true };
  }

  async screencapRaw(serial) {
    // Return raw PNG buffer from screencap
    const { stdout } = await execAsync(
      `"${this.adbPath}" -s ${serial} exec-out screencap -p`,
      { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 }
    );
    return stdout;
  }

  async screencapOptimized(serial) {
    // Capture screen via exec-out (faster than shell + pull)
    // PNG format from screencap is already well-compressed for screen content
    try {
      const { stdout } = await execAsync(
        `"${this.adbPath}" -s ${serial} exec-out screencap -p`,
        { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 }
      );
      return stdout;
    } catch (err) {
      return await this.screencapRaw(serial);
    }
  }

  async wakeScreen(serial) {
    // Wake up the screen (KEYCODE_WAKEUP = 224)
    await execAsync(`"${this.adbPath}" -s ${serial} shell input keyevent 224`);
    return { success: true };
  }

  async sleepScreen(serial) {
    // Put screen to sleep (KEYCODE_SLEEP = 223)
    await execAsync(`"${this.adbPath}" -s ${serial} shell input keyevent 223`);
    return { success: true };
  }

  async unlockPin(serial, pin) {
    // Wake screen, swipe up, enter PIN, press Enter
    await this.wakeScreen(serial);
    await new Promise(r => setTimeout(r, 500));
    // Swipe up to show PIN entry
    await this.swipe(serial, 540, 1800, 540, 800, 300);
    await new Promise(r => setTimeout(r, 500));
    // Type the PIN
    const escaped = pin.replace(/(["'`\\$!&|;()<> ])/g, '\\$1');
    await execAsync(`"${this.adbPath}" -s ${serial} shell input text "${escaped}"`);
    await new Promise(r => setTimeout(r, 200));
    // Press Enter to confirm
    await execAsync(`"${this.adbPath}" -s ${serial} shell input keyevent 66`);
    return { success: true };
  }

  async unlockPattern(serial, pattern) {
    // Pattern is an array of points [{x, y}] representing the pattern dots
    // We chain them into a single swipe command
    if (!pattern || pattern.length < 2) return { success: false, error: 'Pattern too short' };
    await this.wakeScreen(serial);
    await new Promise(r => setTimeout(r, 500));
    // Swipe up to show pattern entry
    await this.swipe(serial, 540, 1800, 540, 800, 300);
    await new Promise(r => setTimeout(r, 500));
    // Execute the pattern as a series of swipes between consecutive points
    for (let i = 0; i < pattern.length - 1; i++) {
      await this.swipe(serial, pattern[i].x, pattern[i].y, pattern[i + 1].x, pattern[i + 1].y, 100);
      await new Promise(r => setTimeout(r, 50));
    }
    return { success: true };
  }

  async swipeGesture(serial, direction) {
    // Predefined swipe gestures based on a 1080x2400 screen
    const gestures = {
      up: [540, 1800, 540, 600, 300],       // Swipe up (unlock, app drawer)
      down: [540, 100, 540, 1200, 300],       // Swipe down (notification shade)
      left: [900, 1200, 180, 1200, 300],      // Swipe left
      right: [180, 1200, 900, 1200, 300],     // Swipe right
      down_quick: [540, 100, 540, 600, 150],  // Quick settings (fast swipe down)
    };
    const coords = gestures[direction];
    if (!coords) return { success: false, error: 'Unknown gesture direction' };
    await this.swipe(serial, ...coords);
    return { success: true };
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
