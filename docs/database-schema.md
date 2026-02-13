# Database Schema - xSPECTRE Ops Console

PostgreSQL 14+ schema for the complete platform.

---

## Schema Design Principles

- **Normalized**: Minimal data redundancy
- **Auditable**: Full history tracking
- **Scalable**: Indexed for performance at 50–500 devices
- **Time-series aware**: Metrics use partitioning strategy
- **Multi-tenant**: Org-based isolation

---

## Core Tables

### 1. `organizations`

Customer companies + internal infrastructure.

```sql
CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- URL-friendly identifier
    type VARCHAR(20) NOT NULL CHECK (type IN ('customer', 'internal')),
    
    -- Contact info
    billing_email VARCHAR(255),
    technical_email VARCHAR(255),
    phone VARCHAR(50),
    
    -- Address (optional)
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(2), -- ISO 3166-1 alpha-2
    
    -- Business info (customer only)
    abn VARCHAR(50), -- Australian Business Number
    tax_id VARCHAR(100),
    
    -- Metadata
    notes TEXT,
    tags JSONB DEFAULT '[]',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Soft delete
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_orgs_type ON organizations(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_orgs_slug ON organizations(slug) WHERE deleted_at IS NULL;
```

### 2. `sites`

Physical locations under an organization.

```sql
CREATE TABLE sites (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    
    -- Location
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(2),
    
    -- Network info
    public_ip INET,
    lan_subnet CIDR,
    
    -- Contact
    site_contact_name VARCHAR(255),
    site_contact_email VARCHAR(255),
    site_contact_phone VARCHAR(50),
    
    -- Metadata
    notes TEXT,
    tags JSONB DEFAULT '[]',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    UNIQUE(org_id, slug)
);

CREATE INDEX idx_sites_org ON sites(org_id) WHERE deleted_at IS NULL;
```

### 3. `devices`

Scanners and servers (the core inventory).

```sql
CREATE TABLE devices (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
    
    -- Identity
    hostname VARCHAR(255) NOT NULL,
    device_name VARCHAR(255), -- Friendly name
    
    -- Type & role
    device_type VARCHAR(20) NOT NULL CHECK (device_type IN ('scanner', 'server')),
    billing_type VARCHAR(20) NOT NULL CHECK (billing_type IN ('customer', 'internal')),
    environment VARCHAR(20) DEFAULT 'production' CHECK (environment IN ('production', 'staging', 'development', 'internal')),
    
    -- Enrollment
    claim_code VARCHAR(64) UNIQUE, -- One-time use during enrollment
    claim_code_expires_at TIMESTAMPTZ,
    enrolled_at TIMESTAMPTZ,
    
    -- Hardware fingerprint (SHA256 hash)
    fingerprint VARCHAR(64) UNIQUE,
    
    -- Network
    wg_ip INET UNIQUE, -- WireGuard IP (10.10.0.x)
    wg_public_key TEXT,
    local_ip INET,
    public_ip INET,
    mac_addresses TEXT[], -- Array of MAC addresses
    
    -- Hardware info
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    serial_number VARCHAR(255),
    cpu_model VARCHAR(255),
    cpu_cores INTEGER,
    ram_gb INTEGER,
    disk_gb INTEGER,
    
    -- OS info
    os_type VARCHAR(50), -- debian, ubuntu, centos, almalinux, custom
    os_version VARCHAR(100),
    kernel_version VARCHAR(100),
    
    -- Capabilities
    modules_enabled JSONB DEFAULT '["monitoring"]', -- Array of enabled modules
    docker_present BOOLEAN DEFAULT FALSE,
    lvm_present BOOLEAN DEFAULT FALSE, -- For online full backups
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'offline', 'suspended', 'decommissioned')),
    last_seen_at TIMESTAMPTZ,
    uptime_seconds BIGINT,
    
    -- Subscription (nullable for internal devices)
    subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
    
    -- Metadata
    notes TEXT,
    tags JSONB DEFAULT '[]',
    custom_fields JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_devices_org ON devices(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_devices_site ON devices(site_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_devices_type ON devices(device_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_devices_billing ON devices(billing_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_devices_status ON devices(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_devices_wg_ip ON devices(wg_ip) WHERE deleted_at IS NULL;
CREATE INDEX idx_devices_last_seen ON devices(last_seen_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_devices_claim_code ON devices(claim_code) WHERE claim_code IS NOT NULL;
```

### 4. `device_facts`

Hardware/software inventory snapshots (historical).

