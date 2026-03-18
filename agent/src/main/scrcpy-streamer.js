const EventEmitter = require('events');
const WebSocket = require('ws');
const net = require('net');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * ScrcpyStreamer - Streams Android device screens over WebSocket.
 * 
 * Supports two modes:
 * 1. H.264 mode: Uses `adb exec-out screenrecord --output-format=h264` to pipe
 *    raw H.264 Annex B NAL units. 15-30 FPS, very low bandwidth. Requires HTTPS
 *    (WebCodecs) or MSE (jmuxer) for browser decoding. Auto-restarts every 3 min
 *    (Android screenrecord limit).
 * 2. Screencap fallback: Uses `adb screencap -p` for PNG screenshots. ~2-3 FPS,
 *    higher bandwidth but works everywhere.
 * 
 * The backend tells the agent which codec to use via `request_codec` message.
 */
class ScrcpyStreamer extends EventEmitter {
  constructor(serverUrl, apiKey, adbManager) {
    super();
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.adbManager = adbManager;
    this.activeStreams = new Map(); // serial -> streamState
    this.scrcpyServerPath = this._findScrcpyServer();
    this.scrcpyVersion = '2.7';
    this.localPortBase = 27183;
    this.nextPort = this.localPortBase;
    this.screenrecordSupported = new Map(); // serial -> boolean
  }

