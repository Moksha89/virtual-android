import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Power, Trash2, Smartphone } from 'lucide-react';
import { CameraStream } from './CameraStream';

interface AndroidScreenProps {
  instanceId: string;
  onDelete: () => void;
}

export function AndroidScreen({ instanceId, onDelete }: AndroidScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
    const wsUrl = backendUrl.replace('http', 'ws').replace('https', 'wss');
    
    let pc: RTCPeerConnection | null = null;
    const ws = new WebSocket(`${wsUrl}/api/instances/${instanceId}/webrtc`);
    wsRef.current = ws;
    
    ws.onopen = async () => {
      console.log('WebRTC signaling connected');
      setIsLoading(false);
      
      pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });
      
      pc.ontrack = (event) => {
        console.log('Received video track:', event);
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
        }
      };
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          ws.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate.toJSON()
          }));
        }
      };
      
      pc.addTransceiver('video', { direction: 'recvonly' });
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      console.log('Offer SDP length:', offer.sdp?.length);
      console.log('Sending offer:', { type: offer.type, sdp: offer.sdp?.substring(0, 100) + '...' });
      
      ws.send(JSON.stringify({
        type: offer.type,
        sdp: offer.sdp
      }));
    };
    
    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      console.log('Received WebRTC message:', message);
      
      if (message.type === 'answer' && pc) {
        const answer = new RTCSessionDescription({
          type: 'answer',
          sdp: message.sdp
        });
        await pc.setRemoteDescription(answer);
        console.log('WebRTC connection established');
      } else if (message.type === 'error') {
        console.error('WebRTC error:', message.message);
        setError(message.message);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Failed to connect to Android instance');
      setIsLoading(false);
    };
    
    ws.onclose = () => {
      console.log('WebSocket connection closed');
      if (pc) {
        pc.close();
      }
    };
    
    return () => {
      ws.close();
      if (pc) {
        pc.close();
      }
    };
  }, [instanceId]);
  
  const handleClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1080;
    const y = ((e.clientY - rect.top) / rect.height) * 2340;
    
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const token = localStorage.getItem('token');
      await fetch(`${backendUrl}/api/instances/${instanceId}/input`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          x: Math.round(x),
          y: Math.round(y),
          type: 'tap'
        })
      });
    } catch (error) {
      console.error('Failed to send input event:', error);
    }
  };
  
  const sendKeyEvent = async (keycode: number, keyName: string) => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const token = localStorage.getItem('token');
      
      await fetch(`${backendUrl}/api/instances/${instanceId}/keyevent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          keycode,
          key_name: keyName
        })
      });
      
      console.log(`Sent ${keyName} key event`);
    } catch (error) {
      console.error(`Failed to send ${keyName} key event:`, error);
    }
  };
  
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this Android instance?')) {
      return;
    }
    
    setIsDeleting(true);
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/instances/${instanceId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        onDelete();
      } else {
        throw new Error('Failed to delete instance');
      }
    } catch (error) {
      console.error('Failed to delete instance:', error);
      setError('Failed to delete instance');
    } finally {
      setIsDeleting(false);
    }
  };
  
  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden bg-gray-900" style={{ aspectRatio: '1080/2340', maxWidth: '375px' }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-center text-white">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
              <p className="text-sm">Connecting to Android...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-center text-white px-4">
              <Power className="w-12 h-12 mx-auto mb-4 text-red-400" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}
        
        {!error && (
          <div 
            className="absolute inset-0 cursor-pointer" 
            onClick={handleClick}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover bg-gray-800"
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                <div className="text-center text-white px-4">
                  <Smartphone className="w-16 h-16 mx-auto mb-4" />
                  <p className="text-sm mb-2">Connecting to Android...</p>
                  <p className="text-xs text-gray-400">
                    Establishing WebRTC connection
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
      
      <div className="space-y-2">
        <CameraStream instanceId={instanceId} />
        
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Hardware Buttons</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendKeyEvent(24, 'Volume Up')}
            >
              Volume Up
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendKeyEvent(25, 'Volume Down')}
            >
              Volume Down
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendKeyEvent(26, 'Power')}
            >
              Power
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendKeyEvent(3, 'Home')}
            >
              Home
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendKeyEvent(4, 'Back')}
            >
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendKeyEvent(187, 'Recent Apps')}
            >
              Recent Apps
            </Button>
          </div>
        </Card>
      </div>
      
      <div className="flex gap-2">
        <Button
          onClick={handleDelete}
          disabled={isDeleting}
          variant="destructive"
          className="flex-1"
        >
          {isDeleting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Instance
            </>
          )}
        </Button>
      </div>
      
      <div className="text-xs text-gray-500 space-y-1">
        <p>Instance ID: {instanceId}</p>
        <p>Screen: 1080x2340 (Mobile)</p>
        <p>OS: Android 12</p>
      </div>
    </div>
  );
}
