import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2, Smartphone } from 'lucide-react';

interface Device {
  id: string;
  ram_gb: number;
  rom_gb: number;
  status: string;
  assigned_to?: {
    user_id: number;
    username: string;
  };
}

export function MonitoringGrid() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
  const token = localStorage.getItem('token');
  
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/admin/monitor`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        setDevices(data);
      } catch (error) {
        console.error('Failed to fetch monitoring data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDevices();
    const interval = setInterval(fetchDevices, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }
  
  if (devices.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Smartphone className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h2 className="text-xl font-semibold mb-2">No Devices Available</h2>
        <p className="text-gray-500">Create devices in the Devices tab to monitor them here</p>
      </Card>
    );
  }
  
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Live Device Monitoring</h2>
      <p className="text-gray-500 mb-6">Monitoring {devices.length} device(s)</p>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {devices.map((device) => (
          <Card key={device.id} className="p-4">
            <div className="flex items-center mb-2">
              <Smartphone className="w-6 h-6 text-blue-500 mr-2" />
              <div>
                <h3 className="font-semibold text-sm">Android Device</h3>
                <p className="text-xs text-gray-500">{device.ram_gb}GB / {device.rom_gb}GB</p>
              </div>
            </div>
            {device.assigned_to ? (
              <p className="text-xs text-green-600">
                User: {device.assigned_to.username}
              </p>
            ) : (
              <p className="text-xs text-gray-400">Unassigned</p>
            )}
            <p className="text-xs text-gray-400 mt-1">Status: {device.status}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
