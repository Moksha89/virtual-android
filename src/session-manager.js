const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

class SessionManager extends EventEmitter {
  constructor(deviceManager, scrcpyManager, adbManager) {
    super();
    this.deviceManager = deviceManager;
    this.scrcpyManager = scrcpyManager;
    this.adbManager = adbManager;
    this.sessions = new Map(); // serial -> session
    this.inputThrottleMs = 30; // Minimum ms between inputs (bank-safe)
    this.lastInputTime = new Map(); // serial -> timestamp
    
    // Listen for device disconnections
    this.deviceManager.on('device-disconnected', (device) => {
      this.handleDeviceDisconnected(device.serial);
    });
    
    // Listen for scrcpy stream events
    this.scrcpyManager.on('stream-closed', ({ serial, code }) => {
      this.handleStreamClosed(serial, code);
    });
    
    this.scrcpyManager.on('stream-error', ({ serial, error }) => {
      this.handleStreamError(serial, error);
    });
  }
  
  async startSession(serial, options = {}) {
    // Check if device exists and is available
    const device = this.deviceManager.getDevice(serial);
    if (!device) {
      throw new Error('Device not found');
    }
    
    if (device.status !== 'device') {
      throw new Error(`Device is not ready (status: ${device.status})`);
    }
    
    if (device.isLocked) {
      throw new Error('Device is already in use by another session');
    }
    
    // Check if session already exists
    if (this.sessions.has(serial)) {
      throw new Error('Session already exists for this device');
    }
    
    // Create session
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      serial: serial,
      device: device,
      startedAt: new Date().toISOString(),
      status: 'starting',
      options: options,
      streamProcess: null,
      inputCount: 0,
      lastActivity: new Date().toISOString()
    };
    
    // Lock the device
    this.deviceManager.setActiveSession(serial, sessionId);
    
    try {
      // Start scrcpy stream
      const streamResult = await this.scrcpyManager.startStream(
        serial,
        this.adbManager.getAdbPath(),
        {
          maxSize: options.maxSize || 1280,
          bitRate: options.bitRate || 4000000,
          maxFps: options.maxFps || 30,
          stayAwake: options.stayAwake !== false,
          turnScreenOff: options.turnScreenOff || false,
          showTouches: options.showTouches || false,
          windowTitle: options.windowTitle || `Android - ${device.model || serial}`,
          noControl: options.viewOnly || false,
          ...options
        }
      );
      
      session.streamProcess = streamResult.process;
      session.status = 'active';
      
      // Store session
      this.sessions.set(serial, session);
      
      this.emit('session-started', {
        id: sessionId,
        serial: serial,
        device: {
          model: device.model,
          brand: device.details?.brand,
          androidVersion: device.details?.release
        },
        startedAt: session.startedAt
      });
      
      return session;
      
    } catch (error) {
      // Unlock device on failure
      this.deviceManager.clearActiveSession(serial);
      throw error;
    }
  }
  
  async stopSession(serial) {
    const session = this.sessions.get(serial);
    if (!session) {
      return false;
    }
    
    // Stop scrcpy stream
    await this.scrcpyManager.stopStream(serial);
    
    // Update session status
    session.status = 'ended';
    session.endedAt = new Date().toISOString();
    
    // Unlock device
    this.deviceManager.clearActiveSession(serial);
    
    // Remove session
    this.sessions.delete(serial);
    this.lastInputTime.delete(serial);
    
    this.emit('session-ended', {
      id: session.id,
      serial: serial,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      inputCount: session.inputCount
    });
    
    return true;
  }
  
  async stopAllSessions() {
    const serials = Array.from(this.sessions.keys());
    for (const serial of serials) {
      await this.stopSession(serial);
    }
  }
  
  handleDeviceDisconnected(serial) {
    const session = this.sessions.get(serial);
    if (session) {
      session.status = 'disconnected';
      this.stopSession(serial);
      this.emit('session-device-disconnected', { serial, sessionId: session.id });
    }
  }
  
  handleStreamClosed(serial, code) {
    const session = this.sessions.get(serial);
    if (session && session.status === 'active') {
      session.status = 'stream-closed';
      this.stopSession(serial);
      this.emit('session-stream-closed', { serial, sessionId: session.id, code });
    }
  }
  
  handleStreamError(serial, error) {
    const session = this.sessions.get(serial);
    if (session) {
      this.emit('session-error', { serial, sessionId: session.id, error });
    }
  }
  
  getSession(serial) {
    return this.sessions.get(serial);
  }
  
  getActiveSessions() {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      serial: s.serial,
      status: s.status,
      startedAt: s.startedAt,
      device: {
        model: s.device.model,
        brand: s.device.details?.brand
      },
      inputCount: s.inputCount,
      lastActivity: s.lastActivity
    }));
  }
  
  isSessionActive(serial) {
    const session = this.sessions.get(serial);
    return session && session.status === 'active';
  }
  
  // Input methods with throttling for bank safety
  canSendInput(serial) {
    const lastTime = this.lastInputTime.get(serial) || 0;
    const now = Date.now();
    return (now - lastTime) >= this.inputThrottleMs;
  }
  
  recordInput(serial) {
    this.lastInputTime.set(serial, Date.now());
    const session = this.sessions.get(serial);
    if (session) {
      session.inputCount++;
      session.lastActivity = new Date().toISOString();
    }
  }
  
  async sendTouch(serial, x, y, action = 'tap') {
    if (!this.isSessionActive(serial)) {
      throw new Error('No active session for this device');
    }
    
    if (!this.canSendInput(serial)) {
      return { success: false, reason: 'throttled' };
    }
    
    try {
      await this.adbManager.tap(serial, x, y);
      this.recordInput(serial);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
  
  async sendKey(serial, keyCode) {
    if (!this.isSessionActive(serial)) {
      throw new Error('No active session for this device');
    }
    
    if (!this.canSendInput(serial)) {
      return { success: false, reason: 'throttled' };
    }
    
    try {
      await this.adbManager.keyEvent(serial, keyCode);
      this.recordInput(serial);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
  
  async sendText(serial, text) {
    if (!this.isSessionActive(serial)) {
      throw new Error('No active session for this device');
    }
    
    if (!this.canSendInput(serial)) {
      return { success: false, reason: 'throttled' };
    }
    
    try {
      await this.adbManager.inputText(serial, text);
      this.recordInput(serial);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
  
  async sendSwipe(serial, x1, y1, x2, y2, duration = 300) {
    if (!this.isSessionActive(serial)) {
      throw new Error('No active session for this device');
    }
    
    if (!this.canSendInput(serial)) {
      return { success: false, reason: 'throttled' };
    }
    
    try {
      await this.adbManager.swipe(serial, x1, y1, x2, y2, duration);
      this.recordInput(serial);
      return { success: true };
    } catch (error) {
      throw error;
    }
  }
  
  // Navigation shortcuts
  async pressBack(serial) {
    return this.sendKey(serial, 4);
  }
  
  async pressHome(serial) {
    return this.sendKey(serial, 3);
  }
  
  async pressRecent(serial) {
    return this.sendKey(serial, 187);
  }
  
  // Get current app (for banking guard)
  async getCurrentApp(serial) {
    if (!this.isSessionActive(serial)) {
      return null;
    }
    
    return this.adbManager.getCurrentApp(serial);
  }
}

module.exports = SessionManager;
