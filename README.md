# xSPECTRE Ops Console

**Internal-Only SOC Fleet Management Platform**

A comprehensive plug-and-play platform for managing 50–60 distributed scanners and servers with monitoring, Greenbone integration, backups, recovery, and alerting.

---

## 🎯 What This Platform Does

- **Asset/Inventory Management**: Track all scanners + servers with hardware details, org/site assignment
- **Remote Monitoring**: CPU/RAM/disk/network, services, Docker containers, uptime
- **Scanner Operations**: Greenbone insights (scans/tasks/vulnerabilities) without opening GSA
- **Alerting**: Rule engine + BetterStack integration
- **Backups**: Optional per-device (FILE / FULL DISK / HYBRID)
- **Recovery**: USB-based OS recovery and reinstall capability
- **Remote Actions**: SSH, file manager, service control, config reset, hostname change, password management
- **Multi-tenant**: Customer devices (billable) + internal infrastructure (non-billable)

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────┐
│          xSPECTRE Cloud/Core                 │
│                                             │
│  [Ops Console UI]  [API]  [DB]  [Queue]      │
│  [Metrics Store] [Alert Engine] [Audit Log]  │
│  [WG Hub] <-----> [Backup Server/Storage]    │
└───────────────┬─────────────────────────────┘
                │
          WireGuard overlay
                │
