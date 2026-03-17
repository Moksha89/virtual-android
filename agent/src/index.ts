import dotenv from 'dotenv';
import { AdbService } from './services/adb';
import { ApiService } from './services/api';

dotenv.config();

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8000';
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || '10000', 10);

if (!AGENT_API_KEY) {
  console.error('AGENT_API_KEY is required. Register an agent in the dashboard first.');
  process.exit(1);
}

const adb = new AdbService(process.env.ADB_PATH || 'adb');
const api = new ApiService(SERVER_URL, AGENT_API_KEY);

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

async function sendHeartbeat(): Promise<void> {
  try {
    const devices = await adb.getConnectedDevices();
    const deviceInfos = await Promise.all(
      devices.map(async (serial) => {
        const info = await adb.getDeviceInfo(serial);
        return {
          serial,
          model: info.model,
          manufacturer: info.manufacturer,
          android_version: info.androidVersion,
          sdk_version: info.sdkVersion,
          battery_level: info.batteryLevel,
          battery_status: info.batteryStatus,
          screen_resolution: info.screenResolution,
          ip_address: info.ipAddress,
          status: 'online' as const,
        };
      })
    );

    const systemInfo = {
      uptime: process.uptime(),
      platform: process.platform,
      node_version: process.version,
    };

    await api.sendHeartbeat(deviceInfos, systemInfo);

    console.log(
      `[${new Date().toISOString()}] Heartbeat sent: ${deviceInfos.length} device(s) reported`
    );
  } catch (error) {
    console.error('Heartbeat failed:', error);
  }
}

async function start(): Promise<void> {
  console.log('=== Mobile Manager Agent ===');
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Heartbeat interval: ${HEARTBEAT_INTERVAL}ms`);
  console.log('');

  // Check ADB
  const adbAvailable = await adb.isAvailable();
  if (!adbAvailable) {
    console.error('ADB is not available. Please install Android SDK Platform Tools.');
    console.error('Download: https://developer.android.com/tools/releases/platform-tools');
    process.exit(1);
  }

  console.log('ADB is available.');

  // Initial heartbeat
  await sendHeartbeat();

  // Start heartbeat loop
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

  console.log('Agent started. Press Ctrl+C to stop.');
}

process.on('SIGINT', () => {
  console.log('\nShutting down agent...');
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  process.exit(0);
});

start().catch((err) => {
  console.error('Failed to start agent:', err);
  process.exit(1);
});
