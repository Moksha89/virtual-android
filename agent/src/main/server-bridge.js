const EventEmitter = require('events');
const fetch = require('node-fetch');

class ServerBridge extends EventEmitter {
  constructor(serverUrl, apiKey, adbManager, heartbeatInterval) {
    super();
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.adbManager = adbManager;
    this.heartbeatInterval = heartbeatInterval || 10000;
    this.heartbeatTimer = null;
    this.isConnected = false;
    this.lastHeartbeatTime = null;
    this.consecutiveFailures = 0;
    this.maxFailures = 5;
  }

  start() {
    this.emit('status', { connected: false, message: 'Starting...', deviceCount: 0 });
    this.sendHeartbeat();
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.heartbeatInterval);
  }

  stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.isConnected = false;
    this.emit('status', { connected: false, message: 'Stopped', deviceCount: 0 });
  }

  async sendHeartbeat() {
    try {
      const devices = await this.adbManager.getDevicesWithInfo();
      const deviceReports = devices.map((d) => ({
        serial: d.serial,
        model: d.model,
        manufacturer: d.manufacturer,
        android_version: d.androidVersion,
        sdk_version: d.sdkVersion,
        battery_level: d.batteryLevel,
        battery_status: d.batteryStatus,
        screen_resolution: d.screenResolution,
        ip_address: d.ipAddress,
        status: 'online',
      }));

      const systemInfo = {
        uptime: process.uptime(),
        platform: process.platform,
        hostname: require('os').hostname(),
        node_version: process.version,
      };

      const response = await fetch(`${this.serverUrl}/api/agents/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({ devices: deviceReports, system: systemInfo }),
        timeout: 15000,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server returned ${response.status}: ${text}`);
      }

      const result = await response.json();
      this.isConnected = true;
      this.lastHeartbeatTime = new Date().toISOString();
      this.consecutiveFailures = 0;

      this.emit('status', {
        connected: true,
        message: 'Connected',
        deviceCount: devices.length,
      });
      this.emit('devices', devices);
      this.emit('heartbeat', {
        success: true,
        deviceCount: devices.length,
        time: this.lastHeartbeatTime,
      });

      // Check for pending commands
      if (result.commands && result.commands.length > 0) {
        await this.executeCommands(result.commands);
      }
    } catch (err) {
      this.consecutiveFailures++;
      this.isConnected = false;

      const message = this.consecutiveFailures >= this.maxFailures
        ? `Disconnected (${this.consecutiveFailures} failures)`
        : `Connection error: ${err.message}`;

      this.emit('status', {
        connected: false,
        message,
        deviceCount: this.adbManager.lastDeviceCount,
      });
      this.emit('heartbeat', {
        success: false,
        error: err.message,
        time: new Date().toISOString(),
      });
      this.emit('error', err);
    }
  }

  async executeCommands(commands) {
    for (const cmd of commands) {
      try {
        let result;
        switch (cmd.type) {
          case 'reboot':
            result = await this.adbManager.reboot(cmd.serial);
            break;
          case 'install_apk':
            result = await this.adbManager.installApk(cmd.serial, cmd.payload.path);
            break;
          case 'shell':
            result = await this.adbManager.shell(cmd.serial, cmd.payload.command);
            break;
          case 'screenshot':
            result = await this.adbManager.screenshot(cmd.serial);
            break;
          case 'restart_adb':
            result = await this.adbManager.restartAdb();
            break;
          default:
            result = { error: `Unknown command: ${cmd.type}` };
        }

        // Report command result back to server
        await fetch(`${this.serverUrl}/api/agents/command-result`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
          },
          body: JSON.stringify({
            command_id: cmd.id,
            result,
          }),
        }).catch(() => {});
      } catch (err) {
        console.error(`Command execution failed: ${cmd.type}`, err);
      }
    }
  }
}

module.exports = { ServerBridge };
