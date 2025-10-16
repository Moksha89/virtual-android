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
      <div className="flex flex-col items-center justify-center p-16">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mb-4" />
        <p className="text-slate-600">Loading monitoring data...</p>
      </div>
    );
  }
  
  if (devices.length === 0) {
    return (
      <Card className="p-12 text-center bg-white border-slate-200 shadow-lg rounded-xl">
        <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/50">
          <Smartphone className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-3">No Devices Available</h2>
        <p className="text-slate-600 max-w-md mx-auto">Create devices in the Devices tab to monitor them here</p>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Live Device Monitoring</h2>
        <p className="text-slate-600 flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Monitoring {devices.length} device(s)
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {devices.map((device, index) => (
          <Card 
            key={device.id} 
            className="p-5 bg-white border-slate-200 hover:border-indigo-300 hover:shadow-xl transition-all duration-300 hover:scale-105 animate-in fade-in slide-in-from-bottom-4 rounded-xl"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-center mb-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/50 mr-3">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Android Device</h3>
                <p className="text-xs text-slate-600">{device.ram_gb}GB RAM / {device.rom_gb}GB Storage</p>
              </div>
            </div>
            
            <div className="space-y-2">
              {device.assigned_to ? (
                <div className="px-2 py-1 bg-green-50 border border-green-200 rounded">
                  <p className="text-xs text-green-700">
                    👤 User: {device.assigned_to.username}
                  </p>
                </div>
              ) : (
                <div className="px-2 py-1 bg-slate-50 border border-slate-200 rounded">
                  <p className="text-xs text-slate-600">Unassigned</p>
                </div>
              )}
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Status:</span>
                <span className={`px-2 py-1 rounded ${device.status === 'running' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-yellow-50 border border-yellow-200 text-yellow-700'}`}>
                  {device.status}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