```sql
CREATE TABLE device_facts (
    id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    
    -- Snapshot of all facts
    facts JSONB NOT NULL,
    
    -- Examples of what goes in facts JSONB:
    -- {
    --   "hostname": "scanner-a1",
    --   "os": {...},
    --   "cpu": {...},
    --   "memory": {...},
    --   "disks": [...],
    --   "network_interfaces": [...],
    --   "installed_packages": [...],
    --   "docker_version": "24.0.7",
    --   "greenbone_version": "22.4" (scanner only)
    -- }
    
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_facts_device ON device_facts(device_id, collected_at DESC);
CREATE INDEX idx_device_facts_gin ON device_facts USING GIN(facts); -- For JSON queries
```

### 5. `heartbeats`

Latest heartbeat from each device (overwritten, not historical).

```sql
CREATE TABLE heartbeats (
    device_id INTEGER PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    
    -- Timing
    timestamp TIMESTAMPTZ NOT NULL,
    uptime_seconds BIGINT,
    
    -- System metrics (latest)
    cpu_usage_percent NUMERIC(5,2),
    ram_usage_percent NUMERIC(5,2),
    ram_used_gb NUMERIC(10,2),
    ram_total_gb NUMERIC(10,2),
    
    -- Filesystem usage (array of objects)
    filesystems JSONB,
    -- Example:
    -- [
    --   {"mount": "/", "size_gb": 100, "used_gb": 62, "used_percent": 62.0},
    --   {"mount": "/var", "size_gb": 50, "used_gb": 35, "used_percent": 70.0}
    -- ]
    
    -- Network
    network_rx_bytes_per_sec BIGINT,
    network_tx_bytes_per_sec BIGINT,
    
    -- Services status
    services JSONB,
    -- Example:
    -- [
    --   {"name": "docker", "status": "active", "enabled": true},
    --   {"name": "wazuh-agent", "status": "active", "enabled": true},
    --   {"name": "gvmd", "status": "active", "enabled": true}
    -- ]
    
    -- Docker containers (if docker present)
    containers JSONB,
    -- Example:
    -- [
    --   {"name": "gvmd", "status": "running", "restarts": 0, "cpu_percent": 2.1, "mem_mb": 450},
    --   {"name": "ospd-openvas", "status": "running", "restarts": 1, "cpu_percent": 8.3, "mem_mb": 1200}
    -- ]
    
    -- Scanner stats (scanner devices only)
    scanner_stats JSONB,
    -- Example:
    -- {
    --   "tasks_total": 24,
    --   "scans_running": 3,
    --   "scans_queued": 1,
    --   "last_scan_at": "2024-01-15T10:30:00Z",
    --   "feed_updated_at": "2024-01-14T02:00:00Z"
    -- }
    
    -- Security events
    last_login_ips TEXT[],
    failed_login_count_24h INTEGER DEFAULT 0,
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_heartbeats_timestamp ON heartbeats(timestamp DESC);
```

### 6. `metrics_rollup`

Historical metrics (time-series data, partitioned by time).

```sql
CREATE TABLE metrics_rollup (
    id BIGSERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    
    -- Time bucket (5-minute intervals recommended)
    time_bucket TIMESTAMPTZ NOT NULL,
    
    -- Aggregated metrics
    cpu_avg NUMERIC(5,2),
    cpu_max NUMERIC(5,2),
    ram_avg NUMERIC(5,2),
    ram_max NUMERIC(5,2),
    disk_root_avg NUMERIC(5,2),
    disk_root_max NUMERIC(5,2),
    
    network_rx_avg_mbps NUMERIC(10,2),
    network_tx_avg_mbps NUMERIC(10,2),
    
    -- Sample count in bucket
    sample_count INTEGER DEFAULT 1,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_metrics_device_time ON metrics_rollup(device_id, time_bucket DESC);
-- Partition by month for better performance
-- Consider TimescaleDB hypertable for production
```

### 7. `service_status`

Service status snapshots (updated on heartbeat).

```sql
CREATE TABLE service_status (
    id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL,
    
    -- Status
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'inactive', 'failed', 'unknown')),
    enabled BOOLEAN,
    
    -- Details
    pid INTEGER,
    memory_mb INTEGER,
    uptime_seconds INTEGER,
    
    -- Timestamps
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status_changed_at TIMESTAMPTZ,
    
    UNIQUE(device_id, service_name)
);

CREATE INDEX idx_service_status_device ON service_status(device_id);
CREATE INDEX idx_service_status_name ON service_status(service_name);
CREATE INDEX idx_service_status_failed ON service_status(device_id) WHERE status = 'failed';
```

### 8. `docker_containers`

Docker container tracking.