┌───────────────┼──────────────────┐
│               │                  │
Scanner A    Server B         Scanner C
OS+Agent     OS+Agent         OS+Agent
Docker+GVM   Docker opt       Docker+GVM
Recovery USB Recovery USB     Recovery USB
```

**Key Principle**: Devices connect outbound via WireGuard. No port forwarding. No inbound access.

---

## 📦 Components

### Cloud/Core Infrastructure
- **Ops Console UI**: Internal web app for SOC operators
- **Ops API**: Backend (Node.js/Express)
- **Database**: PostgreSQL (inventory, metrics, alerts, audit)
- **Metrics Store**: TimescaleDB/ClickHouse (optional, start simple)
- **Command Queue**: Job queue for remote actions
- **Alert Engine**: Rule evaluation + BetterStack forwarding
- **WireGuard Hub**: Private network overlay (10.10.0.0/24)
- **Backup Server**: Internal storage for file + disk image backups

### Device-Side Components
- **xspectre-agent**: Lightweight agent (Go/Node)
  - Heartbeat every 30–60s
  - Collect metrics + inventory
  - Report service/docker status
  - Execute commands from queue
  - Orchestrate backups
- **WireGuard Client**: Auto-connect to hub
- **Recovery USB**: Minimal Linux OS for bare-metal recovery

---

## 🚀 Device Types & Modules

### Device Types
- **Scanner**: Has Greenbone stack + scanner-specific features
- **Server**: General infrastructure RMM

### Billing Types
- **Customer**: Billable, subscription tracked
- **Internal**: Non-billable, full access

### Module System (Toggle Per Device)
- `monitoring` - CPU/RAM/disk/network/uptime
- `docker` - Container status/stats
- `scanner` - Greenbone insights (scanner only)
- `alerting` - Alert rules enabled
- `backups` - Backup orchestration
- `actions` - Remote control capabilities
- `filemanager` - SFTP/file API access

---

## 📊 Database Schema

See [docs/database-schema.md](docs/database-schema.md) for complete schema.

**Core Tables**:
- `organizations` - Customers + "xSPECTRE Internal"
- `sites` - Physical locations
- `devices` - Scanners + servers
- `device_facts` - Hardware inventory snapshots
- `heartbeats` - Latest device check-in
- `metrics_rollup` - Aggregated metrics
- `service_status` - Service health
- `docker_containers` - Container tracking
- `scanner_stats` - Greenbone summaries
- `subscriptions` - Customer billing (nullable)
- `alerts` - Alert history
- `audit_log` - All actions
- `commands` - Command queue + results
- `backups_catalog` - Backup snapshots

---

## 🔐 Security Model

- **Internal-Only**: No customer portal, no external access
- **RBAC Roles**: Super Admin / SOC Operator / Read-Only
- **Audit Trail**: Every action logged (who/what/when)
- **Encrypted Tunnels**: WireGuard for all device communication
- **Encrypted Backups**: AES-256, keys in vault
- **Signed Commands**: Commands are signed and time-limited

---

## 🛎 Alerting (BetterStack Integration)

**Rule Engine** (in xSPECTRE):
- Device offline > 3 minutes
- CPU > 90% for 5 minutes
- Disk > 90% (warning), > 95% (critical)
- Docker container stopped
- Service down (wazuh/newrelic/rport/docker/gvmd/ospd)
- Backup failed
- Subscription overdue (customer devices only)

**BetterStack** (notification routing):
- Forward alerts via webhook
- Email/SMS/Slack/escalations
- Per-org routing (customer vs internal)

---

## 💾 Backup Architecture

### Backup Modes (Per Device Toggle)
- **OFF**: No backups
- **FILE**: Incremental file-level (restic/borg)
  - `/etc`, `/opt`, `/home`, docker volumes, Greenbone data
  - Daily, fast, low storage
- **FULL DISK**: Block-level disk image
  - Recovery USB method (universal, consistent)
  - Optional online method (LVM snapshot)
  - Weekly, heavier storage
- **HYBRID**: FILE daily + FULL weekly

### Storage Planning (50–60 devices)
- Default: Most scanners OFF or FILE
- Enable FULL DISK for:
  - Core internal servers
  - VIP customer scanners (5–10 devices)

### Retention
- FILE: keep 7 daily + 4 weekly
- FULL DISK: keep 2–4 snapshots

---

## 🔄 Recovery USB System

**Purpose**: Bare-metal recovery when OS completely fails

**How It Works**:
1. Internal USB mounted in each appliance
2. BIOS boot order: SSD first, USB fallback
3. Recovery OS boots independently, connects WireGuard
4. Can:
   - Upload FULL DISK backup (while SSD unmounted)
   - Download + write disk restore image
   - Reinstall base OS
   - Report "RECOVERY MODE" to console

**Trigger Methods**:
- **Automatic**: If SSD fails to boot, BIOS falls back to USB
- **Manual**: Ops Console → "Boot to Recovery USB" → agent sets boot flag → reboot

---

## 🔌 Plug-and-Play Enrollment

### Claim Code Flow (Recommended)
1. Operator creates device entry in Ops Console
   - Device type (scanner/server)
   - Billing type (customer/internal)
   - Org/site assignment
   - Generate claim code
2. Install OS on appliance
3. Run bootstrap command:
   ```bash
   curl -fsSL https://your-cloud/bootstrap.sh | sudo bash -s -- \
     --claim-code "<CLAIM_CODE>"
   ```
4. Bootstrap:
   - Installs WireGuard + agent
   - Connects to hub
   - Sends claim code + hardware facts
   - Downloads device config
5. Device appears in Ops Console automatically

**Result**: Plug in anywhere → auto-registered

---

## 🖥 Ops Console UI Structure

### Global Navigation
- Dashboard
- Inventory
- Alerts
- Backups
- Scanner Ops (aggregate view)
- Automations
- Reports
- Settings
- Audit Log

### Device Page Tabs (Dynamic)

**Common Tabs** (all devices):
- Overview - Health cards, last login IPs, notes
- Metrics - CPU/RAM/disk/network graphs
- Services - Status + restart/stop/logs
- Docker - Container list + stats
- Files - SFTP browser
- Terminal - Web SSH
- Backups - Enable/schedule/restore
- Access - SSH passwords/keys, PIN (scanner)
- Actions - Reboot, hostname change, reset config
- Audit - Action history

**Scanner-Only Tabs**:
- Greenbone - Stack health, feed status
- Scans - Running/queued scans, tasks
- Vulnerabilities - Top vulns summary, severity breakdown
- Scanner Config - PIN, reset config button

---

## 📈 Monitoring & Metrics

### System Metrics (All Devices)
- CPU/RAM usage
- Filesystem usage per mount
- Network transfer (RX/TX)
- Uptime / online state
- Last login IPs (auth logs)

### Service Monitoring
- sshd, docker
- wazuh-agent, newrelic, rport
- Greenbone services (scanner): gvmd, ospd-openvas, redis, postgres

### Docker Monitoring
- Container status (running/exited/restarting)
- Restart counts
- CPU/mem per container
- Last logs tail

### Scanner Intelligence (Greenbone)
Agent queries gvmd via GMP and caches:
- Tasks count
- Running scans count
- Queued scans
- Last scan timestamp
- Top vulnerabilities (severity, CVE, affected assets)
- Feed update status

**No GSA login required** - all visible in Ops Console

---

## 🔧 Remote Actions

All actions go through signed command queue with audit logging:

### Safe Actions
- Restart services
- Update agent
- Docker prune
- Generate diagnostics

### System Actions (requires elevated role)
- Reboot / Shutdown
- Change hostname
- Change SSH password / rotate keys
- **Reset machine config** (scanner: reset GUI config)
- **Boot to Recovery USB** (next boot)
- **Reinstall from base image** (via Recovery USB)

### Scanner-Specific
- Change PIN
- Restart Greenbone stack
- Force feed sync

---

## 🗂 Multi-OS Support

Supports mixed fleet:
- Debian 11/12
- Ubuntu 20.04/22.04/24.04
- CentOS 7/8/Stream
- AlmaLinux 8/9
- Custom images

**Agent** works across all distros.
**Backups**: FILE (restic) universal; FULL DISK via Recovery USB works everywhere.

---

## 📋 Implementation Phases

### Phase 1 (MVP - 2–3 weeks)
- Device enrollment + inventory
- Heartbeats + online/offline
- CPU/RAM/Disk monitoring
- Service status
- BetterStack alert forwarding
- Basic device pages

### Phase 2 (Core Features)
- Docker monitoring
- SSH/web terminal + file manager
- Actions: reboot/reset/hostname
- FILE backups

### Phase 3 (Scanner Ops)
- Greenbone health + container checks
- Running scans/tasks counts
- Vulnerability summaries

### Phase 4 (Advanced)
- FULL DISK backups
- Recovery USB integration
- Restore workflows
- Compliance reports

---

## 🚦 Getting Started

See individual component READMEs:
- [docs/installation.md](docs/installation.md) - Setup instructions
- [cloud/README.md](cloud/README.md) - Cloud infrastructure setup
- [agent/README.md](agent/README.md) - Agent installation
- [recovery-usb/README.md](recovery-usb/README.md) - Recovery USB creation

---

## 📞 Support

Internal use only. Contact SOC infrastructure team.

---

## 📄 License

Proprietary - xSPECTRE Internal Use Only
