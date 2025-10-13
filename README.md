# Virtual Android Emulator

Web-based virtual Android phone emulator with screen streaming and input forwarding.

## 🎯 Features

### Phase 1 (Current Implementation)
- ✅ Create virtual Android phones (Android 12)
- ✅ Configurable RAM (2GB/4GB/8GB) and ROM (16GB/32GB/64GB)
- ✅ Mobile phone screen size (1080x2340)
- ✅ Touch/click input forwarding
- ✅ Full Android OS functionality via redroid containers
- ✅ RESTful API for instance management
- ✅ Modern React UI with real-time updates

### Phase 2 (Future Enhancements)
- Camera streaming from browser to Android
- VoIP integration for calls/SMS (eSIM simulation)
- WebRTC screen streaming
- Persistent storage
- User authentication
- Multiple Android versions

## 🏗️ Architecture

```
┌─────────────────┐
│   User Browser  │
│  (React App)    │
└────────┬────────┘
         │ HTTP/WebSocket
         ▼
┌─────────────────┐
│  FastAPI Server │
│  - Instance Mgmt│
│  - Input Forward│
│  - WebRTC Signal│
└────────┬────────┘
         │ Docker API
         ▼
┌─────────────────┐
│  Docker Engine  │
│   ┌───────────┐ │
│   │  redroid  │ │
│   │ Container │ │
│   │ (Android) │ │
│   └───────────┘ │
└─────────────────┘
```

## 📋 Prerequisites

### Server Requirements
- **OS**: Ubuntu 22.04 LTS or newer (for Python 3.12 support)
- **CPU**: 16+ cores recommended
- **RAM**: 32GB+ (each instance uses 2-8GB)
- **Storage**: 500GB+ SSD
- **Docker**: Version 20.10 or newer

### Development Machine
- Python 3.12+
- Node.js 18+
- Docker (for local testing)

## 🚀 Quick Start

### 1. Server Setup

```bash
# SSH into your server
ssh administrator@YOUR_SERVER_IP

# Install Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker $USER

# Install Python 3.12 (Ubuntu 22.04+)
sudo apt-get install -y python3.12 python3.12-venv python3-pip

# Install Poetry
curl -sSL https://install.python-poetry.org | python3.12 -
export PATH="$HOME/.local/bin:$PATH"

# Pull redroid image
docker pull redroid/redroid:12.0.0-latest

# Setup v4l2loopback for future camera support
sudo apt-get install -y v4l2loopback-dkms
sudo modprobe v4l2loopback devices=1 video_nr=10 card_label="VirtualCam"
echo "v4l2loopback" | sudo tee -a /etc/modules
```

### 2. Backend Deployment

```bash
# Copy backend to server
scp -r backend/ administrator@YOUR_SERVER_IP:~/virtual-android-backend/

# SSH to server
ssh administrator@YOUR_SERVER_IP

# Navigate to backend directory
cd ~/virtual-android-backend

# Update .env file
cat > .env << EOF
DOCKER_HOST=unix:///var/run/docker.sock
CORS_ORIGINS=*
EOF

# Install dependencies
poetry install

# Run backend
poetry run fastapi run app/main.py --host 0.0.0.0 --port 8000
```

#### Optional: Set up systemd service

```bash
sudo tee /etc/systemd/system/virtual-android-backend.service > /dev/null <<EOF
[Unit]
Description=Virtual Android Backend
After=network.target docker.service

[Service]
Type=simple
User=administrator
WorkingDirectory=/home/administrator/virtual-android-backend
ExecStart=/home/administrator/.local/bin/poetry run fastapi run app/main.py --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable virtual-android-backend
sudo systemctl start virtual-android-backend
sudo systemctl status virtual-android-backend
```

### 3. Frontend Deployment

```bash
# Update frontend .env with your backend URL
cd frontend
echo "VITE_BACKEND_URL=http://YOUR_SERVER_IP:8000" > .env

# Build frontend
npm install
npm run build

# Deploy dist/ folder to your hosting provider (Vercel, Netlify, etc.)
# Or serve with nginx on your server
```

## 🧪 Local Development

### Backend

