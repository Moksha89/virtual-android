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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-slate-900 text-xl">Loading...</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiM1QjZDRjIiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE0NGgtMnYtNGgydjR6bTAtMTBoLTJ2LTRoMnY0em0wLTEwaC0ydi00aDJ2NHptMC0xMGgtMnYtNGgydjR6bTAtMTBoLTJWOTBoMnY0em0wLTEwaC0yVjgwaDJ2NHptMC0xMGgtMlY3MGgydjR6bTAtMTBoLTJWNjBoMnY0em0wLTEwaC0yVjUwaDJ2NHptMC0xMGgtMlY0MGgydjR6bTAtMTBoLTJWMzBoMnY0em0wLTEwaC0yVjIwaDJ2NHptMC0xMGgtMlYxMGgydjR6bTAtMTBoLTJWMGgydjR6TTE0NiAxNDRoLTJ2LTRoMnY0em0wLTEwaC0ydi00aDJ2NHptMC0xMGgtMnYtNGgydjR6bTAtMTBoLTJ2LTRoMnY0em0wLTEwaC0yVjkwaDJ2NHptMC0xMGgtMlY4MGgydjR6bTAtMTBoLTJWNzBoMnY0em0wLTEwaC0yVjYwaDJ2NHptMC0xMGgtMlY1MGgydjR6bTAtMTBoLTJWNDBoMnY0em0wLTEwaC0yVjMwaDJ2NHptMC0xMGgtMlYyMGgydjR6bTAtMTBoLTJWMTBoMnY0em0wLTEwaC0yVjBoMnY0eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex items-center justify-between mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/50">
              <Shield className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">Admin Dashboard</h1>
              <p className="text-slate-600 text-sm flex items-center gap-2">
                <Activity className="w-3 h-3 text-indigo-500" />
                System Management Console
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-500">Logged in as</p>
              <p className="text-slate-900 font-medium">{user.username}</p>
            </div>
            <Button 
              onClick={handleLogout} 
              variant="outline"
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200 hover:scale-105 shadow-sm"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="devices" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-white backdrop-blur-sm border border-slate-200 p-1 h-auto rounded-xl shadow-sm">
            <TabsTrigger 
              value="devices"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-slate-600 transition-all duration-200 py-3 data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/50 rounded-lg"
            >
              <Smartphone className="w-4 h-4 mr-2" />
              Devices
            </TabsTrigger>
            <TabsTrigger 
              value="users"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-slate-600 transition-all duration-200 py-3 data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/50 rounded-lg"
            >
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger 
              value="monitor"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-slate-600 transition-all duration-200 py-3 data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/50 rounded-lg"
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
