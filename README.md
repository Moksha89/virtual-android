# Mobile Manager - Remote Android Device Control Platform

A low-latency, browser-based Android device management platform that connects to phones attached to a home Windows gateway and gives secure, fast, and centralized access from anywhere.

## Architecture

```
Browser Dashboard  <-->  Cloud VPS (API + DB)  <-->  Windows Agent (ADB + Phones)
     (React)           (Node.js + PostgreSQL)         (Node.js + scrcpy)
```

### Components

- **Frontend** (`/frontend`): React + TypeScript + Vite + Tailwind CSS dashboard
- **Backend** (`/backend`): Node.js + Express + TypeScript API with PostgreSQL + Redis
- **Agent** (`/agent`): Node.js agent for Windows gateway (ADB device management)
- **Nginx** (`/nginx`): Reverse proxy configuration

## Quick Start (Docker)

```bash
docker compose up -d --build
```

Access the dashboard at `http://your-server-ip`

## Development

### Backend
```bash
cd backend
npm install
cp .env.example .env  # Edit with your settings
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Agent (Windows Gateway)
```bash
cd agent
npm install
cp .env.example .env  # Add your server URL and API key
npm run dev
```

## Phase Roadmap

- **Phase 1** (Current): Device registry, dashboard, agent heartbeat, auth
- **Phase 2**: Live screen via WebRTC (scrcpy + peer-to-peer)
- **Phase 3**: APK install, reboot, shell commands, bulk actions
- **Phase 4**: Auto-reconnect, monitoring, alerts, watchdog
- **Phase 5**: Scale optimization, video tuning, multi-user
