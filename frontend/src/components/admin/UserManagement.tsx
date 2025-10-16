import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Trash2, Loader2 } from 'lucide-react';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user'
  });
  
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
  const token = localStorage.getItem('token');
  
  const fetchUsers = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchUsers();
  }, []);
  
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${backendUrl}/api/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      });
      
      if (response.ok) {
        setNewUser({ username: '', email: '', password: '', role: 'user' });
        setShowCreateForm(false);
        fetchUsers();
      }
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };
  
  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }
    
    try {
      const response = await fetch(`${backendUrl}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        fetchUsers();
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16">
        <Loader2 className="w-12 h-12 animate-spin text-white mb-4" />
        <p className="text-white/70">Loading users...</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">User Management</h2>
        <Button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 shadow-lg shadow-indigo-500/50 transition-all duration-200 hover:shadow-xl hover:scale-105"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Create User
        </Button>
      </div>
      
      {showCreateForm && (
        <Card className="p-6 bg-white border-slate-200 shadow-lg animate-in fade-in slide-in-from-top-4 duration-500 rounded-xl">
          <h3 className="text-lg font-semibold mb-4 text-slate-900">Create New User</h3>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-700 text-sm font-medium">Username</Label>
              <Input
                id="username"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 text-sm font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role" className="text-slate-700 text-sm font-medium">Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(value) => setNewUser({ ...newUser, role: value })}
              >
                <SelectTrigger className="bg-white border-slate-200 text-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  <SelectItem value="user" className="text-slate-900 hover:bg-slate-50">User</SelectItem>
                  <SelectItem value="admin" className="text-slate-900 hover:bg-slate-50">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button 
                type="submit"
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0 shadow-sm"
              >
                Create
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowCreateForm(false)}
                className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}
      
      <div className="grid gap-4">
        {users.map((user, index) => (
          <Card 
            key={user.id} 
            className="p-6 bg-white border-slate-200 hover:border-indigo-300 hover:shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 rounded-xl"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 text-lg">{user.username}</h3>
                <p className="text-sm text-slate-600">{user.email}</p>
                <div className="flex gap-3 mt-2">
                  <span className={`text-xs px-2 py-1 rounded ${user.role === 'admin' ? 'bg-indigo-50 border border-indigo-200 text-indigo-700' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}>
                    {user.role}
                  </span>
                  <span className="text-xs text-slate-500">
                    Created: {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteUser(user.id)}
                className="bg-red-50 border border-red-200 text-red-700 hover:bg-red-100"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
