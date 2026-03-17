import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Smartphone,
  Wifi,
  WifiOff,
  Server,
  Activity,
  Download,
  Monitor,
} from 'lucide-react';
import { useDevices } from '../hooks/useDevices';
import StatsCard from '../components/StatsCard';
import DeviceCard from '../components/DeviceCard';
import api from '../services/api';
import { Agent, Device } from '../types';

export default function DashboardPage() {
  const { devices, onlineDevices, offlineDevices, loading } = useDevices();
  const [agents, setAgents] = useState<Agent[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.getAgents().then(({ agents }) => setAgents(agents)).catch(console.error);
  }, []);

  const onlineAgents = agents.filter((a) => a.status === 'online');

  const handleOpenDevice = (device: Device) => {
    navigate(`/devices/${device.id}`);
  };

  const handleDeviceCommand = async (device: Device, command: string) => {
    try {
      await api.sendDeviceCommand(device.id, command);
    } catch (err) {
      console.error('Command failed:', err);
    }
  };

  const handleDeleteDevice = async (device: Device) => {
    if (confirm(`Remove device ${device.model || device.serial}?`)) {
      try {
        await api.deleteDevice(device.id);
      } catch (err) {
        console.error('Delete failed:', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-dark-400 mt-1">Overview of your mobile device fleet</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Devices"
          value={devices.length}
          subtitle={`${onlineDevices.length} online`}
          icon={Smartphone}
          color="blue"
        />
        <StatsCard
          title="Online"
          value={onlineDevices.length}
          subtitle="Connected & active"
          icon={Wifi}
          color="green"
        />
        <StatsCard
          title="Offline"
          value={offlineDevices.length}
          subtitle="Disconnected"
          icon={WifiOff}
          color="red"
        />
        <StatsCard
          title="Agents"
          value={agents.length}
          subtitle={`${onlineAgents.length} active`}
          icon={Server}
          color="purple"
        />
      </div>

      {/* Download Agent Section */}
      <div className="bg-gradient-to-r from-primary-600/20 to-primary-800/10 rounded-xl border border-primary-500/30 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-600/30 rounded-xl flex items-center justify-center">
              <Monitor className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Windows Gateway Agent</h2>
              <p className="text-dark-400 text-sm mt-0.5">
                Install on your Windows PC to connect Android devices to this dashboard
              </p>
            </div>
          </div>
          <a
            href="/downloads/Mobile%20Manager%20Agent%20Setup%201.0.0.exe"
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Agent v1.0.0
          </a>
        </div>
      </div>

      {/* Devices Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-400" />
            Connected Devices
          </h2>
          <button
            onClick={() => navigate('/devices')}
            className="text-sm text-primary-400 hover:text-primary-300"
          >
            View All
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-dark-800 rounded-xl border border-dark-700 p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-dark-700 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-4 bg-dark-700 rounded w-2/3 mb-2" />
                    <div className="h-3 bg-dark-700 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-3 bg-dark-700 rounded w-full mb-2" />
                <div className="h-3 bg-dark-700 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="bg-dark-800 rounded-xl border border-dark-700 p-12 text-center">
            <Smartphone className="w-12 h-12 text-dark-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Devices Connected</h3>
            <p className="text-dark-400 max-w-md mx-auto">
              Connect your Android phones to the home gateway and install the agent to see them here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {devices.slice(0, 8).map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onOpen={handleOpenDevice}
                onCommand={handleDeviceCommand}
                onDelete={handleDeleteDevice}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
