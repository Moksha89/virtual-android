// State
let currentTab = 'devices';
let logs = [];
let devices = [];
let config = {};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  config = await window.api.getConfig();

  if (config.firstRun || !config.serverUrl || !config.agentApiKey) {
    showScreen('setup');
    checkAdbStatus();
  } else {
    showScreen('dashboard');
    loadSettingsForm();
    startPolling();
  }

  // Listen for events from main process
  window.api.onStatusUpdate((status) => {
    updateConnectionStatus(status);
    addLog(status.connected ? 'success' : 'warning', status.message);
  });

  window.api.onDevicesUpdate((deviceList) => {
    devices = deviceList;
    renderDevices();
    document.getElementById('stat-devices').textContent = deviceList.length;
  });

  window.api.onHeartbeatResult((result) => {
    if (result.success) {
      document.getElementById('stat-heartbeat').textContent = formatTime(result.time);
    }
  });

  window.api.onDownloadProgress((progress) => {
    const fill = document.getElementById('progress-fill');
    const text = document.getElementById('progress-text');
    if (fill) fill.style.width = progress.percent + '%';
    if (text) text.textContent = progress.message;
  });

  window.api.onError((error) => {
    addLog('error', error.message);
  });

  // Auto-update events
  window.api.onUpdateAvailable((info) => {
    showUpdateBanner(info);
    addLog('info', `Update available: v${info.latestVersion} (current: v${info.currentVersion})`);
  });

  window.api.onUpdateDownloadProgress((progress) => {
    showUpdateProgress(progress.percent);
  });

  window.api.onUpdateDownloadComplete((info) => {
    showUpdateReady(info.version);
    addLog('success', `Update v${info.version} downloaded and ready to install`);
  });

  window.api.onUpdateError((err) => {
    hideUpdateProgress();
    addLog('error', `Update error: ${err.message}`);
  });

  // Show current version in header
  window.api.getVersion().then(v => {
    const el = document.getElementById('app-version');
    if (el) el.textContent = `v${v}`;
  });

  // Update uptime every second
  setInterval(updateUptime, 1000);
});

// Screen management
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(name + '-screen').classList.remove('hidden');
}

// Setup flow
async function checkAdbStatus() {
  const statusEl = document.getElementById('adb-status');
  const downloadBtn = document.getElementById('btn-download-adb');

  try {
    const result = await window.api.checkAdb();
    if (result.available) {
      statusEl.innerHTML = `<span class="status-icon">✅</span><span>ADB found: ${result.path}</span>`;
      statusEl.className = 'status-box success';
      downloadBtn.classList.add('hidden');
    } else {
      statusEl.innerHTML = '<span class="status-icon">⚠️</span><span>ADB not found. Download it to continue.</span>';
      statusEl.className = 'status-box warning';
      downloadBtn.classList.remove('hidden');
    }
  } catch (err) {
    statusEl.innerHTML = `<span class="status-icon">❌</span><span>Error checking ADB: ${err.message}</span>`;
    statusEl.className = 'status-box error';
    downloadBtn.classList.remove('hidden');
  }
}

async function downloadAdb() {
  const downloadBtn = document.getElementById('btn-download-adb');
  const progressEl = document.getElementById('download-progress');

  downloadBtn.classList.add('hidden');
  progressEl.classList.remove('hidden');

  try {
    const result = await window.api.downloadAdb();
    document.getElementById('adb-status').innerHTML =
      `<span class="status-icon">✅</span><span>ADB installed: ${result.path}</span>`;
    document.getElementById('adb-status').className = 'status-box success';
    progressEl.classList.add('hidden');
  } catch (err) {
    document.getElementById('adb-status').innerHTML =
      `<span class="status-icon">❌</span><span>Download failed: ${err.message}</span>`;
    document.getElementById('adb-status').className = 'status-box error';
    downloadBtn.classList.remove('hidden');
    progressEl.classList.add('hidden');
  }
}

async function saveSetup() {
  const serverUrl = document.getElementById('server-url').value.trim();
  const agentApiKey = document.getElementById('agent-api-key').value.trim();
  const agentName = document.getElementById('agent-name').value.trim() || 'Home Gateway';
  const autoStart = document.getElementById('auto-start').checked;

  if (!serverUrl) {
    alert('Please enter the server URL');
    return;
  }
  if (!agentApiKey) {
    alert('Please enter the agent API key');
    return;
  }

  await window.api.saveConfig({
    serverUrl,
    agentApiKey,
    agentName,
    autoStart,
  });

  config = await window.api.getConfig();
  showScreen('dashboard');
  loadSettingsForm();
  startPolling();
  addLog('info', 'Configuration saved, connecting to server...');
}

// Dashboard
function updateConnectionStatus(status) {
  const badge = document.getElementById('connection-badge');
  if (status.connected) {
    badge.className = 'badge badge-online';
    badge.textContent = 'Connected';
  } else {
    badge.className = 'badge badge-offline';
    badge.textContent = 'Disconnected';
  }
  if (status.deviceCount !== undefined) {
    document.getElementById('stat-devices').textContent = status.deviceCount;
  }
}