```sql
CREATE TABLE docker_containers (
    id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    
    -- Container identity
    container_id VARCHAR(64) NOT NULL, -- Short Docker ID
    container_name VARCHAR(255) NOT NULL,
    image_name VARCHAR(255),
    image_tag VARCHAR(100),
    
    -- Status
    status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'exited', 'paused', 'restarting', 'dead')),
    restart_count INTEGER DEFAULT 0,
    
    -- Resources
    cpu_percent NUMERIC(5,2),
    mem_mb INTEGER,
    
    -- Timestamps
    started_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(device_id, container_name)
);

CREATE INDEX idx_containers_device ON docker_containers(device_id);
CREATE INDEX idx_containers_status ON docker_containers(status);
```

### 9. `scanner_stats`

Scanner-specific statistics (Greenbone).

```sql
CREATE TABLE scanner_stats (
    id SERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    
    -- Task & scan counts
    tasks_total INTEGER DEFAULT 0,
    scans_running INTEGER DEFAULT 0,
    scans_queued INTEGER DEFAULT 0,
    scans_completed_24h INTEGER DEFAULT 0,
    
    -- Feed status
    feed_updated_at TIMESTAMPTZ,
    nvt_count INTEGER,
    
    -- Vulnerability summary (from last report)
    vulns_critical INTEGER DEFAULT 0,
    vulns_high INTEGER DEFAULT 0,
    vulns_medium INTEGER DEFAULT 0,
    vulns_low INTEGER DEFAULT 0,
    
    -- Top vulnerabilities (cached)
    top_vulns JSONB,
    -- Example:
    -- [
    --   {"cve": "CVE-2024-1234", "severity": 9.8, "affected_hosts": 12, "title": "..."},
    --   ...
    -- ]
    
    -- Timestamps
    collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(device_id, collected_at)
);

CREATE INDEX idx_scanner_stats_device ON scanner_stats(device_id, collected_at DESC);
```

---

## Subscription & Billing

### 10. `subscriptions`

Customer device subscriptions (null for internal devices).

```sql
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Plan
    plan_name VARCHAR(100) NOT NULL, -- "Basic", "Pro", "Enterprise"
    plan_tier VARCHAR(50), -- Custom tier naming
    
    -- Billing
    billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'yearly', 'one-time')),
    price_cents INTEGER, -- In cents to avoid float issues
    currency VARCHAR(3) DEFAULT 'AUD',
    
    -- Payment provider
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    
    -- Dates
    start_date DATE NOT NULL,
    end_date DATE,
    next_payment_date DATE,
    trial_end_date DATE,
    
    -- Status
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid')),
    payment_status VARCHAR(20) CHECK (payment_status IN ('paid', 'pending', 'failed', 'refunded')),
    
    -- Limits (optional per-subscription)
    max_devices INTEGER,
    max_scans_per_month INTEGER,
    
    -- Metadata
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    canceled_at TIMESTAMPTZ
);

CREATE INDEX idx_subscriptions_org ON subscriptions(org_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_next_payment ON subscriptions(next_payment_date) WHERE status = 'active';
```

---

## Alerting

### 11. `alert_rules`

Alert rule definitions.

```sql
CREATE TABLE alert_rules (
    id SERIAL PRIMARY KEY,
    
    -- Scope
    org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = global
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE, -- NULL = org-wide
    
    -- Rule definition
    rule_type VARCHAR(50) NOT NULL, -- "cpu_high", "disk_full", "service_down", "device_offline", etc.
    
    -- Thresholds
    threshold_value NUMERIC(10,2),
    threshold_duration_seconds INTEGER DEFAULT 300, -- How long condition must persist
    
    -- Severity
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    
    -- Actions
    enabled BOOLEAN DEFAULT TRUE,
    notify_betterstack BOOLEAN DEFAULT TRUE,
    betterstack_webhook_url TEXT,
    email_recipients TEXT[],
    
    -- Deduplication
    cooldown_seconds INTEGER DEFAULT 3600, -- Don't re-alert for 1 hour
    
    -- Metadata
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alert_rules_org ON alert_rules(org_id) WHERE enabled = TRUE;
CREATE INDEX idx_alert_rules_device ON alert_rules(device_id) WHERE enabled = TRUE;
CREATE INDEX idx_alert_rules_type ON alert_rules(rule_type) WHERE enabled = TRUE;
```

### 12. `alerts`

Alert instances (fired alerts).

