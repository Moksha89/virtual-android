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
  Sun,
  Moon,
  Unlock,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lock,
  Menu,
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
  const [showUnlock, setShowUnlock] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [swipeStart, setSwipeStart] = useState<{ x: number; y: number } | null>(null);
  const [codecMode, setCodecMode] = useState<'unknown' | 'h264' | 'screencap'>('unknown');
  const wsRef = useRef<WebSocket | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const frameCountRef = useRef(0);
  const fpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const decoderRef = useRef<VideoDecoder | null>(null);
  const h264BufferRef = useRef<Uint8Array[]>([]);
  const codecModeRef = useRef<'unknown' | 'h264' | 'screencap'>('unknown');
  // Stable tab identifier - survives reconnects within same tab
  const tabIdRef = useRef(Math.random().toString(36).substring(2) + Date.now().toString(36));

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
    const wsUrl = `${wsProtocol}//${wsHost}/ws/screen?role=browser&serial=${encodeURIComponent(deviceSerial)}&token=${encodeURIComponent(token || '')}&tabId=${encodeURIComponent(tabIdRef.current)}`;

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
        const data = new Uint8Array(event.data);

        if (codecModeRef.current === 'h264') {
          // H.264 mode: decode with WebCodecs VideoDecoder
          handleH264Chunk(data);
        } else {
          // Screencap fallback mode: display as image (PNG from agent)
          frameCountRef.current++;
          const blob = new Blob([event.data], { type: 'image/png' });
          const url = URL.createObjectURL(blob);
          const oldUrl = blobUrlRef.current;
          blobUrlRef.current = url;

          if (imgRef.current) {
            imgRef.current.onload = () => {
              if (oldUrl) URL.revokeObjectURL(oldUrl);
            };
            imgRef.current.src = url;
          } else if (oldUrl) {
            URL.revokeObjectURL(oldUrl);
          }
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
          } else if (msg.type === 'codec') {
            console.log('Codec mode:', msg.codec);
            codecModeRef.current = msg.codec;
            setCodecMode(msg.codec);
            if (msg.codec === 'h264') {
              initH264Decoder();
            }
          }
        } catch {
          // ignore parse errors
        }
      }
    };

    ws.onclose = (event) => {
      console.log('Screen WebSocket closed, code:', event.code, event.reason);
      setConnected(false);
      setStreaming(false);
      // Do NOT reconnect if evicted for too many connections (code 4003)
      // or if this is no longer the active WebSocket or component unmounted
      if (event.code === 4003) {
        console.log('Connection evicted (too many tabs). Not reconnecting.');
        wsRef.current = null;
        return;
      }
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

  // H.264 WebCodecs decoder initialization
  const initH264Decoder = useCallback(() => {
    if (decoderRef.current) {
      try { decoderRef.current.close(); } catch {}
    }
    if (typeof VideoDecoder === 'undefined') {
      console.warn('WebCodecs VideoDecoder not available, falling back to screencap');
      codecModeRef.current = 'screencap';
      setCodecMode('screencap');
      return;
    }
    const decoder = new VideoDecoder({
      output: (frame: VideoFrame) => {
        frameCountRef.current++;
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = frame.displayWidth;
          canvas.height = frame.displayHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(frame, 0, 0);
          }
        }
        frame.close();
      },
      error: (err: DOMException) => {
        console.error('VideoDecoder error:', err.message);
      },
    });
    decoder.configure({
      codec: 'avc1.640028', // H.264 High Profile Level 4.0
      optimizeForLatency: true,
    });
    decoderRef.current = decoder;
    h264BufferRef.current = [];
    console.log('H.264 VideoDecoder initialized');
  }, []);

  // Parse H.264 NAL units from raw byte stream and feed to decoder
  const handleH264Chunk = useCallback((data: Uint8Array) => {
    const decoder = decoderRef.current;
    if (!decoder || decoder.state !== 'configured') return;

    // Find NAL unit boundaries (0x00 0x00 0x00 0x01 or 0x00 0x00 0x01)
    const nalUnits: Uint8Array[] = [];
    let start = -1;
    for (let i = 0; i < data.length - 3; i++) {
      if (data[i] === 0 && data[i + 1] === 0) {
        if (data[i + 2] === 1 || (data[i + 2] === 0 && i + 3 < data.length && data[i + 3] === 1)) {
          if (start >= 0) {
            nalUnits.push(data.slice(start, i));
          }
          start = i;
        }
      }
    }
    if (start >= 0) {
      nalUnits.push(data.slice(start));
    }

    // If no NAL boundaries found, treat entire chunk as one unit
    if (nalUnits.length === 0 && data.length > 0) {
      nalUnits.push(data);
    }

    for (const nal of nalUnits) {
      // Determine NAL type (5 bits after start code)
      let nalTypeIdx = 0;
      if (nal[0] === 0 && nal[1] === 0 && nal[2] === 0 && nal[3] === 1) {
        nalTypeIdx = 4;
      } else if (nal[0] === 0 && nal[1] === 0 && nal[2] === 1) {
        nalTypeIdx = 3;
      }
      const nalType = nalTypeIdx < nal.length ? (nal[nalTypeIdx] & 0x1f) : 0;
      const isKeyFrame = nalType === 5; // IDR slice

      try {
        const chunk = new EncodedVideoChunk({
          type: isKeyFrame ? 'key' : 'delta',
          timestamp: performance.now() * 1000, // microseconds
          data: nal,
        });
        decoder.decode(chunk);
      } catch (err) {
        // Skip malformed chunks
      }
    }
  }, []);

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
        ws.onclose = null;
        ws.close();
      }
      if (fpsIntervalRef.current) {
        clearInterval(fpsIntervalRef.current);
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      if (decoderRef.current) {
        try { decoderRef.current.close(); } catch {}
        decoderRef.current = null;
      }
    };
  }, [connectWebSocket]);

  const sendCommand = (msg: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  // Calculate device coordinates from click position on image/canvas
  const getDeviceCoords = (clientX: number, clientY: number) => {
    const el = codecMode === 'h264' ? canvasRef.current : imgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
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
          codecMode === 'h264' ? (
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain select-none"
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onContextMenu={(e) => e.preventDefault()}
            />
          ) : (
            <img
              ref={imgRef}
              alt="Device Screen"
              className="w-full h-full object-contain select-none"
              draggable={false}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onContextMenu={(e) => e.preventDefault()}
            />
          )
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

      {/* Primary Navigation Buttons */}
      <div className="flex items-center justify-center gap-4 py-2 border-t border-dark-700 bg-dark-850">
        <button
          onClick={() => handleKeyEvent(4)}
          disabled={!connected}
          className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Back"
        >
          <BackIcon className="w-4 h-4" />
          <span className="text-[9px]">Back</span>
        </button>
        <button
          onClick={() => handleKeyEvent(3)}
          disabled={!connected}
          className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Home"
        >
          <Home className="w-4 h-4" />
          <span className="text-[9px]">Home</span>
        </button>
        <button
          onClick={() => handleKeyEvent(187)}
          disabled={!connected}
          className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Recent Apps"
        >
          <Square className="w-4 h-4" />
          <span className="text-[9px]">Recent</span>
        </button>
        <div className="w-px h-6 bg-dark-700" />
        <button
          onClick={() => sendCommand({ type: 'wake' })}
          disabled={!connected}
          className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-dark-400 hover:text-yellow-400 hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Wake Screen"
        >
          <Sun className="w-4 h-4" />
          <span className="text-[9px]">Wake</span>
        </button>
        <button
          onClick={() => sendCommand({ type: 'sleep' })}
          disabled={!connected}
          className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-dark-400 hover:text-blue-400 hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Lock Screen"
        >
          <Moon className="w-4 h-4" />
          <span className="text-[9px]">Lock</span>
        </button>
        <button
          onClick={() => setShowUnlock(!showUnlock)}
          disabled={!connected}
          className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${showUnlock ? 'bg-green-600/30 text-green-400' : 'text-dark-400 hover:text-green-400 hover:bg-dark-700'}`}
          title="Unlock Device"
        >
          <Unlock className="w-4 h-4" />
          <span className="text-[9px]">Unlock</span>
        </button>
        <div className="w-px h-6 bg-dark-700" />
        <button
          onClick={() => handleKeyEvent(24)}
          disabled={!connected}
          className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Volume Up"
        >
          <Volume2 className="w-4 h-4" />
          <span className="text-[9px]">Vol+</span>
        </button>
        <button
          onClick={() => handleKeyEvent(25)}
          disabled={!connected}
          className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Volume Down"
        >
          <VolumeX className="w-4 h-4" />
          <span className="text-[9px]">Vol-</span>
        </button>
        <button
          onClick={() => handleKeyEvent(26)}
          disabled={!connected}
          className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Power"
        >
          <Power className="w-4 h-4" />
          <span className="text-[9px]">Power</span>
        </button>
        <button
          onClick={() => handleKeyEvent(82)}
          disabled={!connected}
          className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Menu"
        >
          <Menu className="w-4 h-4" />
          <span className="text-[9px]">Menu</span>
        </button>
      </div>

      {/* Swipe Gesture Buttons */}
      <div className="flex items-center justify-center gap-3 py-2 border-t border-dark-700 bg-dark-850">
        <span className="text-[10px] text-dark-500 mr-1">Swipe:</span>
        <button
          onClick={() => sendCommand({ type: 'swipe_gesture', direction: 'up' })}
          disabled={!connected}
          className="flex items-center gap-1 px-2 py-1 rounded text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[10px]"
          title="Swipe Up"
        >
          <ChevronUp className="w-3 h-3" /> Up
        </button>
        <button
          onClick={() => sendCommand({ type: 'swipe_gesture', direction: 'down' })}
          disabled={!connected}
          className="flex items-center gap-1 px-2 py-1 rounded text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[10px]"
          title="Swipe Down (Notifications)"
        >
          <ChevronDown className="w-3 h-3" /> Down
        </button>
        <button
          onClick={() => sendCommand({ type: 'swipe_gesture', direction: 'left' })}
          disabled={!connected}
          className="flex items-center gap-1 px-2 py-1 rounded text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[10px]"
          title="Swipe Left"
        >
          <ChevronLeft className="w-3 h-3" /> Left
        </button>
        <button
          onClick={() => sendCommand({ type: 'swipe_gesture', direction: 'right' })}
          disabled={!connected}
          className="flex items-center gap-1 px-2 py-1 rounded text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[10px]"
          title="Swipe Right"
        >
          <ChevronRight className="w-3 h-3" /> Right
        </button>
      </div>

      {/* Unlock Panel */}
      {showUnlock && (
        <div className="px-4 py-3 border-t border-dark-700 bg-dark-850">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-white">Unlock Device</span>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter PIN or password..."
              className="flex-1 px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-sm text-white placeholder-dark-500 focus:outline-none focus:border-green-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pinInput.trim()) {
                  sendCommand({ type: 'unlock_pin', pin: pinInput });
                  setPinInput('');
                }
              }}
            />
            <button
              onClick={() => {
                if (pinInput.trim()) {
                  sendCommand({ type: 'unlock_pin', pin: pinInput });
                  setPinInput('');
                }
              }}
              disabled={!pinInput.trim() || !connected}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              Unlock
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => sendCommand({ type: 'swipe_gesture', direction: 'up' })}
              disabled={!connected}
              className="flex-1 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-dark-300 text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              Swipe to Unlock
            </button>
            <button
              onClick={() => sendCommand({ type: 'wake' })}
              disabled={!connected}
              className="flex-1 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-dark-300 text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              Wake + Swipe
            </button>
          </div>
        </div>
      )}

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
              disabled={!textInput.trim() || !connected}
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
