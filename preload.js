const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // System status
  getSystemStatus: () => ipcRenderer.invoke('get-system-status'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Installation
  installAdb: () => ipcRenderer.invoke('install-adb'),
  installScrcpy: () => ipcRenderer.invoke('install-scrcpy'),
  installUsbDrivers: () => ipcRenderer.invoke('install-usb-drivers'),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  
  // Device management
  getDevices: () => ipcRenderer.invoke('get-devices'),
  refreshDevices: () => ipcRenderer.invoke('refresh-devices'),
  getDeviceInfo: (serial) => ipcRenderer.invoke('get-device-info', serial),
  
  // Session management
  startSession: (serial, options) => ipcRenderer.invoke('start-session', serial, options),
  stopSession: (serial) => ipcRenderer.invoke('stop-session', serial),
  getActiveSessions: () => ipcRenderer.invoke('get-active-sessions'),
  
  // Input handling
  sendTouch: (serial, x, y, action) => ipcRenderer.invoke('send-touch', serial, x, y, action),
  sendKey: (serial, keyCode) => ipcRenderer.invoke('send-key', serial, keyCode),
  sendText: (serial, text) => ipcRenderer.invoke('send-text', serial, text),
  sendSwipe: (serial, x1, y1, x2, y2, duration) => ipcRenderer.invoke('send-swipe', serial, x1, y1, x2, y2, duration),
  
  // ADB server control
  startAdbServer: () => ipcRenderer.invoke('start-adb-server'),
  stopAdbServer: () => ipcRenderer.invoke('stop-adb-server'),
  restartAdbServer: () => ipcRenderer.invoke('restart-adb-server'),
  
  // Cloud connection
  cloudConnect: (serverUrl, authToken) => ipcRenderer.invoke('cloud-connect', serverUrl, authToken),
  cloudDisconnect: () => ipcRenderer.invoke('cloud-disconnect'),
  cloudStatus: () => ipcRenderer.invoke('cloud-status'),
  cloudSaveConfig: (config) => ipcRenderer.invoke('cloud-save-config', config),
  cloudLoadConfig: () => ipcRenderer.invoke('cloud-load-config'),
  
  // Utility
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Event listeners
  onDevicesChanged: (callback) => {
    ipcRenderer.on('devices-changed', (event, devices) => callback(devices));
  },
  onDeviceConnected: (callback) => {
    ipcRenderer.on('device-connected', (event, device) => callback(device));
  },
  onDeviceDisconnected: (callback) => {
    ipcRenderer.on('device-disconnected', (event, device) => callback(device));
  },
  onSessionStarted: (callback) => {
    ipcRenderer.on('session-started', (event, session) => callback(session));
  },
  onSessionEnded: (callback) => {
    ipcRenderer.on('session-ended', (event, session) => callback(session));
  },
  onStreamFrame: (callback) => {
    ipcRenderer.on('stream-frame', (event, data) => callback(data));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
  },
  onCloudConnected: (callback) => {
    ipcRenderer.on('cloud-connected', () => callback());
  },
  onCloudDisconnected: (callback) => {
    ipcRenderer.on('cloud-disconnected', (event, data) => callback(data));
  },
  onCloudReconnecting: (callback) => {
    ipcRenderer.on('cloud-reconnecting', (event, data) => callback(data));
  },
  onCloudError: (callback) => {
    ipcRenderer.on('cloud-error', (event, data) => callback(data));
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
