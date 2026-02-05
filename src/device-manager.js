const { EventEmitter } = require('events');

class DeviceManager extends EventEmitter {
  constructor(adbManager) {
    super();
    this.adbManager = adbManager;
    this.devices = new Map(); // serial -> device info
    this.monitorInterval = null;
    this.pollInterval = 2000; // Poll every 2 seconds
  }
  
  async startMonitoring() {
    // Initial device scan
    await this.refreshDevices();
    
    // Start polling for device changes
    this.monitorInterval = setInterval(async () => {
      await this.refreshDevices();
    }, this.pollInterval);
    
    this.emit('monitoring-started');
  }
  
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.emit('monitoring-stopped');
  }
  
  async refreshDevices() {
    try {
      const adbDevices = await this.adbManager.getDevices();
      const currentSerials = new Set(adbDevices.map(d => d.serial));
      const previousSerials = new Set(this.devices.keys());
      
      // Check for new devices
      for (const device of adbDevices) {
        if (!previousSerials.has(device.serial)) {
          // New device connected
          const deviceInfo = await this.buildDeviceInfo(device);
          this.devices.set(device.serial, deviceInfo);
          this.emit('device-connected', deviceInfo);
        } else {
          // Update existing device status
          const existingDevice = this.devices.get(device.serial);
          if (existingDevice.status !== device.status) {
            existingDevice.status = device.status;
            this.emit('device-status-changed', existingDevice);
          }
        }
      }
      
      // Check for disconnected devices
      for (const serial of previousSerials) {
        if (!currentSerials.has(serial)) {
          const device = this.devices.get(serial);
          this.devices.delete(serial);
          this.emit('device-disconnected', device);
        }
      }
      
      // Emit devices changed event
      this.emit('devices-changed', this.getDevices());
      
    } catch (error) {
      this.emit('error', error);
    }
  }
  
  async buildDeviceInfo(basicDevice) {
    const deviceInfo = {
      serial: basicDevice.serial,
      status: basicDevice.status,
      model: basicDevice.model,
      device: basicDevice.device,
      product: basicDevice.product,
      transportId: basicDevice.transportId,
      details: null,
      lastSeen: new Date().toISOString(),
      isLocked: false,
      activeSession: null
    };
    
    // Get detailed info if device is authorized
    if (basicDevice.status === 'device') {
      try {
        deviceInfo.details = await this.adbManager.getDeviceDetails(basicDevice.serial);
      } catch (error) {
        // Device might have disconnected
        deviceInfo.details = null;
      }
    }
    
    return deviceInfo;
  }
  
  getDevices() {
    return Array.from(this.devices.values());
  }
  
  getDevice(serial) {
    return this.devices.get(serial);
  }
  
  async getDeviceInfo(serial) {
    const device = this.devices.get(serial);
    if (!device) {
      return null;
    }
    
    // Refresh details
    if (device.status === 'device') {
      try {
        device.details = await this.adbManager.getDeviceDetails(serial);
        device.lastSeen = new Date().toISOString();
      } catch (error) {
        // Device might have issues
      }
    }
    
    return device;
  }
  
  lockDevice(serial) {
    const device = this.devices.get(serial);
    if (device) {
      device.isLocked = true;
      this.emit('device-locked', device);
      return true;
    }
    return false;
  }
  
  unlockDevice(serial) {
    const device = this.devices.get(serial);
    if (device) {
      device.isLocked = false;
      device.activeSession = null;
      this.emit('device-unlocked', device);
      return true;
    }
    return false;
  }
  
  setActiveSession(serial, sessionId) {
    const device = this.devices.get(serial);
    if (device) {
      device.activeSession = sessionId;
      device.isLocked = true;
      return true;
    }
    return false;
  }
  
  clearActiveSession(serial) {
    const device = this.devices.get(serial);
    if (device) {
      device.activeSession = null;
      device.isLocked = false;
      return true;
    }
    return false;
  }
  
  isDeviceAvailable(serial) {
    const device = this.devices.get(serial);
    if (!device) return false;
    return device.status === 'device' && !device.isLocked;
  }
  
  isDeviceConnected(serial) {
    return this.devices.has(serial);
  }
  
  getDeviceCount() {
    return this.devices.size;
  }
  
  getAvailableDevices() {
    return this.getDevices().filter(d => d.status === 'device' && !d.isLocked);
  }
  
  getUnauthorizedDevices() {
    return this.getDevices().filter(d => d.status === 'unauthorized');
  }
  
  getOfflineDevices() {
    return this.getDevices().filter(d => d.status === 'offline');
  }
}

module.exports = DeviceManager;
