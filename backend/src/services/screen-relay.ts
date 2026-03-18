import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import pool from '../config/database';
import { JwtPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';
const MAX_BROWSERS_PER_DEVICE = 5;

interface ScreenSocket extends WebSocket {
  role?: 'agent' | 'browser';
  deviceSerial?: string;
  agentId?: string;
  userId?: string;
  isAlive?: boolean;
  connectedAt?: number;
  tabId?: string;
}

// Map: deviceSerial -> { agent, browsers, codec }
const screenSessions = new Map<string, {
  agent: ScreenSocket | null;
  browsers: Map<string, ScreenSocket>;
  codec: string;
}>();

// Track frame relay stats
let frameRelayCount = 0;
let lastFrameLogTime = Date.now();
let totalBytesRelayed = 0;

// Cache last frame per device for instant initial load (screencap mode only)
const lastCachedFrame = new Map<string, Buffer>();
const deviceCodec = new Map<string, string>();

// Screencap compression settings
const JPEG_QUALITY = 40;
const SCALE_WIDTH = 540; // Scale down from 1080 to 540

// "Latest frame only" pattern: drop stale frames during compression
const latestFrameBuffer = new Map<string, Buffer>();
const compressionActive = new Map<string, boolean>();

async function compressAndRelay(serial: string, session: { agent: ScreenSocket | null; browsers: Map<string, ScreenSocket>; codec: string }) {
  if (compressionActive.get(serial)) {
    // Already compressing — the latest frame will be picked up after current one finishes
    return;
  }
  compressionActive.set(serial, true);

  while (latestFrameBuffer.has(serial)) {
    const frameData = latestFrameBuffer.get(serial)!;
    latestFrameBuffer.delete(serial);

    try {
      const compressed = await sharp(frameData)
        .resize(SCALE_WIDTH, undefined, { fit: 'inside' })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();

      lastCachedFrame.set(serial, compressed);

      // Relay compressed frame to all browsers
      session.browsers.forEach((browser) => {
        if (browser.readyState === WebSocket.OPEN) {
          browser.send(compressed, { binary: true });
        }
      });

      frameRelayCount++;
      totalBytesRelayed += compressed.length;
    } catch (err) {
      // Skip malformed frames
    }
  }

  compressionActive.set(serial, false);
}

export function setupScreenRelay(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', async (ws: ScreenSocket, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const role = url.searchParams.get('role'); // 'agent' or 'browser'
    const serial = url.searchParams.get('serial');

    if (!role || !serial) {
      ws.close(4000, 'Missing role or serial parameter');
      return;
    }

    if (role === 'agent') {
      const apiKey = url.searchParams.get('apiKey');
      if (!apiKey || apiKey !== AGENT_API_KEY) {
        // Also check database for agent-specific keys
        try {
          const result = await pool.query('SELECT id FROM agents WHERE api_key = $1', [apiKey]);
          if (result.rows.length === 0) {
            ws.close(4001, 'Invalid API key');
            return;
          }
          ws.agentId = result.rows[0].id;
        } catch {
          ws.close(4001, 'Invalid API key');
          return;
        }
      }
      ws.role = 'agent';
      ws.deviceSerial = serial;

      // Register agent for this device
      if (!screenSessions.has(serial)) {
        screenSessions.set(serial, { agent: null, browsers: new Map(), codec: 'unknown' });
      }
      const session = screenSessions.get(serial)!;

      // Close previous agent connection if exists
      if (session.agent && session.agent.readyState === WebSocket.OPEN) {
        console.log(`Closing previous agent connection for device: ${serial}`);
        session.agent.close(4002, 'Replaced by new agent connection');
      }
      session.agent = ws;

      console.log(`Screen agent connected for device: ${serial}`);

      // Notify all browsers that agent is connected
      session.browsers.forEach((browser) => {
        if (browser.readyState === WebSocket.OPEN) {
          browser.send(JSON.stringify({ type: 'agent_connected' }));
        }
      });

      // Always start streaming immediately so frames are cached for instant initial load
      ws.send(JSON.stringify({ type: 'start_streaming' }));
    } else if (role === 'browser') {
      const token = url.searchParams.get('token');
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
          ws.userId = decoded.userId;
        } catch {
          ws.close(4001, 'Invalid token');
          return;
        }
      }
      ws.role = 'browser';
      ws.deviceSerial = serial;

      // Register browser for this device
      if (!screenSessions.has(serial)) {
        screenSessions.set(serial, { agent: null, browsers: new Map(), codec: 'unknown' });
      }
      const session = screenSessions.get(serial)!;

      // Require tabId from browser clients (new JS sends this, old cached JS doesn't)
      const tabId = url.searchParams.get('tabId');
      if (!tabId) {
        // Old cached browser JS - reject immediately to prevent churn loop
        console.log(`Rejecting browser without tabId for device: ${serial} (outdated client)`);
        ws.close(4005, 'Browser version outdated - please hard refresh (Ctrl+Shift+R)');
        return;
      }
      ws.tabId = tabId;

      // Clean up dead browser connections before adding new one
      const deadTabIds: string[] = [];
      session.browsers.forEach((browser, tid) => {
        if (browser.readyState !== WebSocket.OPEN && browser.readyState !== WebSocket.CONNECTING) {
          deadTabIds.push(tid);
        }
      });
      deadTabIds.forEach((tid) => session.browsers.delete(tid));

      // If same tabId reconnecting, close the old connection (deduplicate)
      const existing = session.browsers.get(tabId);
      if (existing) {
        console.log(`Replacing existing browser connection for tabId ${tabId.substring(0, 8)} on device: ${serial}`);
        if (existing.readyState === WebSocket.OPEN) {
          existing.onclose = null; // Prevent close handler cleanup
          existing.close(4004, 'Replaced by same tab reconnect');
        }
        session.browsers.delete(tabId);
      }

      // Enforce max browser connections per device (unique tabs only)
      if (session.browsers.size >= MAX_BROWSERS_PER_DEVICE) {
        const numToEvict = session.browsers.size - MAX_BROWSERS_PER_DEVICE + 1;
        const browsersArray = Array.from(session.browsers.entries());
        // Prioritize evicting legacy connections (old cached JS tabs) over stable tabId connections
        // Sort: legacy tabs first (alphabetically "legacy-" comes before other IDs), then by oldest connectedAt
        browsersArray.sort((a, b) => {
          const aIsLegacy = a[0].startsWith('legacy-') ? 0 : 1;
          const bIsLegacy = b[0].startsWith('legacy-') ? 0 : 1;
          if (aIsLegacy !== bIsLegacy) return aIsLegacy - bIsLegacy; // legacy first
          return (a[1].connectedAt || 0) - (b[1].connectedAt || 0); // then oldest first
        });
        const toRemove = browsersArray.slice(0, numToEvict);
        toRemove.forEach(([tid, old]) => {
          console.log(`Evicting browser (tab ${tid.substring(0, 8)}, legacy=${tid.startsWith('legacy-')}) for device: ${serial}`);
          session.browsers.delete(tid);
          if (old.readyState === WebSocket.OPEN) {
            old.close(4003, 'Too many browser connections');
          }
        });
      }

      ws.connectedAt = Date.now();
      session.browsers.set(tabId, ws);

      console.log(`Screen browser connected for device: ${serial}, tabId: ${tabId.substring(0, 8)}, total tabs: ${session.browsers.size}`);

      // Tell agent to start streaming if connected
      if (session.agent && session.agent.readyState === WebSocket.OPEN) {
        // Tell browser which codec to expect
        const codec = deviceCodec.get(serial) || 'unknown';
        if (codec !== 'unknown') {
          ws.send(JSON.stringify({ type: 'codec', codec }));
        }

        // Send cached frame for instant first paint (screencap mode only)
        if (codec === 'screencap' || codec === 'unknown') {
          const cached = lastCachedFrame.get(serial);
          if (cached) {
            ws.send(cached, { binary: true });
            console.log(`Sent cached frame (${(cached.length / 1024).toFixed(0)}KB) to new browser for ${serial}`);
          }
        }

        session.agent.send(JSON.stringify({ type: 'start_streaming' }));
        ws.send(JSON.stringify({ type: 'agent_connected' }));
      } else {
        ws.send(JSON.stringify({ type: 'agent_disconnected' }));
      }
    } else {
      ws.close(4000, 'Invalid role');
      return;
    }

    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data, isBinary) => {
      const session = screenSessions.get(ws.deviceSerial || '');
      if (!session) return;

      if (ws.role === 'agent') {
        if (isBinary) {
          // Binary data from agent - H.264 chunks or PNG screencap frames
          const frameData = data as Buffer;
          const codec = deviceCodec.get(ws.deviceSerial!) || 'unknown';

          // Log stats every 10s
          const now = Date.now();
          if (now - lastFrameLogTime > 10000) {
            const activeBrowsers = Array.from(session.browsers.values()).filter(b => b.readyState === WebSocket.OPEN).length;
            console.log(`Frame relay [${codec}]: ${frameRelayCount} chunks in 10s, ${(totalBytesRelayed / 1024).toFixed(0)}KB total, ${activeBrowsers} browsers for ${ws.deviceSerial}`);
            frameRelayCount = 0;
            totalBytesRelayed = 0;
            lastFrameLogTime = now;
          }

          if (codec === 'h264') {
            // H.264 mode: DIRECT PASS-THROUGH, zero processing overhead
            frameRelayCount++;
            totalBytesRelayed += frameData.length;
            session.browsers.forEach((browser) => {
              if (browser.readyState === WebSocket.OPEN) {
                browser.send(frameData, { binary: true });
              }
            });
          } else {
            // Screencap mode: compress PNG->JPEG with "latest frame only" pattern
            latestFrameBuffer.set(ws.deviceSerial!, frameData);
            compressAndRelay(ws.deviceSerial!, session);
          }
        } else {
          // JSON message from agent
          const msgStr = data.toString();

          // Check if this is a codec notification
          try {
            const msg = JSON.parse(msgStr);
            if (msg.type === 'codec') {
              deviceCodec.set(ws.deviceSerial!, msg.codec);
              session.codec = msg.codec;
              console.log(`Device ${ws.deviceSerial} codec set to: ${msg.codec}`);
            }
          } catch {
            // Not JSON or parse error
          }

          session.browsers.forEach((browser) => {
            if (browser.readyState === WebSocket.OPEN) {
              browser.send(msgStr);
            }
          });
        }
      } else if (ws.role === 'browser') {
        // Browser sending input commands - relay to agent
        if (session.agent && session.agent.readyState === WebSocket.OPEN) {
          const cmdStr = data.toString();
          console.log(`Relaying browser command to agent for ${ws.deviceSerial}: ${cmdStr}`);
          session.agent.send(cmdStr);
        } else {
          console.log(`Cannot relay command - no agent connected for ${ws.deviceSerial}`);
        }
      }
    });

    ws.on('close', () => {
      const session = screenSessions.get(ws.deviceSerial || '');
      if (!session) return;

      if (ws.role === 'agent') {
        session.agent = null;
        console.log(`Screen agent disconnected for device: ${ws.deviceSerial}`);
        // Notify all browsers
        session.browsers.forEach((browser) => {
          if (browser.readyState === WebSocket.OPEN) {
            browser.send(JSON.stringify({ type: 'agent_disconnected' }));
          }
        });
        // Clean up if no browsers either
        if (session.browsers.size === 0) {
          screenSessions.delete(ws.deviceSerial || '');
        }
      } else if (ws.role === 'browser') {
        // Remove by tabId
        if (ws.tabId && session.browsers.get(ws.tabId) === ws) {
          session.browsers.delete(ws.tabId);
        }
        console.log(`Screen browser disconnected for device: ${ws.deviceSerial}, tabId: ${(ws.tabId || '').substring(0, 8)}, remaining: ${session.browsers.size}`);
        // Keep agent streaming even with no browsers so cached frames stay fresh
        // (Agent will self-throttle via backpressure when no frames are being consumed)
        // Clean up if no agent either
        if (session.browsers.size === 0 && !session.agent) {
          screenSessions.delete(ws.deviceSerial || '');
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`Screen WebSocket error (${ws.role}/${ws.deviceSerial}):`, err.message);
    });
  });

  // Heartbeat to detect dead connections (every 15s)
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const screenWs = ws as ScreenSocket;
      if (screenWs.isAlive === false) {
        console.log(`Terminating dead ${screenWs.role} connection for ${screenWs.deviceSerial}`);
        return screenWs.terminate();
      }
      screenWs.isAlive = false;
      screenWs.ping();
    });

    // Also clean up dead browsers from sessions
    screenSessions.forEach((session, serial) => {
      const deadTabIds: string[] = [];
      session.browsers.forEach((browser, tid) => {
        if (browser.readyState !== WebSocket.OPEN && browser.readyState !== WebSocket.CONNECTING) {
          deadTabIds.push(tid);
        }
      });
      if (deadTabIds.length > 0) {
        deadTabIds.forEach((tid) => session.browsers.delete(tid));
        console.log(`Cleaned up ${deadTabIds.length} dead browser connections for ${serial}, remaining: ${session.browsers.size}`);
      }
    });
  }, 15000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  console.log('Screen relay WebSocket server initialized at /ws/screen');
  return wss;
}

export function getActiveScreenSessions(): { serial: string; hasBrowsers: boolean; hasAgent: boolean }[] {
  const sessions: { serial: string; hasBrowsers: boolean; hasAgent: boolean }[] = [];
  screenSessions.forEach((session, serial) => {
    sessions.push({
      serial,
      hasBrowsers: Array.from(session.browsers.values()).some(b => b.readyState === WebSocket.OPEN),
      hasAgent: session.agent !== null && session.agent.readyState === WebSocket.OPEN,
    });
  });
  return sessions;
}
