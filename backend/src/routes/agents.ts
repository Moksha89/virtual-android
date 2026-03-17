import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { authenticateToken, authenticateAgent } from '../middleware/auth';
import { broadcastToClients } from '../services/websocket';
import { AgentDeviceInfo } from '../types';

const router = Router();

router.post('/register', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Agent name is required' });
      return;
    }

    const apiKey = `agent_${uuidv4().replace(/-/g, '')}`;

    const result = await pool.query(
      'INSERT INTO agents (name, api_key) VALUES ($1, $2) RETURNING id, name, api_key, status, created_at',
      [name, apiKey]
    );

    res.status(201).json({ agent: result.rows[0] });
  } catch (error) {
    console.error('Register agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT id, name, api_key, ip_address, status, last_heartbeat, system_info, created_at FROM agents ORDER BY created_at DESC'
    );
    res.json({ agents: result.rows });
  } catch (error) {
    console.error('List agents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/heartbeat', authenticateAgent, async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = req.agentId!;
    const { devices, system } = req.body as { devices: AgentDeviceInfo[]; system: Record<string, unknown> };

    const agentResult = await pool.query(
      `UPDATE agents SET
        status = 'online',
        last_heartbeat = NOW(),
        ip_address = $1,
        system_info = $2,
        updated_at = NOW()
      WHERE api_key = $3 RETURNING id, name`,
      [req.ip, JSON.stringify(system || {}), apiKey]
    );

    if (agentResult.rows.length === 0) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const agentId = agentResult.rows[0].id;

    if (devices && Array.isArray(devices)) {
      const reportedSerials = devices.map((d) => d.serial);

      if (reportedSerials.length > 0) {
        await pool.query(
          `UPDATE devices SET status = 'offline', updated_at = NOW()
           WHERE agent_id = $1 AND serial != ALL($2)`,
          [agentId, reportedSerials]
        );
      } else {
        await pool.query(
          `UPDATE devices SET status = 'offline', updated_at = NOW() WHERE agent_id = $1`,
          [agentId]
        );
      }

      for (const device of devices) {
        await pool.query(
          `INSERT INTO devices (agent_id, serial, model, manufacturer, android_version, sdk_version,
            battery_level, battery_status, screen_resolution, ip_address, status, last_seen, extra_info)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12)
          ON CONFLICT (agent_id, serial)
          DO UPDATE SET
            model = EXCLUDED.model,
            manufacturer = EXCLUDED.manufacturer,
            android_version = EXCLUDED.android_version,
            sdk_version = EXCLUDED.sdk_version,
            battery_level = EXCLUDED.battery_level,
            battery_status = EXCLUDED.battery_status,
            screen_resolution = EXCLUDED.screen_resolution,
            ip_address = EXCLUDED.ip_address,
            status = EXCLUDED.status,
            last_seen = NOW(),
            extra_info = EXCLUDED.extra_info,
            updated_at = NOW()`,
          [
            agentId,
            device.serial,
            device.model || null,
            device.manufacturer || null,
            device.android_version || null,
            device.sdk_version || null,
            device.battery_level || null,
            device.battery_status || null,
            device.screen_resolution || null,
            device.ip_address || null,
            device.status || 'online',
            JSON.stringify(device.extra_info || {}),
          ]
        );
      }
    }

    const allDevices = await pool.query(
      'SELECT * FROM devices WHERE agent_id = $1',
      [agentId]
    );

    broadcastToClients({
      type: 'devices:updated',
      data: { agent_id: agentId, devices: allDevices.rows },
    });

    res.json({ status: 'ok', agent_id: agentId });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Agent version check endpoint (no auth required - agent checks before full setup)
router.get('/check-update', async (req: Request, res: Response): Promise<void> => {
  try {
    const currentVersion = req.query.version as string;
    const platform = (req.query.platform as string) || 'win32';

    // Latest version info - update this when releasing new agent versions
    const latestVersion = process.env.AGENT_LATEST_VERSION || '1.1.0';
    const downloadUrl = process.env.AGENT_DOWNLOAD_URL ||
      `${req.protocol}://${req.get('host')}/downloads/Mobile%20Manager%20Agent%20Setup%20${latestVersion}.exe`;
    const releaseNotes = process.env.AGENT_RELEASE_NOTES ||
      'Auto-update support, live screen streaming, touch/swipe/keyboard control, performance improvements.';
    const mandatory = process.env.AGENT_UPDATE_MANDATORY === 'true';

    const hasUpdate = currentVersion ? latestVersion !== currentVersion &&
      compareVersions(latestVersion, currentVersion) > 0 : false;

    res.json({
      current_version: currentVersion || 'unknown',
      latest_version: latestVersion,
      has_update: hasUpdate,
      download_url: hasUpdate ? downloadUrl : null,
      release_notes: hasUpdate ? releaseNotes : null,
      mandatory: hasUpdate ? mandatory : false,
      platform,
    });
  } catch (error) {
    console.error('Check update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Simple semver comparison: returns >0 if a > b, <0 if a < b, 0 if equal
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

router.delete('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('DELETE FROM agents WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    res.json({ message: 'Agent deleted' });
  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
