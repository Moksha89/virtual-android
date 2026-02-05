// Android Remote Control - Renderer Process
class App {
  constructor() {
    this.currentView = 'devices';
    this.devices = [];
    this.sessions = [];
    this.selectedDevice = null;
    this.systemStatus = null;
    
    this.init();
  }
  
  async init() {
    // Set up navigation
    this.setupNavigation();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Set up IPC listeners
    this.setupIpcListeners();
    
    // Load initial data
    await this.loadSystemStatus();
    await this.loadDevices();
    
    // Set app version
    this.setAppVersion();
  }
  
  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        this.switchView(view);
      });
    });
  }
  
  switchView(viewName) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });
    
    // Update views
    document.querySelectorAll('.view').forEach(view => {
      view.classList.toggle('active', view.id === `${viewName}View`);
    });
    
    this.currentView = viewName;
    
    // Load view-specific data
    if (viewName === 'sessions') {
      this.loadSessions();
    }
  }
  
  setupEventListeners() {
    // Refresh devices button
    document.getElementById('refreshDevicesBtn').addEventListener('click', () => {
      this.loadDevices();
    });
    
    // Restart ADB button
    document.getElementById('restartAdbBtn').addEventListener('click', async () => {
      this.showLoading('Restarting ADB server...');
      try {
        await window.electronAPI.restartAdbServer();
        this.showToast('ADB server restarted', 'success');
        await this.loadDevices();
      } catch (error) {
        this.showToast('Failed to restart ADB: ' + error.message, 'error');
      }
      this.hideLoading();
    });
    
    // Install all button
    document.getElementById('installAllBtn')?.addEventListener('click', () => {
      this.installAllComponents();
    });
    
    // Go to settings button
    document.getElementById('goToSettingsBtn')?.addEventListener('click', () => {
      this.switchView('settings');
    });
    
    // Install ADB button
    document.getElementById('installAdbBtn').addEventListener('click', () => {
      this.installAdb();
    });
    
    // Install scrcpy button
    document.getElementById('installScrcpyBtn').addEventListener('click', () => {
      this.installScrcpy();
    });
    
    // Install drivers button
    document.getElementById('installDriversBtn').addEventListener('click', () => {
      this.installDrivers();
    });
    
    // Check updates button
    document.getElementById('checkUpdatesBtn').addEventListener('click', () => {
      this.checkUpdates();
    });
    
    // Stop all sessions button
    document.getElementById('stopAllSessionsBtn').addEventListener('click', () => {
      this.stopAllSessions();
    });
    
    // Modal close button
    document.getElementById('closeModal').addEventListener('click', () => {
      this.closeModal();
    });
    
    document.getElementById('modalCancelBtn').addEventListener('click', () => {
      this.closeModal();
    });
    
    // Modal start session button
    document.getElementById('modalStartSessionBtn').addEventListener('click', () => {
      this.startSessionFromModal();
    });
    
    // Close modal on backdrop click
    document.getElementById('deviceModal').addEventListener('click', (e) => {
      if (e.target.id === 'deviceModal') {
        this.closeModal();
      }
    });
  }
  
  setupIpcListeners() {
    // Device events
    window.electronAPI.onDevicesChanged((devices) => {
      this.devices = devices;
      this.renderDevices();
    });
    
    window.electronAPI.onDeviceConnected((device) => {
      this.showToast(`Device connected: ${device.model || device.serial}`, 'success');
    });
    
    window.electronAPI.onDeviceDisconnected((device) => {
      this.showToast(`Device disconnected: ${device.model || device.serial}`, 'warning');
    });
    
    // Session events
    window.electronAPI.onSessionStarted((session) => {
      this.showToast(`Session started for ${session.device?.model || session.serial}`, 'success');
      this.loadSessions();
    });
    
    window.electronAPI.onSessionEnded((session) => {
      this.showToast(`Session ended`, 'success');
      this.loadSessions();
    });
    
    // Download progress
    window.electronAPI.onDownloadProgress((data) => {
      this.updateDownloadProgress(data.type, data.progress);
    });
  }
  
  async setAppVersion() {
    try {
      const version = await window.electronAPI.getAppVersion();
      document.getElementById('appVersion').textContent = `v${version}`;
    } catch (error) {
      // Ignore
    }
  }
  
  async loadSystemStatus() {
    try {
      this.systemStatus = await window.electronAPI.getSystemStatus();
      this.updateSystemStatusUI();
      this.checkSetupRequired();
    } catch (error) {
      console.error('Failed to load system status:', error);
    }
  }
  
  updateSystemStatusUI() {
    const status = this.systemStatus;
    
    // Sidebar status dots
    const adbDot = document.getElementById('adbStatus');
    const scrcpyDot = document.getElementById('scrcpyStatus');
    
    adbDot.className = 'status-dot ' + (status.adb.installed ? 'success' : 'error');
    scrcpyDot.className = 'status-dot ' + (status.scrcpy.installed ? 'success' : 'error');
    
    // Settings page badges
    const adbBadge = document.getElementById('adbStatusBadge');
    const scrcpyBadge = document.getElementById('scrcpyStatusBadge');
    const adbVersion = document.getElementById('adbVersionText');
    const scrcpyVersion = document.getElementById('scrcpyVersionText');
    
    if (status.adb.installed) {
      adbBadge.textContent = 'Installed';
      adbBadge.className = 'status-badge installed';
      adbVersion.textContent = status.adb.version ? `v${status.adb.version}` : '';
      document.getElementById('installAdbBtn').textContent = 'Reinstall';
    } else {
      adbBadge.textContent = 'Not Installed';
      adbBadge.className = 'status-badge not-installed';
      adbVersion.textContent = '';
      document.getElementById('installAdbBtn').textContent = 'Install';
    }
    
    if (status.scrcpy.installed) {
      scrcpyBadge.textContent = 'Installed';
      scrcpyBadge.className = 'status-badge installed';
      scrcpyVersion.textContent = status.scrcpy.version ? `v${status.scrcpy.version}` : '';
      document.getElementById('installScrcpyBtn').textContent = 'Reinstall';
    } else {
      scrcpyBadge.textContent = 'Not Installed';
      scrcpyBadge.className = 'status-badge not-installed';
      scrcpyVersion.textContent = '';
      document.getElementById('installScrcpyBtn').textContent = 'Install';
    }
  }
  
  checkSetupRequired() {
    const status = this.systemStatus;
    const setupBanner = document.getElementById('setupBanner');
    
    if (!status.adb.installed || !status.scrcpy.installed) {
      const missing = [];
      if (!status.adb.installed) missing.push('ADB');
      if (!status.scrcpy.installed) missing.push('scrcpy');
      
      document.getElementById('setupMessage').textContent = 
        `The following components need to be installed: ${missing.join(', ')}`;
      setupBanner.style.display = 'flex';
    } else {
      setupBanner.style.display = 'none';
    }
  }
  
  async loadDevices() {
    try {
      this.devices = await window.electronAPI.refreshDevices();
      this.renderDevices();
    } catch (error) {
      console.error('Failed to load devices:', error);
      this.showToast('Failed to load devices', 'error');
    }
  }
  
  renderDevices() {
    const grid = document.getElementById('deviceGrid');
    const emptyState = document.getElementById('emptyDevices');
    
    // Clear existing device cards (keep empty state)
    const existingCards = grid.querySelectorAll('.device-card');
    existingCards.forEach(card => card.remove());
    
    if (this.devices.length === 0) {
      emptyState.style.display = 'flex';
      return;
    }
    
    emptyState.style.display = 'none';
    
    this.devices.forEach(device => {
      const card = this.createDeviceCard(device);
      grid.appendChild(card);
    });
  }
  
  createDeviceCard(device) {
    const card = document.createElement('div');
    card.className = 'device-card';
    
    // Add status class
    if (device.status === 'device') {
      card.classList.add(device.isLocked ? 'active' : '');
    } else if (device.status === 'unauthorized') {
      card.classList.add('unauthorized');
    } else {
      card.classList.add('offline');
    }
    
    // Get status badge
    let statusBadge = '';
    let statusClass = '';
    if (device.status === 'device') {
      if (device.isLocked) {
        statusBadge = 'In Use';
        statusClass = 'busy';
      } else {
        statusBadge = 'Online';
        statusClass = 'online';
      }
    } else if (device.status === 'unauthorized') {
      statusBadge = 'Unauthorized';
      statusClass = 'unauthorized';
    } else {
      statusBadge = 'Offline';
      statusClass = 'offline';
    }
    
    // Get device details
    const details = device.details || {};
    const model = details.model || device.model || 'Unknown Device';
    const brand = details.brand || details.manufacturer || '';
    const androidVersion = details.release || 'Unknown';
    const batteryLevel = details.batteryLevel !== null ? `${details.batteryLevel}%` : 'N/A';
    
    card.innerHTML = `
      <div class="device-header">
        <div class="device-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
            <line x1="12" y1="18" x2="12" y2="18"></line>
          </svg>
        </div>
        <div class="device-info">
          <div class="device-name">${this.escapeHtml(model)}</div>
          <div class="device-model">${this.escapeHtml(brand)} • ${this.escapeHtml(device.serial)}</div>
        </div>
        <span class="device-status-badge ${statusClass}">${statusBadge}</span>
      </div>
      <div class="device-details">
        <div class="detail-item">
          <span class="detail-label">Android</span>
          <span class="detail-value">${this.escapeHtml(androidVersion)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Battery</span>
          <span class="detail-value">${batteryLevel}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Screen</span>
          <span class="detail-value">${this.escapeHtml(details.screenSize || 'N/A')}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Status</span>
          <span class="detail-value">${details.batteryStatus || 'N/A'}</span>
        </div>
      </div>
      <div class="device-actions">
        ${device.status === 'device' && !device.isLocked ? `
          <button class="btn btn-primary btn-sm" data-action="start-session">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Start Session
          </button>
        ` : ''}
        ${device.isLocked ? `
          <button class="btn btn-danger btn-sm" data-action="stop-session">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            </svg>
            Stop Session
          </button>
        ` : ''}
        ${device.status === 'unauthorized' ? `
          <button class="btn btn-secondary btn-sm" disabled>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            Accept on Phone
          </button>
        ` : ''}
        <button class="btn btn-secondary btn-sm" data-action="view-details">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          Details
        </button>
      </div>
    `;
    
    // Add event listeners
    card.querySelector('[data-action="start-session"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openDeviceModal(device);
    });
    
    card.querySelector('[data-action="stop-session"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.stopSession(device.serial);
    });
    
    card.querySelector('[data-action="view-details"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openDeviceModal(device);
    });
    
    card.addEventListener('click', () => {
      this.openDeviceModal(device);
    });
    
    return card;
  }
  
  openDeviceModal(device) {
    this.selectedDevice = device;
    const modal = document.getElementById('deviceModal');
    const modalBody = document.getElementById('modalBody');
    const startBtn = document.getElementById('modalStartSessionBtn');
    
    const details = device.details || {};
    const model = details.model || device.model || 'Unknown Device';
    
    document.getElementById('modalDeviceName').textContent = model;
    
    // Show/hide start session button based on device status
    if (device.status === 'device' && !device.isLocked) {
      startBtn.style.display = 'inline-flex';
      startBtn.textContent = 'Start Session';
    } else if (device.isLocked) {
      startBtn.style.display = 'inline-flex';
      startBtn.textContent = 'Stop Session';
      startBtn.className = 'btn btn-danger';
    } else {
      startBtn.style.display = 'none';
    }
    
    modalBody.innerHTML = `
      <div class="device-detail-grid">
        <div class="device-detail-item">
          <div class="label">Serial</div>
          <div class="value">${this.escapeHtml(device.serial)}</div>
        </div>
        <div class="device-detail-item">
          <div class="label">Status</div>
          <div class="value">${this.escapeHtml(device.status)}</div>
        </div>
        <div class="device-detail-item">
          <div class="label">Model</div>
          <div class="value">${this.escapeHtml(details.model || device.model || 'Unknown')}</div>
        </div>
        <div class="device-detail-item">
          <div class="label">Brand</div>
          <div class="value">${this.escapeHtml(details.brand || details.manufacturer || 'Unknown')}</div>
        </div>
        <div class="device-detail-item">
          <div class="label">Android Version</div>
          <div class="value">${this.escapeHtml(details.release || 'Unknown')}</div>
        </div>
        <div class="device-detail-item">
          <div class="label">SDK Level</div>
          <div class="value">${this.escapeHtml(details.sdk || 'Unknown')}</div>
        </div>
        <div class="device-detail-item">
          <div class="label">Screen Size</div>
          <div class="value">${this.escapeHtml(details.screenSize || 'Unknown')}</div>
        </div>
        <div class="device-detail-item">
          <div class="label">Battery</div>
          <div class="value">${details.batteryLevel !== null ? details.batteryLevel + '%' : 'Unknown'} (${details.batteryStatus || 'Unknown'})</div>
        </div>
      </div>
      
      ${device.status === 'device' && !device.isLocked ? `
        <div class="session-options">
          <h4>Session Options</h4>
          <div class="form-group">
            <label for="modalResolution">Max Resolution</label>
            <select id="modalResolution" class="form-control">
              <option value="1920">1920px (Full HD)</option>
              <option value="1280" selected>1280px (HD)</option>
              <option value="1024">1024px</option>
              <option value="800">800px</option>
            </select>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="modalStayAwake" checked>
              <span>Keep device awake</span>
            </label>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="modalShowTouches">
              <span>Show touch indicators</span>
            </label>
          </div>
        </div>
      ` : ''}
      
      ${device.status === 'unauthorized' ? `
        <div class="help-card warning" style="margin-top: 20px;">
          <h3>Device Unauthorized</h3>
          <p>Please check your phone for a USB debugging authorization prompt and tap "Allow".</p>
          <p>If you don't see a prompt:</p>
          <ol>
            <li>Go to Settings → Developer Options</li>
            <li>Tap "Revoke USB debugging authorizations"</li>
            <li>Reconnect the USB cable</li>
            <li>Accept the new authorization prompt</li>
          </ol>
        </div>
      ` : ''}
    `;
    
    modal.classList.add('active');
  }
  
  closeModal() {
    document.getElementById('deviceModal').classList.remove('active');
    this.selectedDevice = null;
    
    // Reset start button
    const startBtn = document.getElementById('modalStartSessionBtn');
    startBtn.className = 'btn btn-primary';
    startBtn.textContent = 'Start Session';
  }
  
  async startSessionFromModal() {
    if (!this.selectedDevice) return;
    
    const device = this.selectedDevice;
    
    // If device is locked, stop the session instead
    if (device.isLocked) {
      await this.stopSession(device.serial);
      this.closeModal();
      return;
    }
    
    // Get options from modal
    const resolution = document.getElementById('modalResolution')?.value || 1280;
    const stayAwake = document.getElementById('modalStayAwake')?.checked ?? true;
    const showTouches = document.getElementById('modalShowTouches')?.checked ?? false;
    
    this.closeModal();
    await this.startSession(device.serial, {
      maxSize: parseInt(resolution),
      stayAwake,
      showTouches
    });
  }
  
  async startSession(serial, options = {}) {
    this.showLoading('Starting session...');
    
    try {
      const result = await window.electronAPI.startSession(serial, options);
      
      if (result.success) {
        this.showToast('Session started successfully', 'success');
        await this.loadDevices();
      } else {
        this.showToast('Failed to start session: ' + result.error, 'error');
      }
    } catch (error) {
      this.showToast('Failed to start session: ' + error.message, 'error');
    }
    
    this.hideLoading();
  }
  
  async stopSession(serial) {
    this.showLoading('Stopping session...');
    
    try {
      const result = await window.electronAPI.stopSession(serial);
      
      if (result.success) {
        this.showToast('Session stopped', 'success');
        await this.loadDevices();
      } else {
        this.showToast('Failed to stop session: ' + result.error, 'error');
      }
    } catch (error) {
      this.showToast('Failed to stop session: ' + error.message, 'error');
    }
    
    this.hideLoading();
  }
  
  async stopAllSessions() {
    if (this.sessions.length === 0) {
      this.showToast('No active sessions', 'warning');
      return;
    }
    
    this.showLoading('Stopping all sessions...');
    
    for (const session of this.sessions) {
      try {
        await window.electronAPI.stopSession(session.serial);
      } catch (error) {
        console.error('Failed to stop session:', error);
      }
    }
    
    await this.loadDevices();
    await this.loadSessions();
    this.hideLoading();
    this.showToast('All sessions stopped', 'success');
  }
  
  async loadSessions() {
    try {
      this.sessions = await window.electronAPI.getActiveSessions();
      this.renderSessions();
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }
  
  renderSessions() {
    const list = document.getElementById('sessionsList');
    const emptyState = document.getElementById('emptySessions');
    
    // Clear existing session cards
    const existingCards = list.querySelectorAll('.session-card');
    existingCards.forEach(card => card.remove());
    
    if (this.sessions.length === 0) {
      emptyState.style.display = 'flex';
      return;
    }
    
    emptyState.style.display = 'none';
    
    this.sessions.forEach(session => {
      const card = this.createSessionCard(session);
      list.appendChild(card);
    });
  }
  
  createSessionCard(session) {
    const card = document.createElement('div');
    card.className = 'session-card';
    
    const startTime = new Date(session.startedAt);
    const duration = this.formatDuration(Date.now() - startTime.getTime());
    
    card.innerHTML = `
      <div class="device-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
          <line x1="12" y1="18" x2="12" y2="18"></line>
        </svg>
      </div>
      <div class="session-info">
        <div class="session-device">${this.escapeHtml(session.device?.model || session.serial)}</div>
        <div class="session-meta">
          <span>Duration: ${duration}</span>
          <span>Inputs: ${session.inputCount || 0}</span>
          <span>Status: ${session.status}</span>
        </div>
      </div>
      <div class="session-actions">
        <button class="btn btn-danger btn-sm" data-action="stop">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          </svg>
          Stop
        </button>
      </div>
    `;
    
    card.querySelector('[data-action="stop"]').addEventListener('click', () => {
      this.stopSession(session.serial);
    });
    
    return card;
  }
  
  async installAllComponents() {
    await this.installAdb();
    await this.installScrcpy();
  }
  
  async installAdb() {
    this.showDownloadModal('Downloading ADB...');
    
    try {
      const result = await window.electronAPI.installAdb();
      
      if (result.success) {
        this.showToast('ADB installed successfully', 'success');
        await this.loadSystemStatus();
      } else {
        this.showToast('Failed to install ADB: ' + result.error, 'error');
      }
    } catch (error) {
      this.showToast('Failed to install ADB: ' + error.message, 'error');
    }
    
    this.hideDownloadModal();
  }
  
  async installScrcpy() {
    this.showDownloadModal('Downloading scrcpy...');
    
    try {
      const result = await window.electronAPI.installScrcpy();
      
      if (result.success) {
        this.showToast('scrcpy installed successfully', 'success');
        await this.loadSystemStatus();
      } else {
        this.showToast('Failed to install scrcpy: ' + result.error, 'error');
      }
    } catch (error) {
      this.showToast('Failed to install scrcpy: ' + error.message, 'error');
    }
    
    this.hideDownloadModal();
  }
  
  async installDrivers() {
    this.showDownloadModal('Downloading USB drivers...');
    
    try {
      const result = await window.electronAPI.installUsbDrivers();
      
      if (result.success) {
        this.showToast(result.message || 'USB drivers downloaded', 'success');
        if (result.driverPath) {
          this.showToast('Please install drivers manually from: ' + result.driverPath, 'warning');
        }
      } else {
        this.showToast('Failed to download drivers: ' + result.error, 'error');
      }
    } catch (error) {
      this.showToast('Failed to download drivers: ' + error.message, 'error');
    }
    
    this.hideDownloadModal();
  }
  
  async checkUpdates() {
    this.showLoading('Checking for updates...');
    
    try {
      const updates = await window.electronAPI.checkUpdates();
      
      if (updates.adb?.updateAvailable || updates.scrcpy?.updateAvailable) {
        let message = 'Updates available: ';
        const parts = [];
        if (updates.adb?.updateAvailable) parts.push('ADB');
        if (updates.scrcpy?.updateAvailable) parts.push('scrcpy');
        message += parts.join(', ');
        this.showToast(message, 'warning');
      } else {
        this.showToast('All components are up to date', 'success');
      }
    } catch (error) {
      this.showToast('Failed to check updates: ' + error.message, 'error');
    }
    
    this.hideLoading();
  }
  
  showDownloadModal(title) {
    document.getElementById('downloadTitle').textContent = title;
    document.getElementById('downloadProgress').style.width = '0%';
    document.getElementById('downloadProgressText').textContent = '0%';
    document.getElementById('downloadModal').classList.add('active');
  }
  
  hideDownloadModal() {
    document.getElementById('downloadModal').classList.remove('active');
  }
  
  updateDownloadProgress(type, progress) {
    document.getElementById('downloadProgress').style.width = `${progress}%`;
    document.getElementById('downloadProgressText').textContent = `${progress}%`;
  }
  
  showLoading(message = 'Loading...') {
    document.getElementById('loadingMessage').textContent = message;
    document.getElementById('loadingOverlay').classList.add('active');
  }
  
  hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
  }
  
  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
      error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
    };
    
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span class="toast-message">${this.escapeHtml(message)}</span>
      <button class="toast-close">×</button>
    `;
    
    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.remove();
    });
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 5000);
  }
  
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
  
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
