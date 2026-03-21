// Use relative URLs when served from the same origin (empty string = same origin)
const API_URL = import.meta.env.VITE_API_URL ?? "";

export interface HardwareProfile {
  id: string;
  name: string;
  brand: string;
  category: string;
  x_res: number;
  y_res: number;
  dpi: number;
  default_ram_mb: number;
  default_storage_gb: number;
  default_cpus: number;
  description: string;
  icon: string;
  is_custom: boolean;
}

export interface DeviceInfo {
  id: string;
  name: string;
  instance_id: number;
  profile_id: string;
  profile_name: string;
  android_version: string;
  os_type: string;
  status: "running" | "starting" | "stopped" | "error";
  ram_mb: number;
  storage_gb: number;
  cpus: number;
  x_res: number;
  y_res: number;
  dpi: number;
  gpu_mode: string;
  adb_port: number;
  webrtc_port: number;
  adb_serial: string;
  ip: string;
  assigned_users: string[];
}

export interface ServerStatus {
  cpu_cores: number;
  cpu_usage_percent: number;
  ram_total_gb: number;
  ram_used_gb: number;
  ram_available_gb: number;
  disk_total_gb: number;
  disk_used_gb: number;
  disk_available_gb: number;
  gpu_name: string;
  gpu_memory_total_mb: number;
  gpu_memory_used_mb: number;
}

export interface AndroidVersion {
  version: string;
  api_level: number;
  codename: string;
  images_dir: string;
  available: boolean;
}

export interface OSType {
  id: string;
  name: string;
  description: string;
  available: boolean;
  icon: string;
}

export interface CreateDeviceRequest {
  name: string;
  profile_id: string;
  android_version: string;
  os_type: string;
  ram_mb: number;
  storage_gb: number;
  cpus: number;
  gpu_mode: string;
}

export interface EditDeviceRequest {
  name?: string;
  ram_mb?: number;
  storage_gb?: number;
  cpus?: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active?: boolean;
  created_at?: string;
  last_login?: string | null;
}

export interface Assignment {
  device_id: string;
  user_id: number;
  username: string;
}

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
    }
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "API request failed");
  }
  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    fetchApi<{ access_token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  register: (username: string, email: string, password: string) =>
    fetchApi<{ access_token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    }),
  getMe: () => fetchApi<User>("/api/auth/me"),

  // Admin
  getUsers: () => fetchApi<User[]>("/api/admin/users"),
  updateUser: (userId: number, data: { role?: string; is_active?: boolean }) =>
    fetchApi(`/api/admin/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteUser: (userId: number) =>
    fetchApi(`/api/admin/users/${userId}`, { method: "DELETE" }),
  adminCreateUser: (username: string, email: string, password: string) =>
    fetchApi("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    }),
  getAssignments: () => fetchApi<Assignment[]>("/api/admin/assignments"),
  assignDevice: (deviceId: string, userId: number) =>
    fetchApi("/api/admin/assignments", {
      method: "POST",
      body: JSON.stringify({ device_id: deviceId, user_id: userId }),
    }),
  unassignDevice: (deviceId: string, userId: number) =>
    fetchApi(`/api/admin/assignments/${deviceId}/${userId}`, {
      method: "DELETE",
    }),

  // Profiles
  getProfiles: () => fetchApi<HardwareProfile[]>("/api/profiles"),
  createProfile: (data: Omit<HardwareProfile, "id" | "icon" | "is_custom">) =>
    fetchApi<HardwareProfile>("/api/profiles", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteProfile: (profileId: string) =>
    fetchApi(`/api/profiles/${profileId}`, { method: "DELETE" }),

  // Devices
  getDevices: () => fetchApi<DeviceInfo[]>("/api/devices"),
  createDevice: (data: CreateDeviceRequest) =>
    fetchApi("/api/devices", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  editDevice: (deviceId: string, data: EditDeviceRequest) =>
    fetchApi(`/api/devices/${deviceId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteDevice: (deviceId: string) =>
    fetchApi(`/api/devices/${deviceId}`, { method: "DELETE" }),

  // Device Control
  deviceControl: (deviceId: string, action: string, params: Record<string, unknown> = {}) =>
    fetchApi<{ success: boolean; stdout?: string; stderr?: string; return_code?: number; image_base64?: string }>(
      `/api/devices/${deviceId}/control`,
      {
        method: "POST",
        body: JSON.stringify({ action, params }),
      }
    ),
  installGapps: (deviceId: string) =>
    fetchApi<{ message: string }>(`/api/devices/${deviceId}/install-gapps`, {
      method: "POST",
    }),

  // Server
  getServerStatus: () => fetchApi<ServerStatus>("/api/server/status"),
  getAndroidVersions: () => fetchApi<AndroidVersion[]>("/api/android-versions"),
  getOsTypes: () => fetchApi<OSType[]>("/api/os-types"),
};
