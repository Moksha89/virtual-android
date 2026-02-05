# Android Remote Control

A bank-safe Windows application for remotely controlling Android devices via ADB. This application uses the same technology as Android developers (ADB + scrcpy) to provide secure remote access without triggering banking app security measures.

## Features

- **Auto-download Tools**: Automatically downloads and installs ADB and scrcpy
- **Multi-device Support**: Control multiple Android devices simultaneously
- **Bank-safe Design**: Uses ADB (no Android app, no root, no AccessibilityService)
- **Clean Modern UI**: Dark theme with intuitive device management
- **Help Prompts**: Step-by-step guidance for setup and troubleshooting
- **Auto USB Drivers**: Downloads USB drivers for Windows (optional)

## Architecture

```
┌──────────────────────────────┐
│      Electron Application    │
│                              │
│  ┌─────────┐  ┌───────────┐ │
│  │ Device  │  │  Session  │ │
│  │ Manager │  │  Manager  │ │
│  └────┬────┘  └────┬──────┘ │
│       │              │       │
│  ┌────▼────┐   ┌────▼─────┐ │
│  │   ADB   │   │  scrcpy  │ │
│  │ Manager │   │  Manager │ │
│  └────┬────┘   └────┬─────┘ │
│       │              │       │
│       └──────┬───────┘       │
│              ▼               │
│     Android Device (USB)     │
└──────────────────────────────┘
```

## Why This is Bank-Safe

1. **No Android App**: Nothing is installed on your phone
2. **No Root Required**: Works with standard Android devices
3. **No AccessibilityService**: Doesn't trigger banking app security
4. **ADB-based Control**: Same method used by Android developers
5. **Human-speed Input**: Input throttling prevents detection

## Requirements

- Windows 10/11 (primary), macOS, or Linux
- Node.js 18+ (for development)
- Android device with USB Debugging enabled

## Installation

### For Users (Windows)

1. Download the latest release from the Releases page
2. Run the installer or portable executable
3. Launch "Android Remote Control"
4. Click "Install" to download ADB and scrcpy automatically

### For Developers

```bash
# Clone the repository
git clone https://github.com/user/android-remote-control.git
cd android-remote-control

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build:win   # Windows
npm run build:mac   # macOS
npm run build:linux # Linux
```

## Setup Guide

### 1. Enable USB Debugging on Your Android Device

1. Go to **Settings** → **About Phone**
2. Tap **Build Number** 7 times to enable Developer Options
3. Go back to **Settings** → **Developer Options**
4. Enable **USB Debugging**

### 2. Connect Your Device

1. Connect your Android device via USB cable
2. When prompted on your phone, tap **Allow** to authorize USB debugging
3. Check **"Always allow from this computer"** for convenience

### 3. Start a Session

1. Your device should appear in the Devices list
2. Click on the device and select **Start Session**
3. A scrcpy window will open showing your device's screen
4. Use your mouse and keyboard to control the device

## Keyboard Shortcuts (in scrcpy window)

| Shortcut | Action |
|----------|--------|
| `Ctrl + H` | Home button |
| `Ctrl + B` | Back button |
| `Ctrl + S` | App switch |
| `Ctrl + P` | Power button |
| `Ctrl + ↑` | Volume up |
| `Ctrl + ↓` | Volume down |
| `Ctrl + O` | Turn screen off |
| `Ctrl + Shift + O` | Turn screen on |
| `Ctrl + R` | Rotate screen |

## Troubleshooting

### Device Not Detected

- Ensure USB Debugging is enabled
- Try a different USB cable (use original if possible)
- Try a different USB port
- Click "Restart ADB" in the app
- On Windows, install USB drivers from Settings

### Device Shows "Unauthorized"

- Check your phone for a USB debugging authorization prompt
- Tap "Allow" on the prompt
- If no prompt appears, revoke USB debugging authorizations in Developer Options and reconnect

### Screen Mirroring Not Working

- Ensure scrcpy is installed (check Settings)
- Try lowering the resolution in Settings
- Some devices may require specific USB modes - try "File Transfer" mode

## Project Structure

```
android-remote-control/
├── main.js              # Electron main process
├── preload.js           # Preload script for IPC
├── package.json         # Project configuration
├── src/
│   ├── adb-manager.js   # ADB download and commands
│   ├── scrcpy-manager.js # scrcpy download and streaming
│   ├── device-manager.js # Device detection and tracking
│   └── session-manager.js # Session control and input
├── renderer/
│   ├── index.html       # Main UI
│   ├── css/
│   │   └── styles.css   # Application styles
│   └── js/
│       └── app.js       # Renderer process logic
└── assets/              # Icons and images
```

## Security Considerations

- **Input Throttling**: Minimum 30ms between inputs to appear human-like
- **No Cloud**: All processing happens locally
- **No Recording**: Screen content is never stored
- **Device Locking**: One session per device at a time

## License

MIT License

## Credits

- [scrcpy](https://github.com/Genymobile/scrcpy) - Screen mirroring tool
- [Android Platform Tools](https://developer.android.com/studio/releases/platform-tools) - ADB