```bash
cd backend

# Install dependencies
poetry install

# Update .env for local Docker
echo "DOCKER_HOST=unix:///var/run/docker.sock" > .env
echo "CORS_ORIGINS=*" >> .env

# Run development server
poetry run fastapi dev app/main.py --host 0.0.0.0 --port 8000

# API documentation available at http://localhost:8000/docs
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Update .env for local backend
echo "VITE_BACKEND_URL=http://localhost:8000" > .env

# Run development server
npm run dev

# Frontend available at http://localhost:5173
```

## 📡 API Endpoints

### Instance Management

- `POST /api/instances` - Create new Android instance
  ```json
  {
    "ram_gb": 4,
    "rom_gb": 32
  }
  ```

- `GET /api/instances` - List all instances

- `GET /api/instances/{instance_id}` - Get instance details

- `DELETE /api/instances/{instance_id}` - Delete instance

### Input Control

- `POST /api/instances/{instance_id}/input` - Send touch input
  ```json
  {
    "x": 540,
    "y": 1170,
    "type": "tap"
  }
  ```

### WebRTC Streaming

- `WS /api/instances/{instance_id}/webrtc` - WebRTC signaling endpoint

## 🛠️ Technology Stack

### Backend
- **FastAPI** - Modern Python web framework
- **Docker SDK** - Container management
- **redroid** - Android in Docker
- **aiortc** - WebRTC implementation
- **WebSockets** - Real-time communication

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **Lucide React** - Icons

### Infrastructure
- **Docker** - Containerization
- **redroid 12.0.0** - Android 12 containers
- **Ubuntu Server 20 LTS** - Operating system

## 📝 Environment Variables

### Backend (.env)
```bash
DOCKER_HOST=unix:///var/run/docker.sock  # Local Docker
# OR
DOCKER_HOST=ssh://user@host              # Remote Docker (requires SSH keys)
CORS_ORIGINS=*                           # CORS configuration
```

### Frontend (.env)
```bash
VITE_BACKEND_URL=http://localhost:8000   # Backend API URL
```

## 🐛 Troubleshooting

### Backend Issues

**Docker connection errors:**
- Ensure Docker is running: `sudo systemctl status docker`
- Check Docker socket permissions: `sudo usermod -aG docker $USER`
- Verify DOCKER_HOST in .env is correct

**Port already in use:**
```bash
# Find process using port 8000
sudo lsof -i :8000

# Kill process
kill -9 <PID>
```

### Frontend Issues

**Can't connect to backend:**
- Verify backend is running
- Check VITE_BACKEND_URL in frontend/.env
- Ensure CORS is configured correctly in backend

**Build errors:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

## 🔐 Security Considerations

- Never commit .env files with credentials
- Use SSH key-based authentication instead of passwords
- Restrict CORS origins in production
- Implement user authentication before public deployment
- Use HTTPS for production deployments
- Set up firewall rules to limit access

## 📊 Resource Management

Each Android instance uses:
- **RAM**: 2-8GB (user configurable)
- **Storage**: 16-64GB (user configurable)
- **CPU**: ~2-4 cores per instance

With a 16-core, 32GB RAM server, you can support 5-8 concurrent instances.

## 🚧 Known Limitations

- WebRTC screen streaming not fully implemented (Phase 2)
- Camera integration not yet available (Phase 2)
- VoIP/eSIM simulation not implemented (Phase 2)
- No persistent storage (instances lost on restart)
- No user authentication
- Some Android apps may detect emulation

## 🗺️ Roadmap

### Phase 2 Features
- [ ] Full WebRTC screen streaming implementation
- [ ] Camera streaming from browser to Android
- [ ] VoIP integration (Twilio/Google Voice) for calls/SMS
- [ ] eSIM simulation via VoIP
- [ ] Persistent storage for instances
- [ ] User authentication and sessions
- [ ] Multiple Android versions support
- [ ] Performance optimizations
- [ ] Auto-cleanup for idle instances

## 📄 License

MIT License

## 👥 Credits

- **Requested by**: Tulasiram Pemmadi (@Moksha89)
- **Developed by**: Devin AI
- **Session**: https://app.devin.ai/sessions/b63ddcd2012a41d19e6a96164f9d58ce

## 🔗 Links

- **Repository**: https://github.com/Moksha89/virtual-android
- **redroid**: https://github.com/remote-android/redroid-doc
- **Docker**: https://www.docker.com/
- **FastAPI**: https://fastapi.tiangolo.com/
- **React**: https://react.dev/
