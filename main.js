const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const AdbManager = require('./src/adb-manager');
const ScrcpyManager = require('./src/scrcpy-manager');
const DeviceManager = require('./src/device-manager');
const SessionManager = require('./src/session-manager');
const CloudConnector = require('./src/cloud-connector');

let mainWindow;
let adbManager;
let scrcpyManager;
let deviceManager;
let sessionManager;
let cloudConnector;

// Cloud configuration file path
const getConfigPath = () => path.join(app.getPath('userData'), 'cloud-config.json');

function loadCloudConfig() {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (error) {
    console.error('Failed to load cloud config:', error.message);
  }
  return { serverUrl: '', authToken: '', autoConnect: false };
}

function saveCloudConfig(config) {
  try {
    const configPath = getConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save cloud config:', error.message);
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'Android Remote Control',
    backgroundColor: '#1a1a2e'
  });

  mainWindow.loadFile('renderer/index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initializeManagers() {
  const userDataPath = app.getPath('userData');
  
  // Initialize ADB Manager
  adbManager = new AdbManager(userDataPath);
  
  // Initialize Scrcpy Manager
  scrcpyManager = new ScrcpyManager(userDataPath);
  
  // Initialize Device Manager
  deviceManager = new DeviceManager(adbManager);
  
  // Initialize Session Manager
  sessionManager = new SessionManager(deviceManager, scrcpyManager, adbManager);
  
  // Initialize Cloud Connector
  cloudConnector = new CloudConnector();
  cloudConnector.setDeviceManager(deviceManager);
  cloudConnector.setSessionManager(sessionManager);
  
  // Cloud connector events
  cloudConnector.on('connected', () => {
    if (mainWindow) {
      mainWindow.webContents.send('cloud-connected');
    }
  });
  
  cloudConnector.on('disconnected', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('cloud-disconnected', data);
    }
  });
  
  cloudConnector.on('reconnecting', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('cloud-reconnecting', data);
    }
  });
  
  cloudConnector.on('error', (error) => {
    if (mainWindow) {
      mainWindow.webContents.send('cloud-error', { message: error.message });
    }
  });
  
  // Auto-connect to cloud if configured
  const cloudConfig = loadCloudConfig();
  if (cloudConfig.autoConnect && cloudConfig.serverUrl) {
    cloudConnector.connect(cloudConfig.serverUrl, cloudConfig.authToken).catch(err => {
      console.error('Auto-connect to cloud failed:', err.message);
    });
  }
  
  // Set up event forwarding to renderer
  deviceManager.on('devices-changed', (devices) => {
    if (mainWindow) {
      mainWindow.webContents.send('devices-changed', devices);
    }
  });
  
  deviceManager.on('device-connected', (device) => {
    if (mainWindow) {
      mainWindow.webContents.send('device-connected', device);
    }
  });
  
  deviceManager.on('device-disconnected', (device) => {
    if (mainWindow) {
      mainWindow.webContents.send('device-disconnected', device);
    }
  });
  
  sessionManager.on('session-started', (session) => {
    if (mainWindow) {
      mainWindow.webContents.send('session-started', session);
    }
  });
  
  sessionManager.on('session-ended', (session) => {
    if (mainWindow) {
      mainWindow.webContents.send('session-ended', session);
    }
  });
  
  sessionManager.on('stream-frame', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('stream-frame', data);
    }
  });
}

// IPC Handlers
function setupIpcHandlers() {
  // System status
  ipcMain.handle('get-system-status', async () => {
    const adbInstalled = await adbManager.isInstalled();
    const scrcpyInstalled = await scrcpyManager.isInstalled();
    const adbVersion = adbInstalled ? await adbManager.getVersion() : null;
    const scrcpyVersion = scrcpyInstalled ? await scrcpyManager.getVersion() : null;
    
    return {
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
    };
  });
  
  // ADB Management
  ipcMain.handle('install-adb', async (event) => {
    try {
      await adbManager.download((progress) => {
        mainWindow.webContents.send('download-progress', { type: 'adb', progress });
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('install-scrcpy', async (event) => {
    try {
      await scrcpyManager.download((progress) => {
        mainWindow.webContents.send('download-progress', { type: 'scrcpy', progress });
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('check-updates', async () => {
    const adbUpdate = await adbManager.checkForUpdates();
    const scrcpyUpdate = await scrcpyManager.checkForUpdates();
    return { adb: adbUpdate, scrcpy: scrcpyUpdate };
  });
  
  // Device Management
  ipcMain.handle('get-devices', async () => {
    return deviceManager.getDevices();
  });
  
  ipcMain.handle('refresh-devices', async () => {
    await deviceManager.refreshDevices();
    return deviceManager.getDevices();
  });
  
  ipcMain.handle('get-device-info', async (event, serial) => {
    return deviceManager.getDeviceInfo(serial);
  });
  
  // Session Management
  ipcMain.handle('start-session', async (event, serial, options) => {
    try {
      const session = await sessionManager.startSession(serial, options);
      return { success: true, session };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('stop-session', async (event, serial) => {
    try {
      await sessionManager.stopSession(serial);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('get-active-sessions', async () => {
    return sessionManager.getActiveSessions();
  });
  
  // Input handling
  ipcMain.handle('send-touch', async (event, serial, x, y, action) => {
    return sessionManager.sendTouch(serial, x, y, action);
  });
  
  ipcMain.handle('send-key', async (event, serial, keyCode) => {
    return sessionManager.sendKey(serial, keyCode);
  });
  
  ipcMain.handle('send-text', async (event, serial, text) => {
    return sessionManager.sendText(serial, text);
  });
  
  ipcMain.handle('send-swipe', async (event, serial, x1, y1, x2, y2, duration) => {
    return sessionManager.sendSwipe(serial, x1, y1, x2, y2, duration);
  });
  
  // Utility
  ipcMain.handle('open-external', async (event, url) => {
    shell.openExternal(url);
  });
  
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });
  
  // Driver installation
  ipcMain.handle('install-usb-drivers', async () => {
    try {
      await adbManager.installUsbDrivers((progress) => {
        mainWindow.webContents.send('download-progress', { type: 'drivers', progress });
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  // ADB server control
  ipcMain.handle('start-adb-server', async () => {
    return adbManager.startServer();
  });
  
  ipcMain.handle('stop-adb-server', async () => {
    return adbManager.stopServer();
  });
  
  ipcMain.handle('restart-adb-server', async () => {
    await adbManager.stopServer();
    return adbManager.startServer();
  });
  
  // Cloud connection handlers
  ipcMain.handle('cloud-connect', async (event, serverUrl, authToken) => {
    try {
      await cloudConnector.connect(serverUrl, authToken);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('cloud-disconnect', async () => {
    cloudConnector.disconnect();
    return { success: true };
  });
  
  ipcMain.handle('cloud-status', async () => {
    return cloudConnector.getStatus();
  });
  
  ipcMain.handle('cloud-save-config', async (event, config) => {
    const success = saveCloudConfig(config);
    return { success };
  });
  
  ipcMain.handle('cloud-load-config', async () => {
    return loadCloudConfig();
  });
}

app.whenReady().then(async () => {
  await initializeManagers();
  setupIpcHandlers();
  createWindow();
  
  // Start device monitoring
  deviceManager.startMonitoring();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Stop all sessions
  if (sessionManager) {
    sessionManager.stopAllSessions();
  }
  
  // Stop device monitoring
  if (deviceManager) {
    deviceManager.stopMonitoring();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (sessionManager) {
    sessionManager.stopAllSessions();
  }
});
