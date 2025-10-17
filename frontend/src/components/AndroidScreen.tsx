import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Power, Trash2, Smartphone, Volume2, VolumeX, Home, ArrowLeft, Menu as MenuIcon, Maximize, Minimize, ChevronLeft, ChevronRight, Upload, Download } from 'lucide-react';
import { CameraStream } from './CameraStream';

interface AndroidScreenProps {
  instanceId: string;
  onDelete: () => void;
}

export function AndroidScreen({ instanceId, onDelete }: AndroidScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const clipboardIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gamepadIntervalRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  const [showFiles, setShowFiles] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [activeCamera, setActiveCamera] = useState<'front' | 'back'>('front');
  const [encodingQuality, setEncodingQuality] = useState<'high' | 'medium' | 'low'>('medium');
  
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
      
      const dataChannel = pc.createDataChannel('clipboard');
      dataChannelRef.current = dataChannel;
      
      dataChannel.onopen = () => {
        console.log('Data channel opened');
      };
      
      dataChannel.onmessage = (event) => {
        console.log('Data channel message:', event.data);
      };
      
      let lastClipboard = '';
      clipboardIntervalRef.current = setInterval(async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text !== lastClipboard && text !== '') {
            lastClipboard = text;
            if (dataChannel.readyState === 'open') {
              dataChannel.send(JSON.stringify({
                type: 'clipboard',
                content: text
              }));
              console.log('Sent clipboard to Android:', text.substring(0, 50));
            }
          }
        } catch (err) {
          // Clipboard access might be denied
        }
      }, 1000);
      
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
      
      const gamepadState: { [key: number]: boolean } = {};
      
      const pollGamepad = () => {
        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
          if (gamepad) {
            gamepad.buttons.forEach((button, index) => {
              const pressed = button.pressed;
              const wasPressed = gamepadState[index] || false;
              
              if (pressed !== wasPressed) {
                gamepadState[index] = pressed;
                
                if (ws && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    type: 'gamepad',
                    button: index,
                    pressed: pressed
                  }));
                }
              }
            });
          }
        }
      };
      
      gamepadIntervalRef.current = setInterval(pollGamepad, 16) as unknown as number;
      
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
      if (clipboardIntervalRef.current) {
        clearInterval(clipboardIntervalRef.current);
      }
      if (gamepadIntervalRef.current) {
        clearInterval(gamepadIntervalRef.current);
      }
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
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;
    
    setIsUploading(true);
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const token = localStorage.getItem('token');
      
      for (const file of droppedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${backendUrl}/api/instances/${instanceId}/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        
        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
      }
      
      console.log('Files uploaded successfully');
      await fetchFiles();
    } catch (error) {
      console.error('File upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };
  
  const fetchFiles = async () => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${backendUrl}/api/instances/${instanceId}/files`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files);
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
    }
  };
  
  const handleDownload = async (filename: string) => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${backendUrl}/api/instances/${instanceId}/download/${filename}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('File download failed:', error);
    }
  };
  
  useEffect(() => {
    if (showFiles) {
      fetchFiles();
    }
  }, [showFiles]);
  
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
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover bg-slate-900"
                />
                
                {isDragging && (
                  <div className="absolute inset-0 bg-indigo-500/20 border-4 border-dashed border-indigo-500 flex items-center justify-center backdrop-blur-sm z-20">
                    <div className="text-center text-white">
                      <Upload className="w-16 h-16 mx-auto mb-4" />
                      <p className="text-xl font-bold mb-2">Drop files to upload</p>
                      <p className="text-sm">Files will be saved to /sdcard/Download/</p>
                    </div>
                  </div>
                )}
                
                {isUploading && (
                  <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center backdrop-blur-sm z-20">
                    <div className="text-center text-white">
                      <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-indigo-400" />
                      <p className="text-sm">Uploading files...</p>
                    </div>
                  </div>
                )}
                
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
                
                <div className="border-t border-slate-200 my-3 pt-3">
                  <p className="text-xs text-slate-500 mb-2 font-medium">File Transfer</p>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFiles(!showFiles)}
                  className="w-full justify-start bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 transition-all duration-200 shadow-sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {showFiles ? 'Hide' : 'Show'} Files
                </Button>
                
                {showFiles && files.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                    {files.map((file, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleDownload(file.split(' ').pop() || '')}
                        className="w-full text-left text-xs px-2 py-1 bg-slate-50 hover:bg-slate-100 rounded truncate transition-colors"
                        title={file}
                      >
                        📄 {file.split(' ').pop()}
                      </button>
                    ))}
                  </div>
                )}
                
                {showFiles && files.length === 0 && (
                  <p className="text-xs text-slate-400 mt-2 text-center">No files in Downloads</p>
                )}
                
                <div className="border-t border-slate-200 my-3 pt-3">
                  <p className="text-xs text-slate-500 mb-2 font-medium">Phase 3 Features</p>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!isRecording) {
                      try {
                        const token = localStorage.getItem('token');
                        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
                        await fetch(`${backendUrl}/api/instances/${instanceId}/start-recording`, {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${token}` }
                        });
                        setIsRecording(true);
                        alert('Recording started (max 3 minutes)');
                        setTimeout(() => setIsRecording(false), 180000);
                      } catch (error) {
                        console.error('Failed to start recording:', error);
                      }
                    }
                  }}
                  className={`w-full justify-start ${isRecording ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'} transition-all duration-200`}
                >
                  {isRecording ? '⏺️ Recording...' : '🎥 Record Screen'}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('token');
                      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
                      const response = await fetch(`${backendUrl}/api/instances/${instanceId}/screenshot`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `screenshot_${Date.now()}.png`;
                      a.click();
                    } catch (error) {
                      console.error('Failed to take screenshot:', error);
                    }
                  }}
                  className="w-full justify-start bg-white border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200"
                >
                  📸 Screenshot
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const newCamera = activeCamera === 'front' ? 'back' : 'front';
                    try {
                      const token = localStorage.getItem('token');
                      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
                      await fetch(`${backendUrl}/api/instances/${instanceId}/switch-camera?camera_type=${newCamera}`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      setActiveCamera(newCamera);
                      alert(`Switched to ${newCamera} camera`);
                    } catch (error) {
                      console.error('Failed to switch camera:', error);
                    }
                  }}
                  className="w-full justify-start bg-white border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200"
                >
                  🔄 Switch to {activeCamera === 'front' ? 'Back' : 'Front'} Camera
                </Button>
                
                <div className="flex gap-1 items-center">
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="Lat"
                    className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded"
                    id={`gps-lat-${instanceId}`}
                  />
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="Lng"
                    className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded"
                    id={`gps-lng-${instanceId}`}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const latInput = document.getElementById(`gps-lat-${instanceId}`) as HTMLInputElement;
                    const lngInput = document.getElementById(`gps-lng-${instanceId}`) as HTMLInputElement;
                    const latitude = parseFloat(latInput.value);
                    const longitude = parseFloat(lngInput.value);
                    
                    if (isNaN(latitude) || isNaN(longitude)) {
                      alert('Please enter valid latitude and longitude');
                      return;
                    }
                    
                    try {
                      const token = localStorage.getItem('token');
                      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
                      await fetch(`${backendUrl}/api/instances/${instanceId}/set-gps`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ latitude, longitude })
                      });
                      alert(`GPS set to (${latitude}, ${longitude})`);
                    } catch (error) {
                      console.error('Failed to set GPS location:', error);
                    }
                  }}
                  className="w-full justify-start bg-white border-slate-200 text-slate-700 hover:bg-slate-50 transition-all duration-200"
                >
                  📍 Set GPS
                </Button>
                
                <select
                  onChange={async (e) => {
                    const preset = e.target.value;
                    try {
                      const token = localStorage.getItem('token');
                      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
                      await fetch(`${backendUrl}/api/instances/${instanceId}/set-network-throttling?preset=${preset}`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      alert(`Network set to ${preset}`);
                    } catch (error) {
                      console.error('Failed to set network throttling:', error);
                    }
                  }}
                  className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                >
                  <option value="none">Network: None</option>
                  <option value="3g">Network: 3G</option>
                  <option value="4g">Network: 4G</option>
                  <option value="lte">Network: LTE</option>
                  <option value="slow">Network: Slow</option>
                </select>

                <select
                  value={encodingQuality}
                  onChange={async (e) => {
                    const quality = e.target.value as 'high' | 'medium' | 'low';
                    setEncodingQuality(quality);
                    try {
                      const token = localStorage.getItem('token');
                      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
                      await fetch(`${backendUrl}/api/instances/${instanceId}/set-encoding-quality?quality=${quality}`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      alert(`Streaming quality set to ${quality}`);
                    } catch (error) {
                      console.error('Failed to set encoding quality:', error);
                    }
                  }}
                  className="w-full px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                >
                  <option value="high">Quality: High (30 FPS, 1080p)</option>
                  <option value="medium">Quality: Medium (20 FPS, 720p)</option>
                  <option value="low">Quality: Low (15 FPS, 480p)</option>
                </select>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
