const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const AutoLaunch = require('auto-launch');
const { AdbManager } = require('./adb-manager');
const { ServerBridge } = require('./server-bridge');
const { SetupManager } = require('./setup-manager');
const { ScreenStreamer } = require('./screen-streamer');
const { AutoUpdater } = require('./auto-updater');

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

const store = new Store({
  defaults: {
    serverUrl: '',
    agentApiKey: '',
    agentName: '',
    autoStart: true,
    heartbeatInterval: 10000,
    adbPath: '',
    minimizeToTray: true,
    firstRun: true,
  },
});

let mainWindow = null;
let tray = null;
let adbManager = null;
let serverBridge = null;
let setupManager = null;
let screenStreamer = null;
let autoUpdater = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 800,
    minHeight: 550,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: getIconPath(),
    title: 'Mobile Manager Agent',
    show: false,
    autoHideMenuBar: true,
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting && store.get('minimizeToTray')) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function getIconPath() {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  // In development
  let iconPath = path.join(__dirname, '..', '..', 'build', iconName);
  // In production (packaged)
  if (!require('fs').existsSync(iconPath)) {
    iconPath = path.join(process.resourcesPath, 'build', iconName);
  }
  return iconPath;
}

function createTray() {
  const trayIcon = nativeImage.createFromPath(getIconPath());
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Status: Connecting...',
      enabled: false,
      id: 'status',
    },
    {
      label: 'Devices: 0',
      enabled: false,
      id: 'devices',
    },
    { type: 'separator' },
    {
      label: 'Open Web Dashboard',
      click: () => {
        const serverUrl = store.get('serverUrl');
        if (serverUrl) {
          shell.openExternal(serverUrl);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Mobile Manager Agent');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
}

function updateTrayMenu(status, deviceCount) {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: `Status: ${status}`,
      enabled: false,
    },
    {
      label: `Devices: ${deviceCount}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Open Web Dashboard',
      click: () => {
        const serverUrl = store.get('serverUrl');
        if (serverUrl) {
          shell.openExternal(serverUrl);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip(`Mobile Manager Agent - ${status} - ${deviceCount} device(s)`);
}

// Setup IPC handlers
function setupIPC() {
  // Config
  ipcMain.handle('get-config', () => {
    return {
      serverUrl: store.get('serverUrl'),
      agentApiKey: store.get('agentApiKey'),
      agentName: store.get('agentName'),
      autoStart: store.get('autoStart'),
      heartbeatInterval: store.get('heartbeatInterval'),
      minimizeToTray: store.get('minimizeToTray'),
      firstRun: store.get('firstRun'),
      adbPath: store.get('adbPath'),
    };
  });

  ipcMain.handle('save-config', async (_, config) => {
    if (config.serverUrl !== undefined) store.set('serverUrl', config.serverUrl);
    if (config.agentApiKey !== undefined) store.set('agentApiKey', config.agentApiKey);
    if (config.agentName !== undefined) store.set('agentName', config.agentName);
    if (config.autoStart !== undefined) {
      store.set('autoStart', config.autoStart);
      await setupAutoLaunch(config.autoStart);
    }
    if (config.heartbeatInterval !== undefined) store.set('heartbeatInterval', config.heartbeatInterval);
    if (config.minimizeToTray !== undefined) store.set('minimizeToTray', config.minimizeToTray);
    if (config.adbPath !== undefined) store.set('adbPath', config.adbPath);
    store.set('firstRun', false);

    // Restart bridge with new config
    if (serverBridge) {
      serverBridge.stop();
    }
    startBridge();
    return true;
  });

  // ADB / Setup
  ipcMain.handle('check-adb', async () => {
    return await setupManager.checkAdb();
  });

  ipcMain.handle('download-adb', async () => {
    return await setupManager.downloadAdb((progress) => {
      sendToRenderer('download-progress', progress);
    });
  });

  ipcMain.handle('get-devices', async () => {
    if (!adbManager) return [];
    return await adbManager.getDevicesWithInfo();
  });

  ipcMain.handle('get-status', () => {
    return {
      connected: serverBridge ? serverBridge.isConnected : false,
      deviceCount: adbManager ? adbManager.lastDeviceCount : 0,
      uptime: process.uptime(),
      lastHeartbeat: serverBridge ? serverBridge.lastHeartbeatTime : null,
      serverUrl: store.get('serverUrl'),
    };
  });

  // Device actions
  ipcMain.handle('reboot-device', async (_, serial) => {
    if (!adbManager) throw new Error('ADB not initialized');
    return await adbManager.reboot(serial);
  });

  ipcMain.handle('screenshot-device', async (_, serial) => {
    if (!adbManager) throw new Error('ADB not initialized');
    return await adbManager.screenshot(serial);
  });

  ipcMain.handle('restart-adb', async () => {
    if (!adbManager) throw new Error('ADB not initialized');
    return await adbManager.restartAdb();
  });

  ipcMain.handle('open-web-dashboard', () => {
    const serverUrl = store.get('serverUrl');
    if (serverUrl) shell.openExternal(serverUrl);
  });

  // Auto-update
  ipcMain.handle('get-version', () => app.getVersion());

  ipcMain.handle('check-update', async () => {
    if (!autoUpdater) return { error: 'Updater not initialized' };
    await autoUpdater.checkForUpdate();
    return autoUpdater.updateInfo || { has_update: false };
  });

  ipcMain.handle('download-update', async () => {
    if (!autoUpdater) return { error: 'Updater not initialized' };
    await autoUpdater.downloadAndInstall();
    return { started: true };
  });

  ipcMain.handle('install-update', () => {
    if (!autoUpdater) return { error: 'Updater not initialized' };
    autoUpdater.installNow();
    return { ok: true };
  });

  ipcMain.handle('open-update-download', () => {
    if (autoUpdater) autoUpdater.openDownloadPage(shell);
    return { ok: true };
  });

  // Screen streaming
  ipcMain.handle('get-stream-status', () => {
    if (!screenStreamer) return { active: false, streams: [] };
    const streams = [];
    for (const [serial, state] of screenStreamer.activeStreams) {
      streams.push({
        serial,
        connected: state.ws && state.ws.readyState === 1,
        streaming: state.streaming,
      });
    }
    return { active: true, streams };
  });
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

async function setupAutoLaunch(enabled) {
  const autoLauncher = new AutoLaunch({
    name: 'Mobile Manager Agent',
    isHidden: true,
  });

  try {
    if (enabled) {
      await autoLauncher.enable();
    } else {
      await autoLauncher.disable();
    }
  } catch (err) {
    console.error('Auto-launch setup failed:', err);
  }
}

function startBridge() {
  const serverUrl = store.get('serverUrl');
  const apiKey = store.get('agentApiKey');
  const adbPath = store.get('adbPath') || setupManager.getAdbPath();

  if (!serverUrl || !apiKey) {
    sendToRenderer('status-update', { connected: false, message: 'Not configured' });
    return;
  }

  // Initialize ADB manager
  adbManager = new AdbManager(adbPath);

  // Initialize server bridge
  serverBridge = new ServerBridge(serverUrl, apiKey, adbManager, store.get('heartbeatInterval'));

  serverBridge.on('status', (status) => {
    sendToRenderer('status-update', status);
    updateTrayMenu(status.connected ? 'Connected' : 'Disconnected', status.deviceCount || 0);
  });

  serverBridge.on('devices', (devices) => {
    sendToRenderer('devices-update', devices);
    // Update screen streamer with current devices
    if (screenStreamer) {
      screenStreamer.updateDevices(devices);
    }
  });

  serverBridge.on('heartbeat', (result) => {
    sendToRenderer('heartbeat-result', result);
  });

  serverBridge.on('error', (error) => {
    sendToRenderer('error', { message: error.message });
  });

  serverBridge.start();

  // Initialize auto-updater
  autoUpdater = new AutoUpdater(serverUrl, app.getVersion());

  autoUpdater.on('update-available', (info) => {
    sendToRenderer('update-available', info);
    // Also show in tray tooltip
    if (tray) tray.setToolTip(`Mobile Manager Agent - Update available: v${info.latestVersion}`);
  });

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('update-download-progress', progress);
  });

  autoUpdater.on('download-complete', (info) => {
    sendToRenderer('update-download-complete', info);
  });

  autoUpdater.on('update-error', (err) => {
    sendToRenderer('update-error', err);
  });

  autoUpdater.start();

  // Initialize screen streamer
  screenStreamer = new ScreenStreamer(serverUrl, apiKey, adbManager);

  screenStreamer.on('stream_connected', (data) => {
    sendToRenderer('stream-status', { serial: data.serial, status: 'connected' });
  });

  screenStreamer.on('stream_started', (data) => {
    sendToRenderer('stream-status', { serial: data.serial, status: 'streaming' });
  });

  screenStreamer.on('stream_stopped', (data) => {
    sendToRenderer('stream-status', { serial: data.serial, status: 'stopped' });
  });

  screenStreamer.on('stream_disconnected', (data) => {
    sendToRenderer('stream-status', { serial: data.serial, status: 'disconnected' });
  });
}

// App lifecycle
app.on('ready', async () => {
  setupManager = new SetupManager(app.getPath('userData'));
  setupIPC();
  createTray();
  createWindow();

  // Check ADB and auto-start bridge
  const adbStatus = await setupManager.checkAdb();
  if (adbStatus.available) {
    store.set('adbPath', adbStatus.path);
    startBridge();
  }

  // Setup auto-launch
  if (store.get('autoStart')) {
    await setupAutoLaunch(true);
  }
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  // Don't quit on window close - stay in tray
});

app.on('before-quit', () => {
  isQuitting = true;
  if (autoUpdater) {
    autoUpdater.stop();
  }
  if (screenStreamer) {
    screenStreamer.stopAll();
  }
  if (serverBridge) {
    serverBridge.stop();
  }
});

app.on('activate', () => {
  if (!mainWindow) {
    createWindow();
  }
});
