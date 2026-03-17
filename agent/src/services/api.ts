import fetch from 'node-fetch';

interface DeviceReport {
  serial: string;
  model?: string | null;
  manufacturer?: string | null;
  android_version?: string | null;
  sdk_version?: string | null;
  battery_level?: number | null;
  battery_status?: string | null;
  screen_resolution?: string | null;
  ip_address?: string | null;
  status: string;
}

export class ApiService {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async sendHeartbeat(
    devices: DeviceReport[],
    system: Record<string, unknown>
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/agents/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({ devices, system }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Heartbeat failed: ${response.status} - ${text}`);
    }
  }
}
