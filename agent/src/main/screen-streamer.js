const EventEmitter = require('events');
const WebSocket = require('ws');

class ScreenStreamer extends EventEmitter {
  constructor(serverUrl, apiKey, adbManager) {
    super();
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.adbManager = adbManager;
    this.activeStreams = new Map(); // serial -> { ws, interval, streaming }
    this.frameInterval = 100; // ~10 FPS target (actual will be limited by screencap speed)
  }

  startForDevice(serial) {
    if (this.activeStreams.has(serial)) {
      console.log(`Stream already active for ${serial}`);
      return;
    }

    const wsUrl = this.serverUrl.replace(/^http/, 'ws') + `/ws/screen?role=agent&serial=${encodeURIComponent(serial)}&apiKey=${encodeURIComponent(this.apiKey)}`;

    console.log(`Connecting screen stream for ${serial}...`);
    const ws = new WebSocket(wsUrl);

    const streamState = {
      ws,
      interval: null,
      streaming: false,
      capturing: false,
      pingInterval: null,
      framesSent: 0,
    };

    ws.on('open', () => {
      console.log(`Screen WebSocket connected for ${serial}`);
      this.emit('stream_connected', { serial });
      // Send a ping to keep the connection alive
      streamState.pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 20000);
    });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case 'start_streaming':
            console.log(`Start streaming requested for ${serial}`);
            streamState.streaming = true;
            this.startCapturing(serial, streamState);
            this.emit('stream_started', { serial });
            break;

          case 'stop_streaming':
            console.log(`Stop streaming requested for ${serial}`);
            streamState.streaming = false;
            this.stopCapturing(streamState);
            this.emit('stream_stopped', { serial });
            break;

          case 'tap':
            console.log(`Executing tap at ${msg.x},${msg.y} on ${serial}`);
            await this.adbManager.tap(serial, msg.x, msg.y);
            break;

          case 'swipe':
            console.log(`Executing swipe on ${serial}`);
            await this.adbManager.swipe(serial, msg.x1, msg.y1, msg.x2, msg.y2, msg.duration || 300);
            break;

          case 'keyevent':
            console.log(`Executing keyevent ${msg.keycode} on ${serial}`);
            await this.adbManager.keyevent(serial, msg.keycode);
            break;

          case 'text':
            console.log(`Executing text input on ${serial}`);
            await this.adbManager.inputText(serial, msg.text);
            break;

          case 'wake':
            console.log(`Waking screen on ${serial}`);
            await this.adbManager.wakeScreen(serial);
            break;

          case 'sleep':
            console.log(`Sleeping screen on ${serial}`);
            await this.adbManager.sleepScreen(serial);
            break;

          case 'unlock_pin':
            console.log(`Unlocking with PIN on ${serial}`);
            await this.adbManager.unlockPin(serial, msg.pin);
            break;

          case 'unlock_pattern':
            console.log(`Unlocking with pattern on ${serial}`);
            await this.adbManager.unlockPattern(serial, msg.pattern);
            break;

          case 'swipe_gesture':
            console.log(`Executing swipe gesture: ${msg.direction} on ${serial}`);
            await this.adbManager.swipeGesture(serial, msg.direction);
            break;

          default:
            console.log(`Unknown screen message type: ${msg.type}`);
        }
      } catch (err) {
        console.error(`Error handling screen message for ${serial}:`, err.message);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`Screen WebSocket closed for ${serial} (code: ${code}, reason: ${reason || 'none'})`);
      if (streamState.pingInterval) {
        clearInterval(streamState.pingInterval);
        streamState.pingInterval = null;
      }
      this.stopCapturing(streamState);
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
      console.error(`Screen WebSocket error for ${serial}:`, err.message);
    });

    this.activeStreams.set(serial, streamState);
  }

  startCapturing(serial, streamState) {
    if (streamState.looping) return;
    streamState.looping = true;

    // Continuous capture loop - no idle gaps between frames
    const captureLoop = async () => {
      while (streamState.streaming && streamState.looping) {
        if (streamState.ws.readyState !== WebSocket.OPEN) {
          await new Promise(r => setTimeout(r, 100));
          continue;
        }

        try {
          const frameBuffer = await this.adbManager.screencapOptimized(serial);
          if (frameBuffer && frameBuffer.length > 0 && streamState.ws.readyState === WebSocket.OPEN) {
            streamState.ws.send(frameBuffer, { binary: true });
            streamState.framesSent++;
            if (streamState.framesSent % 100 === 1) {
              console.log(`[${serial}] Frame #${streamState.framesSent} sent, size: ${(frameBuffer.length / 1024).toFixed(0)}KB`);
            }
          }
        } catch (err) {
          if (!err.message.includes('device not found') && !err.message.includes('no devices')) {
            if (streamState.framesSent === 0) {
              console.error(`[${serial}] Screencap error: ${err.message}`);
            }
          }
          // Brief pause on error before retrying
          await new Promise(r => setTimeout(r, 200));
        }
      }
      streamState.looping = false;
    };

    captureLoop();
  }

  stopCapturing(streamState) {
    streamState.streaming = false;
    streamState.looping = false;
    if (streamState.pingInterval) {
      clearInterval(streamState.pingInterval);
      streamState.pingInterval = null;
    }
  }

  stopForDevice(serial) {
    const streamState = this.activeStreams.get(serial);
    if (streamState) {
      this.stopCapturing(streamState);
      if (streamState.ws.readyState === WebSocket.OPEN) {
        streamState.ws.close();
      }
      this.activeStreams.delete(serial);
    }
  }

  stopAll() {
    for (const [serial, streamState] of this.activeStreams) {
      this.stopCapturing(streamState);
      if (streamState.ws.readyState === WebSocket.OPEN) {
        streamState.ws.close();
      }
    }
    this.activeStreams.clear();
  }

  updateDevices(devices) {
    const currentSerials = new Set(devices.map(d => d.serial));

    // Start streams for new devices
    for (const device of devices) {
      if (!this.activeStreams.has(device.serial)) {
        this.startForDevice(device.serial);
      }
    }

    // Stop streams for disconnected devices
    for (const [serial] of this.activeStreams) {
      if (!currentSerials.has(serial)) {
        this.stopForDevice(serial);
      }
    }
  }

  setFrameRate(fps) {
    this.frameInterval = Math.max(100, Math.round(1000 / fps));
  }

}

module.exports = { ScreenStreamer };