```sql
CREATE TABLE alerts (
    id BIGSERIAL PRIMARY KEY,
    
    -- Source
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rule_id INTEGER REFERENCES alert_rules(id) ON DELETE SET NULL,
    
    -- Alert details
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    
    -- Metric snapshot
    metric_name VARCHAR(100),
    metric_value NUMERIC(10,2),
    
    -- Status
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'muted')),
    
    -- Actions taken
    notified_betterstack BOOLEAN DEFAULT FALSE,
    betterstack_alert_id VARCHAR(255),
    
    -- Resolution
    acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_note TEXT,
    
    -- Timestamps
    fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_device ON alerts(device_id, fired_at DESC);
CREATE INDEX idx_alerts_org ON alerts(org_id, fired_at DESC);
CREATE INDEX idx_alerts_status ON alerts(status, fired_at DESC);
CREATE INDEX idx_alerts_severity ON alerts(severity) WHERE status = 'open';
```

---

## Backups

### 13. `backups_catalog`

Backup snapshot inventory.

```sql
CREATE TABLE backups_catalog (
    id BIGSERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    
    -- Backup type
    backup_type VARCHAR(20) NOT NULL CHECK (backup_type IN ('file', 'full_disk')),
    backup_method VARCHAR(50), -- "restic", "recovery_usb", "lvm_snapshot"
    
    -- Snapshot info
    snapshot_id VARCHAR(255) NOT NULL, -- UUID or restic snapshot ID
    snapshot_name VARCHAR(255),
    
    -- Storage
    storage_path TEXT NOT NULL,
    size_bytes BIGINT,
    compressed_size_bytes BIGINT,
    
    -- Encryption
    encrypted BOOLEAN DEFAULT TRUE,
    encryption_key_id VARCHAR(100), -- Reference to key vault
    
    -- Status
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'deleted')),
    
    -- Timing
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    
    -- Restore info
    last_verified_at TIMESTAMPTZ,
    restore_tested BOOLEAN DEFAULT FALSE,
    
    -- Retention
    expires_at TIMESTAMPTZ,
    
    -- Metadata
    file_count INTEGER,
    error_message TEXT,
    logs TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_backups_device ON backups_catalog(device_id, started_at DESC);
CREATE INDEX idx_backups_type ON backups_catalog(backup_type);
CREATE INDEX idx_backups_status ON backups_catalog(status);
CREATE INDEX idx_backups_expires ON backups_catalog(expires_at) WHERE status = 'completed';
```

### 14. `backup_configs`

Per-device backup configuration.

```sql
CREATE TABLE backup_configs (
    device_id INTEGER PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    
    -- Mode
    enabled BOOLEAN DEFAULT FALSE,
    backup_mode VARCHAR(20) CHECK (backup_mode IN ('off', 'file', 'full_disk', 'hybrid')),
    
    -- Schedule
    schedule_cron VARCHAR(100), -- e.g., "0 2 * * *" (daily at 2am)
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Retention
    retention_count INTEGER DEFAULT 7, -- Keep last N backups
    retention_days INTEGER, -- Or by days
    
    -- Full disk options
    full_disk_method VARCHAR(50) CHECK (full_disk_method IN ('recovery_usb', 'online_lvm')),
    require_reboot BOOLEAN DEFAULT TRUE, -- For recovery_usb
    
    -- Storage target
    storage_target VARCHAR(100) DEFAULT 'default', -- "default", "backup-server-a", etc.
    
    -- Metadata
    last_backup_at TIMESTAMPTZ,
    last_backup_status VARCHAR(20),
    next_scheduled_at TIMESTAMPTZ,
    
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Remote Commands & Actions

### 15. `commands`

Command queue for remote actions.

```sql
CREATE TABLE commands (
    id BIGSERIAL PRIMARY KEY,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    
    -- Command
    command_type VARCHAR(50) NOT NULL, -- "reboot", "change_hostname", "reset_config", "boot_recovery", etc.
    command_payload JSONB, -- Parameters for the command
    
    -- Signature (for security)
    command_signature TEXT,
    expires_at TIMESTAMPTZ NOT NULL, -- Commands expire after 5 minutes
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'expired', 'canceled')),
    
    -- Result
    result JSONB,
    error_message TEXT,
    
    -- Timing
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    picked_up_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Audit
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX idx_commands_device_status ON commands(device_id, status);
CREATE INDEX idx_commands_created ON commands(created_at DESC);
CREATE INDEX idx_commands_expires ON commands(expires_at) WHERE status = 'pending';
```

---

## User Management & Audit

### 16. `users`

Internal operators/admins.

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    
    -- Identity
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    
    -- Auth (if not using SSO)
    password_hash VARCHAR(255),
    totp_secret VARCHAR(64), -- For 2FA
    totp_enabled BOOLEAN DEFAULT FALSE,
    
    -- Profile
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    
    -- Role
    role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'operator', 'read_only')),
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    
    -- SSO (optional)
    sso_provider VARCHAR(50), -- "azure", "google"
    sso_subject VARCHAR(255),
    
    -- Session
    last_login_at TIMESTAMPTZ,
    last_login_ip INET,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email) WHERE active = TRUE;
CREATE INDEX idx_users_role ON users(role) WHERE active = TRUE;
```

