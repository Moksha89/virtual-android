import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Video, VideoOff } from 'lucide-react';

interface CameraStreamProps {
  instanceId: string;
}

export function CameraStream({ instanceId }: CameraStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      
      intervalRef.current = window.setInterval(async () => {
        if (videoRef.current && ctx) {
          ctx.drawImage(videoRef.current, 0, 0, 1280, 720);
          canvas.toBlob(async (blob) => {
            if (blob) {
              const backendUrl = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:8000';
              await fetch(`${backendUrl}/api/instances/${instanceId}/camera`, {
                method: 'POST',
                body: blob,
                headers: { 'Content-Type': 'image/jpeg' }
              });
            }
          }, 'image/jpeg', 0.8);
        }
      }, 100);
      
      setIsCameraEnabled(true);
      setError(null);
      
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Failed to access camera. Please grant permission.');
    }
  };
  
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsCameraEnabled(false);
  };
  
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);
  
  return (
    <div className="space-y-2">
      <Button
        onClick={isCameraEnabled ? stopCamera : startCamera}
        variant={isCameraEnabled ? "secondary" : "default"}
        className="w-full"
      >
        {isCameraEnabled ? (
          <>
            <VideoOff className="w-4 h-4 mr-2" />
            Disable Camera
          </>
        ) : (
          <>
            <Video className="w-4 h-4 mr-2" />
            Enable Camera
          </>
        )}
      </Button>
      
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
      
      {isCameraEnabled && (
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded border border-gray-600"
          />
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
            LIVE
          </div>
        </div>
      )}
    </div>
  );
}
