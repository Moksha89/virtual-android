import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Smartphone, Loader2, Plus, UserCheck, UserX } from 'lucide-react';
import { InstanceCreator } from '@/components/InstanceCreator';

interface Device {
  id: string;
  ram_gb: number;
  rom_gb: number;
  status: string;
  assigned_to?: {
    user_id: number;
    username: string;
    assigned_at: string;
  };
}

interface User {
  id: number;
  username: string;
  role: string;
}

export function DeviceManagement() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [assigningDevice, setAssigningDevice] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
  const token = localStorage.getItem('token');
  
  const fetchDevices = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/admin/devices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setDevices(data);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchUsers = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setUsers(data.filter((u: User) => u.role !== 'admin'));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };
  
  useEffect(() => {
    fetchDevices();
    fetchUsers();
  }, []);
  
  const handleAssignDevice = async (deviceId: string) => {
    if (!selectedUserId) return;
    
    try {
      const response = await fetch(`${backendUrl}/api/admin/devices/${deviceId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: parseInt(selectedUserId) })
      });
      
      if (response.ok) {
        setAssigningDevice(null);
        setSelectedUserId('');
        fetchDevices();
      }
    } catch (error) {
      console.error('Failed to assign device:', error);
    }
  };
  
  const handleUnassignDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to unassign this device?')) {
      return;
    }
    
    try {
      const response = await fetch(`${backendUrl}/api/admin/devices/${deviceId}/assign`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        fetchDevices();
      }
    } catch (error) {
      console.error('Failed to unassign device:', error);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16">
        <Loader2 className="w-12 h-12 animate-spin text-white mb-4" />
        <p className="text-white/70">Loading devices...</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Device Management</h2>
        <Button 
          onClick={() => setShowCreator(!showCreator)}
          className="bg-gradient-to-r from-gray-700 to-gray-900 hover:from-gray-600 hover:to-gray-800 text-white border-0 shadow-lg shadow-black/50 transition-all duration-200 hover:shadow-xl hover:scale-105"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Device
        </Button>
      </div>
      
      {showCreator && (
        <Card className="p-6 backdrop-blur-xl bg-white/10 border-white/20 animate-in fade-in slide-in-from-top-4 duration-500">
          <h3 className="text-lg font-semibold mb-4 text-white">Create New Android Device</h3>
          <InstanceCreator onInstanceCreated={() => {
            setShowCreator(false);
            fetchDevices();
          }} />
        </Card>
      )}
      
      <div className="grid gap-4">
        {devices.map((device, index) => (
          <Card 
            key={device.id} 
            className="p-6 backdrop-blur-xl bg-white/10 border-white/20 hover:bg-white/15 transition-all duration-300 hover:shadow-lg animate-in fade-in slide-in-from-bottom-4"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-gray-600 to-gray-800 rounded-lg shadow-lg shadow-black/50">
                  <Smartphone className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg">Android Device</h3>
                  <p className="text-sm text-white/70">
                    {device.ram_gb}GB RAM / {device.rom_gb}GB ROM
                  </p>
                  <p className="text-xs text-white/50 font-mono">ID: {device.id.slice(0, 8)}...</p>
                  {device.assigned_to && (
                    <div className="mt-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded inline-block">
                      <p className="text-xs text-green-200">
                        Assigned to: {device.assigned_to.username}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2">
                {device.assigned_to ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnassignDevice(device.id)}
                    className="bg-white/10 border-white/20 text-white hover:bg-red-500/20 hover:border-red-500/30 transition-all duration-200"
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    Unassign
                  </Button>
                ) : assigningDevice === device.id ? (
                  <div className="flex gap-2 items-center">
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white">
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-white/20">
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id.toString()} className="text-white hover:bg-white/10">
                            {user.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => handleAssignDevice(device.id)}
                      disabled={!selectedUserId}
                      className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0 disabled:opacity-50"
                    >
                      Assign
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAssigningDevice(null);
                        setSelectedUserId('');
                      }}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAssigningDevice(device.id)}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all duration-200 hover:scale-105"
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    Assign
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
