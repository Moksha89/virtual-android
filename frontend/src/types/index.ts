export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
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
  last_seen: string | null;
  extra_info: Record<string, unknown>;
  agent_name?: string;
  agent_status?: string;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  name: string;
  api_key?: string;
  ip_address: string | null;
  status: string;
  last_heartbeat: string | null;
  system_info: Record<string, unknown>;
  created_at: string;
}

export interface Session {
  id: string;
  device_id: string;
  user_id: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  serial?: string;
  model?: string;
  manufacturer?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface DeviceLog {
  id: string;
  device_id: string;
  agent_id: string;
  level: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
