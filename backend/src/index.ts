import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import { initDatabase } from './config/database';
import { initRedis } from './config/redis';
import { setupWebSocket, getConnectedClientsCount } from './services/websocket';
import { setupScreenRelay, getActiveScreenSessions } from './services/screen-relay';
import authRoutes from './routes/auth';
import deviceRoutes from './routes/devices';
import agentRoutes from './routes/agents';
import sessionRoutes from './routes/sessions';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8000', 10);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS === '*' ? '*' : process.env.CORS_ORIGINS?.split(','),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/healthz', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'mobile-manager-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    websocket_clients: getConnectedClientsCount(),
    screen_sessions: getActiveScreenSessions(),
  });
});

// API info
app.get('/', (_req, res) => {
  res.json({
    name: 'Mobile Manager API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /healthz',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me',
      },
      devices: {
        list: 'GET /api/devices',
        get: 'GET /api/devices/:id',
        update: 'PATCH /api/devices/:id',
        delete: 'DELETE /api/devices/:id',
        command: 'POST /api/devices/:id/command',
        logs: 'GET /api/devices/:id/logs',
      },
      agents: {
        register: 'POST /api/agents/register',
        list: 'GET /api/agents',
        heartbeat: 'POST /api/agents/heartbeat',
        delete: 'DELETE /api/agents/:id',
      },
      sessions: {
        create: 'POST /api/sessions',
        list: 'GET /api/sessions',
        end: 'PATCH /api/sessions/:id/end',
      },
      websocket: 'WS /ws?token=<jwt>',
    },
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/sessions', sessionRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start(): Promise<void> {
  try {
    console.log('Initializing database...');
    await initDatabase();

    console.log('Initializing Redis...');
    try {
      await initRedis();
    } catch (err) {
      console.warn('Redis connection failed, continuing without Redis:', err);
    }

    const server = http.createServer(app);

    setupWebSocket(server);
    setupScreenRelay(server);

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Mobile Manager Backend running on port ${PORT}`);
      console.log(`API: http://0.0.0.0:${PORT}`);
      console.log(`WebSocket: ws://0.0.0.0:${PORT}/ws`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