  _findScrcpyServer() {
    // Look for scrcpy-server.jar in several locations
    const candidates = [
      path.join(process.resourcesPath || '', 'scrcpy-server.jar'),
      path.join(__dirname, '..', '..', 'scrcpy-server.jar'),
      path.join(__dirname, '..', '..', '..', 'scrcpy-server.jar'),
      path.join(process.cwd(), 'scrcpy-server.jar'),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          console.log(`Found scrcpy-server.jar at: ${p}`);
          return p;
        }
      } catch {}
    }
    console.warn('scrcpy-server.jar not found, will use screencap fallback');
    return null;
  }

  _getLocalPort() {
    const port = this.nextPort;
    this.nextPort++;
    if (this.nextPort > 27200) this.nextPort = this.localPortBase;
    return port;
  }

  startForDevice(serial) {
    if (this.activeStreams.has(serial)) {
      console.log(`Stream already active for ${serial}`);
      return;
    }

    const wsUrl = this.serverUrl.replace(/^http/, 'ws') +
      `/ws/screen?role=agent&serial=${encodeURIComponent(serial)}&apiKey=${encodeURIComponent(this.apiKey)}`;

    console.log(`[scrcpy] Connecting WebSocket for ${serial}...`);
    const ws = new WebSocket(wsUrl);

    const streamState = {
      ws,
      streaming: false,
      scrcpyProcess: null,
      screenrecordProcess: null,
      tcpSocket: null,
      localPort: null,
      pingInterval: null,
      framesSent: 0,
      bytesTotal: 0,
      useScrcpy: false,
      useScreenrecord: false, // H.264 via adb screenrecord
      looping: false,
      framesSkipped: 0,
      codec: 'screencap', // Current active codec: 'h264' or 'screencap'
    };

    ws.on('open', () => {
      console.log(`[scrcpy] WebSocket connected for ${serial}`);
      this.emit('stream_connected', { serial });
      streamState.pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.ping();
      }, 20000);
    });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        switch (msg.type) {
          case 'start_streaming':
            console.log(`[stream] Start streaming for ${serial} (codec: ${streamState.codec})`);
            streamState.streaming = true;
            if (streamState.codec === 'h264') {
              this._startScreenrecordH264(serial, streamState);
            } else {
              this._startScreencapFallback(serial, streamState);
            }
            this.emit('stream_started', { serial });
            break;

          case 'stop_streaming':
            console.log(`[scrcpy] Stop streaming for ${serial}`);
            this._stopStream(streamState);
            this.emit('stream_stopped', { serial });
            break;

          // Input commands - relay to ADB
          case 'tap':
            await this.adbManager.tap(serial, msg.x, msg.y);
            break;
          case 'swipe':
            await this.adbManager.swipe(serial, msg.x1, msg.y1, msg.x2, msg.y2, msg.duration || 300);
            break;
          case 'keyevent':
            await this.adbManager.keyevent(serial, msg.keycode);
            break;
          case 'text':
            await this.adbManager.inputText(serial, msg.text);
            break;
          case 'wake':
            await this.adbManager.wakeScreen(serial);
            break;
          case 'sleep':
            await this.adbManager.sleepScreen(serial);
            break;
          case 'unlock_pin':
            await this.adbManager.unlockPin(serial, msg.pin);
            break;
          case 'unlock_pattern':
            await this.adbManager.unlockPattern(serial, msg.pattern);
            break;
          case 'swipe_gesture':
            await this.adbManager.swipeGesture(serial, msg.direction);
            break;
          case 'request_codec':
            console.log(`[stream] Server requested codec: ${msg.codec} for ${serial} (current: ${streamState.codec})`);
            if (msg.codec === 'screencap' && streamState.codec !== 'screencap') {
              // Stop H.264 streaming and switch to screencap
              this._stopH264(streamState);
              streamState.codec = 'screencap';
              if (streamState.streaming && !streamState.looping) {
                this._startScreencapFallback(serial, streamState);
              }
            } else if (msg.codec === 'h264' && streamState.codec !== 'h264') {
              // Stop screencap and switch to H.264 screenrecord
              streamState.looping = false; // Stop screencap loop
              streamState.codec = 'h264';
              if (streamState.streaming) {
                this._startScreenrecordH264(serial, streamState);
              }
            }
            break;
          default:
            console.log(`[scrcpy] Unknown message type: ${msg.type}`);
        }
      } catch (err) {
        console.error(`[scrcpy] Error handling message for ${serial}:`, err.message);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`[scrcpy] WebSocket closed for ${serial} (code: ${code})`);
      this._stopStream(streamState);
      this.activeStreams.delete(serial);
      this.emit('stream_disconnected', { serial });

      // Reconnect after delay
      setTimeout(() => {
        if (!this.activeStreams.has(serial)) {
          const devices = this.adbManager.deviceCache || [];
          if (devices.some(d => d.serial === serial)) {
            this.startForDevice(serial);
          }
        }
      }, 5000);
    });

    ws.on('error', (err) => {
      console.error(`[scrcpy] WebSocket error for ${serial}:`, err.message);
    });

    this.activeStreams.set(serial, streamState);
  }

  /**
   * Start H.264 streaming using `adb exec-out screenrecord --output-format=h264 -`
   * This pipes raw H.264 Annex B NAL units from the device's hardware encoder.
   * Auto-restarts every ~3 minutes (Android screenrecord limit).
   */
  _startScreenrecordH264(serial, streamState) {
    if (streamState.screenrecordProcess) {
      try { streamState.screenrecordProcess.kill('SIGKILL'); } catch {}
      streamState.screenrecordProcess = null;
    }

    const adbPath = this.adbManager.adbPath;
    streamState.useScreenrecord = true;
    streamState.codec = 'h264';

    // Notify backend we're sending H.264
    if (streamState.ws.readyState === WebSocket.OPEN) {
      streamState.ws.send(JSON.stringify({ type: 'codec', codec: 'h264' }));
    }

    const startRecording = () => {
      if (!streamState.streaming || !streamState.useScreenrecord) return;

      console.log(`[h264] Starting screenrecord H.264 pipe for ${serial}...`);
      const proc = spawn(adbPath, [
        '-s', serial, 'exec-out',
        'screenrecord',
        '--output-format=h264',
        '--size', '720x1280',
        '--bit-rate', '2000000',
        '-'  // pipe to stdout
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      streamState.screenrecordProcess = proc;
      let chunkCount = 0;

      proc.stdout.on('data', (chunk) => {
        if (!streamState.streaming || !streamState.useScreenrecord) return;
        if (streamState.ws.readyState !== WebSocket.OPEN) return;

        // Backpressure: skip if WebSocket buffer is too full
        if (streamState.ws.bufferedAmount > 512 * 1024) {
          streamState.framesSkipped++;
          return;
        }

        streamState.ws.send(chunk, { binary: true });
        streamState.framesSent++;
        streamState.bytesTotal += chunk.length;
        chunkCount++;

        if (chunkCount % 100 === 1) {
          const kbSent = (streamState.bytesTotal / 1024).toFixed(0);
          console.log(`[h264] ${serial}: ${chunkCount} chunks, ${kbSent}KB total, ${streamState.framesSkipped} skipped`);
        }
      });

      proc.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) console.log(`[h264-stderr] ${serial}: ${msg}`);
      });

      proc.on('exit', (code) => {
        console.log(`[h264] screenrecord exited (code ${code}) for ${serial}`);
        streamState.screenrecordProcess = null;

        if (streamState.streaming && streamState.useScreenrecord) {
          if (code === null || code === 0 || code === 1) {
            // Normal exit (3-min limit) or killed — auto-restart
            console.log(`[h264] Auto-restarting screenrecord for ${serial}...`);
            setTimeout(() => startRecording(), 200);
          } else {
            // Unexpected error — fall back to screencap
            console.log(`[h264] screenrecord failed (code ${code}), falling back to screencap for ${serial}`);
            streamState.useScreenrecord = false;
            streamState.codec = 'screencap';
            if (streamState.ws.readyState === WebSocket.OPEN) {
              streamState.ws.send(JSON.stringify({ type: 'codec', codec: 'screencap' }));
            }
            this._startScreencapFallback(serial, streamState);
          }
        }
      });

      proc.on('error', (err) => {
        console.error(`[h264] screenrecord spawn error for ${serial}:`, err.message);
        streamState.screenrecordProcess = null;
        // Fall back to screencap
        streamState.useScreenrecord = false;
        streamState.codec = 'screencap';
        if (streamState.ws.readyState === WebSocket.OPEN) {
          streamState.ws.send(JSON.stringify({ type: 'codec', codec: 'screencap' }));
        }
        this._startScreencapFallback(serial, streamState);
      });
    };

    startRecording();
  }

  _stopH264(streamState) {
    streamState.useScreenrecord = false;
    if (streamState.screenrecordProcess) {
      try { streamState.screenrecordProcess.kill('SIGKILL'); } catch {}
      streamState.screenrecordProcess = null;
    }
    // Also stop scrcpy if running
    if (streamState.scrcpyProcess) {
      try { streamState.scrcpyProcess.kill(); } catch {}
      streamState.scrcpyProcess = null;
    }
    if (streamState.tcpSocket) {
      try { streamState.tcpSocket.destroy(); } catch {}
      streamState.tcpSocket = null;
    }
  }

  async _startScrcpyStream(serial, streamState) {
    const adbPath = this.adbManager.adbPath;
    const localPort = this._getLocalPort();
    streamState.localPort = localPort;

    try {
      // Step 1: Push scrcpy-server.jar to device
      console.log(`[scrcpy] Pushing scrcpy-server.jar to ${serial}...`);
      execSync(`"${adbPath}" -s ${serial} push "${this.scrcpyServerPath}" /data/local/tmp/scrcpy-server.jar`, {
        timeout: 10000,
      });

      // Step 2: Set up port forwarding
      console.log(`[scrcpy] Setting up port forward ${localPort} for ${serial}...`);
      try {
        execSync(`"${adbPath}" -s ${serial} forward --remove tcp:${localPort}`, { timeout: 5000 });
      } catch {}
      execSync(`"${adbPath}" -s ${serial} forward tcp:${localPort} localabstract:scrcpy`, {
        timeout: 5000,
      });

      // Step 3: Start scrcpy server on device
      console.log(`[scrcpy] Starting scrcpy server on ${serial}...`);
      const scrcpyArgs = [
        '-s', serial, 'shell',
        'CLASSPATH=/data/local/tmp/scrcpy-server.jar',
        'app_process', '/', 'com.genymobile.scrcpy.Server',
        this.scrcpyVersion,
        'tunnel_forward=true',
        'control=false',
        'cleanup=false',
        'raw_stream=true',
        'video_codec=h264',
        'max_size=720',
        'max_fps=30',
        'video_bit_rate=2000000',
      ];

      const scrcpyProc = spawn(adbPath, scrcpyArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      streamState.scrcpyProcess = scrcpyProc;

      scrcpyProc.stdout.on('data', (data) => {
        console.log(`[scrcpy-server stdout] ${data.toString().trim()}`);
      });
      scrcpyProc.stderr.on('data', (data) => {
        console.log(`[scrcpy-server stderr] ${data.toString().trim()}`);
      });
      scrcpyProc.on('exit', (code) => {
        console.log(`[scrcpy] Server process exited with code ${code} for ${serial}`);
        // If streaming was active, fall back to screencap
        if (streamState.streaming && streamState.useScrcpy) {
          console.log(`[scrcpy] Falling back to screencap for ${serial}`);
          streamState.useScrcpy = false;
          this._startScreencapFallback(serial, streamState);
        }
      });

      // Step 4: Wait for server to start, then connect via TCP
      await new Promise(r => setTimeout(r, 1500));

      console.log(`[scrcpy] Connecting to TCP localhost:${localPort} for ${serial}...`);
      const tcpSocket = new net.Socket();
      streamState.tcpSocket = tcpSocket;

      tcpSocket.connect(localPort, '127.0.0.1', () => {
        console.log(`[scrcpy] TCP connected to scrcpy server for ${serial}`);
        // Send protocol header to browser so it knows this is H.264 mode
        if (streamState.ws.readyState === WebSocket.OPEN) {
          streamState.ws.send(JSON.stringify({ type: 'codec', codec: 'h264' }));
        }
      });

      tcpSocket.on('data', (chunk) => {
        // Raw H.264 NAL units - send directly over WebSocket
        if (streamState.ws.readyState === WebSocket.OPEN) {
          // Backpressure: skip if buffer is too full
          if (streamState.ws.bufferedAmount > 1024 * 1024) {
            streamState.framesSkipped++;
            return;
          }
          streamState.ws.send(chunk, { binary: true });
          streamState.framesSent++;
          streamState.bytesTotal += chunk.length;

          if (streamState.framesSent % 300 === 1) {
            const kbSent = (streamState.bytesTotal / 1024).toFixed(0);
            const skipped = streamState.framesSkipped;
            console.log(`[scrcpy] ${serial}: ${streamState.framesSent} chunks sent, ${kbSent}KB total, ${skipped} skipped`);
            streamState.framesSkipped = 0;
          }
        }
      });

      tcpSocket.on('error', (err) => {
        console.error(`[scrcpy] TCP error for ${serial}:`, err.message);
        // Fall back to screencap
        if (streamState.streaming) {
          console.log(`[scrcpy] TCP failed, falling back to screencap for ${serial}`);
          streamState.useScrcpy = false;
          this._startScreencapFallback(serial, streamState);
        }
      });

      tcpSocket.on('close', () => {
        console.log(`[scrcpy] TCP connection closed for ${serial}`);
      });

    } catch (err) {
      console.error(`[scrcpy] Failed to start scrcpy for ${serial}:`, err.message);
      // Fall back to screencap
      streamState.useScrcpy = false;
      this._startScreencapFallback(serial, streamState);
    }
  }

  // Fallback: ADB screencap with backpressure (existing approach)
  _startScreencapFallback(serial, streamState) {
    if (streamState.looping) return;
    streamState.looping = true;

    // Notify browser this is screencap mode (not h264)
    if (streamState.ws.readyState === WebSocket.OPEN) {
      streamState.ws.send(JSON.stringify({ type: 'codec', codec: 'screencap' }));
    }

    const MAX_BUFFER = 512 * 1024;

    const captureLoop = async () => {
      while (streamState.streaming && streamState.looping) {
        if (streamState.ws.readyState !== WebSocket.OPEN) {
          await new Promise(r => setTimeout(r, 100));
          continue;
        }
        if (streamState.ws.bufferedAmount > MAX_BUFFER) {
          streamState.framesSkipped = (streamState.framesSkipped || 0) + 1;
          await new Promise(r => setTimeout(r, 50));
          continue;
        }
        try {
          const frameBuffer = await this.adbManager.screencapOptimized(serial);
          if (frameBuffer && frameBuffer.length > 0 && streamState.ws.readyState === WebSocket.OPEN) {
            if (streamState.ws.bufferedAmount > MAX_BUFFER) {
              streamState.framesSkipped++;
              continue;
            }
            streamState.ws.send(frameBuffer, { binary: true });
            streamState.framesSent++;
            if (streamState.framesSent % 50 === 1) {
              console.log(`[screencap] ${serial}: Frame #${streamState.framesSent}, ${(frameBuffer.length / 1024).toFixed(0)}KB`);
            }
          }
        } catch (err) {
          if (!err.message.includes('device not found') && !err.message.includes('no devices')) {
            if (streamState.framesSent === 0) {
              console.error(`[screencap] ${serial}: Error: ${err.message}`);
            }
          }
          await new Promise(r => setTimeout(r, 200));
        }
      }
      streamState.looping = false;
    };

    captureLoop();
  }

  _stopStream(streamState) {
    streamState.streaming = false;
    streamState.looping = false;
    streamState.useScreenrecord = false;

    if (streamState.screenrecordProcess) {
      try { streamState.screenrecordProcess.kill('SIGKILL'); } catch {}
      streamState.screenrecordProcess = null;
    }

    if (streamState.tcpSocket) {
      try { streamState.tcpSocket.destroy(); } catch {}
      streamState.tcpSocket = null;
    }

    if (streamState.scrcpyProcess) {
      try { streamState.scrcpyProcess.kill(); } catch {}
      streamState.scrcpyProcess = null;
    }

    if (streamState.localPort) {
      try {
        execSync(`"${this.adbManager.adbPath}" forward --remove tcp:${streamState.localPort}`, { timeout: 3000 });
      } catch {}
      streamState.localPort = null;
    }

    if (streamState.pingInterval) {
      clearInterval(streamState.pingInterval);
      streamState.pingInterval = null;
    }
  }

  stopForDevice(serial) {
    const streamState = this.activeStreams.get(serial);
    if (streamState) {
      this._stopStream(streamState);
      if (streamState.ws.readyState === WebSocket.OPEN) {
        streamState.ws.close();
      }
      this.activeStreams.delete(serial);
    }
  }

  stopAll() {
    for (const [serial, streamState] of this.activeStreams) {
      this._stopStream(streamState);
      if (streamState.ws.readyState === WebSocket.OPEN) {
        streamState.ws.close();
      }
    }
    this.activeStreams.clear();
  }

  updateDevices(devices) {
    const currentSerials = new Set(devices.map(d => d.serial));
    for (const device of devices) {
      if (!this.activeStreams.has(device.serial)) {
        this.startForDevice(device.serial);
      }
    }
    for (const [serial] of this.activeStreams) {
      if (!currentSerials.has(serial)) {
        this.stopForDevice(serial);
      }
    }
  }
}

module.exports = { ScrcpyStreamer };
