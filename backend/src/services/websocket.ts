import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { JwtPayload, WebSocketMessage } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

const clients = new Set<AuthenticatedWebSocket>();

export function setupWebSocket(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
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

    ws.isAlive = true;
    clients.add(ws);

    console.log(`WebSocket client connected. Total: ${clients.size}`);

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        handleWebSocketMessage(ws, message);
      } catch {
        ws.send(JSON.stringify({ type: 'error', data: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`WebSocket client disconnected. Total: ${clients.size}`);
    });

    ws.send(JSON.stringify({ type: 'connected', data: { message: 'Connected to Mobile Manager' } }));
  });

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedWebSocket;
      if (authWs.isAlive === false) {
        clients.delete(authWs);
        return authWs.terminate();
      }
      authWs.isAlive = false;
      authWs.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
}

function handleWebSocketMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
  switch (message.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', data: {} }));
      break;
    case 'subscribe:devices':
      // Client wants real-time device updates - already handled by broadcast
      ws.send(JSON.stringify({ type: 'subscribed', data: { channel: 'devices' } }));
      break;
    default:
      ws.send(JSON.stringify({ type: 'error', data: `Unknown message type: ${message.type}` }));
  }
}

export function broadcastToClients(message: WebSocketMessage): void {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

export function getConnectedClientsCount(): number {
  return clients.size;
}
