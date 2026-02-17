const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const logger = require('../utils/logger');

router.post('/:device_id', async (req, res) => {
  const client = await db.getClient();

  try {
    const { device_id } = req.params;
    const {
      enrollment_key,
      uptime_seconds,
      cpu_usage_percent,
      ram_usage_percent,
      ram_used_gb,
      ram_total_gb,
      filesystems,
      network_rx_bytes_per_sec,
      network_tx_bytes_per_sec,
      services,
      containers,
      scanner_stats,
      last_login_ips,
      failed_login_count_24h,
      public_ip
    } = req.body;

    const deviceResult = await client.query(
      'SELECT device_type FROM devices WHERE id = $1',
      [device_id]
    );

    if (deviceResult.rows.length === 0) {
      await client.rollback();
      return res.status(404).json({ error: 'Device not found' });
    }

    const device = deviceResult.rows[0];

    await client.query(
      `UPDATE devices SET 
        last_seen_at = NOW(),
        uptime_seconds = $1,
        public_ip = $2,
        updated_at = NOW()
       WHERE id = $3`,
      [uptime_seconds, public_ip, device_id]
    );

    await client.query(
      `INSERT INTO heartbeats (
        device_id, timestamp, uptime_seconds,
        cpu_usage_percent, ram_usage_percent, ram_used_gb, ram_total_gb,
        filesystems, network_rx_bytes_per_sec, network_tx_bytes_per_sec,
        services, containers, scanner_stats,
        last_login_ips, failed_login_count_24h
      ) VALUES (
        $1, NOW(), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      ON CONFLICT (device_id) DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        uptime_seconds = EXCLUDED.uptime_seconds,
        cpu_usage_percent = EXCLUDED.cpu_usage_percent,
        ram_usage_percent = EXCLUDED.ram_usage_percent,
        ram_used_gb = EXCLUDED.ram_used_gb,
        ram_total_gb = EXCLUDED.ram_total_gb,
        filesystems = EXCLUDED.filesystems,
        network_rx_bytes_per_sec = EXCLUDED.network_rx_bytes_per_sec,
        network_tx_bytes_per_sec = EXCLUDED.network_tx_bytes_per_sec,
        services = EXCLUDED.services,
        containers = EXCLUDED.containers,
        scanner_stats = EXCLUDED.scanner_stats,
        last_login_ips = EXCLUDED.last_login_ips,
        failed_login_count_24h = EXCLUDED.failed_login_count_24h`,
      [
        device_id,
        uptime_seconds,
        cpu_usage_percent,
        ram_usage_percent,
        ram_used_gb,
        ram_total_gb,
        JSON.stringify(filesystems || []),
        network_rx_bytes_per_sec,
        network_tx_bytes_per_sec,
        JSON.stringify(services || []),
        JSON.stringify(containers || []),
        device.device_type === 'scanner' ? JSON.stringify(scanner_stats || {}) : null,
        last_login_ips || [],
        failed_login_count_24h || 0
      ]
    );

    const timeBucket = new Date();
    timeBucket.setMinutes(Math.floor(timeBucket.getMinutes() / 5) * 5, 0, 0);

    await client.query(
      `INSERT INTO metrics_rollup (
        device_id, time_bucket, cpu_avg, ram_avg, disk_root_avg,
        network_rx_avg_mbps, network_tx_avg_mbps, sample_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
      ON CONFLICT (device_id, time_bucket) DO UPDATE SET
        cpu_avg = (metrics_rollup.cpu_avg * metrics_rollup.sample_count + EXCLUDED.cpu_avg) / (metrics_rollup.sample_count + 1),
        ram_avg = (metrics_rollup.ram_avg * metrics_rollup.sample_count + EXCLUDED.ram_avg) / (metrics_rollup.sample_count + 1),
        disk_root_avg = (metrics_rollup.disk_root_avg * metrics_rollup.sample_count + EXCLUDED.disk_root_avg) / (metrics_rollup.sample_count + 1),
        network_rx_avg_mbps = (metrics_rollup.network_rx_avg_mbps * metrics_rollup.sample_count + EXCLUDED.network_rx_avg_mbps) / (metrics_rollup.sample_count + 1),
        network_tx_avg_mbps = (metrics_rollup.network_tx_avg_mbps * metrics_rollup.sample_count + EXCLUDED.network_tx_avg_mbps) / (metrics_rollup.sample_count + 1),
        sample_count = metrics_rollup.sample_count + 1,
        cpu_max = GREATEST(metrics_rollup.cpu_max, EXCLUDED.cpu_avg),
        ram_max = GREATEST(metrics_rollup.ram_max, EXCLUDED.ram_avg),
        disk_root_max = GREATEST(metrics_rollup.disk_root_max, EXCLUDED.disk_root_avg)`,
      [
        device_id,
        timeBucket,
        cpu_usage_percent,
        ram_usage_percent,
        filesystems && filesystems.length > 0 ? (filesystems.find(f => f.mount === '/') || {}).used_percent || 0 : 0,
        (network_rx_bytes_per_sec || 0) / 1048576,
        (network_tx_bytes_per_sec || 0) / 1048576
      ]
    );

    await client.commit();

    if (enrollment_key && global.deviceRegistry) {
      global.deviceRegistry.set(enrollment_key, {
        id: device_id,
        cpu_usage_percent: cpu_usage_percent || 0,
        ram_usage_percent: ram_usage_percent || 0,
        uptime_seconds: uptime_seconds || 0,
        status: 'online',
        last_seen: new Date().toISOString()
      });
    }

    if (global.broadcastUpdate) {
      global.broadcastUpdate('device.heartbeat', {
        device_id,
        cpu: cpu_usage_percent,
        ram: ram_usage_percent,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Heartbeat received' });
  } catch (error) {
    try {
      await client.rollback();
    } catch (rollbackError) {
      logger.error('Heartbeat rollback failed', {
        device_id: req.params.device_id,
        error: rollbackError.message
      });
    }

    logger.error('Heartbeat processing error', {
      device_id: req.params.device_id,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: 'Failed to process heartbeat' });
  } finally {
    client.release();
  }
});

router.post('/:device_id/facts', async (req, res) => {
  try {
    const { device_id } = req.params;
    const facts = req.body;

    await db.query(
      `INSERT INTO device_facts (device_id, collected_at, facts)
       VALUES ($1, NOW(), $2)`,
      [device_id, JSON.stringify(facts)]
    );

    logger.info('Device facts received', { device_id, fact_keys: Object.keys(facts).length });

    res.json({ success: true, message: 'Facts stored' });
  } catch (error) {
    logger.error('Facts processing error', {
      device_id: req.params.device_id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to store facts' });
  }
});

module.exports = router;
