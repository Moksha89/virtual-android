import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LogOut, Loader2, Smartphone } from 'lucide-react';
import { AndroidScreen } from '@/components/AndroidScreen';

export function UserDashboard() {
  const [user, setUser] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
      navigate('/login');
      return;
    }
    
    const userData = JSON.parse(userStr);
    setUser(userData);
    
    fetchDevices(token);
  }, [navigate]);
  
  const fetchDevices = async (token: string) => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/user/devices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDevices(data);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };
  
  if (!user) {
    return <div>Loading...</div>;
  }
  
  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">My Devices</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400">Welcome, {user.username}</span>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : devices.length === 0 ? (
          <Card className="p-8 text-center">
            <Smartphone className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">No Devices Assigned</h2>
            <p className="text-gray-500">Contact your administrator to get device access</p>
          </Card>
        ) : selectedDevice ? (
          <div>
            <Button onClick={() => setSelectedDevice(null)} variant="outline" className="mb-4">
              Back to Devices
            </Button>
            <AndroidScreen 
              instanceId={selectedDevice} 
              onDelete={() => {
                setSelectedDevice(null);
                fetchDevices(localStorage.getItem('token')!);
              }}
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {devices.map((device) => (
              <Card key={device.id} className="p-6">
                <div className="flex items-center mb-4">
                  <Smartphone className="w-8 h-8 text-blue-500 mr-3" />
                  <div>
                    <h3 className="font-semibold">Android Device</h3>
                    <p className="text-sm text-gray-500">{device.ram_gb}GB RAM / {device.rom_gb}GB ROM</p>
                  </div>
                </div>
                <Button onClick={() => setSelectedDevice(device.id)} className="w-full">
                  Access Device
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
