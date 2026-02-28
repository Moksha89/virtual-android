// API abstraction layer - works with both Electron IPC and HTTP API
class API {
  constructor() {
    this.isElectron = typeof window.electronAPI !== 'undefined';
    this.baseUrl = window.location.origin;
    this.ws = null;
    this.eventHandlers = {};
    
    if (!this.isElectron) {
      this.initWebSocket();
    }
  }
  
  initWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
    };
    
    this.ws.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data);
        this.handleEvent(type, data);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting...');
      setTimeout(() => this.initWebSocket(), 3000);
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }
  
  handleEvent(type, data) {
    const handlers = this.eventHandlers[type] || [];
    handlers.forEach(handler => handler(data));
  }
  
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }
  
  async fetch(endpoint, options = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }
    
    return response.json();
  }
  
  // System Status
  async getSystemStatus() {
    if (this.isElectron) {
      return window.electronAPI.getSystemStatus();
    }
    return this.fetch('/api/status');
  }
  
  // Installation
  async installAdb() {
    if (this.isElectron) {
      return window.electronAPI.installAdb();
    }
    return this.fetch('/api/install/adb', { method: 'POST' });
  }
  
  async installScrcpy() {
    if (this.isElectron) {
      return window.electronAPI.installScrcpy();
    }
    return this.fetch('/api/install/scrcpy', { method: 'POST' });
  }
  
  async installUsbDrivers() {
    if (this.isElectron) {
      return window.electronAPI.installUsbDrivers();
    }
    // Not applicable for web version
    return { success: true, message: 'USB drivers not needed for web version' };
  }
  
  async checkUpdates() {
    if (this.isElectron) {
      return window.electronAPI.checkUpdates();
    }
    return this.fetch('/api/updates');
  }
  
  // Devices
  async getDevices() {
    if (this.isElectron) {
      return window.electronAPI.getDevices();
    }
    return this.fetch('/api/devices');
  }
  
  async refreshDevices() {
    if (this.isElectron) {
      return window.electronAPI.refreshDevices();
    }
    return this.fetch('/api/devices/refresh', { method: 'POST' });
  }
  
  async getDeviceInfo(serial) {
    if (this.isElectron) {
      return window.electronAPI.getDeviceInfo(serial);
    }
    return this.fetch(`/api/devices/${serial}`);
  }
  
  async getDeviceDetails(serial) {
    if (this.isElectron) {
      return window.electronAPI.getDeviceInfo(serial);
    }
    return this.fetch(`/api/devices/${serial}/details`);
  }
  
  // Sessions
  async startSession(serial, options = {}) {
    if (this.isElectron) {
      return window.electronAPI.startSession(serial, options);
    }
    return this.fetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ serial, options })
    });
  }
  
  async stopSession(serial) {
    if (this.isElectron) {
      return window.electronAPI.stopSession(serial);
    }
    return this.fetch(`/api/sessions/${serial}`, { method: 'DELETE' });
  }
  
  async getActiveSessions() {
    if (this.isElectron) {
      return window.electronAPI.getActiveSessions();
    }
    return this.fetch('/api/sessions');
  }
  
  async stopAllSessions() {
    if (this.isElectron) {
      // Electron doesn't have this method, iterate
      const sessions = await this.getActiveSessions();
      for (const session of sessions) {
        await this.stopSession(session.serial);
      }
      return { success: true };
    }
    return this.fetch('/api/sessions', { method: 'DELETE' });
  }
  
  // Input
  async sendTap(serial, x, y) {
    if (this.isElectron) {
      return window.electronAPI.sendTouch(serial, x, y);
    }
    return this.fetch(`/api/input/${serial}/tap`, {
      method: 'POST',
      body: JSON.stringify({ x, y })
    });
  }
  
  async sendSwipe(serial, x1, y1, x2, y2, duration = 300) {
    if (this.isElectron) {
      return window.electronAPI.sendSwipe(serial, x1, y1, x2, y2, duration);
    }
    return this.fetch(`/api/input/${serial}/swipe`, {
      method: 'POST',
      body: JSON.stringify({ x1, y1, x2, y2, duration })
    });
  }
  
  async sendKey(serial, keyCode) {
    if (this.isElectron) {
      return window.electronAPI.sendKey(serial, keyCode);
    }
    return this.fetch(`/api/input/${serial}/key`, {
      method: 'POST',
      body: JSON.stringify({ keyCode })
    });
  }
  
  async sendText(serial, text) {
    if (this.isElectron) {
      return window.electronAPI.sendText(serial, text);
    }
    return this.fetch(`/api/input/${serial}/text`, {
      method: 'POST',
      body: JSON.stringify({ text })
    });
  }
  
  async pressBack(serial) {
    if (this.isElectron) {
      return window.electronAPI.sendKey(serial, 4);
    }
    return this.fetch(`/api/input/${serial}/back`, { method: 'POST' });
  }
  
  async pressHome(serial) {
    if (this.isElectron) {
      return window.electronAPI.sendKey(serial, 3);
    }
    return this.fetch(`/api/input/${serial}/home`, { method: 'POST' });
  }
  
  async pressRecent(serial) {
    if (this.isElectron) {
      return window.electronAPI.sendKey(serial, 187);
    }
    return this.fetch(`/api/input/${serial}/recent`, { method: 'POST' });
  }
  
  // Screenshot
  getScreenshotUrl(serial) {
    return `/api/devices/${serial}/screenshot?t=${Date.now()}`;
  }
  
  // ADB Server
  async startAdbServer() {
    if (this.isElectron) {
      return window.electronAPI.startAdbServer();
    }
    return this.fetch('/api/adb/start', { method: 'POST' });
  }
  
  async stopAdbServer() {
    if (this.isElectron) {
      return window.electronAPI.stopAdbServer();
    }
    return this.fetch('/api/adb/stop', { method: 'POST' });
  }
  
  async restartAdbServer() {
    if (this.isElectron) {
      return window.electronAPI.restartAdbServer();
    }
    return this.fetch('/api/adb/restart', { method: 'POST' });
  }
  
  // App version
  async getAppVersion() {
    if (this.isElectron) {
      return window.electronAPI.getAppVersion();
    }
    return '1.0.0'; // Web version
  }
  
  // Cloud connection (web mode stubs - cloud is for Windows agent, not browser)
  async cloudConnect(serverUrl, authToken) {
    if (this.isElectron) {
      return window.electronAPI.cloudConnect(serverUrl, authToken);
    }
    return { success: false, error: 'Cloud connection is configured from the Windows desktop app, not the browser. Download the Windows app from the Download page.' };
  }
  
  async cloudDisconnect() {
    if (this.isElectron) {
      return window.electronAPI.cloudDisconnect();
    }
    return { success: true };
  }
  
  async cloudSaveConfig(config) {
    if (this.isElectron) {
      return window.electronAPI.cloudSaveConfig(config);
    }
    return { success: false, error: 'Cloud settings are configured from the Windows desktop app.' };
  }
  
  async cloudStatus() {
    if (this.isElectron) {
      return window.electronAPI.cloudStatus();
    }
    return { connected: false };
  }
  
  // Event listeners (for compatibility with Electron API)
  onDevicesChanged(callback) {
    if (this.isElectron) {
      window.electronAPI.onDevicesChanged(callback);
    } else {
      this.on('devices-changed', callback);
    }
  }
  
  onDeviceConnected(callback) {
    if (this.isElectron) {
      window.electronAPI.onDeviceConnected(callback);
    } else {
      this.on('device-connected', callback);
    }
  }
  
  onDeviceDisconnected(callback) {
    if (this.isElectron) {
      window.electronAPI.onDeviceDisconnected(callback);
    } else {
      this.on('device-disconnected', callback);
    }
  }
  
  onSessionStarted(callback) {
    if (this.isElectron) {
      window.electronAPI.onSessionStarted(callback);
    } else {
      this.on('session-started', callback);
    }
  }
  
  onSessionEnded(callback) {
    if (this.isElectron) {
      window.electronAPI.onSessionEnded(callback);
    } else {
      this.on('session-ended', callback);
    }
  }
  
  onDownloadProgress(callback) {
    if (this.isElectron) {
      window.electronAPI.onDownloadProgress(callback);
    } else {
      this.on('download-progress', callback);
    }
  }
}

// Create global API instance
window.api = new API();