### 17. `audit_log`

Comprehensive audit trail.

```sql
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    
    -- Who
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    user_role VARCHAR(20),
    ip_address INET,
    user_agent TEXT,
    
    -- What
    action VARCHAR(100) NOT NULL, -- "device.reboot", "backup.restore", "alert.acknowledge", "password.change"
    resource_type VARCHAR(50), -- "device", "backup", "alert", "subscription", etc.
    resource_id VARCHAR(100),
    
    -- Details
    details JSONB,
    
    -- Where
    org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
    
    -- Result
    result VARCHAR(20) CHECK (result IN ('success', 'failure', 'partial')),
    error_message TEXT,
    
    -- Timing
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id, timestamp DESC);
CREATE INDEX idx_audit_device ON audit_log(device_id, timestamp DESC);
CREATE INDEX idx_audit_action ON audit_log(action, timestamp DESC);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);

-- Partition by month for performance
-- Example: audit_log_2024_01, audit_log_2024_02, etc.
```

---

## Helper Tables

### 18. `api_keys` (optional)

For agent authentication (if not using device certs).

```sql
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    device_id INTEGER UNIQUE REFERENCES devices(id) ON DELETE CASCADE,
    
    -- Key
    key_hash VARCHAR(64) NOT NULL, -- SHA256 of actual key
    key_prefix VARCHAR(16), -- First few chars for identification
    
    -- Permissions
    scopes TEXT[] DEFAULT '["heartbeat", "command.poll"]',
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_active ON api_keys(key_hash) WHERE active = TRUE;
```

---

## Views (Convenience)

### Device Online Status

```sql
CREATE VIEW devices_online AS
SELECT 
    d.*,
    h.timestamp AS last_heartbeat,
    CASE 
        WHEN h.timestamp > NOW() - INTERVAL '3 minutes' THEN TRUE
        ELSE FALSE
    END AS is_online,
    EXTRACT(EPOCH FROM (NOW() - h.timestamp)) AS seconds_since_heartbeat
FROM devices d
LEFT JOIN heartbeats h ON h.device_id = d.id
WHERE d.deleted_at IS NULL;
```

### Scanner Summary

```sql
CREATE VIEW scanner_summary AS
SELECT 
    d.id AS device_id,
    d.device_name,
    d.org_id,
    o.name AS org_name,
    d.status,
    h.timestamp AS last_seen,
    ss.scans_running,
    ss.scans_queued,
    ss.vulns_critical,
    ss.vulns_high
FROM devices d
JOIN organizations o ON o.id = d.org_id
LEFT JOIN heartbeats h ON h.device_id = d.id
LEFT JOIN LATERAL (
    SELECT * FROM scanner_stats
    WHERE device_id = d.id
    ORDER BY collected_at DESC
    LIMIT 1
) ss ON TRUE
WHERE d.device_type = 'scanner'
  AND d.deleted_at IS NULL;
```

---

## Database Maintenance

### Retention Policies

```sql
-- Metrics: Keep 3 months of 5-min rollups
DELETE FROM metrics_rollup 
WHERE time_bucket < NOW() - INTERVAL '3 months';

-- Audit log: Keep 3 years
DELETE FROM audit_log 
WHERE timestamp < NOW() - INTERVAL '3 years';

-- Device facts: Keep latest 30 snapshots per device
DELETE FROM device_facts 
WHERE id NOT IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY collected_at DESC) AS rn
        FROM device_facts
    ) sub
    WHERE rn <= 30
);
```

### Indexes to Monitor

```sql
-- Check index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Initial Data

```sql
-- Create xSPECTRE internal organization
INSERT INTO organizations (name, slug, type, created_at)
VALUES ('xSPECTRE Internal', 'xspectre-internal', 'internal', NOW());

-- Create super admin user
INSERT INTO users (email, username, role, active, created_at)
VALUES ('admin@xspectre.internal', 'admin', 'super_admin', TRUE, NOW());
```

---

This schema is production-ready for 50–500 devices and can scale to thousands with partitioning and TimescaleDB.
