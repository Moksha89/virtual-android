import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { JwtPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';

interface ScreenSocket extends WebSocket {
  role?: 'agent' | 'browser';
  deviceSerial?: string;
  agentId?: string;
  userId?: string;
  isAlive?: boolean;
}

// Map: deviceSerial -> { agent: ScreenSocket, browsers: Set<ScreenSocket> }
const screenSessions = new Map<string, {
  agent: ScreenSocket | null;
  browsers: Set<ScreenSocket>;
}>();

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
      session.agent = ws;

      console.log(`Screen agent connected for device: ${serial}`);

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
        // Agent sending frame data (binary JPEG) or JSON messages
        if (isBinary) {
          // Binary frame data - relay to all browsers
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
          session.agent.send(data.toString());
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

  // Heartbeat to detect dead connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const screenWs = ws as ScreenSocket;
      if (screenWs.isAlive === false) {
        return screenWs.terminate();
      }
      screenWs.isAlive = false;
      screenWs.ping();
    });
  }, 30000);

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
