import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Smartphone,
  Battery,
  Wifi,
  WifiOff,
  RotateCcw,
  Camera,
  Download,
  Terminal,
  Type,
  Monitor,
  Clock,
  Cpu,
} from 'lucide-react';
import api from '../services/api';
import { Device, DeviceLog } from '../types';

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [logs, setLogs] = useState<DeviceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [commandLoading, setCommandLoading] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');

  useEffect(() => {
    if (!id) return;

    const fetchDevice = async () => {
      try {
        const { device } = await api.getDevice(id);
        setDevice(device);
        const { logs } = await api.getDeviceLogs(id);
        setLogs(logs);
      } catch (err) {
        console.error('Failed to load device:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDevice();
    const interval = setInterval(fetchDevice, 10000);
    return () => clearInterval(interval);
  }, [id]);

  const sendCommand = async (type: string, payload?: Record<string, unknown>) => {
    if (!id) return;
    setCommandLoading(type);
    try {
      await api.sendDeviceCommand(id, type, payload);
      const { logs: newLogs } = await api.getDeviceLogs(id);
      setLogs(newLogs);
    } catch (err) {
      console.error('Command failed:', err);
    } finally {
      setCommandLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-white mb-2">Device Not Found</h2>
        <button onClick={() => navigate('/devices')} className="text-primary-400 hover:text-primary-300">
          Back to Devices
        </button>
      </div>
    );
  }

  const isOnline = device.status === 'online';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/devices')}
          className="p-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">
              {device.nickname || device.model || 'Unknown Device'}
            </h1>
            <span
              className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                isOnline ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-dark-400'
              }`}
            >
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <p className="text-dark-400 mt-0.5">
            {device.manufacturer} &middot; {device.serial}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Screen placeholder & controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Screen Viewer Placeholder */}
          <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-primary-400" />
                <span className="text-sm font-medium text-white">Live Screen</span>
              </div>
              <span className="text-xs text-dark-500">Phase 2 - WebRTC</span>
            </div>
            <div className="aspect-[9/16] max-h-96 bg-dark-900 flex items-center justify-center">
              <div className="text-center">
                <Monitor className="w-16 h-16 text-dark-700 mx-auto mb-3" />
                <p className="text-dark-500 text-sm">Live screen view coming in Phase 2</p>
                <p className="text-dark-600 text-xs mt-1">WebRTC peer-to-peer streaming</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-dark-800 rounded-xl border border-dark-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { type: 'reboot', label: 'Reboot', icon: RotateCcw, color: 'text-yellow-400' },
                { type: 'screenshot', label: 'Screenshot', icon: Camera, color: 'text-blue-400' },
                { type: 'restart_adb', label: 'Restart ADB', icon: Terminal, color: 'text-green-400' },
                { type: 'install_apk', label: 'Install APK', icon: Download, color: 'text-purple-400' },
              ].map((action) => (
                <button
                  key={action.type}
                  onClick={() => sendCommand(action.type)}
                  disabled={!isOnline || commandLoading === action.type}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg bg-dark-700/50 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <action.icon
                    className={`w-5 h-5 ${action.color} ${
                      commandLoading === action.type ? 'animate-spin' : ''
                    }`}
                  />
                  <span className="text-xs text-dark-300">{action.label}</span>
                </button>
              ))}
            </div>

            {/* Text Input */}
            <div className="mt-4 flex gap-2">
              <div className="relative flex-1">
                <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type text to send to device..."
                  className="w-full pl-10 pr-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && textInput.trim()) {
                      sendCommand('input_text', { text: textInput });
                      setTextInput('');
                    }
                  }}
                />
              </div>
              <button
                onClick={() => {
                  if (textInput.trim()) {
                    sendCommand('input_text', { text: textInput });
                    setTextInput('');
                  }
                }}
                disabled={!isOnline || !textInput.trim()}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Right: Device Info & Logs */}
        <div className="space-y-6">
          {/* Device Info */}
          <div className="bg-dark-800 rounded-xl border border-dark-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-primary-400" />
              Device Information
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Model', value: device.model || 'Unknown' },
                { label: 'Manufacturer', value: device.manufacturer || 'Unknown' },
                { label: 'Serial', value: device.serial },
                { label: 'Android', value: device.android_version || 'Unknown' },
                { label: 'SDK', value: device.sdk_version || 'Unknown' },
                { label: 'Resolution', value: device.screen_resolution || 'Unknown' },
                { label: 'IP Address', value: device.ip_address || 'N/A' },
              ].map((item) => (
                <div key={item.label} className="flex justify-between text-sm">
                  <span className="text-dark-400">{item.label}</span>
                  <span className="text-dark-200 font-mono text-xs">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Battery */}
          <div className="bg-dark-800 rounded-xl border border-dark-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Battery className="w-4 h-4 text-primary-400" />
              Battery
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    (device.battery_level || 0) > 60
                      ? 'bg-green-500'
                      : (device.battery_level || 0) > 20
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${device.battery_level || 0}%` }}
                />
              </div>
              <span className="text-sm font-medium text-white">{device.battery_level ?? 0}%</span>
            </div>
            <p className="text-xs text-dark-400 mt-2">{device.battery_status || 'Unknown'}</p>
          </div>

          {/* Status */}
          <div className="bg-dark-800 rounded-xl border border-dark-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary-400" />
              Status
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-dark-400">Connection</span>
                <div className="flex items-center gap-1.5">
                  {isOnline ? (
                    <Wifi className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span className={isOnline ? 'text-green-400' : 'text-red-400'}>
                    {isOnline ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-dark-400">Last Seen</span>
                <span className="text-dark-200">
                  {device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Never'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-dark-400">Agent</span>
                <span className="text-dark-200">{device.agent_name || 'Unknown'}</span>
              </div>
            </div>
          </div>

          {/* Recent Logs */}
          <div className="bg-dark-800 rounded-xl border border-dark-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary-400" />
              Recent Logs
            </h3>
            {logs.length === 0 ? (
              <p className="text-sm text-dark-500">No logs yet</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {logs.slice(0, 10).map((log) => (
                  <div key={log.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          log.level === 'error'
                            ? 'bg-red-500/20 text-red-400'
                            : log.level === 'warn'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-dark-700 text-dark-400'
                        }`}
                      >
                        {log.level}
                      </span>
                      <span className="text-dark-500">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-dark-300 mt-0.5">{log.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
