import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Users, Smartphone, Monitor, LogOut } from 'lucide-react';
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
    return <div>Loading...</div>;
  }
  
  return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400">Welcome, {user.username}</span>
            <Button onClick={handleLogout} variant="outline">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="devices" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="devices">
              <Smartphone className="w-4 h-4 mr-2" />
              Devices
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="monitor">
              <Monitor className="w-4 h-4 mr-2" />
              Live Monitor
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="devices">
            <DeviceManagement />
          </TabsContent>
          
          <TabsContent value="users">
            <UserManagement />
          </TabsContent>
          
          <TabsContent value="monitor">
            <MonitoringGrid />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
