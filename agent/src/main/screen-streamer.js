const EventEmitter = require('events');
const WebSocket = require('ws');
const sharp = require('sharp');

class ScreenStreamer extends EventEmitter {
  constructor(serverUrl, apiKey, adbManager) {
    super();
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.adbManager = adbManager;
    this.activeStreams = new Map(); // serial -> { ws, interval, streaming }
    this.frameInterval = 200; // ~5 FPS
    this.jpegQuality = 50; // JPEG quality (lower = smaller, faster)
    this.maxWidth = 720; // Scale down for faster transfer
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
    };

    ws.on('open', () => {
      console.log(`Screen WebSocket connected for ${serial}`);
      this.emit('stream_connected', { serial });
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

          default:
            console.log(`Unknown screen message type: ${msg.type}`);
        }
      } catch (err) {
        console.error(`Error handling screen message for ${serial}:`, err.message);
      }
    });

    ws.on('close', () => {
      console.log(`Screen WebSocket closed for ${serial}`);
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
    if (streamState.interval) return;

    streamState.interval = setInterval(async () => {
      if (!streamState.streaming || streamState.capturing) return;
      if (streamState.ws.readyState !== WebSocket.OPEN) return;

      streamState.capturing = true;
      try {
        const pngBuffer = await this.adbManager.screencapRaw(serial);
        if (!pngBuffer || pngBuffer.length === 0) return;

        // Convert PNG to smaller JPEG and resize
        const jpegBuffer = await sharp(pngBuffer)
          .resize({ width: this.maxWidth, withoutEnlargement: true })
          .jpeg({ quality: this.jpegQuality })
          .toBuffer();

        if (streamState.ws.readyState === WebSocket.OPEN) {
          streamState.ws.send(jpegBuffer, { binary: true });
        }
      } catch (err) {
        // Silently handle capture errors (device might be temporarily busy)
        if (!err.message.includes('device not found') && !err.message.includes('no devices')) {
          // Only log non-transient errors occasionally
        }
      } finally {
        streamState.capturing = false;
      }
    }, this.frameInterval);
  }

  stopCapturing(streamState) {
    if (streamState.interval) {
      clearInterval(streamState.interval);
      streamState.interval = null;
    }
    streamState.streaming = false;
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

  setQuality(quality) {
    this.jpegQuality = Math.max(10, Math.min(100, quality));
  }

  setMaxWidth(width) {
    this.maxWidth = Math.max(320, Math.min(1920, width));
  }
}

module.exports = { ScreenStreamer };
