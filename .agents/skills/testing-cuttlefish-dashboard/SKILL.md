# Testing the Cuttlefish Device Manager Dashboard

## Environment Setup

- **Dashboard URL**: http://173.208.243.135:8000
- **Backend**: FastAPI (Python) running as systemd service `cuttlefish-dashboard` on the same server
- **Frontend**: React + TypeScript + Vite, built and served by the FastAPI backend as static files
- **Database**: SQLite at `/data/dashboard.db`
- **Server**: Bare metal dedicated server (Dual Xeon E5-2697v4, 256GB RAM, RTX A6000)

## Devin Secrets Needed

- `SERVER_SSH_PASSWORD`: SSH password for administrator@173.208.243.135 (used for deployment and server management)

## Login

- Default admin credentials: `admin` / `admin123`
- Login page appears at the dashboard URL if not authenticated
- Admin users see all devices + Admin Panel tab; regular users only see assigned devices

## How to Run Locally

```bash
# SSH to server
ssh administrator@173.208.243.135

# Backend
cd /home/administrator/cuttlefish-dashboard/app
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000

# Or restart the systemd service
sudo systemctl restart cuttlefish-dashboard
```

## Testing the Dashboard Features

### General Tips

- After deploying changes, hard-refresh (Ctrl+Shift+R) the browser to clear cached JS bundles
- The dashboard auto-refreshes device status every 15 seconds — dialogs may briefly flicker
- Dialog close buttons (X) may sometimes need coordinate-based clicks rather than devinid clicks due to overlay positioning
- Some API calls (branding save, recording start/stop) take 3-5 seconds because they SSH into the device server

### Dashboard Layout

- **11 tabs**: Devices, Templates, Analytics, Profiles, Admin, API Keys, Pools, Scheduling, Billing, Webhooks, Plugins
- **Header buttons**: AI Recommend (purple brain icon), Voice Control (mic), Notifications (bell), Dark Mode toggle, Refresh, Create Device, User menu
- **Device card rows**: Row 1 has File Manager, ADB Terminal, App Manager, Device Logs, Clipboard, Network Throttle, Snapshots, Screen Record, Screenshot. Row 2 has Device Health, GPS, SMS/Call, Locale, Remote Debug, Monkey Test, AI Test, Session Recording, Branding & Boot

### Feature-Specific Testing Notes

#### Smart Device Recommendations
- Click "AI Recommend" button in header
- 3 dropdowns: App Category (5 options), Target Audience, Budget
- Generate produces recommendation cards with profile name, Android version, reason, priority badge (high/medium/low with color coding), and config specs (CPUs, RAM, Storage)
- The recommendations are rule-based (not LLM) — same inputs always produce same outputs

#### Plugins Tab
- Admin-only tab
- Register Plugin form with name, author, description, version, and hook event selection
- 11 hook events available (device.created, device.deleted, etc.)
- Plugin cards show toggle switch (Enabled/Disabled) and delete button
- Delete uses browser `confirm()` dialog — in automated testing, this auto-accepts
- Plugins are database-only — no actual plugin execution runtime exists

#### Session Recording
- Opens from red disc button on device cards
- Start Recording calls `getevent` on the device via SSH/ADB
- Stop Recording stops the capture and reports event count
- If no one is interacting with the device touchscreen, captured events will be 0 — this is expected behavior
- Save and Replay features require events data to be present

#### Branding & Boot Animation
- Opens from teal tag button on device cards
- Fields pre-populate from device properties via `adb shell getprop`
- Brand/Model/Manufacturer fields are editable
- Save Branding calls `setprop` on the device — may silently fail for `ro.*` read-only properties on Cuttlefish
- 8 boot animation themes available (Default Android, Material Design, Minimal, Corporate, Gaming, Neon, Nature, Retro)
- Apply Animation pushes a bootanimation.zip to `/system/media/` — requires writable system partition

### Known Limitations

- **Branding persistence**: `ro.product.brand` and similar properties are read-only on Cuttlefish. The API returns success but the property may not actually change until next boot with custom build.
- **Boot animation apply**: Requires writable `/system` partition. Cuttlefish may use overlayfs which could make this work, but it's not guaranteed.
- **Live Collaboration**: Requires multiple simultaneous users to test properly. Single-user testing can only verify the CollabIndicator renders.
- **Session Recording replay**: Requires actual touch events captured from device interaction. Testing with no device interaction will always show 0 events.
- **GApps auto-install**: Download URL may break if the upstream MindTheGapps repository changes. Check `/home/administrator/cuttlefish-dashboard/app/ssh_manager.py` for the current download URL if installs fail.

## Deployment

```bash
# On the server, the app runs as a systemd service
sudo systemctl status cuttlefish-dashboard
sudo systemctl restart cuttlefish-dashboard
sudo journalctl -u cuttlefish-dashboard -f  # view logs
```

The frontend is built locally and the dist/ output is served by FastAPI's StaticFiles mount.
