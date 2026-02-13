# xSPECTRE Ops Console - Complete Architecture

## Table of Contents
1. [System Overview](#system-overview)
2. [Network Architecture](#network-architecture)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Security Architecture](#security-architecture)
6. [Backup & Recovery Architecture](#backup--recovery-architecture)
7. [Deployment Architecture](#deployment-architecture)

---

## System Overview

xSPECTRE Ops Console is an internal-only platform for managing a distributed fleet of 50–60 security scanners and servers across multiple customer sites and internal infrastructure.

### Core Principles
- **Plug-and-Play**: Devices auto-enroll, no manual configuration
- **Outbound-Only**: No port forwarding, no firewall changes at customer sites
- **Zero-Touch Recovery**: USB-based bare-metal recovery
- **Multi-Tenant**: Customer devices (billable) + internal infra (non-billable)
- **Internal-Only**: No customer-facing portal

### Key Capabilities
- Asset inventory + hardware tracking
- Real-time monitoring (system + docker + services)
- Scanner operations (Greenbone insights without GSA)
- Alerting (BetterStack integration)
- Optional per-device backups (file + full disk)
- Remote management (SSH, files, actions)
- Full audit trail

---

## Network Architecture

### Topology

```
                     ┌─────────────────────────────────────┐
                     │        xSPECTRE Cloud Core          │
                     │         (OVH/Cloud)                 │
                     │                                     │
                     │  ┌───────────────────────────────┐  │
                     │  │   Ops Console UI (Web App)    │  │
                     │  │   Port 443 (internal access)  │  │
                     │  └───────────────────────────────┘  │
                     │                │                     │
                     │  ┌─────────────▼─────────────────┐  │
                     │  │      Ops API (Node.js)        │  │
                     │  │      Port 3000 (internal)     │  │
                     │  └─────────────┬─────────────────┘  │
                     │                │                     │
                     │  ┌─────────────▼─────────────────┐  │
                     │  │    PostgreSQL Database        │  │
                     │  │      Port 5432 (internal)     │  │
                     │  └───────────────────────────────┘  │
                     │                                     │
                     │  ┌───────────────────────────────┐  │
                     │  │   WireGuard Hub (wg0)         │  │
                     │  │   10.10.0.1/24                │  │
                     │  │   UDP 51820 (public)          │  │
                     │  └─────────────┬─────────────────┘  │
                     │                │                     │
                     │  ┌─────────────▼─────────────────┐  │
                     │  │   Backup Server + Storage     │  │
                     │  │   (ZFS/RAID pool)             │  │
                     │  └───────────────────────────────┘  │
                     └─────────────────┬───────────────────┘
                                       │
                           WireGuard Overlay Network
                              (10.10.0.0/24)
                           Encrypted, Outbound-Only
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        │                              │                              │
┌───────▼────────┐            ┌────────▼───────┐           ┌─────────▼────────┐
│  Customer A    │            │ Customer B     │           │  xSPECTRE        │
│  Site          │            │ Site           │           │  Internal        │
│                │            │                │           │                  │
│ ┌────────────┐ │            │ ┌────────────┐ │           │ ┌──────────────┐ │
│ │ Scanner A1 │ │            │ │ Scanner B1 │ │           │ │ Server I1    │ │
│ │ 10.10.0.21 │ │            │ │ 10.10.0.31 │ │           │ │ 10.10.0.10   │ │
│ │            │ │            │ │            │ │           │ │              │ │
│ │ Greenbone  │ │            │ │ Greenbone  │ │           │ │ Internal DB  │ │
│ │ Docker     │ │            │ │ Docker     │ │           │ │ Docker       │ │
│ │ Agent      │ │            │ │ Agent      │ │           │ │ Agent        │ │
│ │ WireGuard  │─┼─────┐      │ │ WireGuard  │─┼────┐      │ │ WireGuard    │─┼──┐
│ │ Recovery   │ │     │      │ │ Recovery   │ │    │      │ │ Recovery     │ │  │
│ └────────────┘ │     │      │ └────────────┘ │    │      │ └──────────────┘ │  │
│                │     │      │                │    │      │                  │  │
│ ┌────────────┐ │     │      │ ┌────────────┐ │    │      │ ┌──────────────┐ │  │
│ │ Server A1  │ │     │      │ │ Scanner B2 │ │    │      │ │ Server I2    │ │  │
│ │ 10.10.0.22 │ │     │      │ │ 10.10.0.32 │ │    │      │ │ 10.10.0.11   │ │  │
│ │            │ │     │      │ │            │ │    │      │ │              │ │  │
│ │ App Server │ │     │      │ │ Greenbone  │ │    │      │ │ Monitoring   │ │  │
│ │ Docker     │ │     │      │ │ Docker     │ │    │      │ │ Wazuh        │ │  │
│ │ Agent      │ │     │      │ │ Agent      │ │    │      │ │ Agent        │ │  │
│ │ WireGuard  │─┼─────┘      │ │ WireGuard  │─┼────┘      │ │ WireGuard    │─┼──┘
│ │ Recovery   │ │            │ │ Recovery   │ │           │ │ Recovery     │ │
│ └────────────┘ │            │ └────────────┘ │           │ └──────────────┘ │
│                │            │                │           │                  │
│  Customer LAN  │            │  Customer LAN  │           │  Office/DC LAN   │
│  192.168.1.0/24│            │  10.0.0.0/24   │           │  172.16.0.0/24   │
└────────────────┘            └────────────────┘           └──────────────────┘
```

### Network Layers

#### 1. Management Overlay (WireGuard)
- **Subnet**: 10.10.0.0/24
- **Hub**: 10.10.0.1 (cloud)
- **Devices**: 10.10.0.10-99 (assigned dynamically)
- **Protocol**: WireGuard (UDP 51820)
- **Encryption**: ChaCha20-Poly1305
- **Direction**: Outbound-only from devices
- **PersistentKeepalive**: 25 seconds

#### 2. Local LANs (Customer Sites)
- Devices have local IPs (DHCP or static)
- Greenbone scans local networks via local interface
- No routing of customer LANs through WireGuard (isolated)

#### 3. Cloud Internal Network
- API, DB, UI on private network
- Only WireGuard hub exposed publicly (UDP 51820)
- Internal services communicate over private IPs

### IP Allocation

| Range | Purpose |
|-------|---------|
| 10.10.0.1 | Cloud WireGuard hub |
| 10.10.0.10-19 | xSPECTRE internal infrastructure |
| 10.10.0.20-99 | Customer scanners + servers |
| 10.10.0.100-199 | Reserved for expansion |

### Security Zones

1. **Public Zone**: Only UDP 51820 (WireGuard)
2. **Management Zone**: WireGuard overlay (10.10.0.0/24)
3. **Internal Zone**: Cloud services (API/DB/UI)
4. **Customer LANs**: Isolated, no cross-site routing

---

## Component Architecture

### Cloud Infrastructure

```
┌────────────────────────────────────────────────────────────┐
│                    Cloud Server (OVH)                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Ops Console UI (Frontend)                   │  │
│  │  - React/Vue/Next.js                                  │  │
│  │  - Dashboard, Inventory, Device Pages                 │  │
│  │  - Alerts, Backups, Scanner Ops views                 │  │
│  │  - Web Terminal (xterm.js + WebSocket)                │  │
│  │  - File Manager (SFTP via browser)                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                │
│  ┌────────────────────────▼──────────────────────────────┐  │
│  │           Ops API (Backend)                           │  │
│  │  - Node.js + Express                                  │  │
│  │  - Authentication/Authorization (JWT + RBAC)          │  │
│  │  - Device registry + enrollment                       │  │
│  │  - Heartbeat receiver                                 │  │
│  │  - Metrics aggregation                                │  │
│  │  - Command queue management                           │  │
│  │  - Alert rule evaluation                              │  │
│  │  - BetterStack webhook integration                    │  │
│  │  - Greenbone data caching                             │  │
│  │  - Backup orchestration                               │  │
│  └───────────────┬───────────────────┬──────────────────┘  │
│                  │                   │                     │
│  ┌───────────────▼─────┐   ┌─────────▼─────────────────┐  │
│  │   PostgreSQL DB     │   │   Redis (optional)        │  │
│  │   - Inventory       │   │   - Session cache         │  │
│  │   - Metrics rollup  │   │   - Command queue         │  │
│  │   - Alerts          │   │   - Rate limiting         │  │
│  │   - Audit log       │   └───────────────────────────┘  │
│  │   - Subscriptions   │                                  │
│  └─────────────────────┘                                  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           WireGuard Service                           │  │
│  │  - Interface: wg0                                     │  │
│  │  - Listen: UDP 51820                                  │  │
│  │  - IP: 10.10.0.1/24                                   │  │
│  │  - Peer management (devices)                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Backup Server                               │  │
│  │  - Storage pool (ZFS RAIDZ2)                          │  │
│  │  - File backup repository (restic)                    │  │
│  │  - Disk image repository                              │  │
│  │  - Retention/cleanup automation                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Device Architecture (Scanner/Server)

```
┌────────────────────────────────────────────────────────────┐
│              Scanner/Server Device                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                Operating System                       │  │
│  │  - Debian/Ubuntu/CentOS/AlmaLinux/Custom             │  │
│  │  - Base OS services                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                │
│  ┌────────────────────────┴──────────────────────────────┐  │
│  │           xspectre-agent (systemd service)            │  │
│  │                                                       │  │
│  │  Core Functions:                                      │  │
│  │  ├─ Heartbeat sender (every 30-60s)                   │  │
│  │  ├─ Inventory collector (hardware/OS facts)           │  │
│  │  ├─ Metrics collector (CPU/RAM/disk/network)          │  │
│  │  ├─ Service monitor (systemd units)                   │  │
│  │  ├─ Docker monitor (containers/stats)                 │  │
│  │  ├─ Scanner integrator (GMP queries) [scanner only]   │  │
│  │  ├─ Command executor (queue polling)                  │  │
│  │  ├─ Backup orchestrator (file/full disk)              │  │
│  │  └─ Security event reporter (auth logs)               │  │
│  │                                                       │  │
│  │  Config: /etc/xspectre/agent.conf                     │  │
│  │  State: /var/lib/xspectre/agent.state                 │  │
│  │  Logs: /var/log/xspectre/agent.log                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                │
│  ┌────────────────────────▼──────────────────────────────┐  │
│  │           WireGuard Client                            │  │
│  │  - Interface: wg0                                     │  │
│  │  - Server: <cloud-ip>:51820                           │  │
│  │  - IP: 10.10.0.x/24 (assigned)                        │  │
│  │  - PersistentKeepalive: 25                            │  │
│  │  - Auto-start: yes                                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Docker Engine (optional)                    │  │
│  │  - Greenbone stack (scanner only)                     │  │
│  │  - Application containers                             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Additional Agents (optional)                │  │
│  │  - Wazuh agent                                        │  │
│  │  - NewRelic infrastructure agent                      │  │
│  │  - rport remote access                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Internal USB Drive                          │  │
│  │  - Recovery OS (minimal Linux)                        │  │
│  │  - Recovery agent                                     │  │
│  │  - WireGuard config                                   │  │
│  │  - Auto-boot on SSD failure                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Device Enrollment Flow

```
┌─────────┐                    ┌─────────┐                    ┌──────────┐
│Operator │                    │   API   │                    │ Database │
└────┬────┘                    └────┬────┘                    └────┬─────┘
     │                              │                              │
     │ 1. Create device entry       │                              │
     │───────────────────────────>  │                              │
     │    (type, billing, org/site) │                              │
     │                              │  2. Insert device record     │
     │                              │─────────────────────────────>│
     │                              │                              │
     │  3. Generate claim code      │                              │
     │ <─────────────────────────── │                              │
     │                              │                              │
     │                              │                              │
┌────┴────┐                    ┌────┴────┐                    ┌────┴─────┐
│ Device  │                    │   API   │                    │ Database │
└────┬────┘                    └────┬────┘                    └────┬─────┘
     │                              │                              │
     │ 4. Boot + run bootstrap.sh   │                              │
     │    with claim code           │                              │
     │                              │                              │
     │ 5. Install WireGuard + agent │                              │
     │    Bring up tunnel           │                              │
     │                              │                              │
     │ 6. POST /enroll              │                              │
     │    - claim_code              │                              │
     │    - hostname                │                              │
     │    - local IP                │                              │
     │    - MAC(s)                  │                              │
     │    - serial/model            │                              │
     │    - CPU/RAM/disk            │                              │
     │    - OS version              │                              │
     │─────────────────────────────>│                              │
     │                              │  7. Validate claim code      │
     │                              │─────────────────────────────>│
     │                              │  <───────────────────────────│
     │                              │                              │
     │                              │  8. Update device record     │
     │                              │     (bind hardware, activate)│
     │                              │─────────────────────────────>│
     │                              │                              │
     │  9. Device config            │                              │
     │     - WG IP                  │                              │
     │     - modules enabled        │                              │
     │     - alert rules            │                              │
     │     - backup settings        │                              │
     │ <────────────────────────────│                              │
     │                              │                              │
     │ 10. Start agent service      │                              │
     │     Begin heartbeats         │                              │
     │                              │                              │
```

### 2. Heartbeat & Monitoring Flow

```
┌────────┐                    ┌─────────┐                    ┌──────────┐
│ Agent  │                    │   API   │                    │ Database │
└───┬────┘                    └────┬────┘                    └────┬─────┘
    │                              │                              │
    │ Every 30-60s:                │                              │
    │ POST /heartbeat              │                              │
    │  {                           │                              │
    │    device_id,                │                              │
    │    timestamp,                │                              │
    │    uptime,                   │                              │
    │    cpu_usage,                │                              │
    │    ram_usage,                │                              │
    │    disk_usage: [{mount,used}]│                              │
    │    network: {rx,tx},         │                              │
    │    services: [{name,status}],│                              │
    │    docker: [{container,...}],│                              │
    │    scanner_stats: {...}      │  [scanner only]              │
    │  }                           │                              │
    │─────────────────────────────>│                              │
    │                              │  1. Update heartbeat table   │
    │                              │─────────────────────────────>│
    │                              │                              │
    │                              │  2. Insert metrics_rollup    │
    │                              │─────────────────────────────>│
    │                              │                              │
    │                              │  3. Evaluate alert rules     │
    │                              │     (CPU/disk/service/etc)   │
    │                              │                              │
    │                              │  4. Trigger alerts if needed │
    │                              │─────────────────────────────>│
    │                              │                              │
    │                              │  5. Forward to BetterStack   │
    │                              │    (webhook)                 │
    │                              │                              │
    │  ACK                         │                              │
    │ <────────────────────────────│                              │
    │                              │                              │
```

### 3. Remote Action Flow

```
┌─────────┐      ┌─────────┐      ┌──────────┐      ┌────────┐
│Operator │      │   UI    │      │   API    │      │ Device │
└────┬────┘      └────┬────┘      └────┬─────┘      └───┬────┘
     │                │                 │                │
     │ 1. Click      │                 │                │
     │   "Reboot"    │                 │                │
     │──────────────>│                 │                │
     │                │  2. POST        │                │
     │                │    /commands    │                │
     │                │────────────────>│                │
     │                │   {device_id,   │                │
     │                │    action:      │                │
     │                │    "reboot"}    │                │
     │                │                 │  3. Insert     │
     │                │                 │     command    │
     │                │                 │     (signed)   │
     │                │                 │────────────┐   │
     │                │                 │            │   │
     │                │                 │ <──────────┘   │
     │                │                 │                │
     │                │                 │                │
     │                │                 │ 4. Agent polls │
     │                │                 │    command     │
     │                │                 │    queue       │
     │                │                 │ <──────────────│
     │                │                 │                │
     │                │                 │  5. Return     │
     │                │                 │     pending    │
     │                │                 │     command    │
     │                │                 │───────────────>│
     │                │                 │                │
     │                │                 │                │
     │                │                 │  6. Execute    │
     │                │                 │     reboot     │
     │                │                 │ <──────────────│
     │                │                 │     (async)    │
     │                │                 │                │
     │                │                 │  7. Update     │
     │                │                 │     command    │
     │                │                 │     status     │
     │                │                 │ <──────────────│
     │                │                 │    "success"   │
     │                │                 │                │
     │                │  8. Audit log   │                │
     │                │     (who/what/  │                │
     │                │      when)      │                │
     │                │                 │────────────┐   │
     │                │                 │            │   │
     │                │                 │ <──────────┘   │
     │                │                 │                │
```

### 4. Backup Flow (FULL DISK via Recovery USB)

```
┌─────────┐      ┌─────────┐      ┌────────┐      ┌─────────┐      ┌────────┐
│Operator │      │   API   │      │ Device │      │Recovery │      │Backup  │
│         │      │         │      │ (Main) │      │   USB   │      │Server  │
└────┬────┘      └────┬────┘      └───┬────┘      └────┬────┘      └───┬────┘
     │                │                │                │               │
     │ 1. Trigger     │                │                │               │
     │   FULL backup  │                │                │               │
     │───────────────>│                │                │               │
     │                │  2. Command:   │                │               │
     │                │     Boot USB   │                │               │
     │                │───────────────>│                │               │
     │                │                │  3. Set boot   │               │
     │                │                │     flag USB   │               │
     │                │                │     + reboot   │               │
     │                │                │                │               │
     │                │                │     [REBOOT]   │               │
     │                │                │                │               │
     │                │                │                │  4. USB boots │
     │                │                │                │     Connects  │
     │                │                │                │     WireGuard │
     │                │                │                │               │
     │                │                │                │  5. Notify    │
     │                │                │                │     "RECOVERY"│
     │                │  6. Show       │                │───────────────┤
     │                │     "RECOVERY  │                │               │
     │                │      MODE"     │ <──────────────│               │
     │                │                │                │               │
     │                │                │                │  6. Image SSD │
     │                │                │                │     (unmounted│
     │                │                │                │──────────────>│
     │                │                │                │  compress &   │
     │                │                │                │  stream       │
     │                │                │                │               │
     │                │                │                │  7. Store     │
     │                │                │                │     snapshot  │
     │                │                │                │ <─────────────│
     │                │                │                │               │
     │                │                │                │  8. Reboot    │
     │                │                │                │     to SSD    │
     │                │                │                │               │
     │                │                │    [REBOOT]    │               │
     │                │                │ <──────────────│               │
     │                │                │                │               │
     │                │                │  9. Main OS    │               │
     │                │                │     boots      │               │
     │                │                │                │               │
     │                │                │ 10. Heartbeat  │               │
     │                │  11. Update    │────────────────┤               │
     │  12. "Backup   │      backup    │                │               │
     │      complete" │      catalog   │                │               │
     │ <──────────────│ <──────────────│                │               │
     │                │                │                │               │
```

---

## Security Architecture

### Authentication & Authorization

```
┌──────────────────────────────────────────────────────────┐
│                  Authentication Layer                     │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Option A: Local Auth + 2FA                              │
│  - Username/password (bcrypt hashed)                     │
│  - TOTP 2FA (optional but recommended)                   │
│  - Session management (JWT)                              │
│                                                          │
│  Option B: SSO Integration (recommended)                 │
│  - Azure Entra ID / Google Workspace                     │
│  - SAML 2.0 or OAuth 2.0                                 │
│  - MFA enforced at IdP level                             │
│                                                          │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│                  Authorization Layer (RBAC)               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Roles:                                                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Super Admin                                       │  │
│  │  - Full access to everything                       │  │
│  │  - Manage users/roles                              │  │
│  │  - View internal infrastructure                    │  │
│  │  - Critical actions (reinstall, full backups)      │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  SOC Operator                                      │  │
│  │  - Manage customer devices                         │  │
│  │  - View internal infra (read-only)                 │  │
│  │  - Trigger backups                                 │  │
│  │  - Restart services                                │  │
│  │  - View scanner ops                                │  │
│  │  - No critical actions                             │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Read-Only                                         │  │
│  │  - View dashboards                                 │  │
│  │  - View alerts                                     │  │
│  │  - No actions                                      │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Permissions per Resource:                               │
│  - devices.view                                          │
│  - devices.manage                                        │
│  - devices.critical_actions                              │
│  - backups.view                                          │
│  - backups.trigger                                       │
│  - backups.restore                                       │
│  - alerts.view                                           │
│  - alerts.ack                                            │
│  - audit.view                                            │
│  - settings.manage                                       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Device Security

```
┌──────────────────────────────────────────────────────────┐
│               Device Enrollment Security                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Claim Code System:                                      │
│  - One-time use claim codes                              │
│  - Expire after 24 hours or first use                    │
│  - Bound to specific org/site/type                       │
│  - Cannot be reused                                      │
│                                                          │
│  Hardware Fingerprint:                                   │
│  - SHA256(serial + MAC + CPU ID + salt)                  │
│  - Stored during enrollment                              │
│  - Prevents device cloning/spoofing                      │
│  - Alert on fingerprint change                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│               Communication Security                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  WireGuard Tunnel:                                       │
│  - ChaCha20-Poly1305 encryption                          │
│  - Curve25519 key exchange                               │
│  - Per-device keypair                                    │
│  - PersistentKeepalive prevents firewall timeouts        │
│                                                          │
│  API Security:                                           │
│  - TLS 1.3 (HTTPS only)                                  │
│  - JWT tokens for auth                                   │
│  - Rate limiting per device                              │
│  - Request signing for critical commands                 │
│                                                          │
│  Command Security:                                       │
│  - Commands signed with device key                       │
│  - Time-limited (expire after 5 minutes)                 │
│  - Nonce prevents replay attacks                         │
│  - Full audit trail                                      │
│                                                          │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│               Data Security                               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Database:                                               │
│  - Encrypted at rest                                     │
│  - Sensitive fields encrypted (AES-256)                  │
│  - Password hashes (bcrypt, cost 12)                     │
│  - Regular backups (encrypted)                           │
│                                                          │
│  Backups:                                                │
│  - AES-256 encryption before upload                      │
│  - Keys stored in secrets vault                          │
│  - Per-device encryption keys                            │
│  - Cloud cannot decrypt backups                          │
│                                                          │
│  Secrets Management:                                     │
│  - Use Vault / AWS Secrets Manager / env vars            │
│  - Rotate keys regularly                                 │
│  - Never log secrets                                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Audit Trail

Every action is logged:

| Field | Description |
|-------|-------------|
| timestamp | ISO8601 timestamp |
| user_id | Who performed action |
| user_ip | Source IP of request |
| action | Action type (e.g., "reboot", "backup", "password_change") |
| resource_type | "device", "backup", "alert", etc. |
| resource_id | Affected device/resource |
| details | JSON with full context |
| result | "success" / "failure" |
| error_message | If failed |

Retention: Minimum 1 year, recommended 3 years.

---

## Backup & Recovery Architecture

### Backup Tier System

```
┌─────────────────────────────────────────────────────────────┐
│                    Backup Modes                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  OFF                                                        │
│  - No backups                                               │
│  - Use for: Non-critical scanners, test devices             │
│                                                             │
│  ──────────────────────────────────────────────────────────  │
│                                                             │
│  FILE (Incremental)                                         │
│  - Tool: restic (recommended) or borg                       │
│  - What: /etc, /opt, /home, docker volumes, app data        │
│  - Scanner: + /var/lib/gvm, scanner configs                 │
│  - Schedule: Daily 02:00 local time                         │
│  - Retention: 7 daily + 4 weekly                            │
│  - Storage: ~1-5GB per device                               │
│  - Recovery: Fast, file-level restore                       │
│                                                             │
│  ──────────────────────────────────────────────────────────  │
│                                                             │
│  FULL DISK                                                  │
│  - Tool: dd + compression via Recovery USB                  │
│  - What: Entire SSD/HDD block-level image                   │
│  - Schedule: Weekly Sunday 03:00                            │
│  - Retention: 2-4 snapshots                                 │
│  - Storage: ~40-120GB per snapshot (compressed)             │
│  - Recovery: Bare-metal restore                             │
│  - Requires: ~5-15min downtime (reboot to USB)              │
│                                                             │
│  ──────────────────────────────────────────────────────────  │
│                                                             │
│  HYBRID                                                     │
│  - FILE daily                                               │
│  - FULL DISK weekly                                         │
│  - Best for: Critical infrastructure, VIP customers         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Recovery USB Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Recovery USB OS (Minimal Linux)                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Base: Alpine Linux (minimal) or Debian netinst             │
│  Size: 2-4GB                                                │
│  Boot: UEFI + Legacy BIOS support                           │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Core Components                                      │  │
│  │  - WireGuard client (preconfigured)                   │  │
│  │  - xspectre-recovery agent                            │  │
│  │  - Basic networking tools                             │  │
│  │  - Disk imaging tools (dd, gzip, zstd)                │  │
│  │  - curl/wget for downloads                            │  │
│  │  - Hardware detection utilities                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Boot Sequence                                        │  │
│  │  1. Detect hardware                                   │  │
│  │  2. Bring up network (DHCP)                           │  │
│  │  3. Start WireGuard tunnel                            │  │
│  │  4. Connect to xSPECTRE API                           │  │
│  │  5. Register as "RECOVERY MODE"                       │  │
│  │  6. Wait for commands or auto-execute backup          │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Recovery Actions                                     │  │
│  │  - Upload FULL DISK backup                            │  │
│  │  - Download & restore disk image                      │  │
│  │  - Reinstall base OS (fetch from cloud)               │  │
│  │  - Disk diagnostics (SMART status)                    │  │
│  │  - Partition repair                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Exit: Reboot back to main SSD                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Storage Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Backup Storage Server                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Hardware:                                                  │
│  - Dedicated server (office or cloud)                       │
│  - 4-8 HDDs in RAIDZ2 (ZFS) or RAID6                        │
│  - 10GbE link to core infra (optional)                      │
│  - UPS protected                                            │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ZFS Pool: backup-pool                                │  │
│  │  ├─ file-backups/                                     │  │
│  │  │    ├─ device-001/                                  │  │
│  │  │    │    └─ restic repository                       │  │
│  │  │    ├─ device-002/                                  │  │
│  │  │    │    └─ restic repository                       │  │
│  │  │    └─ ...                                          │  │
│  │  │                                                     │  │
│  │  ├─ disk-images/                                      │  │
│  │  │    ├─ device-001/                                  │  │
│  │  │    │    ├─ 2024-01-15.img.zst                      │  │
│  │  │    │    ├─ 2024-01-22.img.zst                      │  │
│  │  │    │    └─ metadata.json                           │  │
│  │  │    ├─ device-002/                                  │  │
│  │  │    │    └─ ...                                     │  │
│  │  │    └─ ...                                          │  │
│  │  │                                                     │  │
│  │  └─ metadata/                                         │  │
│  │       └─ catalog.db (snapshot index)                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Features:                                                  │
│  - Compression: zstd (default ZFS)                          │
│  - Deduplication: Optional (RAM-intensive)                  │
│  - Snapshots: ZFS auto-snapshots for versioning            │
│  - Scrubs: Monthly integrity checks                         │
│  - Replication: Optional offsite replication                │
│                                                             │
│  Access:                                                    │
│  - Restricted to Ops API only                               │
│  - No direct device access                                  │
│  - All operations audited                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Deployment Architecture

### Cloud Server (OVH)

**Minimum Specs**:
- 8 vCPU
- 16GB RAM
- 100GB root disk (OS + DB + logs)
- 1TB+ data disk (backups) or separate backup server
- 1Gbps network
- Public IP (for WireGuard)

**OS**: Ubuntu 22.04 LTS or Debian 12

**Services**:
- Ops Console UI (port 443)
- Ops API (port 3000 internal)
- PostgreSQL (port 5432 internal)
- Redis (optional, port 6379 internal)
- WireGuard (UDP 51820 public)
- Backup Server (internal storage or separate node)

### Device Requirements

**Scanner Minimum**:
- 4 cores / 8 threads
- 16GB RAM (Greenbone + Docker)
- 256GB SSD
- 2x NICs (management + scanning, optional)
- Internal USB port (for Recovery USB)

**Server Minimum**:
- 2 cores
- 4GB RAM
- 120GB SSD
- Internal USB port (for Recovery USB)

**Supported OS**:
- Debian 11/12
- Ubuntu 20.04/22.04/24.04
- CentOS 7/8/Stream
- AlmaLinux 8/9
- Custom images

### Network Requirements

**Outbound from devices**:
- UDP 51820 (WireGuard) - REQUIRED
- TCP 443 (HTTPS fallback, optional)

**No inbound ports required at customer sites**.

**Cloud public exposure**:
- UDP 51820 (WireGuard)
- TCP 443 (Ops Console HTTPS, restricted to internal IPs)

---

## Scalability Considerations

### Current Scale (50–60 devices)
- Single cloud server sufficient
- PostgreSQL on same server OK
- Backup server can be same or separate

### Future Scale (100–500 devices)
- Separate DB server
- Load-balanced API (2+ nodes)
- Dedicated backup cluster
- Metrics storage → TimescaleDB/ClickHouse
- Consider sharding backups by region

### Future Scale (500+ devices)
- Multi-region deployment
- Edge aggregation nodes
- S3-compatible object storage for backups
- Kafka for event streaming
- Distributed tracing (Jaeger/Zipkin)

---

## Technology Stack Summary

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | React/Vue/Next.js | Internal-only UI |
| Backend API | Node.js + Express | RESTful API |
| Database | PostgreSQL 14+ | Primary data store |
| Cache | Redis (optional) | Session + queue |
| Metrics | PostgreSQL (start) → TimescaleDB (scale) | Time-series data |
| VPN | WireGuard | Device connectivity |
| Agent | Go or Node.js | Lightweight, cross-platform |
| Backups | restic (file) + dd/zstd (full) | Encrypted, incremental |
| Storage | ZFS on Linux | Backup pool |
| Alerting | BetterStack API | External notification |
| Web Terminal | xterm.js + node-pty | SSH via browser |
| File Manager | ssh2-sftp-client or custom | SFTP over WireGuard |

---

This architecture is designed for **real-world deployment** at your current scale (50–60 devices) with clear paths for growth. Every component is production-ready and battle-tested.
