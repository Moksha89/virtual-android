import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface DeviceInfo {
  model: string | null;
  manufacturer: string | null;
  androidVersion: string | null;
  sdkVersion: string | null;
  batteryLevel: number | null;
  batteryStatus: string | null;
  screenResolution: string | null;
  ipAddress: string | null;
}

export class AdbService {
  private adbPath: string;

  constructor(adbPath: string = 'adb') {
    this.adbPath = adbPath;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync(`${this.adbPath} version`);
      return true;
    } catch {
      return false;
    }
  }

  async getConnectedDevices(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`${this.adbPath} devices`);
      const lines = stdout.trim().split('\n').slice(1);
      return lines
        .filter((line) => line.includes('\tdevice'))
        .map((line) => line.split('\t')[0].trim());
    } catch {
      return [];
    }
  }

  async getDeviceInfo(serial: string): Promise<DeviceInfo> {
    const info: DeviceInfo = {
      model: null,
      manufacturer: null,
      androidVersion: null,
      sdkVersion: null,
      batteryLevel: null,
      batteryStatus: null,
      screenResolution: null,
      ipAddress: null,
    };

    try {
      info.model = await this.getProp(serial, 'ro.product.model');
      info.manufacturer = await this.getProp(serial, 'ro.product.manufacturer');
      info.androidVersion = await this.getProp(serial, 'ro.build.version.release');
      info.sdkVersion = await this.getProp(serial, 'ro.build.version.sdk');

      // Battery info
      try {
        const { stdout: batteryOutput } = await execAsync(
          `${this.adbPath} -s ${serial} shell dumpsys battery`
        );
        const levelMatch = batteryOutput.match(/level:\s*(\d+)/);
        if (levelMatch) info.batteryLevel = parseInt(levelMatch[1], 10);

        const statusMatch = batteryOutput.match(/status:\s*(\d+)/);
        if (statusMatch) {
          const statusMap: Record<string, string> = {
            '1': 'Unknown',
            '2': 'Charging',
            '3': 'Discharging',
            '4': 'Not charging',
            '5': 'Full',
          };
          info.batteryStatus = statusMap[statusMatch[1]] || 'Unknown';
        }
      } catch {
        // Battery info not available
      }

      // Screen resolution
      try {
        const { stdout: wmOutput } = await execAsync(
          `${this.adbPath} -s ${serial} shell wm size`
        );
        const sizeMatch = wmOutput.match(/(\d+x\d+)/);
        if (sizeMatch) info.screenResolution = sizeMatch[1];
      } catch {
        // Screen info not available
      }

      // IP address
      try {
        const { stdout: ipOutput } = await execAsync(
          `${this.adbPath} -s ${serial} shell ip route | head -1`
        );
        const ipMatch = ipOutput.match(/src\s+([\d.]+)/);
        if (ipMatch) info.ipAddress = ipMatch[1];
      } catch {
        // IP info not available
      }
    } catch {
      // Device info partially available
    }

    return info;
  }

  private async getProp(serial: string, prop: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync(`${this.adbPath} -s ${serial} shell getprop ${prop}`);
      const value = stdout.trim();
      return value || null;
    } catch {
      return null;
    }
  }

  async reboot(serial: string): Promise<void> {
    await execAsync(`${this.adbPath} -s ${serial} reboot`);
  }

  async installApk(serial: string, apkPath: string): Promise<void> {
    await execAsync(`${this.adbPath} -s ${serial} install -r "${apkPath}"`);
  }

  async shell(serial: string, command: string): Promise<string> {
    const { stdout } = await execAsync(`${this.adbPath} -s ${serial} shell ${command}`);
    return stdout.trim();
  }

  async inputText(serial: string, text: string): Promise<void> {
    const escaped = text.replace(/[\\'"&|;$`!#()\s]/g, (char) => `\\${char}`);
    await execAsync(`${this.adbPath} -s ${serial} shell input text "${escaped}"`);
  }

  async tap(serial: string, x: number, y: number): Promise<void> {
    await execAsync(`${this.adbPath} -s ${serial} shell input tap ${x} ${y}`);
  }

  async swipe(serial: string, x1: number, y1: number, x2: number, y2: number, durationMs: number = 300): Promise<void> {
    await execAsync(`${this.adbPath} -s ${serial} shell input swipe ${x1} ${y1} ${x2} ${y2} ${durationMs}`);
  }

  async screenshot(serial: string, outputPath: string): Promise<void> {
    await execAsync(`${this.adbPath} -s ${serial} shell screencap -p > "${outputPath}"`);
  }

  async restartAdb(): Promise<void> {
    await execAsync(`${this.adbPath} kill-server && ${this.adbPath} start-server`);
  }
}
