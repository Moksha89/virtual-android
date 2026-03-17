const API_URL = import.meta.env.VITE_API_URL || '';

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ user: import('../types').User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, password: string, name: string) {
    return this.request<{ user: import('../types').User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async getMe() {
    return this.request<{ user: import('../types').User }>('/api/auth/me');
  }

  // Devices
  async getDevices() {
    return this.request<{ devices: import('../types').Device[] }>('/api/devices');
  }

  async getDevice(id: string) {
    return this.request<{ device: import('../types').Device }>(`/api/devices/${id}`);
  }

  async updateDevice(id: string, data: { nickname?: string; tags?: string[] }) {
    return this.request<{ device: import('../types').Device }>(`/api/devices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteDevice(id: string) {
    return this.request<{ message: string }>(`/api/devices/${id}`, {
      method: 'DELETE',
    });
  }

  async sendDeviceCommand(id: string, type: string, payload?: Record<string, unknown>) {
    return this.request<{ message: string }>(`/api/devices/${id}/command`, {
      method: 'POST',
      body: JSON.stringify({ type, payload }),
    });
  }

  async getDeviceLogs(id: string, limit = 50, offset = 0) {
    return this.request<{ logs: import('../types').DeviceLog[] }>(
      `/api/devices/${id}/logs?limit=${limit}&offset=${offset}`
    );
  }

  // Agents
  async getAgents() {
    return this.request<{ agents: import('../types').Agent[] }>('/api/agents');
  }

  async registerAgent(name: string) {
    return this.request<{ agent: import('../types').Agent }>('/api/agents/register', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async deleteAgent(id: string) {
    return this.request<{ message: string }>(`/api/agents/${id}`, {
      method: 'DELETE',
    });
  }

  // Sessions
  async createSession(deviceId: string) {
    return this.request<{ session: import('../types').Session }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId }),
    });
  }

  async getSessions(status?: string) {
    const query = status ? `?status=${status}` : '';
    return this.request<{ sessions: import('../types').Session[] }>(`/api/sessions${query}`);
  }

  async endSession(id: string) {
    return this.request<{ session: import('../types').Session }>(`/api/sessions/${id}/end`, {
      method: 'PATCH',
    });
  }

  // Health
  async getHealth() {
    return this.request<{ status: string; version: string; websocket_clients: number }>('/healthz');
  }
}

export const api = new ApiService();
export default api;