function renderDevices() {
  const container = document.getElementById('devices-list');

  if (!devices || devices.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
          <line x1="12" y1="18" x2="12.01" y2="18"/>
        </svg>
        <p>No devices connected</p>
        <small>Connect Android phones via USB to this PC</small>
      </div>`;
    return;
  }

  container.innerHTML = devices.map(device => {
    const batteryClass = (device.batteryLevel || 0) < 20 ? 'low' :
                         (device.batteryLevel || 0) < 50 ? 'medium' : 'high';
    return `
      <div class="device-card">
        <div class="device-card-header">
          <div>
            <div class="device-name">${device.model || 'Unknown Device'}</div>
            <div class="device-serial">${device.serial}</div>
          </div>
          <div class="device-status"></div>
        </div>
        <div class="device-info">
          <div class="device-info-item">
            <span class="device-info-label">Brand:</span>
            <span>${device.manufacturer || '-'}</span>
          </div>
          <div class="device-info-item">
            <span class="device-info-label">Android:</span>
            <span>${device.androidVersion || '-'}</span>
          </div>
          <div class="device-info-item">
            <span class="device-info-label">Screen:</span>
            <span>${device.screenResolution || '-'}</span>
          </div>
          <div class="device-info-item">
            <span class="battery-indicator">
              🔋 <span class="battery-level ${batteryClass}">${device.batteryLevel !== null ? device.batteryLevel + '%' : '-'}</span>
              ${device.batteryStatus === 'Charging' ? '⚡' : ''}
            </span>
          </div>
        </div>
        <div class="device-actions">
          <button class="btn btn-small" onclick="screenshotDevice('${device.serial}')">📸 Screenshot</button>
          <button class="btn btn-small btn-danger" onclick="rebootDevice('${device.serial}')">🔄 Reboot</button>
        </div>
      </div>`;
  }).join('');
}

// Tab switching
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

  const tabs = document.querySelectorAll('.tab');
  const tabMap = { devices: 0, logs: 1, settings: 2 };
  if (tabs[tabMap[tab]]) tabs[tabMap[tab]].classList.add('active');

  document.getElementById('tab-' + tab).classList.add('active');
}

function showSettings() {
  switchTab('settings');
}

// Device actions
async function refreshDevices() {
  try {
    devices = await window.api.getDevices();
    renderDevices();
    document.getElementById('stat-devices').textContent = devices.length;
    addLog('info', `Refreshed: ${devices.length} device(s) found`);
  } catch (err) {
    addLog('error', `Refresh failed: ${err.message}`);
  }
}

async function restartAdb() {
  try {
    addLog('info', 'Restarting ADB server...');
    const result = await window.api.restartAdb();
    if (result.success) {
      addLog('success', 'ADB server restarted');
      setTimeout(refreshDevices, 2000);
    } else {
      addLog('error', `ADB restart failed: ${result.error}`);
    }
  } catch (err) {
    addLog('error', `ADB restart error: ${err.message}`);
  }
}

async function rebootDevice(serial) {
  if (!confirm(`Reboot device ${serial}?`)) return;
  try {
    await window.api.rebootDevice(serial);
    addLog('success', `Rebooting device ${serial}`);
  } catch (err) {
    addLog('error', `Reboot failed: ${err.message}`);
  }
}

async function screenshotDevice(serial) {
  try {
    addLog('info', `Taking screenshot of ${serial}...`);
    const result = await window.api.screenshotDevice(serial);
    if (result.success) {
      addLog('success', `Screenshot captured for ${serial}`);
    }
  } catch (err) {
    addLog('error', `Screenshot failed: ${err.message}`);
  }
}

function openWebDashboard() {
  window.api.openWebDashboard();
}

// Settings
function loadSettingsForm() {
  document.getElementById('set-server-url').value = config.serverUrl || '';
  document.getElementById('set-api-key').value = config.agentApiKey || '';
  document.getElementById('set-agent-name').value = config.agentName || '';
  document.getElementById('set-heartbeat').value = config.heartbeatInterval || 10000;
  document.getElementById('set-auto-start').checked = config.autoStart !== false;
  document.getElementById('set-minimize-tray').checked = config.minimizeToTray !== false;
  document.getElementById('set-adb-path').value = config.adbPath || '';
  document.getElementById('stat-server').textContent = config.serverUrl ?
    new URL(config.serverUrl).host : '-';
  // Show version in settings
  window.api.getVersion().then(v => {
    const el = document.getElementById('settings-version');
    if (el) el.textContent = `v${v}`;
  });
}

async function saveSettings() {
  const newConfig = {
    serverUrl: document.getElementById('set-server-url').value.trim(),
    agentApiKey: document.getElementById('set-api-key').value.trim(),
    agentName: document.getElementById('set-agent-name').value.trim(),
    heartbeatInterval: parseInt(document.getElementById('set-heartbeat').value, 10),
    autoStart: document.getElementById('set-auto-start').checked,
    minimizeToTray: document.getElementById('set-minimize-tray').checked,
    adbPath: document.getElementById('set-adb-path').value.trim(),
  };

  await window.api.saveConfig(newConfig);
  config = await window.api.getConfig();
  addLog('success', 'Settings saved and applied');
  document.getElementById('stat-server').textContent = config.serverUrl ?
    new URL(config.serverUrl).host : '-';
}

// Logging
function addLog(type, message) {
  const time = new Date().toLocaleTimeString();
  logs.unshift({ type, message, time });
  if (logs.length > 200) logs.pop();

  const logsList = document.getElementById('logs-list');
  if (logsList) {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.innerHTML = `<span class="log-time">${time}</span><span>${message}</span>`;
    logsList.prepend(entry);

    // Keep max 200 entries in DOM
    while (logsList.children.length > 200) {
      logsList.removeChild(logsList.lastChild);
    }
  }
}

function clearLogs() {
  logs = [];
  document.getElementById('logs-list').innerHTML = '';
}

// Utilities
function formatTime(isoString) {
  if (!isoString) return 'Never';
  const d = new Date(isoString);
  return d.toLocaleTimeString();
}

let startTime = Date.now();
function updateUptime() {
  const seconds = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const el = document.getElementById('stat-uptime');
  if (el) {
    if (h > 0) el.textContent = `${h}h ${m}m`;
    else if (m > 0) el.textContent = `${m}m ${s}s`;
    else el.textContent = `${s}s`;
  }
}

// Auto-update UI
let pendingUpdateInfo = null;

function showUpdateBanner(info) {
  pendingUpdateInfo = info;
  const banner = document.getElementById('update-banner');
  const title = document.getElementById('update-title');
  const subtitle = document.getElementById('update-subtitle');
  const btnDownload = document.getElementById('btn-download-update');
  const btnInstall = document.getElementById('btn-install-now');
  const btnOpen = document.getElementById('btn-open-download');

  title.textContent = `Update Available: v${info.latestVersion}`;
  subtitle.textContent = info.releaseNotes || 'A new version is ready to download';
  btnDownload.style.display = '';
  btnInstall.style.display = 'none';
  btnOpen.style.display = '';
  banner.classList.remove('hidden');
}

function dismissUpdateBanner() {
  document.getElementById('update-banner').classList.add('hidden');
}

async function downloadUpdate() {
  const btnDownload = document.getElementById('btn-download-update');
  btnDownload.textContent = 'Downloading...';
  btnDownload.disabled = true;
  showUpdateProgress(0);
  addLog('info', 'Downloading update...');
  try {
    await window.api.downloadUpdate();
  } catch (err) {
    addLog('error', `Download failed: ${err.message}`);
    btnDownload.textContent = 'Download & Install';
    btnDownload.disabled = false;
    hideUpdateProgress();
  }
}

function showUpdateProgress(percent) {
  const bar = document.getElementById('update-progress-bar');
  const fill = document.getElementById('update-progress-fill');
  const text = document.getElementById('update-progress-text');
  bar.classList.remove('hidden');
  fill.style.width = percent + '%';
  text.textContent = `Downloading update... ${percent}%`;
}

function hideUpdateProgress() {
  document.getElementById('update-progress-bar').classList.add('hidden');
}

function showUpdateReady(version) {
  hideUpdateProgress();
  const btnDownload = document.getElementById('btn-download-update');
  const btnInstall = document.getElementById('btn-install-now');
  btnDownload.style.display = 'none';
  btnInstall.style.display = '';
  document.getElementById('update-title').textContent = `Update Ready: v${version}`;
  document.getElementById('update-subtitle').textContent = 'Download complete. Click to restart and install.';
}

async function installUpdateNow() {
  if (!confirm('The agent will restart to install the update. Continue?')) return;
  addLog('info', 'Installing update and restarting...');
  await window.api.installUpdate();
}

function openUpdateDownload() {
  window.api.openUpdateDownload();
}

async function manualCheckUpdate() {
  addLog('info', 'Checking for updates...');
  const result = await window.api.checkUpdate();
  if (result && result.has_update) {
    showUpdateBanner({
      currentVersion: result.current_version,
      latestVersion: result.latest_version,
      releaseNotes: result.release_notes,
    });
  } else {
    addLog('info', 'You are running the latest version');
  }
}

// Polling
let pollTimer = null;
function startPolling() {
  // Initial fetch
  refreshDevices();

  // Poll every 5 seconds for device updates
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const status = await window.api.getStatus();
      updateConnectionStatus(status);
      document.getElementById('stat-heartbeat').textContent = formatTime(status.lastHeartbeat);
    } catch { /* ignore */ }
  }, 5000);
}
