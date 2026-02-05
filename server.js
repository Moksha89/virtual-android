const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const url = require('url');
const AdbManager = require('./src/adb-manager');
const ScrcpyManager = require('./src/scrcpy-manager');
const DeviceManager = require('./src/device-manager');
const SessionManager = require('./src/session-manager');

const app = express();
const server = http.createServer(app);

// Create separate WebSocket servers for browsers and agents
const wss = new WebSocket.Server({ noServer: true });
const agentWss = new WebSocket.Server({ noServer: true });

// Configuration
const PORT = process.env.PORT || 3000;
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, 'data');

// Initialize managers
let adbManager;
let scrcpyManager;
let deviceManager;
let sessionManager;

// Store connected WebSocket clients (browsers)
const clients = new Set();

// Store connected agents (Windows apps)
const agents = new Map(); // agentId -> { ws, devices, info }

// Broadcast to all connected clients
function broadcast(type, data) {
  const message = JSON.stringify({ type, data });
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Initialize all managers
async function initializeManagers() {
  console.log('Initializing managers...');
  console.log('Data path:', DATA_PATH);
  
  // Initialize ADB Manager
  adbManager = new AdbManager(DATA_PATH);
  
  // Initialize Scrcpy Manager
  scrcpyManager = new ScrcpyManager(DATA_PATH);
  
  // Initialize Device Manager
  deviceManager = new DeviceManager(adbManager);
  
  // Initialize Session Manager
  sessionManager = new SessionManager(deviceManager, scrcpyManager, adbManager);
  
  // Set up event forwarding via WebSocket
  deviceManager.on('devices-changed', (devices) => {
    broadcast('devices-changed', devices);
  });
  
  deviceManager.on('device-connected', (device) => {
    broadcast('device-connected', device);
    console.log('Device connected:', device.serial);
  });
  
  deviceManager.on('device-disconnected', (device) => {
    broadcast('device-disconnected', device);
    console.log('Device disconnected:', device.serial);
  });
  
  sessionManager.on('session-started', (session) => {
    broadcast('session-started', session);
    console.log('Session started:', session.serial);
  });
  
  sessionManager.on('session-ended', (session) => {
    broadcast('session-ended', session);
    console.log('Session ended:', session.serial);
  });
  
  // Check if ADB is installed
  const adbInstalled = await adbManager.isInstalled();
  console.log('ADB installed:', adbInstalled);
  
  if (!adbInstalled) {
    console.log('ADB not found. Will download on first request.');
  }
  
  // Check if scrcpy is installed
  const scrcpyInstalled = await scrcpyManager.isInstalled();
  console.log('Scrcpy installed:', scrcpyInstalled);
  
  if (!scrcpyInstalled) {
    console.log('Scrcpy not found. Will download on first request.');
  }
  
  console.log('Managers initialized successfully');
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'renderer')));

// API Routes

