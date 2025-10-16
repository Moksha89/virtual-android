# Load Balancing Architecture

## Current Setup (Single Server)

The Virtual Android Emulator currently runs on a single server (155.117.44.194) with:
- 16 CPU cores
- 32GB RAM
- Nginx as reverse proxy
- Backend on port 8000
- Frontend served via nginx

## Multi-Server Architecture (Future)

### Components

1. **Load Balancer (Nginx)**
   - Entry point for all traffic
   - Distributes requests across multiple backend servers
   - Implements sticky sessions for WebRTC connections

2. **Backend Servers (Multiple)**
   - Run identical copies of the FastAPI backend
   - Each manages Docker containers locally
   - Share Redis for session storage

3. **Redis Cluster**
   - Centralized session storage
   - Shared cache across all backend servers
   - Ensures session persistence during server failures

4. **Database (PostgreSQL)**
   - Centralized database shared by all backends
   - Connection pooling configured for multiple servers

### Nginx Configuration (Multi-Server)

```nginx
upstream backend_servers {
    ip_hash;  # Sticky sessions for WebRTC connections
    server backend1.example.com:8000;
    server backend2.example.com:8000;
    server backend3.example.com:8000;
}

server {
    listen 443 ssl;
    server_name virtual-android.example.com;

    location /api/ {
        proxy_pass http://backend_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://backend_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

### Session Affinity

WebRTC connections require sticky sessions to maintain peer connections. Use `ip_hash` directive in nginx to ensure requests from the same client always go to the same backend server.

### Deployment Strategy

1. **Prepare Backend Servers**
   - Clone repository to each server
   - Configure environment variables (Redis URL, Database URL)
   - Install dependencies
   - Set up systemd services

2. **Configure Shared Redis**
   - Set up Redis cluster or single Redis instance
   - Update `REDIS_URL` environment variable on all backends
   - Configure Redis password

3. **Configure Shared Database**
   - Use PostgreSQL instead of SQLite
   - Update `DATABASE_URL` environment variable on all backends
   - Configure connection pooling for multiple servers

4. **Configure Load Balancer**
   - Set up nginx on separate server
   - Configure upstream servers
   - Enable SSL/TLS
   - Configure health checks

5. **Test and Monitor**
   - Test failover scenarios
   - Monitor connection distribution
   - Monitor Redis performance
   - Monitor database connection pool usage

### Scaling Considerations

- **Horizontal Scaling**: Add more backend servers as needed
- **Docker Distribution**: Each backend manages containers locally (no need for centralized Docker)
- **Session Management**: Redis ensures sessions work across servers
- **Database Load**: May need read replicas if database becomes bottleneck
- **Redis Load**: May need Redis Cluster if cache becomes bottleneck

### Current Limitations (Single Server)

- Cannot test load balancing without multiple servers
- No failover capability
- Limited by single server resources (16 cores, 32GB RAM)
- Estimated capacity: 8-10 concurrent Android instances

### Migration Path

When ready to scale to multiple servers:
1. Switch from SQLite to PostgreSQL
2. Deploy Redis cluster or single Redis instance accessible to all servers
3. Deploy backend to multiple servers
4. Configure nginx load balancer
5. Update DNS to point to load balancer
6. Test failover and sticky sessions
