import { useState, useEffect } from 'react';
import { Settings, Server, Shield, Bell } from 'lucide-react';
import api from '../services/api';

export default function SettingsPage() {
  const [health, setHealth] = useState<{ status: string; version: string; websocket_clients: number } | null>(null);

  useEffect(() => {
    api.getHealth().then(setHealth).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-dark-400 mt-1">System configuration and status</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Status */}
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Server className="w-4 h-4 text-primary-400" />
            System Status
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">API Status</span>
              <span className={`font-medium ${health?.status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                {health?.status || 'Checking...'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Version</span>
              <span className="text-dark-200">{health?.version || '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">WebSocket Clients</span>
              <span className="text-dark-200">{health?.websocket_clients ?? '-'}</span>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary-400" />
            Security
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Authentication</span>
              <span className="text-green-400">JWT Enabled</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Agent Auth</span>
              <span className="text-green-400">API Key</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-dark-400">Encryption</span>
              <span className="text-dark-200">TLS (when configured)</span>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary-400" />
            Notifications
          </h3>
          <p className="text-sm text-dark-400">
            Notification settings will be available in a future update. You&apos;ll be able to set up alerts
            for device disconnections, low battery, and more.
          </p>
        </div>

        {/* About */}
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary-400" />
            About
          </h3>
          <div className="space-y-2 text-sm text-dark-400">
            <p>Mobile Manager v1.0.0 - Phase 1</p>
            <p>A low-latency, browser-based Android device management platform.</p>
            <p className="text-dark-500 mt-3">
              Phase 2: Live screen via WebRTC &middot; Phase 3: APK install, bulk actions &middot;
              Phase 4: Auto-reconnect, monitoring
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
