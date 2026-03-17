export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  created_at: Date;
  updated_at: Date;
}

export interface Agent {
  id: string;
  name: string;
  api_key: string;
  ip_address: string | null;
  status: string;
  last_heartbeat: Date | null;
  system_info: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface Device {
  id: string;
  agent_id: string;
  serial: string;
  model: string | null;
  manufacturer: string | null;
  android_version: string | null;
  sdk_version: string | null;
  battery_level: number | null;
  battery_status: string | null;
  screen_resolution: string | null;
  ip_address: string | null;
  status: string;
  nickname: string | null;
  tags: string[];
  last_seen: Date | null;
  extra_info: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface Session {
  id: string;
  device_id: string;
  user_id: string | null;
  status: string;
  started_at: Date;
  ended_at: Date | null;
  metadata: Record<string, unknown>;
}

export interface DeviceLog {
  id: string;
  device_id: string;
  agent_id: string;
  level: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AgentHeartbeat {
  agent_id: string;
  devices: AgentDeviceInfo[];
  system: {
    cpu_usage?: number;
    memory_usage?: number;
    uptime?: number;
  };
}

export interface AgentDeviceInfo {
  serial: string;
  model?: string;
  manufacturer?: string;
  android_version?: string;
  sdk_version?: string;
  battery_level?: number;
  battery_status?: string;
  screen_resolution?: string;
  ip_address?: string;
  status: string;
  extra_info?: Record<string, unknown>;
}

export interface DeviceCommand {
  type: 'reboot' | 'screenshot' | 'install_apk' | 'shell' | 'restart_adb' | 'input_text' | 'tap' | 'swipe';
  payload?: Record<string, unknown>;
}

export interface WebSocketMessage {
  type: string;
  data: unknown;
}
