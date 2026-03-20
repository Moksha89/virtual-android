# Mobile Manager Testing Skills

## Architecture
- **VPS**: 69.197.168.244 running Docker Compose (frontend nginx, backend Node.js, PostgreSQL, Redis)
- **Agent**: Windows Electron app (.exe) connecting to VPS via WebSocket
- **Frontend**: React + Vite, served by nginx in Docker
- **Backend**: Node.js/TypeScript with WebSocket relay for screen streaming

## Test Accounts
- Dashboard login: `admin@mobilemanager.com` / `Admin@123`
- Agent API key: Check Agents page in dashboard for per-agent keys

## Deployment
- SSH to VPS: `sshpass -p '<VPS_PASSWORD>' ssh administrator@69.197.168.244`
- Project dir on VPS: `/home/administrator/mobile-manager/`
- Rebuild containers: `docker compose build --no-cache <service>` then `docker compose up -d <service>`
- **IMPORTANT**: When deploying frontend changes, you must upload the SOURCE files to VPS before `docker compose build`, because the Docker build compiles from source (not from local dist/). The Vite build hash will differ between local and Docker builds.
- Frontend nginx serves from `/usr/share/nginx/html/` inside the container
- Check deployed JS hash: `docker exec mm_frontend ls /usr/share/nginx/html/assets/`

## Backend Logs
- View logs: `docker compose logs --tail 50 backend`
- Filter noise: `grep -v 'Rejecting browser' | grep -v 'level=warning'`
- Key log patterns:
  - `Frame relay [screencap]: N chunks in 10s, XKB total, Y browsers` — streaming stats
  - `Relaying browser command to agent` — input command relay confirmation
  - `codec set to: h264|screencap` — codec mode changes
  - `[H264 watchdog]` — H.264 garbage detection and fallback trigger
  - `Forcing screencap mode` — backend forcing screencap on agent connect

## Agent .exe Build
- Build locally: `cd agent && npm run build` (produces `dist/Mobile Manager Agent Setup 1.0.0.exe`)
- Upload to VPS: `scp "dist/Mobile Manager Agent Setup 1.0.0.exe" administrator@VPS_IP:/home/administrator/mobile-manager/downloads/`
- Download URL: `http://VPS_IP/downloads/Mobile%20Manager%20Agent%20Setup%201.0.0.exe`
- The agent is an Electron app built with electron-builder for Windows

## Screen Streaming Pipeline
1. Agent captures phone screen via ADB screencap or scrcpy H.264
2. Agent sends frames over WebSocket to backend (`/ws/screen?role=agent`)
3. Backend compresses PNG→JPEG with sharp (screencap mode) or passes through (H.264 mode)
4. Backend relays to browser WebSocket connections (`/ws/screen?role=browser`)
5. Browser renders: `<img>` for screencap, `<video>` for H.264

## Known Issues
- scrcpy H.264 produces garbage data on some devices — backend watchdog auto-falls back to screencap
- Old browser tabs without tabId flood backend with reconnect attempts — they get rejected with code 4005
- Frontend caching: browsers may cache old JS. Users need Ctrl+Shift+R to get updated frontend
- ADB screencap is limited to ~3 FPS due to capture speed (~300-500ms per frame)
