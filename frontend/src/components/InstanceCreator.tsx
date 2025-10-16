import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Smartphone, Loader2 } from 'lucide-react';

interface InstanceCreatorProps {
  onInstanceCreated: (instanceId: string) => void;
}

export function InstanceCreator({ onInstanceCreated }: InstanceCreatorProps) {
  const [ramGb, setRamGb] = useState('4');
  const [romGb, setRomGb] = useState('32');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const token = localStorage.getItem('token');
      const response = await fetch(`${backendUrl}/api/instances`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          ram_gb: parseInt(ramGb), 
          rom_gb: parseInt(romGb) 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create instance');
      }
      
      const instance = await response.json();
      onInstanceCreated(instance.id);
    } catch (error) {
      console.error('Failed to create instance:', error);
      setError(error instanceof Error ? error.message : 'Failed to create instance');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="w-full max-w-md">
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">RAM Memory</label>
          <Select value={ramGb} onValueChange={setRamGb}>
            <SelectTrigger className="bg-white border-slate-200 text-slate-900">
              <SelectValue placeholder="Select RAM" />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200">
              <SelectItem value="2" className="text-slate-900 hover:bg-slate-50">2 GB</SelectItem>
              <SelectItem value="4" className="text-slate-900 hover:bg-slate-50">4 GB (Recommended)</SelectItem>
              <SelectItem value="8" className="text-slate-900 hover:bg-slate-50">8 GB</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">ROM Storage</label>
          <Select value={romGb} onValueChange={setRomGb}>
            <SelectTrigger className="bg-white border-slate-200 text-slate-900">
              <SelectValue placeholder="Select ROM" />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200">
              <SelectItem value="16" className="text-slate-900 hover:bg-slate-50">16 GB</SelectItem>
              <SelectItem value="32" className="text-slate-900 hover:bg-slate-50">32 GB (Recommended)</SelectItem>
              <SelectItem value="64" className="text-slate-900 hover:bg-slate-50">64 GB</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 animate-in slide-in-from-top-2 duration-300">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        
        <Button 
          onClick={handleCreate} 
          disabled={loading} 
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 shadow-lg shadow-indigo-500/50 transition-all duration-200 hover:shadow-xl disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Smartphone className="w-4 h-4 mr-2" />
              Create Android Phone
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
