import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Users, Smartphone, Monitor, LogOut, Shield, Activity } from 'lucide-react';
import { UserManagement } from '@/components/admin/UserManagement';
import { DeviceManagement } from '@/components/admin/DeviceManagement';
import { MonitoringGrid } from '@/components/admin/MonitoringGrid';

export function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
      navigate('/admin/login');
      return;
    }
    
    const userData = JSON.parse(userStr);
    if (userData.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    
    setUser(userData);
  }, [navigate]);
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/admin/login');
  };
  
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE0NGgtMnYtNGgydjR6bTAtMTBoLTJ2LTRoMnY0em0wLTEwaC0ydi00aDJ2NHptMC0xMGgtMnYtNGgydjR6bTAtMTBoLTJWOTBoMnY0em0wLTEwaC0yVjgwaDJ2NHptMC0xMGgtMlY3MGgydjR6bTAtMTBoLTJWNjBoMnY0em0wLTEwaC0yVjUwaDJ2NHptMC0xMGgtMlY0MGgydjR6bTAtMTBoLTJWMzBoMnY0em0wLTEwaC0yVjIwaDJ2NHptMC0xMGgtMlYxMGgydjR6bTAtMTBoLTJWMGgydjR6TTE0NiAxNDRoLTJ2LTRoMnY0em0wLTEwaC0ydi00aDJ2NHptMC0xMGgtMnYtNGgydjR6bTAtMTBoLTJ2LTRoMnY0em0wLTEwaC0yVjkwaDJ2NHptMC0xMGgtMlY4MGgydjR6bTAtMTBoLTJWNzBoMnY0em0wLTEwaC0yVjYwaDJ2NHptMC0xMGgtMlY1MGgydjR6bTAtMTBoLTJWNDBoMnY0em0wLTEwaC0yVjMwaDJ2NHptMC0xMGgtMlYyMGgydjR6bTAtMTBoLTJWMTBoMnY0em0wLTEwaC0yVjBoMnY0eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex items-center justify-between mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-gray-600 to-gray-800 rounded-xl shadow-lg shadow-black/50">
              <Shield className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Admin Dashboard</h1>
              <p className="text-gray-300 text-sm flex items-center gap-2">
                <Activity className="w-3 h-3" />
                System Management Console
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-400">Logged in as</p>
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
        
        <Tabs defaultValue="devices" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-white/10 backdrop-blur-sm border border-white/20 p-1 h-auto">
            <TabsTrigger 
              value="devices"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-gray-600 data-[state=active]:to-gray-800 data-[state=active]:text-white text-white/70 transition-all duration-200 py-3 data-[state=active]:shadow-lg"
            >
              <Smartphone className="w-4 h-4 mr-2" />
              Devices
            </TabsTrigger>
            <TabsTrigger 
              value="users"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-gray-600 data-[state=active]:to-gray-800 data-[state=active]:text-white text-white/70 transition-all duration-200 py-3 data-[state=active]:shadow-lg"
            >
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger 
              value="monitor"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-gray-600 data-[state=active]:to-gray-800 data-[state=active]:text-white text-white/70 transition-all duration-200 py-3 data-[state=active]:shadow-lg"
            >
              <Monitor className="w-4 h-4 mr-2" />
              Live Monitor
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="devices" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <DeviceManagement />
          </TabsContent>
          
          <TabsContent value="users" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <UserManagement />
          </TabsContent>
          
          <TabsContent value="monitor" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <MonitoringGrid />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
