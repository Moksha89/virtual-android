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

  // Auto-update
  getVersion: () => ipcRenderer.invoke('get-version'),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  openUpdateDownload: () => ipcRenderer.invoke('open-update-download'),

  // Screen streaming
  getStreamStatus: () => ipcRenderer.invoke('get-stream-status'),

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
  onStreamStatus: (callback) => {
    ipcRenderer.on('stream-status', (_, data) => callback(data));
  },
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_, data) => callback(data));
  },
  onUpdateDownloadProgress: (callback) => {
    ipcRenderer.on('update-download-progress', (_, data) => callback(data));
  },
  onUpdateDownloadComplete: (callback) => {
    ipcRenderer.on('update-download-complete', (_, data) => callback(data));
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (_, data) => callback(data));
  },
});
