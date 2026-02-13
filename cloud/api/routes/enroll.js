/**
 * Device Enrollment Routes
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../utils/database');
const logger = require('../utils/logger');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

/**
 * POST /api/enroll
 * Enroll a new device using a claim code
 */
router.post('/', async (req, res) => {
  const client = await db.getClient();
  
  try {
    const {
      claim_code,
      hostname,
      wg_public_key,
      local_ip,
      mac_addresses,
      manufacturer,
      model,
      serial_number,
      cpu_model,
      cpu_cores,
      ram_gb,
      disk_gb,
      os_type,
      os_version,
      kernel_version,
      docker_present,
      lvm_present
    } = req.body;

    // Validate required fields
    if (!claim_code || !hostname || !wg_public_key) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await client.beginTransaction();

    // Find device by claim code
    const deviceResult = await client.query(
      `SELECT d.*, o.name as org_name, s.name as site_name
       FROM devices d
       LEFT JOIN organizations o ON d.org_id = o.id
       LEFT JOIN sites s ON d.site_id = s.id
       WHERE d.claim_code = $1
         AND d.status = 'pending'
         AND d.claim_code_expires_at > NOW()`,
      [claim_code]
    );

    if (deviceResult.rows.length === 0) {
      await client.rollback();
      return res.status(404).json({ error: 'Invalid or expired claim code' });
    }

    const device = deviceResult.rows[0];

    // Generate hardware fingerprint
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${serial_number}|${mac_addresses}|${manufacturer}|${model}`)
      .digest('hex');

    // Check for duplicate fingerprint (prevent re-enrollment)
    const duplicateCheck = await client.query(
      'SELECT id FROM devices WHERE fingerprint = $1 AND id != $2',
      [fingerprint, device.id]
    );

    if (duplicateCheck.rows.length > 0) {
      await client.rollback();
      return res.status(409).json({
        error: 'Device already enrolled',
        device_id: duplicateCheck.rows[0].id
      });
    }

    // Allocate WireGuard IP
    // Customer devices: 10.10.0.20-99
    // Internal devices: 10.10.0.10-19
    const ipRangeStart = device.billing_type === 'internal' ? 10 : 20;
    const ipRangeEnd = device.billing_type === 'internal' ? 19 : 99;

    const ipResult = await client.query(
      `SELECT wg_ip FROM devices 
       WHERE wg_ip IS NOT NULL
       ORDER BY wg_ip DESC
       LIMIT 1`
    );

    let wg_ip;
    if (ipResult.rows.length === 0) {
      wg_ip = `10.10.0.${ipRangeStart}`;
    } else {
      const lastIp = ipResult.rows[0].wg_ip;
      const lastOctet = parseInt(lastIp.split('.')[3]);
      const nextOctet = lastOctet + 1;

      if (nextOctet > ipRangeEnd) {
        await client.rollback();
        return res.status(507).json({ error: 'No available IP addresses in range' });
      }

      wg_ip = `10.10.0.${nextOctet}`;
    }

    // Update device record with hardware info
    await client.query(
      `UPDATE devices SET
        hostname = $1,
        wg_public_key = $2,
        wg_ip = $3,
        local_ip = $4,
        mac_addresses = $5,
        manufacturer = $6,
        model = $7,
        serial_number = $8,
        fingerprint = $9,
        cpu_model = $10,
        cpu_cores = $11,
        ram_gb = $12,
        disk_gb = $13,
        os_type = $14,
        os_version = $15,
        kernel_version = $16,
        docker_present = $17,
        lvm_present = $18,
        status = 'active',
        enrolled_at = NOW(),
        updated_at = NOW()
      WHERE id = $19`,
      [
        hostname, wg_public_key, wg_ip, local_ip, mac_addresses ? mac_addresses.split(',') : [],
        manufacturer, model, serial_number, fingerprint,
        cpu_model, cpu_cores, ram_gb, disk_gb,
        os_type, os_version, kernel_version,
        docker_present, lvm_present,
        device.id
      ]
    );

    // Add WireGuard peer to server
    const wgConfig = `
[Peer]
PublicKey = ${wg_public_key}
AllowedIPs = ${wg_ip}/32
PersistentKeepalive = 25
`;

    // Add peer to WireGuard
    try {
      await execAsync(`wg set wg0 peer ${wg_public_key} allowed-ips ${wg_ip}/32 persistent-keepalive 25`);
      await execAsync('wg-quick save wg0');
      logger.info('WireGuard peer added', { device_id: device.id, wg_ip, wg_public_key });
    } catch (error) {
      logger.error('Failed to add WireGuard peer', { error: error.message, device_id: device.id });
      await client.rollback();
      return res.status(500).json({ error: 'Failed to configure WireGuard peer' });
    }

    // Create initial heartbeat record
    await client.query(
      `INSERT INTO heartbeats (device_id, timestamp, uptime_seconds)
       VALUES ($1, NOW(), 0)
       ON CONFLICT (device_id) DO NOTHING`,
      [device.id]
    );

    await client.commit();

    // Broadcast device enrollment
    if (global.broadcastUpdate) {
      global.broadcastUpdate('device.enrolled', {
        device_id: device.id,
        device_name: device.device_name,
        org_name: device.org_name,
        wg_ip
      });
    }

    logger.info('Device enrolled successfully', {
      device_id: device.id,
      device_name: device.device_name,
      hostname,
      wg_ip,
      fingerprint
    });

    // Return enrollment details
    res.json({
      success: true,
      device_id: device.id,
      device_name: device.device_name,
      wg_ip,
      wg_server_public_key: process.env.WIREGUARD_PUBLIC_KEY,
      wg_server_endpoint: `${process.env.CLOUD_PUBLIC_IP}:51820`,
      api_url: process.env.CLOUD_DOMAIN || process.env.CLOUD_PUBLIC_IP,
      heartbeat_interval: 60,
      message: 'Enrollment successful'
    });

  } catch (error) {
    await client.rollback();
    logger.error('Enrollment error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Enrollment failed', details: error.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/enroll/validate/:claim_code
 * Validate a claim code (optional, for pre-validation UI)
 */
router.get('/validate/:claim_code', async (req, res) => {
  try {
    const { claim_code } = req.params;

    const result = await db.query(
      `SELECT d.id, d.device_name, d.device_type, o.name as org_name, s.name as site_name
       FROM devices d
       LEFT JOIN organizations o ON d.org_id = o.id
       LEFT JOIN sites s ON d.site_id = s.id
       WHERE d.claim_code = $1
         AND d.status = 'pending'
         AND d.claim_code_expires_at > NOW()`,
      [claim_code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ valid: false, error: 'Invalid or expired claim code' });
    }

    const device = result.rows[0];
    res.json({
      valid: true,
      device_name: device.device_name,
      device_type: device.device_type,
      org_name: device.org_name,
      site_name: device.site_name
    });

  } catch (error) {
    logger.error('Claim code validation error', { error: error.message });
    res.status(500).json({ error: 'Validation failed' });
  }
});

module.exports = router;
