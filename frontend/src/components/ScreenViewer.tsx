import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  Home,
  ArrowLeft as BackIcon,
  Square,
  Volume2,
  VolumeX,
  Power,
  RotateCcw,
  Keyboard,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface ScreenViewerProps {
  deviceSerial: string;
  deviceResolution: string | null; // e.g., "1080x1920"
  isOnline: boolean;
}

export default function ScreenViewer({ deviceSerial, deviceResolution, isOnline }: ScreenViewerProps) {
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [fps, setFps] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [swipeStart, setSwipeStart] = useState<{ x: number; y: number } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameCountRef = useRef(0);
  const fpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Parse device resolution
  const [devWidth, devHeight] = (deviceResolution || '1080x1920').split('x').map(Number);

  const connectWebSocket = useCallback(() => {
    if (!isOnline || !deviceSerial || !mountedRef.current) return;

    // Close existing connection before creating new one
    if (wsRef.current) {
      const oldWs = wsRef.current;
      wsRef.current = null;
      oldWs.onclose = null; // Prevent reconnect from old socket
      oldWs.onerror = null;
      oldWs.onmessage = null;
      if (oldWs.readyState === WebSocket.OPEN || oldWs.readyState === WebSocket.CONNECTING) {
        oldWs.close();
      }
    }

    // Clear any pending reconnect timer
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const token = localStorage.getItem('token');
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/ws/screen?role=browser&serial=${encodeURIComponent(deviceSerial)}&token=${encodeURIComponent(token || '')}`;

    console.log('Screen WebSocket connecting...');
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Screen WebSocket connected');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        // Binary PNG frame
        frameCountRef.current++;
        const blob = new Blob([event.data], { type: 'image/png' });
        const url = URL.createObjectURL(blob);

        // Revoke previous blob URL to prevent memory leak
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }
        blobUrlRef.current = url;

        if (imgRef.current) {
          imgRef.current.src = url;
        }
        setStreaming(true);
      } else {
        // JSON message
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'agent_connected') {
            setConnected(true);
          } else if (msg.type === 'agent_disconnected') {
            setStreaming(false);
          }
        } catch {
          // ignore parse errors
        }
      }
    };

    ws.onclose = () => {
      console.log('Screen WebSocket closed');
      setConnected(false);
      setStreaming(false);
      // Only reconnect if this is still the active WebSocket and component is mounted
      if (wsRef.current === ws && mountedRef.current && isOnline) {
        wsRef.current = null;
        reconnectTimerRef.current = setTimeout(connectWebSocket, 3000);
      }
    };

    ws.onerror = (err) => {
      console.error('Screen WebSocket error', err);
      // Will trigger onclose
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceSerial, isOnline]);

  useEffect(() => {
    mountedRef.current = true;
    connectWebSocket();

    // FPS counter
    fpsIntervalRef.current = setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        ws.onclose = null; // Prevent reconnect on cleanup
        ws.close();
      }
      if (fpsIntervalRef.current) {
        clearInterval(fpsIntervalRef.current);
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, [connectWebSocket]);

  const sendCommand = (msg: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  // Calculate device coordinates from click position on image
  const getDeviceCoords = (clientX: number, clientY: number) => {
    if (!imgRef.current) return null;
    const rect = imgRef.current.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    return {
      x: Math.round(relX * devWidth),
      y: Math.round(relY * devHeight),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getDeviceCoords(e.clientX, e.clientY);
    if (coords) {
      setSwipeStart(coords);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const coords = getDeviceCoords(e.clientX, e.clientY);
    if (!coords || !swipeStart) {
      setSwipeStart(null);
      return;
    }

    const dx = Math.abs(coords.x - swipeStart.x);
    const dy = Math.abs(coords.y - swipeStart.y);

    if (dx < 20 && dy < 20) {
      // Tap
      sendCommand({ type: 'tap', x: coords.x, y: coords.y });
    } else {
      // Swipe
      sendCommand({
        type: 'swipe',
        x1: swipeStart.x,
        y1: swipeStart.y,
        x2: coords.x,
        y2: coords.y,
        duration: 300,
      });
    }
    setSwipeStart(null);
  };

  const handleKeyEvent = (keycode: number) => {
    sendCommand({ type: 'keyevent', keycode });
  };

  const handleSendText = () => {
    if (textInput.trim()) {
      sendCommand({ type: 'text', text: textInput });
      setTextInput('');
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
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
    <div ref={containerRef} className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
        <div className="flex items-center gap-2">
          {connected ? (
            <Wifi className="w-4 h-4 text-green-400" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-400" />
          )}
          <span className="text-sm font-medium text-white">Live Screen</span>
          {streaming && (
            <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
              {fps} FPS
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowKeyboard(!showKeyboard)}
            className={`p-1.5 rounded ${showKeyboard ? 'bg-primary-600/30 text-primary-400' : 'text-dark-400 hover:text-white'}`}
            title="Toggle keyboard"
          >
            <Keyboard className="w-4 h-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded text-dark-400 hover:text-white"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Screen Area */}
      <div
        className={`relative bg-black flex items-center justify-center ${isFullscreen ? 'h-[calc(100vh-120px)]' : 'aspect-[9/16] max-h-[500px]'}`}
        style={{ cursor: streaming ? 'crosshair' : 'default' }}
      >
        {streaming ? (
          <img
            ref={imgRef}
            alt="Device Screen"
            className="w-full h-full object-contain select-none"
            draggable={false}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onContextMenu={(e) => e.preventDefault()}
          />
        ) : (
          <div className="text-center p-6">
            {isOnline ? (
              <>
                <RotateCcw className="w-10 h-10 text-dark-600 mx-auto mb-3 animate-spin" />
                <p className="text-dark-400 text-sm">
                  {connected ? 'Waiting for screen stream...' : 'Connecting to device agent...'}
                </p>
                <p className="text-dark-500 text-xs mt-1">
                  The agent on your Windows PC streams the screen
                </p>
              </>
            ) : (
              <>
                <WifiOff className="w-10 h-10 text-dark-600 mx-auto mb-3" />
                <p className="text-dark-400 text-sm">Device is offline</p>
                <p className="text-dark-500 text-xs mt-1">
                  Connect the device and ensure the agent is running
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Android Navigation Buttons */}
      <div className="flex items-center justify-center gap-6 py-3 border-t border-dark-700 bg-dark-850">
        <button
          onClick={() => handleKeyEvent(4)}
          disabled={!streaming}
          className="flex flex-col items-center gap-1 p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Back"
        >
          <BackIcon className="w-5 h-5" />
          <span className="text-[10px]">Back</span>
        </button>
        <button
          onClick={() => handleKeyEvent(3)}
          disabled={!streaming}
          className="flex flex-col items-center gap-1 p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Home"
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Home</span>
        </button>
        <button
          onClick={() => handleKeyEvent(187)}
          disabled={!streaming}
          className="flex flex-col items-center gap-1 p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Recent Apps"
        >
          <Square className="w-5 h-5" />
          <span className="text-[10px]">Recent</span>
        </button>
        <div className="w-px h-8 bg-dark-700" />
        <button
          onClick={() => handleKeyEvent(24)}
          disabled={!streaming}
          className="flex flex-col items-center gap-1 p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Volume Up"
        >
          <Volume2 className="w-5 h-5" />
          <span className="text-[10px]">Vol+</span>
        </button>
        <button
          onClick={() => handleKeyEvent(25)}
          disabled={!streaming}
          className="flex flex-col items-center gap-1 p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Volume Down"
        >
          <VolumeX className="w-5 h-5" />
          <span className="text-[10px]">Vol-</span>
        </button>
        <button
          onClick={() => handleKeyEvent(26)}
          disabled={!streaming}
          className="flex flex-col items-center gap-1 p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Power"
        >
          <Power className="w-5 h-5" />
          <span className="text-[10px]">Power</span>
        </button>
      </div>

      {/* Keyboard Input */}
      {showKeyboard && (
        <div className="px-4 py-3 border-t border-dark-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type text to send to device..."
              className="flex-1 px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSendText();
                }
              }}
            />
            <button
              onClick={handleSendText}
              disabled={!textInput.trim() || !streaming}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
