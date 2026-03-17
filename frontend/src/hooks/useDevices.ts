import { useState, useEffect, useCallback } from 'react';
import { Device } from '../types';
import api from '../services/api';
import wsService from '../services/websocket';

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      const { devices } = await api.getDevices();
      setDevices(devices);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch devices';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();

    const unsubUpdated = wsService.on('devices:updated', () => {
      fetchDevices();
    });

    const unsubRemoved = wsService.on('device:removed', () => {
      fetchDevices();
    });

    const interval = setInterval(fetchDevices, 15000);

    return () => {
      unsubUpdated();
      unsubRemoved();
      clearInterval(interval);
    };
  }, [fetchDevices]);

  const onlineDevices = devices.filter((d) => d.status === 'online');
  const offlineDevices = devices.filter((d) => d.status === 'offline');

  return {
    devices,
    onlineDevices,
    offlineDevices,
    loading,
    error,
    refresh: fetchDevices,
  };
}
