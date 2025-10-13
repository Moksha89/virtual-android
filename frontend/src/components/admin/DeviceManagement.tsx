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
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Device Management</h2>
        <Button onClick={() => setShowCreator(!showCreator)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Device
        </Button>
      </div>
      
      {showCreator && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Create New Android Device</h3>
          <InstanceCreator onInstanceCreated={() => {
            setShowCreator(false);
            fetchDevices();
          }} />
        </Card>
      )}
      
      <div className="grid gap-4">
        {devices.map((device) => (
          <Card key={device.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Smartphone className="w-8 h-8 text-blue-500" />
                <div>
                  <h3 className="font-semibold">Android Device</h3>
                  <p className="text-sm text-gray-500">
                    {device.ram_gb}GB RAM / {device.rom_gb}GB ROM
                  </p>
                  <p className="text-xs text-gray-400">ID: {device.id}</p>
                  {device.assigned_to && (
                    <p className="text-xs text-green-600">
                      Assigned to: {device.assigned_to.username}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2">
                {device.assigned_to ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnassignDevice(device.id)}
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    Unassign
                  </Button>
                ) : assigningDevice === device.id ? (
                  <div className="flex gap-2 items-center">
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => handleAssignDevice(device.id)}
                      disabled={!selectedUserId}
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
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAssigningDevice(device.id)}
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
