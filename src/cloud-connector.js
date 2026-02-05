const { EventEmitter } = require('events');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

class CloudConnector extends EventEmitter {
  constructor(options = {}) {
    super();
    this.serverUrl = options.serverUrl || null;
    this.agentId = options.agentId || uuidv4();
    this.agentName = options.agentName || require('os').hostname();
    this.authToken = options.authToken || null;
    
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 5000;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = 30000;
    
    this.deviceManager = null;
    this.sessionManager = null;
    
    this.pendingRequests = new Map();
    this.requestTimeout = 30000;
  }
  
  setDeviceManager(deviceManager) {
    this.deviceManager = deviceManager;
    
    // Forward device events to cloud
    deviceManager.on('devices-changed', (devices) => {
      this.sendDeviceUpdate(devices);
    });
    
    deviceManager.on('device-connected', (device) => {
      this.send('device-connected', { device });
    });
    
    deviceManager.on('device-disconnected', (device) => {
      this.send('device-disconnected', { device });
    });
  }
  
  setSessionManager(sessionManager) {
    this.sessionManager = sessionManager;
    
    // Forward session events to cloud
    sessionManager.on('session-started', (session) => {
      this.send('session-started', { session: this.sanitizeSession(session) });
    });
    
    sessionManager.on('session-ended', (session) => {
      this.send('session-ended', { session: this.sanitizeSession(session) });
    });
  }
  
  sanitizeSession(session) {
    // Remove sensitive data before sending to cloud
    return {
      id: session.id,
      serial: session.serial,
      deviceModel: session.deviceModel,
      startedAt: session.startedAt,
      status: session.status
    };
  }
  
  async connect(serverUrl, authToken) {
    if (serverUrl) this.serverUrl = serverUrl;
    if (authToken) this.authToken = authToken;
    
    if (!this.serverUrl) {
      throw new Error('Server URL is required');
    }
    
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.serverUrl.replace(/^http/, 'ws') + '/agent';
        
        this.ws = new WebSocket(wsUrl, {
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'X-Agent-Id': this.agentId,
            'X-Agent-Name': this.agentName
          }
        });
        
