const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // ADB
  checkAdb: () => ipcRenderer.invoke('check-adb'),
  downloadAdb: () => ipcRenderer.invoke('download-adb'),

  // Devices
  getDevices: () => ipcRenderer.invoke('get-devices'),
  rebootDevice: (serial) => ipcRenderer.invoke('reboot-device', serial),
  screenshotDevice: (serial) => ipcRenderer.invoke('screenshot-device', serial),
  restartAdb: () => ipcRenderer.invoke('restart-adb'),

  // Status
  getStatus: () => ipcRenderer.invoke('get-status'),
  openWebDashboard: () => ipcRenderer.invoke('open-web-dashboard'),

  // Events from main process
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (_, data) => callback(data));
  },
  onDevicesUpdate: (callback) => {
    ipcRenderer.on('devices-update', (_, data) => callback(data));
  },
  onHeartbeatResult: (callback) => {
    ipcRenderer.on('heartbeat-result', (_, data) => callback(data));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (_, data) => callback(data));
  },
  onError: (callback) => {
    ipcRenderer.on('error', (_, data) => callback(data));
  },
});