// System status
app.get('/api/status', async (req, res) => {
  try {
    const adbInstalled = await adbManager.isInstalled();
    const scrcpyInstalled = await scrcpyManager.isInstalled();
    const adbVersion = adbInstalled ? await adbManager.getVersion() : null;
    const scrcpyVersion = scrcpyInstalled ? await scrcpyManager.getVersion() : null;
    
    res.json({
      adb: {
        installed: adbInstalled,
        version: adbVersion,
        path: adbManager.getAdbPath()
      },
      scrcpy: {
        installed: scrcpyInstalled,
        version: scrcpyVersion,
        path: scrcpyManager.getScrcpyPath()
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Install ADB
app.post('/api/install/adb', async (req, res) => {
  try {
    console.log('Installing ADB...');
    await adbManager.download((progress) => {
      broadcast('download-progress', { type: 'adb', progress });
    });
    res.json({ success: true, message: 'ADB installed successfully' });
  } catch (error) {
    console.error('ADB installation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Install scrcpy
app.post('/api/install/scrcpy', async (req, res) => {
  try {
    console.log('Installing scrcpy...');
    await scrcpyManager.download((progress) => {
      broadcast('download-progress', { type: 'scrcpy', progress });
    });
    res.json({ success: true, message: 'Scrcpy installed successfully' });
  } catch (error) {
    console.error('Scrcpy installation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check for updates
app.get('/api/updates', async (req, res) => {
  try {
    const adbUpdate = await adbManager.checkForUpdates();
    const scrcpyUpdate = await scrcpyManager.checkForUpdates();
    res.json({ adb: adbUpdate, scrcpy: scrcpyUpdate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get devices
app.get('/api/devices', async (req, res) => {
  try {
    const devices = deviceManager.getDevices();
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refresh devices
app.post('/api/devices/refresh', async (req, res) => {
  try {
    await deviceManager.refreshDevices();
    const devices = deviceManager.getDevices();
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get device info
app.get('/api/devices/:serial', async (req, res) => {
  try {
    const info = await deviceManager.getDeviceInfo(req.params.serial);
    if (info) {
      res.json(info);
    } else {
      res.status(404).json({ error: 'Device not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get device details
app.get('/api/devices/:serial/details', async (req, res) => {
  try {
    const details = await adbManager.getDeviceDetails(req.params.serial);
    res.json(details);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start session
app.post('/api/sessions', async (req, res) => {
  try {
    const { serial, options } = req.body;
    const session = await sessionManager.startSession(serial, options || {});
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get active sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = sessionManager.getActiveSessions();
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop session
app.delete('/api/sessions/:serial', async (req, res) => {
  try {
    await sessionManager.stopSession(req.params.serial);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop all sessions
app.delete('/api/sessions', async (req, res) => {
  try {
    sessionManager.stopAllSessions();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Input: Touch/Tap
app.post('/api/input/:serial/tap', async (req, res) => {
  try {
    const { x, y } = req.body;
    await sessionManager.sendTouch(req.params.serial, x, y);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Input: Swipe
app.post('/api/input/:serial/swipe', async (req, res) => {
  try {
    const { x1, y1, x2, y2, duration } = req.body;
    await sessionManager.sendSwipe(req.params.serial, x1, y1, x2, y2, duration);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Input: Key
app.post('/api/input/:serial/key', async (req, res) => {
  try {
    const { keyCode } = req.body;
    await sessionManager.sendKey(req.params.serial, keyCode);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Input: Text
app.post('/api/input/:serial/text', async (req, res) => {
  try {
    const { text } = req.body;
    await sessionManager.sendText(req.params.serial, text);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Navigation shortcuts
app.post('/api/input/:serial/back', async (req, res) => {
  try {
    await sessionManager.pressBack(req.params.serial);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/input/:serial/home', async (req, res) => {
  try {
    await sessionManager.pressHome(req.params.serial);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/input/:serial/recent', async (req, res) => {
  try {
    await sessionManager.pressRecent(req.params.serial);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Screenshot
app.get('/api/devices/:serial/screenshot', async (req, res) => {
  try {
    const screenshotPath = path.join(DATA_PATH, 'screenshots', `${req.params.serial}_${Date.now()}.png`);
    const fs = require('fs').promises;
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await adbManager.takeScreenshot(req.params.serial, screenshotPath);
    res.sendFile(screenshotPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ADB server control
app.post('/api/adb/start', async (req, res) => {
  try {
    const result = await adbManager.startServer();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/adb/stop', async (req, res) => {
  try {
    const result = await adbManager.stopServer();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/adb/restart', async (req, res) => {
  try {
    await adbManager.stopServer();
    const result = await adbManager.startServer();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current app
app.get('/api/devices/:serial/current-app', async (req, res) => {
  try {
    const app = await adbManager.getCurrentApp(req.params.serial);
    res.json({ app });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all devices from all agents
function getAllAgentDevices() {
  const allDevices = [];
  agents.forEach((agent, agentId) => {
    if (agent.devices) {
      agent.devices.forEach(device => {
        allDevices.push({
          ...device,
          agentId,
          agentName: agent.info?.hostname || agentId
        });
      });
    }
  });
  return allDevices;
}

// Forward command to specific agent
function forwardToAgent(agentId, type, data) {
  const agent = agents.get(agentId);
  if (agent && agent.ws.readyState === WebSocket.OPEN) {
    agent.ws.send(JSON.stringify({ type, data }));
    return true;
  }
  return false;
}

// Broadcast to all browser clients
function broadcastToBrowsers(type, data) {
  const message = JSON.stringify({ type, data });
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Agent WebSocket handling (Windows apps connect here)
agentWss.on('connection', (ws, req) => {
  const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  console.log(`Agent connected: ${agentId}`);
  
  agents.set(agentId, {
    ws,
    devices: [],
    info: null,
    connectedAt: new Date()
  });
  
  // Send welcome message with agent ID
  ws.send(JSON.stringify({
    type: 'welcome',
    data: { agentId }
  }));
  
  ws.on('message', async (message) => {
    try {
      const msg = JSON.parse(message);
      const agent = agents.get(agentId);
      
      switch (msg.type) {
        case 'register':
          // Agent registration with info
          agent.info = msg.data;
          console.log(`Agent registered: ${msg.data.hostname || agentId}`);
          broadcastToBrowsers('agent-connected', { agentId, info: msg.data });
          break;
          
        case 'devices':
          // Agent sends device list
          agent.devices = msg.data || [];
          console.log(`Agent ${agentId} has ${agent.devices.length} devices`);
          broadcastToBrowsers('devices-changed', getAllAgentDevices());
          break;
          
        case 'device-connected':
          // Agent reports new device
          const existingIdx = agent.devices.findIndex(d => d.serial === msg.data.serial);
          if (existingIdx >= 0) {
            agent.devices[existingIdx] = msg.data;
          } else {
            agent.devices.push(msg.data);
          }
          broadcastToBrowsers('device-connected', { ...msg.data, agentId });
          broadcastToBrowsers('devices-changed', getAllAgentDevices());
          break;
          
        case 'device-disconnected':
          // Agent reports device disconnected
          agent.devices = agent.devices.filter(d => d.serial !== msg.data.serial);
          broadcastToBrowsers('device-disconnected', { ...msg.data, agentId });
          broadcastToBrowsers('devices-changed', getAllAgentDevices());
          break;
          
        case 'session-started':
          broadcastToBrowsers('session-started', { ...msg.data, agentId });
          break;
          
        case 'session-ended':
          broadcastToBrowsers('session-ended', { ...msg.data, agentId });
          break;
          
        case 'response':
          // Response to a request from browser
          broadcastToBrowsers('agent-response', { agentId, ...msg.data });
          break;
          
        case 'webrtc-offer':
        case 'webrtc-answer':
        case 'webrtc-ice-candidate':
          // WebRTC signaling - forward to browsers
          broadcastToBrowsers(msg.type, { agentId, ...msg.data });
          break;
          
        case 'heartbeat':
          // Agent heartbeat
          agent.lastHeartbeat = new Date();
          ws.send(JSON.stringify({ type: 'heartbeat-ack' }));
          break;
      }
    } catch (error) {
      console.error('Agent message error:', error);
      ws.send(JSON.stringify({ type: 'error', data: error.message }));
    }
  });
  
  ws.on('close', () => {
    console.log(`Agent disconnected: ${agentId}`);
    const agent = agents.get(agentId);
    if (agent) {
      broadcastToBrowsers('agent-disconnected', { agentId, info: agent.info });
    }
    agents.delete(agentId);
    broadcastToBrowsers('devices-changed', getAllAgentDevices());
  });
  
  ws.on('error', (error) => {
    console.error(`Agent ${agentId} error:`, error);
    agents.delete(agentId);
  });
});

// Browser WebSocket handling
wss.on('connection', (ws) => {
  console.log('Browser client connected');
  clients.add(ws);
  
  // Send current state including local devices and agent devices
  const localDevices = deviceManager ? deviceManager.getDevices() : [];
  const agentDevices = getAllAgentDevices();
  const allDevices = [...localDevices, ...agentDevices];
  
  ws.send(JSON.stringify({
    type: 'init',
    data: {
      devices: allDevices,
      sessions: sessionManager ? sessionManager.getActiveSessions() : [],
      agents: Array.from(agents.entries()).map(([id, agent]) => ({
        id,
        info: agent.info,
        deviceCount: agent.devices.length
      }))
    }
  }));
  
  ws.on('message', async (message) => {
    try {
      const { action, data } = JSON.parse(message);
      
      // Check if this is for an agent device
      if (data && data.agentId) {
        // Forward to specific agent
        const forwarded = forwardToAgent(data.agentId, 'command', { action, ...data });
        if (!forwarded) {
          ws.send(JSON.stringify({ type: 'error', data: 'Agent not connected' }));
        }
        return;
      }
      
      // Handle local device commands
      switch (action) {
        case 'refresh-devices':
          await deviceManager.refreshDevices();
          break;
        case 'tap':
          await sessionManager.sendTouch(data.serial, data.x, data.y);
          break;
        case 'swipe':
          await sessionManager.sendSwipe(data.serial, data.x1, data.y1, data.x2, data.y2, data.duration);
          break;
        case 'key':
          await sessionManager.sendKey(data.serial, data.keyCode);
          break;
        case 'text':
          await sessionManager.sendText(data.serial, data.text);
          break;
        case 'back':
          await sessionManager.pressBack(data.serial);
          break;
        case 'home':
          await sessionManager.pressHome(data.serial);
          break;
        case 'recent':
          await sessionManager.pressRecent(data.serial);
          break;
        case 'webrtc-offer':
        case 'webrtc-answer':
        case 'webrtc-ice-candidate':
          // Forward WebRTC signaling to agent
          if (data.agentId) {
            forwardToAgent(data.agentId, action, data);
          }
          break;
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', data: error.message }));
    }
  });
  
  ws.on('close', () => {
    console.log('Browser client disconnected');
    clients.delete(ws);
  });
  
  ws.on('error', (error) => {
    console.error('Browser WebSocket error:', error);
    clients.delete(ws);
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'renderer', 'index.html'));
});

// API endpoint to get connected agents
app.get('/api/agents', (req, res) => {
  const agentList = Array.from(agents.entries()).map(([id, agent]) => ({
    id,
    info: agent.info,
    deviceCount: agent.devices.length,
    devices: agent.devices,
    connectedAt: agent.connectedAt,
    lastHeartbeat: agent.lastHeartbeat
  }));
  res.json(agentList);
});

// Handle WebSocket upgrade - route to correct server based on path
server.on('upgrade', (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;
  
  if (pathname === '/agent') {
    // Windows agent connection
    agentWss.handleUpgrade(request, socket, head, (ws) => {
      agentWss.emit('connection', ws, request);
    });
  } else {
    // Browser client connection (default)
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

// Start server
async function start() {
  try {
    await initializeManagers();
    
    // Start device monitoring
    deviceManager.startMonitoring();
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n========================================`);
      console.log(`Android Remote Control Server`);
      console.log(`========================================`);
      console.log(`Server running on http://0.0.0.0:${PORT}`);
      console.log(`Access from browser: http://YOUR_IP:${PORT}`);
      console.log(`Browser WebSocket: ws://YOUR_IP:${PORT}`);
      console.log(`Agent WebSocket: ws://YOUR_IP:${PORT}/agent`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  if (sessionManager) {
    sessionManager.stopAllSessions();
  }
  if (deviceManager) {
    deviceManager.stopMonitoring();
  }
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  if (sessionManager) {
    sessionManager.stopAllSessions();
  }
  if (deviceManager) {
    deviceManager.stopMonitoring();
  }
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

start();
