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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDEzNEgzNHYtNGgydjR6bTAtMTBIMzR2LTRoMnY0em0wLTEwSDM0di00aDJ2NHptMC0xMEgzNHYtNGgydjR6bTAtMTBIMzRWOTBoMnY0em0wLTEwSDM0VjgwaDJ2NHptMC0xMEgzNFY3MGgydjR6bTAtMTBIMzRWNjBoMnY0em0wLTEwSDM0VjUwaDJ2NHptMC0xMEgzNFY0MGgydjR6bTAtMTBIMzRWMzBoMnY0em0wLTEwSDM0VjIwaDJ2NHptMC0xMEgzNFYxMGgydjR6bTAtMTBIMzRWMGgydjR6TTI2IDEzNEgyNHYtNGgydjR6bTAtMTBIMjR2LTRoMnY0em0wLTEwSDI0di00aDJ2NHptMC0xMEgyNHYtNGgydjR6bTAtMTBIMjRWOTBoMnY0em0wLTEwSDI0VjgwaDJ2NHptMC0xMEgyNFY3MGgydjR6bTAtMTBIMjRWNjBoMnY0em0wLTEwSDI0VjUwaDJ2NHptMC0xMEgyNFY0MGgydjR6bTAtMTBIMjRWMzBoMnY0em0wLTEwSDI0VjIwaDJ2NHptMC0xMEgyNFYxMGgydjR6bTAtMTBIMjRWMGgydjR6TTE2IDEzNEgxNHYtNGgydjR6bTAtMTBIMTR2LTRoMnY0em0wLTEwSDE0di00aDJ2NHptMC0xMEgxNHYtNGgydjR6bTAtMTBIMTRWOTBoMnY0em0wLTEwSDE0VjgwaDJ2NHptMC0xMEgxNFY3MGgydjR6bTAtMTBIMTRWNjBoMnY0em0wLTEwSDE0VjUwaDJ2NHptMC0xMEgxNFY0MGgydjR6bTAtMTBIMTRWMzBoMnY0em0wLTEwSDE0VjIwaDJ2NHptMC0xMEgxNFYxMGgydjR6bTAtMTBIMTRWMGgydjR6TTE0NiAxMzRoLTJ2LTRoMnY0em0wLTEwaC0ydi00aDJ2NHptMC0xMGgtMnYtNGgydjR6bTAtMTBoLTJ2LTRoMnY0em0wLTEwaC0yVjkwaDJ2NHptMC0xMGgtMlY4MGgydjR6bTAtMTBoLTJWNzBoMnY0em0wLTEwaC0yVjYwaDJ2NHptMC0xMGgtMlY1MGgydjR6bTAtMTBoLTJWNDBoMnY0em0wLTEwaC0yVjMwaDJ2NHptMC0xMGgtMlYyMGgydjR6bTAtMTBoLTJWMTBoMnY0em0wLTEwaC0yVjBoMnY0em0tMTAgMTM0aC0ydi00aDJ2NHptMC0xMGgtMnYtNGgydjR6bTAtMTBoLTJ2LTRoMnY0em0wLTEwaC0ydi00aDJ2NHptMC0xMGgtMlY5MGgydjR6bTAtMTBoLTJWODBoMnY0em0wLTEwaC0yVjcwaDJ2NHptMC0xMGgtMlY2MGgydjR6bTAtMTBoLTJWNTBoMnY0em0wLTEwaC0yVjQwaDJ2NHptMC0xMGgtMlYzMGgydjR6bTAtMTBoLTJWMjBoMnY0em0wLTEwaC0yVjEwaDJ2NHptMC0xMGgtMlYwaDJ2NHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20"></div>
      
      <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute top-40 right-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      
      <Card className="w-full max-w-md p-8 backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-lg"></div>
        
        <div className="flex flex-col items-center justify-center mb-8 relative">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
            <Shield className="w-16 h-16 text-white relative z-10 drop-shadow-lg" strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl font-bold text-white mt-4 mb-2 bg-gradient-to-r from-purple-200 via-blue-200 to-indigo-200 bg-clip-text text-transparent">Admin Portal</h1>
          <p className="text-purple-200 text-sm flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Secure Admin Access
          </p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-5 relative">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-white text-sm font-medium">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400/20 transition-all duration-200 hover:bg-white/15"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white text-sm font-medium">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-purple-400 focus:ring-purple-400/20 transition-all duration-200 hover:bg-white/15"
              required
            />
          </div>
          
          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 animate-in slide-in-from-top-2 duration-300">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}
          
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white border-0 shadow-lg shadow-purple-500/30 transition-all duration-200 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98] h-11"
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
        
        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="text-xs text-center text-purple-200/60">
            Authorized personnel only • Secure connection enabled
          </p>
        </div>
      </Card>
    </div>
  );
}
