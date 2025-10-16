import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Power, Trash2, Smartphone, Volume2, VolumeX, Home, ArrowLeft, Menu as MenuIcon, Maximize, Minimize, ChevronLeft, ChevronRight } from 'lucide-react';
import { CameraStream } from './CameraStream';

interface AndroidScreenProps {
  instanceId: string;
  onDelete: () => void;
}

export function AndroidScreen({ instanceId, onDelete }: AndroidScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
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
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getAudioTracks().forEach(track => {
          if (pc) {
            pc.addTrack(track, stream);
            console.log('Added audio track to peer connection');
          }
        });
      } catch (err) {
        console.warn('Could not access microphone:', err);
      }
      
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
  
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-4">
        <div className={`flex-1 space-y-4 transition-all duration-300 ${isFullscreen ? 'max-w-full' : 'max-w-md'}`}>
          <Card className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 shadow-2xl rounded-xl" style={{ aspectRatio: isFullscreen ? 'auto' : '1080/2340', height: isFullscreen ? '100vh' : 'auto' }}>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                <div className="text-center text-white">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-indigo-400" />
                  <p className="text-sm">Connecting to Android...</p>
                </div>
              </div>
            )}
            
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
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
                  className="w-full h-full object-cover bg-slate-900"
                />
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                    <div className="text-center text-white px-4">
                      <div className="mb-4 p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full inline-block shadow-lg shadow-indigo-500/50">
                        <Smartphone className="w-12 h-12" />
                      </div>
                      <p className="text-sm mb-2 font-medium">Connecting to Android...</p>
                      <p className="text-xs text-slate-400">
                        Establishing WebRTC connection
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="absolute top-4 right-4 flex gap-2 z-10">
              <Button
                size="sm"
                onClick={toggleFullscreen}
                className="bg-indigo-500/90 hover:bg-indigo-600 border-0 text-white backdrop-blur-sm transition-all duration-200 shadow-lg shadow-indigo-500/50"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </Button>
              {!isFullscreen && (
                <Button
                  size="sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="bg-purple-500/90 hover:bg-purple-600 border-0 text-white backdrop-blur-sm transition-all duration-200 shadow-lg shadow-purple-500/50"
                >
                  {sidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </Card>
          
          {!isFullscreen && (
            <>
              <div className="space-y-3">
                <CameraStream instanceId={instanceId} />
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-all duration-200 shadow-sm"
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
              
              <Card className="p-3 bg-white border-slate-200 shadow-sm rounded-xl">
                <div className="text-xs text-slate-600 space-y-1">
                  <p className="font-mono">Instance ID: {instanceId.slice(0, 8)}...</p>
                  <p>Screen: 1080x2340 (Mobile)</p>
                  <p>OS: Android 12 AOSP</p>
                </div>
              </Card>
            </>
          )}
        </div>
        
        {!isFullscreen && (
          <div className={`transition-all duration-300 ${sidebarOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
            <Card className="p-4 bg-white border-slate-200 shadow-lg sticky top-4 rounded-xl">
              <h3 className="text-sm font-semibold mb-4 text-slate-900 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Virtual Controls
              </h3>
              
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendKeyEvent(26, 'Power')}
                  className="w-full justify-start bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 transition-all duration-200 shadow-sm"
                >
                  <Power className="w-4 h-4 mr-2" />
                  Power
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendKeyEvent(24, 'Volume Up')}
                  className="w-full justify-start bg-white border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200"
                >
                  <Volume2 className="w-4 h-4 mr-2" />
                  Volume Up
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendKeyEvent(25, 'Volume Down')}
                  className="w-full justify-start bg-white border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200"
                >
                  <VolumeX className="w-4 h-4 mr-2" />
                  Volume Down
                </Button>
                
                <div className="border-t border-slate-200 my-3 pt-3">
                  <p className="text-xs text-slate-500 mb-2 font-medium">Navigation</p>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendKeyEvent(3, 'Home')}
                  className="w-full justify-start bg-white border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Home
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendKeyEvent(4, 'Back')}
                  className="w-full justify-start bg-white border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendKeyEvent(187, 'Recent Apps')}
                  className="w-full justify-start bg-white border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200"
                >
                  <MenuIcon className="w-4 h-4 mr-2" />
                  Recent Apps
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
