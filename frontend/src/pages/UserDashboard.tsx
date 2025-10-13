import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LogOut, Loader2, Smartphone, Cpu, HardDrive, ArrowLeft, Sparkles } from 'lucide-react';
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE0NGgtMnYtNGgydjR6bTAtMTBoLTJ2LTRoMnY0em0wLTEwaC0ydi00aDJ2NHptMC0xMGgtMnYtNGgydjR6bTAtMTBoLTJWOTBoMnY0em0wLTEwaC0yVjgwaDJ2NHptMC0xMGgtMlY3MGgydjR6bTAtMTBoLTJWNjBoMnY0em0wLTEwaC0yVjUwaDJ2NHptMC0xMGgtMlY0MGgydjR6bTAtMTBoLTJWMzBoMnY0em0wLTEwaC0yVjIwaDJ2NHptMC0xMGgtMlYxMGgydjR6bTAtMTBoLTJWMGgydjR6TTE0NiAxNDRoLTJ2LTRoMnY0em0wLTEwaC0ydi00aDJ2NHptMC0xMGgtMnYtNGgydjR6bTAtMTBoLTJ2LTRoMnY0em0wLTEwaC0yVjkwaDJ2NHptMC0xMGgtMlY4MGgydjR6bTAtMTBoLTJWNzBoMnY0em0wLTEwaC0yVjYwaDJ2NHptMC0xMGgtMlY1MGgydjR6bTAtMTBoLTJWNDBoMnY0em0wLTEwaC0yVjMwaDJ2NHptMC0xMGgtMlYyMGgydjR6bTAtMTBoLTJWMTBoMnY0em0wLTEwaC0yVjBoMnY0eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex items-center justify-between mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg shadow-blue-500/30">
              <Smartphone className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">My Virtual Devices</h1>
              <p className="text-blue-200 text-sm flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                Your Android Devices
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-blue-300">Logged in as</p>
              <p className="text-white font-medium">{user.username}</p>
            </div>
            <Button 
              onClick={handleLogout} 
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all duration-200 hover:scale-105"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16">
            <Loader2 className="w-12 h-12 animate-spin text-white mb-4" />
            <p className="text-white/70">Loading your devices...</p>
          </div>
        ) : devices.length === 0 ? (
          <Card className="p-12 text-center backdrop-blur-xl bg-white/10 border-white/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30">
              <Smartphone className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">No Devices Assigned</h2>
            <p className="text-white/70 max-w-md mx-auto">Contact your administrator to get access to virtual Android devices</p>
          </Card>
        ) : selectedDevice ? (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <Button 
              onClick={() => setSelectedDevice(null)} 
              variant="outline"
              className="mb-4 bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all duration-200 hover:scale-105"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
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
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {devices.map((device, index) => (
              <Card 
                key={device.id} 
                className="p-6 backdrop-blur-xl bg-white/10 border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/20 group cursor-pointer"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform duration-300">
                    <Smartphone className="w-6 h-6 text-white" />
                  </div>
                  <div className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                    <span className="text-xs text-green-200 font-medium">Active</span>
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-white mb-3">Android Device</h3>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-white/70">
                    <Cpu className="w-4 h-4" />
                    <span className="text-sm">{device.ram_gb}GB RAM</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/70">
                    <HardDrive className="w-4 h-4" />
                    <span className="text-sm">{device.rom_gb}GB Storage</span>
                  </div>
                </div>
                
                <Button 
                  onClick={() => setSelectedDevice(device.id)} 
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white border-0 shadow-lg shadow-blue-500/30 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/40"
                >
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