        this.ws.on('open', () => {
          console.log('Connected to cloud server');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connected');
          
          // Send initial registration
          this.send('agent-register', {
            agentId: this.agentId,
            agentName: this.agentName,
            version: require('../package.json').version,
            platform: process.platform,
            devices: this.deviceManager ? this.deviceManager.getDevices() : []
          });
          
          resolve();
        });
        
        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });
        
        this.ws.on('close', (code, reason) => {
          console.log(`Disconnected from cloud: ${code} - ${reason}`);
          this.connected = false;
          this.stopHeartbeat();
          this.emit('disconnected', { code, reason: reason.toString() });
          
          // Attempt reconnection
          this.scheduleReconnect();
        });
        
        this.ws.on('error', (error) => {
          console.error('WebSocket error:', error.message);
          this.emit('error', error);
          
          if (!this.connected) {
            reject(error);
          }
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  disconnect() {
    this.stopHeartbeat();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.connected = false;
    this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
  }
  
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      this.emit('reconnect-failed');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });
    
    setTimeout(() => {
      if (!this.connected) {
        this.connect().catch(err => {
          console.error('Reconnection failed:', err.message);
        });
      }
    }, delay);
  }
  
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.connected) {
        this.send('heartbeat', {
          timestamp: Date.now(),
          devices: this.deviceManager ? this.deviceManager.getDevices().length : 0,
          sessions: this.sessionManager ? this.sessionManager.getActiveSessions().length : 0
        });
      }
    }, this.heartbeatTimeout);
  }
  
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  send(type, data = {}) {
    if (!this.connected || !this.ws) {
      console.warn('Cannot send message: not connected');
      return false;
    }
    
    try {
      const message = JSON.stringify({
        type,
        data,
        agentId: this.agentId,
        timestamp: Date.now()
      });
      
      this.ws.send(message);
      return true;
    } catch (error) {
      console.error('Failed to send message:', error.message);
      return false;
    }
  }
  
  sendDeviceUpdate(devices) {
    this.send('devices-update', {
      devices: devices.map(d => ({
        serial: d.serial,
        model: d.model,
        manufacturer: d.manufacturer,
        status: d.status,
        androidVersion: d.androidVersion
      }))
    });
  }
  
  async request(type, data = {}) {
    return new Promise((resolve, reject) => {
      const requestId = uuidv4();
      
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, this.requestTimeout);
      
      this.pendingRequests.set(requestId, { resolve, reject, timeout });
      
      this.send(type, { ...data, requestId });
    });
  }
  
  handleMessage(rawData) {
    try {
      const message = JSON.parse(rawData.toString());
      const { type, data, requestId } = message;
      
      // Handle response to pending request
      if (requestId && this.pendingRequests.has(requestId)) {
        const { resolve, reject, timeout } = this.pendingRequests.get(requestId);
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        
        if (data.error) {
          reject(new Error(data.error));
        } else {
          resolve(data);
        }
        return;
      }
      
      // Handle incoming commands
      switch (type) {
        case 'ping':
          this.send('pong', { timestamp: Date.now() });
          break;
          
        case 'get-devices':
          this.handleGetDevices(data);
          break;
          
        case 'start-session':
          this.handleStartSession(data);
          break;
          
        case 'stop-session':
          this.handleStopSession(data);
          break;
          
        case 'send-input':
          this.handleSendInput(data);
          break;
          
        case 'get-sessions':
          this.handleGetSessions(data);
          break;
          
        case 'webrtc-offer':
          this.handleWebRTCOffer(data);
          break;
          
        case 'webrtc-answer':
          this.handleWebRTCAnswer(data);
          break;
          
        case 'webrtc-ice-candidate':
          this.handleWebRTCIceCandidate(data);
          break;
          
        default:
          console.log('Unknown message type:', type);
          this.emit('message', message);
      }
      
    } catch (error) {
      console.error('Failed to parse message:', error.message);
    }
  }
  
  async handleGetDevices(data) {
    const devices = this.deviceManager ? this.deviceManager.getDevices() : [];
    this.send('devices-response', {
      requestId: data.requestId,
      devices
    });
  }
  
  async handleStartSession(data) {
    const { serial, options, requestId, userId } = data;
    
    try {
      if (!this.sessionManager) {
        throw new Error('Session manager not available');
      }
      
      const session = await this.sessionManager.startSession(serial, {
        ...options,
        remoteUserId: userId
      });
      
      this.send('session-response', {
        requestId,
        success: true,
        session: this.sanitizeSession(session)
      });
      
    } catch (error) {
      this.send('session-response', {
        requestId,
        success: false,
        error: error.message
      });
    }
  }
  
  async handleStopSession(data) {
    const { serial, requestId } = data;
    
    try {
      if (!this.sessionManager) {
        throw new Error('Session manager not available');
      }
      
      await this.sessionManager.stopSession(serial);
      
      this.send('session-response', {
        requestId,
        success: true
      });
      
    } catch (error) {
      this.send('session-response', {
        requestId,
        success: false,
        error: error.message
      });
    }
  }
  
  async handleSendInput(data) {
    const { serial, inputType, inputData, requestId } = data;
    
    try {
      if (!this.sessionManager) {
        throw new Error('Session manager not available');
      }
      
      switch (inputType) {
        case 'tap':
          await this.sessionManager.sendTouch(serial, inputData.x, inputData.y);
          break;
        case 'swipe':
          await this.sessionManager.sendSwipe(
            serial,
            inputData.x1, inputData.y1,
            inputData.x2, inputData.y2,
            inputData.duration
          );
          break;
        case 'key':
          await this.sessionManager.sendKey(serial, inputData.keyCode);
          break;
        case 'text':
          await this.sessionManager.sendText(serial, inputData.text);
          break;
        default:
          throw new Error(`Unknown input type: ${inputType}`);
      }
      
      this.send('input-response', {
        requestId,
        success: true
      });
      
    } catch (error) {
      this.send('input-response', {
        requestId,
        success: false,
        error: error.message
      });
    }
  }
  
  async handleGetSessions(data) {
    const sessions = this.sessionManager ? this.sessionManager.getActiveSessions() : [];
    this.send('sessions-response', {
      requestId: data.requestId,
      sessions: sessions.map(s => this.sanitizeSession(s))
    });
  }
  
  // WebRTC Signaling handlers
  handleWebRTCOffer(data) {
    this.emit('webrtc-offer', data);
  }
  
  handleWebRTCAnswer(data) {
    this.emit('webrtc-answer', data);
  }
  
  handleWebRTCIceCandidate(data) {
    this.emit('webrtc-ice-candidate', data);
  }
  
  sendWebRTCOffer(targetUserId, serial, offer) {
    this.send('webrtc-offer', {
      targetUserId,
      serial,
      offer
    });
  }
  
  sendWebRTCAnswer(targetUserId, serial, answer) {
    this.send('webrtc-answer', {
      targetUserId,
      serial,
      answer
    });
  }
  
  sendWebRTCIceCandidate(targetUserId, serial, candidate) {
    this.send('webrtc-ice-candidate', {
      targetUserId,
      serial,
      candidate
    });
  }
  
  isConnected() {
    return this.connected;
  }
  
  getAgentId() {
    return this.agentId;
  }
  
  getStatus() {
    return {
      connected: this.connected,
      agentId: this.agentId,
      agentName: this.agentName,
      serverUrl: this.serverUrl,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

module.exports = CloudConnector;
