import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Smartphone, Loader2, Plus, UserCheck, UserX, Camera } from 'lucide-react';
import { InstanceCreator } from '@/components/InstanceCreator';

interface Device {
  id: string;
  ram_gb: number;
  rom_gb: number;
  status: string;
  assigned_to?: Array<{
    user_id: number;
    username: string;
    assigned_at: string;
  }> | null;
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
  const [creatingSnapshot, setCreatingSnapshot] = useState<string | null>(null);
  const [snapshotName, setSnapshotName] = useState('');
  
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
  
  const handleUnassignDevice = async (deviceId: string, userId: number, username: string) => {
    if (!confirm(`Are you sure you want to unassign ${username} from this device?`)) {
      return;
    }
    
    try {
      const response = await fetch(`${backendUrl}/api/admin/devices/${deviceId}/assign?user_id=${userId}`, {
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
          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 shadow-lg shadow-indigo-500/50 transition-all duration-200 hover:shadow-xl hover:scale-105"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Device
        </Button>
      </div>
      
      {showCreator && (
        <Card className="p-6 bg-white border-slate-200 shadow-lg animate-in fade-in slide-in-from-top-4 duration-500 rounded-xl">
          <h3 className="text-lg font-semibold mb-4 text-slate-900">Create New Android Device</h3>
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
            className="p-6 bg-white border-slate-200 hover:border-indigo-300 hover:shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 rounded-xl"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/50">
                  <Smartphone className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-lg">Android Device</h3>
                  <p className="text-sm text-slate-600">
                    {device.ram_gb}GB RAM / {device.rom_gb}GB ROM
                  </p>
                  <p className="text-xs text-slate-500 font-mono">ID: {device.id.slice(0, 8)}...</p>
                  {device.assigned_to && device.assigned_to.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-slate-500">Assigned to:</p>
                      <div className="flex flex-wrap gap-1">
                        {device.assigned_to.map((assignment: any) => (
                          <div key={assignment.user_id} className="px-2 py-1 bg-green-50 border border-green-200 rounded inline-flex items-center gap-1">
                            <span className="text-xs text-green-700">{assignment.username}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <span className="text-xs text-slate-500">Not assigned</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2 flex-wrap items-center">
                {device.assigned_to && device.assigned_to.length > 0 ? (
                  <>
                    {device.assigned_to.map((assignment: any) => (
                      <Button
                        key={assignment.user_id}
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnassignDevice(device.id, assignment.user_id, assignment.username)}
                        className="bg-white border-slate-200 text-slate-700 hover:bg-red-50 hover:border-red-200 hover:text-red-700 transition-all duration-200"
                      >
                        <UserX className="w-4 h-4 mr-2" />
                        Unassign {assignment.username}
                      </Button>
                    ))}
                  </>
                ) : null}
                {assigningDevice === device.id ? (
                  <div className="flex gap-2 items-center">
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger className="w-40 bg-white border-slate-200 text-slate-900">
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200">
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id.toString()} className="text-slate-900 hover:bg-slate-50">
                            {user.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => handleAssignDevice(device.id)}
                      disabled={!selectedUserId}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0 disabled:opacity-50 shadow-sm"
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
                      className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : null}
                {creatingSnapshot === device.id ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={snapshotName}
                      onChange={(e) => setSnapshotName(e.target.value)}
                      placeholder="Snapshot name"
                      className="px-3 py-1 border border-slate-200 rounded text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await fetch(`${backendUrl}/api/instances/${device.id}/snapshots`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                              snapshot_name: snapshotName,
                              description: `Snapshot of ${device.id}`
                            })
                          });
                          setCreatingSnapshot(null);
                          setSnapshotName('');
                          alert('Snapshot created successfully');
                        } catch (error) {
                          console.error('Failed to create snapshot:', error);
                        }
                      }}
                      disabled={!snapshotName}
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCreatingSnapshot(null);
                        setSnapshotName('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCreatingSnapshot(device.id)}
                    className="bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Create Snapshot
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await fetch(`${backendUrl}/api/instances/${device.id}/install-fdroid`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      alert('F-Droid installation started. It may take a few minutes.');
                    } catch (error) {
                      console.error('Failed to install F-Droid:', error);
                    }
                  }}
                  className="bg-white border-slate-200 text-slate-700 hover:bg-green-50 hover:border-green-300 hover:text-green-700"
                >
                  📱 Install F-Droid
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAssigningDevice(device.id)}
                  className="bg-white border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-all duration-200 hover:scale-105"
                >
                  <UserCheck className="w-4 h-4 mr-2" />
                  Assign User
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
