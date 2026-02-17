const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const db = require('../utils/database');

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        d.id,
        d.device_name,
        d.hostname,
        d.device_type,
        d.billing_type,
        d.environment,
        d.status,
        d.org_id,
        o.name AS org_name,
        d.site_id,
        s.name AS site_name,
        d.wg_ip,
        d.local_ip,
        d.public_ip,
        d.last_seen_at,
        d.uptime_seconds,
        h.cpu_usage_percent,
        h.ram_usage_percent
      FROM devices d
      LEFT JOIN organizations o ON d.org_id = o.id
      LEFT JOIN sites s ON d.site_id = s.id
      LEFT JOIN heartbeats h ON h.device_id = d.id
      WHERE d.deleted_at IS NULL
      ORDER BY o.name, s.name, d.device_name`
    );

    res.json({
      devices: result.rows
    });
  } catch (error) {
    logger.error('Error fetching devices', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        d.id,
        d.device_name,
        d.hostname,
        d.device_type,
        d.billing_type,
        d.environment,
        d.status,
        d.org_id,
        o.name AS org_name,
        d.site_id,
        s.name AS site_name,
        d.wg_ip,
        d.local_ip,
        d.public_ip,
        d.last_seen_at,
        d.uptime_seconds,
        h.cpu_usage_percent,
        h.ram_usage_percent,
        h.filesystems,
        h.services,
        h.containers,
        h.scanner_stats
      FROM devices d
      LEFT JOIN organizations o ON d.org_id = o.id
      LEFT JOIN sites s ON d.site_id = s.id
      LEFT JOIN heartbeats h ON h.device_id = d.id
      WHERE d.deleted_at IS NULL
        AND d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching device', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/lookup/by-key/:enrollment_key', async (req, res) => {
  try {
    const { enrollment_key } = req.params;

    const result = await db.query(
      `SELECT id, claim_code, status
       FROM devices
       WHERE claim_code = $1
         AND deleted_at IS NULL`,
      [enrollment_key]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Device not found for claim code' });
    }

    const device = result.rows[0];

    res.json({
      id: device.id,
      enrollment_key: device.claim_code,
      status: device.status
    });
  } catch (error) {
    logger.error('Error looking up device', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
