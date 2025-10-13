import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Smartphone } from 'lucide-react';

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
      const response = await fetch(`${backendUrl}/api/instances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Smartphone className="w-6 h-6" />
          <CardTitle>Create Virtual Android</CardTitle>
        </div>
        <CardDescription>
          Configure and launch a new Android phone instance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">RAM Memory</label>
          <Select value={ramGb} onValueChange={setRamGb}>
            <SelectTrigger>
              <SelectValue placeholder="Select RAM" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 GB</SelectItem>
              <SelectItem value="4">4 GB (Recommended)</SelectItem>
              <SelectItem value="8">8 GB</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">ROM Storage</label>
          <Select value={romGb} onValueChange={setRomGb}>
            <SelectTrigger>
              <SelectValue placeholder="Select ROM" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="16">16 GB</SelectItem>
              <SelectItem value="32">32 GB (Recommended)</SelectItem>
              <SelectItem value="64">64 GB</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {error && (
          <div className="text-sm text-red-500 bg-red-50 p-3 rounded">
            {error}
          </div>
        )}
        
        <Button 
          onClick={handleCreate} 
          disabled={loading} 
          className="w-full"
        >
          {loading ? 'Creating...' : 'Create Android Phone'}
        </Button>
      </CardContent>
    </Card>
  );
}
