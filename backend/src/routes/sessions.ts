import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { device_id } = req.body;

    if (!device_id) {
      res.status(400).json({ error: 'device_id is required' });
      return;
    }

    const deviceResult = await pool.query('SELECT id, status FROM devices WHERE id = $1', [device_id]);
    if (deviceResult.rows.length === 0) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const activeSession = await pool.query(
      "SELECT id FROM sessions WHERE device_id = $1 AND status = 'active'",
      [device_id]
    );

    if (activeSession.rows.length > 0) {
      res.status(409).json({ error: 'Device already has an active session', session_id: activeSession.rows[0].id });
      return;
    }

    const result = await pool.query(
      'INSERT INTO sessions (device_id, user_id) VALUES ($1, $2) RETURNING *',
      [device_id, req.user!.userId]
    );

    res.status(201).json({ session: result.rows[0] });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string;
    let query = `
      SELECT s.*, d.serial, d.model, d.manufacturer
      FROM sessions s
      JOIN devices d ON s.device_id = d.id
    `;
    const values: unknown[] = [];

    if (status) {
      query += ' WHERE s.status = $1';
      values.push(status);
    }

    query += ' ORDER BY s.started_at DESC LIMIT 100';

    const result = await pool.query(query, values);
    res.json({ sessions: result.rows });
  } catch (error) {
    console.error('List sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/end', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      "UPDATE sessions SET status = 'ended', ended_at = NOW() WHERE id = $1 AND status = 'active' RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Active session not found' });
      return;
    }

    res.json({ session: result.rows[0] });
  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
