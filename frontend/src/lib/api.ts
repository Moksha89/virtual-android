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

  // Settings
  getDeletePasscode: () =>
    fetchApi<{ passcode: string }>("/api/admin/settings/delete-passcode"),
  setDeletePasscode: (passcode: string) =>
    fetchApi("/api/admin/settings/delete-passcode", {
      method: "PUT",
      body: JSON.stringify({ passcode }),
    }),
  isDeletePasscodeRequired: () =>
    fetchApi<{ required: boolean }>("/api/settings/delete-passcode-required"),
  deleteDeviceWithPasscode: (deviceId: string, passcode: string) =>
    fetchApi(`/api/devices/${deviceId}?passcode=${encodeURIComponent(passcode)}`, { method: "DELETE" }),

  // File Manager
  listFiles: (deviceId: string, path: string = "/sdcard") =>
    fetchApi<{ path: string; files: { name: string; is_dir: boolean; size: number; permissions: string }[] }>(
      `/api/devices/${deviceId}/files?path=${encodeURIComponent(path)}`
    ),
  downloadFile: (deviceId: string, path: string) =>
    fetchApi<{ data: string; filename: string }>(
      `/api/devices/${deviceId}/files/download?path=${encodeURIComponent(path)}`
    ),
  uploadFile: (deviceId: string, path: string, data: string, filename: string) =>
    fetchApi(`/api/devices/${deviceId}/files/upload`, {
      method: "POST",
      body: JSON.stringify({ path, data, filename }),
    }),
  deleteFile: (deviceId: string, path: string) =>
    fetchApi(`/api/devices/${deviceId}/files?path=${encodeURIComponent(path)}`, { method: "DELETE" }),

  // App Management
  listApps: (deviceId: string) =>
    fetchApi<{ apps: { package: string; apk_path: string }[] }>(`/api/devices/${deviceId}/apps`),
  installApk: (deviceId: string, data: string, filename: string) =>
    fetchApi(`/api/devices/${deviceId}/apps/install`, {
      method: "POST",
      body: JSON.stringify({ data, filename }),
    }),
  uninstallApp: (deviceId: string, pkg: string) =>
    fetchApi(`/api/devices/${deviceId}/apps/${pkg}`, { method: "DELETE" }),
  forceStopApp: (deviceId: string, pkg: string) =>
    fetchApi(`/api/devices/${deviceId}/apps/${pkg}/stop`, { method: "POST" }),
  clearAppData: (deviceId: string, pkg: string) =>
    fetchApi(`/api/devices/${deviceId}/apps/${pkg}/clear`, { method: "POST" }),

  // Screen Recording
  startRecording: (deviceId: string, duration: number = 180) =>
    fetchApi(`/api/devices/${deviceId}/recording/start`, {
      method: "POST",
      body: JSON.stringify({ duration }),
    }),
  stopRecording: (deviceId: string) =>
    fetchApi(`/api/devices/${deviceId}/recording/stop`, { method: "POST" }),
  downloadRecording: (deviceId: string) =>
    fetchApi<{ data: string; filename: string }>(`/api/devices/${deviceId}/recording/download`),

  // Clipboard
  getClipboard: (deviceId: string) =>
    fetchApi<{ text: string }>(`/api/devices/${deviceId}/clipboard`),
  setClipboard: (deviceId: string, text: string) =>
    fetchApi(`/api/devices/${deviceId}/clipboard`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  // Network Throttling
  setNetworkThrottle: (deviceId: string, profile: string) =>
    fetchApi(`/api/devices/${deviceId}/network`, {
      method: "POST",
      body: JSON.stringify({ profile }),
    }),
  getNetworkProfiles: () =>
    fetchApi<{ profiles: { id: string; name: string; description: string }[] }>("/api/network-profiles"),

  // Multi-device Actions
  bulkAction: (deviceIds: string[], action: string, params: Record<string, unknown> = {}) =>
    fetchApi<{ results: Record<string, { success: boolean; message: string }> }>("/api/devices/bulk-action", {
      method: "POST",
      body: JSON.stringify({ device_ids: deviceIds, action, params }),
    }),

  // Device Templates
  getTemplates: () => fetchApi<{ id: number; name: string; description: string; profile_id: string; android_version: string; os_type: string; ram_mb: number; storage_gb: number; cpus: number; gpu_mode: string; pre_installed_apps: string; created_at: string }[]>("/api/templates"),
  createTemplate: (data: Record<string, unknown>) =>
    fetchApi("/api/templates", { method: "POST", body: JSON.stringify(data) }),
  deleteTemplate: (id: number) =>
    fetchApi(`/api/templates/${id}`, { method: "DELETE" }),

  // API Keys
  getApiKeys: () => fetchApi<{ id: number; name: string; key_prefix: string; permissions: string; is_active: number; created_at: string; last_used: string | null; username: string }[]>("/api/admin/api-keys"),
  createApiKey: (name: string, userId: number, permissions: string[] = ["read"]) =>
    fetchApi<{ key: string; prefix: string; message: string }>("/api/admin/api-keys", {
      method: "POST",
      body: JSON.stringify({ name, user_id: userId, permissions }),
    }),
  deleteApiKey: (id: number) =>
    fetchApi(`/api/admin/api-keys/${id}`, { method: "DELETE" }),

  // Notifications
  getNotifications: (limit: number = 50) =>
    fetchApi<{ id: number; type: string; title: string; message: string; device_id: string | null; is_read: number; created_at: string }[]>(`/api/notifications?limit=${limit}`),
  markNotificationRead: (id: number) =>
    fetchApi(`/api/notifications/${id}/read`, { method: "PUT" }),
  markAllNotificationsRead: () =>
    fetchApi("/api/notifications/read-all", { method: "PUT" }),
  deleteNotification: (id: number) =>
    fetchApi(`/api/notifications/${id}`, { method: "DELETE" }),

  // Analytics
  getAnalyticsSummary: () =>
    fetchApi<{
      total_events: number;
      events_last_24h: number;
      by_type: { event_type: string; count: number }[];
      by_device: { device_id: string; count: number }[];
      timeline: { day: string; count: number }[];
    }>("/api/analytics/summary"),
  logEvent: (eventType: string, deviceId?: string, userId?: number, details?: Record<string, unknown>) =>
    fetchApi("/api/analytics/event", {
      method: "POST",
      body: JSON.stringify({ event_type: eventType, device_id: deviceId, user_id: userId, details }),
    }),

  // Snapshots
  getSnapshots: () =>
    fetchApi<{ snapshots: { name: string }[] }>("/api/snapshots"),
  createSnapshot: (deviceId: string, name: string) =>
    fetchApi(`/api/devices/${deviceId}/snapshots`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  deleteSnapshot: (name: string) =>
    fetchApi(`/api/snapshots/${name}`, { method: "DELETE" }),

  // Device Health
  getDeviceHealth: (deviceId: string) =>
    fetchApi<{
      cpu_usage: number; mem_total_mb: number; mem_available_mb: number; mem_used_mb: number;
      battery_level: number; battery_status: string; battery_temp: number; temperature_c: number;
      uptime: string; disk_total_mb: number; disk_used_mb: number;
    }>(`/api/devices/${deviceId}/health`),
  getDeviceProcesses: (deviceId: string) =>
    fetchApi<{ processes: { pid: string; user: string; name: string; rss_kb: number }[] }>(`/api/devices/${deviceId}/processes`),

  // GPS Simulation
  setGps: (deviceId: string, latitude: number, longitude: number, altitude: number = 0) =>
    fetchApi(`/api/devices/${deviceId}/gps`, {
      method: "POST", body: JSON.stringify({ latitude, longitude, altitude }),
    }),
  getGpsPresets: () =>
    fetchApi<{ presets: { name: string; latitude: number; longitude: number }[] }>("/api/gps-presets"),

  // SMS/Call Simulation
  sendSms: (deviceId: string, phoneNumber: string, message: string) =>
    fetchApi(`/api/devices/${deviceId}/sms`, {
      method: "POST", body: JSON.stringify({ phone_number: phoneNumber, message }),
    }),
  makeCall: (deviceId: string, phoneNumber: string, action: string = "call") =>
    fetchApi(`/api/devices/${deviceId}/call`, {
      method: "POST", body: JSON.stringify({ phone_number: phoneNumber, action }),
    }),

  // Locale
  getDeviceLocale: (deviceId: string) =>
    fetchApi<{ locale: string }>(`/api/devices/${deviceId}/locale`),
  setDeviceLocale: (deviceId: string, locale: string) =>
    fetchApi(`/api/devices/${deviceId}/locale`, {
      method: "POST", body: JSON.stringify({ locale }),
    }),
  getLocales: () =>
    fetchApi<{ locales: { code: string; name: string; flag: string }[] }>("/api/locales"),

  // Device Pools
  getPools: () =>
    fetchApi<{ pools: { id: number; name: string; description: string; color: string; devices: string[]; created_at: string }[] }>("/api/pools"),
  createPool: (name: string, description: string, color: string) =>
    fetchApi("/api/pools", { method: "POST", body: JSON.stringify({ name, description, color }) }),
  deletePool: (id: number) => fetchApi(`/api/pools/${id}`, { method: "DELETE" }),
  addDeviceToPool: (poolId: number, deviceId: string) =>
    fetchApi(`/api/pools/${poolId}/devices`, { method: "POST", body: JSON.stringify({ device_id: deviceId }) }),
  removeDeviceFromPool: (poolId: number, deviceId: string) =>
    fetchApi(`/api/pools/${poolId}/devices/${deviceId}`, { method: "DELETE" }),

  // Device Tags
  getDeviceTags: (deviceId: string) =>
    fetchApi<{ tags: { tag: string; color: string }[] }>(`/api/devices/${deviceId}/tags`),
  addDeviceTag: (deviceId: string, tag: string, color: string = "#3b82f6") =>
    fetchApi(`/api/devices/${deviceId}/tags`, { method: "POST", body: JSON.stringify({ tag, color }) }),
  removeDeviceTag: (deviceId: string, tag: string) =>
    fetchApi(`/api/devices/${deviceId}/tags/${tag}`, { method: "DELETE" }),

  // Scheduling
  getSchedules: () =>
    fetchApi<{ schedules: { id: number; device_id: string; user_id: number; title: string; start_time: string; end_time: string; status: string; username: string }[] }>("/api/schedules"),
  createSchedule: (deviceId: string, userId: number, title: string, startTime: string, endTime: string) =>
    fetchApi("/api/schedules", { method: "POST", body: JSON.stringify({ device_id: deviceId, user_id: userId, title, start_time: startTime, end_time: endTime }) }),
  deleteSchedule: (id: number) => fetchApi(`/api/schedules/${id}`, { method: "DELETE" }),

  // Cost Tracking / Usage
  getUsage: (deviceId?: string) =>
    fetchApi<{ sessions: { id: number; device_id: string; started_at: string; ended_at: string | null; duration_seconds: number; cost_cents: number }[]; total_cost_cents: number; total_hours: number }>(
      deviceId ? `/api/usage?device_id=${deviceId}` : "/api/usage"
    ),
  startUsageSession: (deviceId: string, userId?: number) =>
    fetchApi<{ session_id: number }>("/api/usage/start", { method: "POST", body: JSON.stringify({ device_id: deviceId, user_id: userId }) }),
  endUsageSession: (sessionId: number) =>
    fetchApi(`/api/usage/${sessionId}/end`, { method: "POST" }),

  // Webhooks
  getWebhooks: () =>
    fetchApi<{ webhooks: { id: number; name: string; url: string; events: string; secret: string; is_active: number; created_at: string; last_triggered: string | null }[] }>("/api/webhooks"),
  createWebhook: (name: string, url: string, events: string[], secret: string = "") =>
    fetchApi("/api/webhooks", { method: "POST", body: JSON.stringify({ name, url, events, secret }) }),
  deleteWebhook: (id: number) => fetchApi(`/api/webhooks/${id}`, { method: "DELETE" }),
  toggleWebhook: (id: number) => fetchApi(`/api/webhooks/${id}/toggle`, { method: "PUT" }),

  // Screenshot Comparison
  compareScreenshots: (deviceId: string, otherDeviceId: string, name?: string) =>
    fetchApi<{ screenshot_a: string | null; screenshot_b: string | null; name: string }>(
      `/api/devices/${deviceId}/screenshot-compare`, { method: "POST", body: JSON.stringify({ other_device_id: otherDeviceId, name }) }
    ),
  getScreenshotComparisons: () =>
    fetchApi<{ comparisons: { id: number; name: string; device_id_a: string; device_id_b: string; created_at: string }[] }>("/api/screenshot-comparisons"),

  // Remote Debugging
  getDebugInfo: (deviceId: string) =>
    fetchApi<{ adb_connect: string; chrome_inspect: string; adb_forward: string; webrtc_url: string }>(`/api/devices/${deviceId}/debug-info`),

  // Automated Testing
  runMonkeyTest: (deviceId: string, packageName: string, eventCount: number = 500) =>
    fetchApi<{ success: boolean; output: string }>(`/api/devices/${deviceId}/test/monkey`, {
      method: "POST", body: JSON.stringify({ package: packageName, event_count: eventCount }),
    }),

  // Session Recording & Playback
  startInputRecording: (deviceId: string) =>
    fetchApi<{ success: boolean; message: string }>(`/api/devices/${deviceId}/input-recording/start`, { method: "POST" }),
  stopInputRecording: (deviceId: string) =>
    fetchApi<{ success: boolean; message: string }>(`/api/devices/${deviceId}/input-recording/stop`, { method: "POST" }),
  getInputRecording: (deviceId: string) =>
    fetchApi<{ events: string; line_count: number }>(`/api/devices/${deviceId}/input-recording`),
  replayInputRecording: (deviceId: string, events: string) =>
    fetchApi<{ success: boolean; message: string }>(`/api/devices/${deviceId}/input-recording/replay`, { method: "POST", body: JSON.stringify({ events }) }),
  getSessionRecordings: () =>
    fetchApi<{ recordings: { id: number; name: string; device_id: string; duration_seconds: number; created_at: string }[] }>("/api/session-recordings"),
  saveSessionRecording: (name: string, deviceId: string, eventsData: string, durationSeconds: number) =>
    fetchApi("/api/session-recordings", { method: "POST", body: JSON.stringify({ name, device_id: deviceId, events_data: eventsData, duration_seconds: durationSeconds }) }),
  getSessionRecording: (id: number) =>
    fetchApi<{ id: number; name: string; device_id: string; events_data: string; duration_seconds: number; created_at: string }>(`/api/session-recordings/${id}`),
  deleteSessionRecording: (id: number) =>
    fetchApi(`/api/session-recordings/${id}`, { method: "DELETE" }),

  // Custom Boot Animations & Branding
  getDeviceBranding: (deviceId: string) =>
    fetchApi<{ model: string; brand: string; manufacturer: string; device: string; bootanim: string }>(`/api/devices/${deviceId}/branding`),
  setDeviceBranding: (deviceId: string, brand: string, model: string, manufacturer: string) =>
    fetchApi(`/api/devices/${deviceId}/branding`, { method: "POST", body: JSON.stringify({ brand, model, manufacturer }) }),
  setBootAnimation: (deviceId: string, animation: string) =>
    fetchApi(`/api/devices/${deviceId}/boot-animation`, { method: "POST", body: JSON.stringify({ animation }) }),
  getBootAnimations: () =>
    fetchApi<{ animations: { id: string; name: string; description: string }[] }>("/api/boot-animations"),

  // Plugin / Extension System
  getPlugins: () =>
    fetchApi<{ plugins: { id: number; name: string; description: string; version: string; author: string; hook_events: string; config_schema: string; is_enabled: number; created_at: string }[] }>("/api/plugins"),
  registerPlugin: (name: string, description: string, version: string, author: string, hookEvents: string[]) =>
    fetchApi("/api/plugins", { method: "POST", body: JSON.stringify({ name, description, version, author, hook_events: hookEvents }) }),
  togglePlugin: (id: number) => fetchApi(`/api/plugins/${id}/toggle`, { method: "PUT" }),
  deletePlugin: (id: number) => fetchApi(`/api/plugins/${id}`, { method: "DELETE" }),
  updatePluginConfig: (id: number, config: Record<string, unknown>) =>
    fetchApi(`/api/plugins/${id}/config`, { method: "PUT", body: JSON.stringify({ config }) }),
  getPluginHooks: () =>
    fetchApi<{ hooks: { event: string; description: string }[] }>("/api/plugin-hooks"),

  // Smart Device Recommendations
  getRecommendations: (appCategory: string, targetAudience: string, budget: string) =>
    fetchApi<{ recommendations: { profile_name: string; android_version: string; reason: string; priority: string; config: { ram_mb: number; storage_gb: number; cpus: number } }[] }>(
      "/api/recommendations", { method: "POST", body: JSON.stringify({ app_category: appCategory, target_audience: targetAudience, budget }) }
    ),
  getRecommendationOptions: () =>
    fetchApi<{
      categories: { id: string; name: string; icon: string }[];
      audiences: { id: string; name: string }[];
      budgets: { id: string; name: string }[];
    }>("/api/recommendation-options"),

  // Live Collaboration
  getCollabUsers: (deviceId: string) =>
    fetchApi<{ users: number; cursors: Record<string, { x: number; y: number; color: string; name: string }> }>(`/api/collab/${deviceId}/users`),

  // Server
  getServerStatus: () => fetchApi<ServerStatus>("/api/server/status"),
  getAndroidVersions: () => fetchApi<AndroidVersion[]>("/api/android-versions"),
  getOsTypes: () => fetchApi<OSType[]>("/api/os-types"),
};
