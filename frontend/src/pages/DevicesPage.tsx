import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, RefreshCw, Smartphone } from 'lucide-react';
import { useDevices } from '../hooks/useDevices';
import DeviceCard from '../components/DeviceCard';
import api from '../services/api';
import { Device } from '../types';

export default function DevicesPage() {
  const { devices, loading, refresh } = useDevices();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const navigate = useNavigate();

  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      !search ||
      (device.model || '').toLowerCase().includes(search.toLowerCase()) ||
      (device.serial || '').toLowerCase().includes(search.toLowerCase()) ||
      (device.nickname || '').toLowerCase().includes(search.toLowerCase()) ||
      (device.manufacturer || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || device.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

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
        refresh();
      } catch (err) {
        console.error('Delete failed:', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Devices</h1>
          <p className="text-dark-400 mt-1">
            {devices.length} total &middot; {devices.filter((d) => d.status === 'online').length} online
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-600 rounded-lg text-sm text-dark-300 hover:text-white hover:border-dark-500 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, model, serial..."
            className="w-full pl-10 pr-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-10 pr-8 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white appearance-none focus:outline-none focus:border-primary-500"
          >
            <option value="all">All Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </div>
      </div>

      {/* Device Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-dark-800 rounded-xl border border-dark-700 p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-dark-700 rounded-lg" />
                <div className="flex-1">
                  <div className="h-4 bg-dark-700 rounded w-2/3 mb-2" />
                  <div className="h-3 bg-dark-700 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-12 text-center">
          <Smartphone className="w-12 h-12 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">
            {search || statusFilter !== 'all' ? 'No Matching Devices' : 'No Devices Connected'}
          </h3>
          <p className="text-dark-400 max-w-md mx-auto">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'Connect your Android phones to the home gateway to see them here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDevices.map((device) => (
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
  );
}
