import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { broadcastToClients } from '../services/websocket';

const router = Router();

router.get('/', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT d.*, a.name as agent_name, a.status as agent_status
      FROM devices d
      LEFT JOIN agents a ON d.agent_id = a.id
      ORDER BY d.status DESC, d.last_seen DESC NULLS LAST
    `);
    res.json({ devices: result.rows });
  } catch (error) {
    console.error('List devices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT d.*, a.name as agent_name, a.status as agent_status
      FROM devices d
      LEFT JOIN agents a ON d.agent_id = a.id
      WHERE d.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    res.json({ device: result.rows[0] });
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { nickname, tags } = req.body;
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (nickname !== undefined) {
      updates.push(`nickname = $${paramIndex++}`);
      values.push(nickname);
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(tags);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE devices SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    res.json({ device: result.rows[0] });
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('DELETE FROM devices WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    broadcastToClients({ type: 'device:removed', data: { id: req.params.id } });
    res.json({ message: 'Device deleted' });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/command', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, payload } = req.body;

    if (!type) {
      res.status(400).json({ error: 'Command type is required' });
      return;
    }

    const deviceResult = await pool.query(
      'SELECT d.*, a.api_key FROM devices d JOIN agents a ON d.agent_id = a.id WHERE d.id = $1',
      [req.params.id]
    );

    if (deviceResult.rows.length === 0) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const device = deviceResult.rows[0];

    broadcastToClients({
      type: 'device:command',
      data: {
        device_id: device.id,
        agent_id: device.agent_id,
        serial: device.serial,
        command: { type, payload },
      },
    });

    await pool.query(
      'INSERT INTO device_logs (device_id, agent_id, level, message, metadata) VALUES ($1, $2, $3, $4, $5)',
      [device.id, device.agent_id, 'info', `Command sent: ${type}`, JSON.stringify({ type, payload })]
    );

    res.json({ message: 'Command sent', command: { type, payload } });
  } catch (error) {
    console.error('Send command error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/logs', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await pool.query(
      'SELECT * FROM device_logs WHERE device_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.params.id, limit, offset]
    );

    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Get device logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
