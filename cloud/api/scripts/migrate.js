/**
 * Database Migration Script
 * 
 * Creates all tables from docs/database-schema.md
 * Run: npm run db:migrate
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const migrations = [
  {
    name: '001_create_organizations',
    sql: `
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('customer', 'internal')),
        billing_email VARCHAR(255),
        billing_address TEXT,
        billing_abn VARCHAR(50),
        contact_name VARCHAR(255),
        contact_email VARCHAR(255),
        contact_phone VARCHAR(50),
        payment_terms_days INTEGER DEFAULT 30,
        notes TEXT,
        tags JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );
      
      CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
      CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(type);
      CREATE INDEX IF NOT EXISTS idx_organizations_deleted ON organizations(deleted_at);
    `
  },
  
  {
    name: '002_create_sites',
    sql: `
      CREATE TABLE IF NOT EXISTS sites (
        id SERIAL PRIMARY KEY,
        org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        postcode VARCHAR(20),
        country VARCHAR(100) DEFAULT 'Australia',
        public_ip INET,
        lan_subnet CIDR,
        site_contact VARCHAR(255),
        site_phone VARCHAR(50),
        notes TEXT,
        tags JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(org_id, slug)
      );
      
      CREATE INDEX IF NOT EXISTS idx_sites_org ON sites(org_id);
      CREATE INDEX IF NOT EXISTS idx_sites_slug ON sites(slug);
    `
  },
  
  {
    name: '003_create_devices',
    sql: `
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
        site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
        hostname VARCHAR(255),
        device_name VARCHAR(255) NOT NULL,
        device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('scanner', 'server')),
        billing_type VARCHAR(20) NOT NULL CHECK (billing_type IN ('customer', 'internal')),
        environment VARCHAR(50),
        claim_code VARCHAR(12) UNIQUE,
        claim_code_expires_at TIMESTAMPTZ,
        fingerprint VARCHAR(64) UNIQUE,
        wg_public_key TEXT,
        wg_ip INET UNIQUE,
        local_ip INET,
        public_ip INET,
        mac_addresses TEXT[],
        manufacturer VARCHAR(255),
        model VARCHAR(255),
        serial_number VARCHAR(255),
        cpu_model VARCHAR(255),
        cpu_cores INTEGER,
        ram_gb INTEGER,
        disk_gb INTEGER,
        os_type VARCHAR(50),
        os_version VARCHAR(255),
        kernel_version VARCHAR(255),
        modules_enabled JSONB DEFAULT '{}',
        docker_present BOOLEAN DEFAULT false,
        lvm_present BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'offline', 'suspended')),
        enrolled_at TIMESTAMPTZ,
        last_seen_at TIMESTAMPTZ,
        uptime_seconds BIGINT,
        subscription_id INTEGER,
        notes TEXT,
        tags JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_devices_org ON devices(org_id);
      CREATE INDEX IF NOT EXISTS idx_devices_site ON devices(site_id);
      CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(device_type);
      CREATE INDEX IF NOT EXISTS idx_devices_billing_type ON devices(billing_type);
      CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
      CREATE INDEX IF NOT EXISTS idx_devices_claim_code ON devices(claim_code) WHERE claim_code IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_devices_wg_ip ON devices(wg_ip);
      CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON devices(fingerprint);
      CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen_at DESC);
    `
  },
  
  {
    name: '004_create_device_facts',
    sql: `
      CREATE TABLE IF NOT EXISTS device_facts (
        device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        facts JSONB NOT NULL,
        PRIMARY KEY (device_id, collected_at)
      );
      
      CREATE INDEX IF NOT EXISTS idx_device_facts_collected ON device_facts(collected_at DESC);
      CREATE INDEX IF NOT EXISTS idx_device_facts_facts_gin ON device_facts USING GIN(facts);
    `
  },
  
  {
    name: '005_create_heartbeats',
    sql: `
      CREATE TABLE IF NOT EXISTS heartbeats (
        device_id INTEGER PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
        timestamp TIMESTAMPTZ NOT NULL,
        uptime_seconds BIGINT,
        cpu_usage_percent NUMERIC(5,2),
        ram_usage_percent NUMERIC(5,2),
        ram_used_gb NUMERIC(10,2),
        ram_total_gb NUMERIC(10,2),
        filesystems JSONB,
        network_rx_bytes_per_sec BIGINT,
        network_tx_bytes_per_sec BIGINT,
        services JSONB,
        containers JSONB,
        scanner_stats JSONB,
        last_login_ips TEXT[],
        failed_login_count_24h INTEGER DEFAULT 0
      );
      
      CREATE INDEX IF NOT EXISTS idx_heartbeats_timestamp ON heartbeats(timestamp DESC);
    `
  },
  
  {
    name: '006_create_metrics_rollup',
    sql: `
      CREATE TABLE IF NOT EXISTS metrics_rollup (
        device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        time_bucket TIMESTAMPTZ NOT NULL,
        cpu_avg NUMERIC(5,2),
        cpu_max NUMERIC(5,2),
        ram_avg NUMERIC(5,2),
        ram_max NUMERIC(5,2),
        disk_root_avg NUMERIC(5,2),
        disk_root_max NUMERIC(5,2),
        network_rx_avg_mbps NUMERIC(10,2),
        network_tx_avg_mbps NUMERIC(10,2),
        sample_count INTEGER DEFAULT 1,
        PRIMARY KEY (device_id, time_bucket)
      );
      
      CREATE INDEX IF NOT EXISTS idx_metrics_rollup_time ON metrics_rollup(time_bucket DESC);
      CREATE INDEX IF NOT EXISTS idx_metrics_rollup_device_time ON metrics_rollup(device_id, time_bucket DESC);
    `
  },
  
  {
    name: '007_create_alert_rules',
    sql: `
      CREATE TABLE IF NOT EXISTS alert_rules (
        id SERIAL PRIMARY KEY,
        org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
        rule_type VARCHAR(50) NOT NULL,
        threshold_value NUMERIC(10,2),
        threshold_duration_seconds INTEGER DEFAULT 300,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
        enabled BOOLEAN DEFAULT true,
        notify_betterstack BOOLEAN DEFAULT true,
        betterstack_webhook_url TEXT,
        email_recipients TEXT[],
        cooldown_seconds INTEGER DEFAULT 3600,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_alert_rules_org ON alert_rules(org_id);
      CREATE INDEX IF NOT EXISTS idx_alert_rules_device ON alert_rules(device_id);
      CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
    `
  },
  
  {
    name: '008_create_alerts',
    sql: `
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
        rule_id INTEGER REFERENCES alert_rules(id) ON DELETE SET NULL,
        alert_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
        message TEXT NOT NULL,
        details JSONB,
        metric_name VARCHAR(100),
        metric_value NUMERIC(10,2),
        status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'muted')),
        notified_betterstack BOOLEAN DEFAULT false,
        betterstack_alert_id VARCHAR(255),
        acknowledged_by INTEGER REFERENCES users(id),
        acknowledged_at TIMESTAMPTZ,
        resolved_at TIMESTAMPTZ,
        resolution_note TEXT,
        fired_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_alerts_device ON alerts(device_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_org ON alerts(org_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
      CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_alerts_fired ON alerts(fired_at DESC);
    `
  },
  
  {
    name: '009_create_commands',
    sql: `
      CREATE TABLE IF NOT EXISTS commands (
        id SERIAL PRIMARY KEY,
        device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        command_type VARCHAR(50) NOT NULL,
        command_payload JSONB,
        command_signature TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'expired')),
        result JSONB,
        error_message TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        picked_up_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        ip_address INET,
        user_agent TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_commands_device ON commands(device_id);
      CREATE INDEX IF NOT EXISTS idx_commands_status ON commands(status);
      CREATE INDEX IF NOT EXISTS idx_commands_created ON commands(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_commands_expires ON commands(expires_at);
    `
  },
  
  {
    name: '010_create_users',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT,
        totp_secret TEXT,
        totp_enabled BOOLEAN DEFAULT false,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        avatar_url TEXT,
        role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'operator', 'read_only')),
        active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false,
        sso_provider VARCHAR(50),
        sso_subject VARCHAR(255),
        last_login_at TIMESTAMPTZ,
        last_login_ip INET,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
    `
  },
  
  {
    name: '011_create_audit_log',
    sql: `
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        user_email VARCHAR(255),
        user_role VARCHAR(20),
        ip_address INET,
        user_agent TEXT,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id VARCHAR(100),
        details JSONB,
        org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
        device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
        result VARCHAR(20) CHECK (result IN ('success', 'failure', 'partial')),
        error_message TEXT,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
      CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
    `
  },
  
  {
    name: '012_create_subscriptions',
    sql: `
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        plan_name VARCHAR(100) NOT NULL,
        plan_tier VARCHAR(50),
        billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'yearly')),
        price_cents INTEGER,
        currency VARCHAR(3) DEFAULT 'AUD',
        stripe_subscription_id VARCHAR(255),
        stripe_customer_id VARCHAR(255),
        start_date DATE NOT NULL,
        end_date DATE,
        next_payment_date DATE,
        trial_end_date DATE,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'paused')),
        payment_status VARCHAR(20) CHECK (payment_status IN ('paid', 'pending', 'failed')),
        max_devices INTEGER,
        max_scans_per_month INTEGER,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(org_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
    `
  },
  
  {
    name: '013_create_backups_catalog',
    sql: `
      CREATE TABLE IF NOT EXISTS backups_catalog (
        id SERIAL PRIMARY KEY,
        device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        backup_type VARCHAR(20) NOT NULL CHECK (backup_type IN ('file', 'full_disk')),
        backup_method VARCHAR(50),
        snapshot_id VARCHAR(255) NOT NULL,
        snapshot_name VARCHAR(255),
        storage_path TEXT NOT NULL,
        size_bytes BIGINT,
        compressed_size_bytes BIGINT,
        encrypted BOOLEAN DEFAULT true,
        encryption_key_id VARCHAR(255),
        status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'deleted')),
        started_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        duration_seconds INTEGER,
        last_verified_at TIMESTAMPTZ,
        restore_tested BOOLEAN DEFAULT false,
        expires_at TIMESTAMPTZ,
        file_count INTEGER,
        error_message TEXT,
        logs TEXT,
        UNIQUE(device_id, snapshot_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_backups_device ON backups_catalog(device_id);
      CREATE INDEX IF NOT EXISTS idx_backups_type ON backups_catalog(backup_type);
      CREATE INDEX IF NOT EXISTS idx_backups_status ON backups_catalog(status);
      CREATE INDEX IF NOT EXISTS idx_backups_started ON backups_catalog(started_at DESC);
    `
  },
  
  {
    name: '014_create_backup_configs',
    sql: `
      CREATE TABLE IF NOT EXISTS backup_configs (
        device_id INTEGER PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
        enabled BOOLEAN DEFAULT false,
        backup_mode VARCHAR(20) DEFAULT 'off' CHECK (backup_mode IN ('off', 'file', 'full_disk', 'hybrid')),
        schedule_cron VARCHAR(100) DEFAULT '0 2 * * 0',
        timezone VARCHAR(50) DEFAULT 'Australia/Sydney',
        retention_count INTEGER DEFAULT 4,
        retention_days INTEGER DEFAULT 30,
        full_disk_method VARCHAR(50) CHECK (full_disk_method IN ('recovery_usb', 'online_lvm')),
        require_reboot BOOLEAN DEFAULT true,
        storage_target VARCHAR(255),
        last_backup_at TIMESTAMPTZ,
        last_backup_status VARCHAR(20),
        next_scheduled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_backup_configs_enabled ON backup_configs(enabled);
      CREATE INDEX IF NOT EXISTS idx_backup_configs_next_scheduled ON backup_configs(next_scheduled_at);
    `
  },
  
  {
    name: '015_create_views',
    sql: `
      -- View: Devices with online status
      CREATE OR REPLACE VIEW devices_online AS
      SELECT 
        d.*,
        h.timestamp as last_heartbeat,
        CASE 
          WHEN h.timestamp > NOW() - INTERVAL '3 minutes' THEN true
          ELSE false
        END as is_online
      FROM devices d
      LEFT JOIN heartbeats h ON d.id = h.device_id
      WHERE d.status = 'active';
      
      -- View: Scanner summary
      CREATE OR REPLACE VIEW scanner_summary AS
      SELECT
        d.id as device_id,
        d.device_name,
        d.org_id,
        o.name as org_name,
        h.scanner_stats->>'tasks_total' as tasks_total,
        h.scanner_stats->>'scans_running' as scans_running,
        h.scanner_stats->>'scans_queued' as scans_queued,
        h.scanner_stats->>'vulns_critical' as vulns_critical,
        h.scanner_stats->>'vulns_high' as vulns_high,
        h.timestamp as last_update
      FROM devices d
      JOIN organizations o ON d.org_id = o.id
      LEFT JOIN heartbeats h ON d.id = h.device_id
      WHERE d.device_type = 'scanner'
        AND d.status = 'active';
    `
  }
];

async function runMigrations() {
  console.log('Starting database migrations...\n');
  
  try {
    for (const migration of migrations) {
      console.log(`Running: ${migration.name}`);
      await pool.query(migration.sql);
      console.log(`✓ ${migration.name} completed\n`);
    }
    
    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
