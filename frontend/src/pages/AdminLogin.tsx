import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, Sparkles } from 'lucide-react';

export function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Login failed');
      }
      
      const data = await response.json();
      
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      if (data.user.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
      
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiM1QjZDRjIiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDEzNEgzNHYtNGgydjR6bTAtMTBIMzR2LTRoMnY0em0wLTEwSDM0di00aDJ2NHptMC0xMEgzNHYtNGgydjR6bTAtMTBIMzRWOTBoMnY0em0wLTEwSDM0VjgwaDJ2NHptMC0xMEgzNFY3MGgydjR6bTAtMTBIMzRWNjBoMnY0em0wLTEwSDM0VjUwaDJ2NHptMC0xMEgzNFY0MGgydjR6bTAtMTBIMzRWMzBoMnY0em0wLTEwSDM0VjIwaDJ2NHptMC0xMEgzNFYxMGgydjR6bTAtMTBIMzRWMGgydjR6TTI2IDEzNEgyNHYtNGgydjR6bTAtMTBIMjR2LTRoMnY0em0wLTEwSDI0di00aDJ2NHptMC0xMEgyNHYtNGgydjR6bTAtMTBIMjRWOTBoMnY0em0wLTEwSDI0VjgwaDJ2NHptMC0xMEgyNFY3MGgydjR6bTAtMTBIMjRWNjBoMnY0em0wLTEwSDI0VjUwaDJ2NHptMC0xMEgyNFY0MGgydjR6bTAtMTBIMjRWMzBoMnY0em0wLTEwSDI0VjIwaDJ2NHptMC0xMEgyNFYxMGgydjR6bTAtMTBIMjRWMGgydjR6TTE2IDEzNEgxNHYtNGgydjR6bTAtMTBIMTR2LTRoMnY0em0wLTEwSDE0di00aDJ2NHptMC0xMEgxNHYtNGgydjR6bTAtMTBIMTRWOTBoMnY0em0wLTEwSDE0VjgwaDJ2NHptMC0xMEgxNFY3MGgydjR6bTAtMTBIMTRWNjBoMnY0em0wLTEwSDE0VjUwaDJ2NHptMC0xMEgxNFY0MGgydjR6bTAtMTBIMTRWMzBoMnY0em0wLTEwSDE0VjIwaDJ2NHptMC0xMEgxNFYxMGgydjR6bTAtMTBIMTRWMGgydjR6TTE0NiAxMzRoLTJ2LTRoMnY0em0wLTEwaC0ydi00aDJ2NHptMC0xMGgtMnYtNGgydjR6bTAtMTBoLTJ2LTRoMnY0em0wLTEwaC0yVjkwaDJ2NHptMC0xMGgtMlY4MGgydjR6bTAtMTBoLTJWNzBoMnY0em0wLTEwaC0yVjYwaDJ2NHptMC0xMGgtMlY1MGgydjR6bTAtMTBoLTJWNDBoMnY0em0wLTEwaC0yVjMwaDJ2NHptMC0xMGgtMlYyMGgydjR6bTAtMTBoLTJWMTBoMnY0em0wLTEwaC0yVjBoMnY0em0tMTAgMTM0aC0ydi00aDJ2NHptMC0xMGgtMnYtNGgydjR6bTAtMTBoLTJ2LTRoMnY0em0wLTEwaC0ydi00aDJ2NHptMC0xMGgtMlY5MGgydjR6bTAtMTBoLTJWODBoMnY0em0wLTEwaC0yVjcwaDJ2NHptMC0xMGgtMlY2MGgydjR6bTAtMTBoLTJWNTBoMnY0em0wLTEwaC0yVjQwaDJ2NHptMC0xMGgtMlYzMGgydjR6bTAtMTBoLTJWMjBoMnY0em0wLTEwaC0yVjEwaDJ2NHptMC0xMGgtMlYwaDJ2NHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30"></div>
      
      <div className="absolute top-20 left-20 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute top-40 right-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      
      <Card className="w-full max-w-md p-8 bg-white shadow-2xl relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700 border-0 rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent rounded-2xl"></div>
        
        <div className="flex flex-col items-center justify-center mb-8 relative">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-30 animate-pulse"></div>
            <div className="relative z-10 p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
              <Shield className="w-12 h-12 text-white" strokeWidth={1.5} />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mt-4 mb-2">Admin Portal</h1>
          <p className="text-slate-600 text-sm flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            Secure Admin Access
          </p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-5 relative">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-slate-700 text-sm font-medium">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 transition-all duration-200 hover:bg-slate-100"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="text-slate-700 text-sm font-medium">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20 transition-all duration-200 hover:bg-slate-100"
              required
            />
          </div>
          
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 animate-in slide-in-from-top-2 duration-300">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 shadow-lg shadow-indigo-500/50 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/60 hover:scale-[1.02] active:scale-[0.98] h-11"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Access Admin Dashboard
              </>
            )}
          </Button>
        </form>
        
        <div className="mt-6 pt-6 border-t border-slate-200">
          <p className="text-xs text-center text-slate-500">
            Authorized personnel only • Secure connection enabled
          </p>
        </div>
      </Card>
    </div>
  );
}
