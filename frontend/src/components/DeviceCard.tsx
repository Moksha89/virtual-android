import {
  Smartphone,
  Battery,
  Wifi,
  WifiOff,
  MoreVertical,
  Monitor,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { Device } from '../types';
import { useState } from 'react';

interface DeviceCardProps {
  device: Device;
  onOpen: (device: Device) => void;
  onCommand: (device: Device, command: string) => void;
  onDelete: (device: Device) => void;
}

export default function DeviceCard({ device, onOpen, onCommand, onDelete }: DeviceCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isOnline = device.status === 'online';

  const getBatteryColor = (level: number | null): string => {
    if (level === null) return 'text-dark-500';
    if (level > 60) return 'text-green-400';
    if (level > 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  const timeSinceLastSeen = (lastSeen: string | null): string => {
    if (!lastSeen) return 'Never';
    const diff = Date.now() - new Date(lastSeen).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div
      className={`bg-dark-800 rounded-xl border transition-all hover:shadow-lg hover:shadow-primary-500/5 cursor-pointer ${
        isOnline ? 'border-dark-700 hover:border-primary-500/50' : 'border-dark-700/50 opacity-75'
      }`}
      onClick={() => onOpen(device)}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isOnline ? 'bg-green-500/20' : 'bg-dark-700'
              }`}
            >
              <Smartphone
                className={`w-5 h-5 ${isOnline ? 'text-green-400' : 'text-dark-500'}`}
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {device.nickname || device.model || 'Unknown Device'}
              </h3>
              <p className="text-xs text-dark-400">
                {device.manufacturer} &middot; {device.serial.slice(0, 12)}
              </p>
            </div>
          </div>

          <div className="relative">
            <button
              className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 w-44 bg-dark-700 border border-dark-600 rounded-lg shadow-xl py-1">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-dark-200 hover:bg-dark-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(device);
                      setMenuOpen(false);
                    }}
                  >
                    <Monitor className="w-4 h-4" />
                    Open Device
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-dark-200 hover:bg-dark-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCommand(device, 'reboot');
                      setMenuOpen(false);
                    }}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reboot
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-dark-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(device);
                      setMenuOpen(false);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Status & Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {isOnline ? (
                <Wifi className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-dark-500" />
              )}
              <span
                className={`text-xs font-medium ${isOnline ? 'text-green-400' : 'text-dark-500'}`}
              >
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <span className="text-xs text-dark-500">{timeSinceLastSeen(device.last_seen)}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Battery className={`w-3.5 h-3.5 ${getBatteryColor(device.battery_level)}`} />
              <span className="text-dark-300">
                {device.battery_level !== null ? `${device.battery_level}%` : 'N/A'}
              </span>
            </div>
            <span className="text-dark-400">
              Android {device.android_version || '?'}
            </span>
          </div>

          {device.tags && device.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {device.tags.map((tag, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs bg-primary-500/10 text-primary-400 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
