import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { JwtPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';
const MAX_BROWSERS_PER_DEVICE = 2;

interface ScreenSocket extends WebSocket {
  role?: 'agent' | 'browser';
  deviceSerial?: string;
  agentId?: string;
  userId?: string;
  isAlive?: boolean;
  connectedAt?: number;
}

// Map: deviceSerial -> { agent: ScreenSocket, browsers: Set<ScreenSocket> }
const screenSessions = new Map<string, {
  agent: ScreenSocket | null;
  browsers: Set<ScreenSocket>;
}>();

// Track frame relay stats
let frameRelayCount = 0;
let lastFrameLogTime = Date.now();

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
        screenSessions.set(serial, { agent: null, browsers: new Set() });
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

      // Notify agent if browsers are already waiting
      if (session.browsers.size > 0) {
        ws.send(JSON.stringify({ type: 'start_streaming' }));
      }
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
        screenSessions.set(serial, { agent: null, browsers: new Set() });
      }
      const session = screenSessions.get(serial)!;

      // Clean up dead browser connections before adding new one
      const deadBrowsers: ScreenSocket[] = [];
      session.browsers.forEach((browser) => {
        if (browser.readyState !== WebSocket.OPEN && browser.readyState !== WebSocket.CONNECTING) {
          deadBrowsers.push(browser);
        }
      });
      deadBrowsers.forEach((b) => session.browsers.delete(b));

      // Enforce max browser connections per device - close oldest if limit exceeded
      if (session.browsers.size >= MAX_BROWSERS_PER_DEVICE) {
        const browsersArray = Array.from(session.browsers) as ScreenSocket[];
        // Sort by connection time, close oldest
        browsersArray.sort((a, b) => (a.connectedAt || 0) - (b.connectedAt || 0));
        const toRemove = browsersArray.slice(0, session.browsers.size - MAX_BROWSERS_PER_DEVICE + 1);
        toRemove.forEach((old) => {
          console.log(`Closing excess browser connection for device: ${serial}`);
          session.browsers.delete(old);
          if (old.readyState === WebSocket.OPEN) {
            old.close(4003, 'Too many browser connections');
          }
        });
      }

      ws.connectedAt = Date.now();
      session.browsers.add(ws);

      console.log(`Screen browser connected for device: ${serial}, total browsers: ${session.browsers.size}`);

      // Tell agent to start streaming if connected
      if (session.agent && session.agent.readyState === WebSocket.OPEN) {
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
        // Agent sending frame data (binary PNG) or JSON messages
        if (isBinary) {
          // Binary frame data - relay to all open browsers
          const frameSize = (data as Buffer).length;
          frameRelayCount++;

          // Log frame stats every 10 seconds
          const now = Date.now();
          if (now - lastFrameLogTime > 10000) {
            const activeBrowsers = Array.from(session.browsers).filter(b => b.readyState === WebSocket.OPEN).length;
            console.log(`Frame relay stats: ${frameRelayCount} frames relayed, ${frameSize} bytes last frame, ${activeBrowsers} active browsers for ${ws.deviceSerial}`);
            frameRelayCount = 0;
            lastFrameLogTime = now;
          }

          session.browsers.forEach((browser) => {
            if (browser.readyState === WebSocket.OPEN) {
              browser.send(data, { binary: true });
            }
          });
        } else {
          // JSON message from agent (e.g., status updates)
          const msgStr = data.toString();
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
        session.browsers.delete(ws);
        console.log(`Screen browser disconnected for device: ${ws.deviceSerial}, remaining: ${session.browsers.size}`);
        // Tell agent to stop streaming if no more browsers
        if (session.browsers.size === 0 && session.agent && session.agent.readyState === WebSocket.OPEN) {
          session.agent.send(JSON.stringify({ type: 'stop_streaming' }));
        }
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
      const deadBrowsers: ScreenSocket[] = [];
      session.browsers.forEach((browser) => {
        if (browser.readyState !== WebSocket.OPEN && browser.readyState !== WebSocket.CONNECTING) {
          deadBrowsers.push(browser);
        }
      });
      if (deadBrowsers.length > 0) {
        deadBrowsers.forEach((b) => session.browsers.delete(b));
        console.log(`Cleaned up ${deadBrowsers.length} dead browser connections for ${serial}, remaining: ${session.browsers.size}`);
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
      hasBrowsers: session.browsers.size > 0,
      hasAgent: session.agent !== null && session.agent.readyState === WebSocket.OPEN,
    });
  });
  return sessions;
}
