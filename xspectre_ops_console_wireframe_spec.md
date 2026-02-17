xSPECTRE Ops Console — Technical Wireframe Spec (Internal)
A) Global UI Layout (All Screens)
┌──────────────────────────────────────────────────────────────────────────┐
│ TopBar: xSPECTRE Ops Console | Search [________] | User | Role | Logout   │
├──────────────────────────────────────────────────────────────────────────┤
│ Sidebar                                                                  │
│  - Dashboard                                                             │
│  - Inventory                                                             │
│  - Alerts                                                                │
│  - Backups                                                               │
│  - Scanner Ops                                                           │
│  - Reports                                                               │
│  - Automations                                                           │
│  - Audit Log                                                             │
│  - Settings                                                              │
├──────────────────────────────────────────────────────────────────────────┤
│ Main Content Area                                                        │
└──────────────────────────────────────────────────────────────────────────┘

Global UI Rules

Internal-only (no customer portal)

Device-type aware modules:

server: hide scanner tabs

scanner: show scanner tabs

Billing-type aware:

internal: hide subscription enforcement banners

B) Permissions/RBAC Wireframe Rules
Roles

SUPER_ADMIN: all actions

OPERATOR: most actions, no user/role admin, limited sensitive actions

READ_ONLY: view only

High-risk actions require SUPER_ADMIN (configurable)

Full disk restore

Change SSH password

Boot recovery USB + reinstall

Reset scanner config

Disable backups

Apply module profile in bulk

C) Sitemap + Navigation (Clickable Map)
Dashboard
Inventory
  ├─ Device Details (scanner/server)
  │    ├─ Overview
  │    ├─ Metrics
  │    ├─ Services
  │    ├─ Docker
  │    ├─ Files
  │    ├─ Terminal
  │    ├─ Backups
  │    ├─ Access
  │    ├─ Actions
  │    ├─ Audit
  │    └─ (Scanner only)
  │        ├─ Greenbone
  │        ├─ Scans
  │        ├─ Vulnerabilities
  │        └─ Scanner Config
Alerts
Backups
Scanner Ops (fleet-level)
Reports
Audit Log
Settings
  ├─ Module Profiles
  ├─ Alert Rules
  ├─ BetterStack Integrations
  ├─ Backup Targets
  ├─ Users & Roles
  └─ WireGuard Hub

1) DASHBOARD (WF-001)
WF-001 — Dashboard Screen
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-001] Dashboard                                                       │
├──────────────────────────────────────────────────────────────────────────┤
│ KPI Row                                                                  │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│ │ Online 52/60│ │ Scanners 18 │ │ Critical  3 │ │ Scans Run  6 │         │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘         │
│                                                                          │
│ Status Widgets Row                                                       │
│ ┌─────────────────────────────┐  ┌─────────────────────────────┐        │
│ │ Latest Alerts (top 10)      │  │ Offline Devices              │        │
│ │ - CRIT: scanner-03 ...      │  │ - server-12 (6m)             │        │
│ │ - WARN: server-08 ...       │  │ - scanner-02 (12m)           │        │
│ └─────────────────────────────┘  └─────────────────────────────┘        │
│                                                                          │
│ ┌─────────────────────────────┐  ┌─────────────────────────────┐        │
│ │ Backup Failures (24h)       │  │ Scanner Health Summary       │        │
│ │ - scanner-07 failed         │  │ Green: 16  Yellow:2 Red:0    │        │
│ └─────────────────────────────┘  └─────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────┘

Dashboard Data Contracts

/dashboard/summary

counts: online/offline by type

active critical alerts

running scans count (scanner only)

backup failures last 24h

scanner health rollup

Primary actions

Click alert → WF-003 Alerts

Click device → WF-010 Device Details

2) INVENTORY (WF-010)
WF-010 — Inventory List
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-010] Inventory                                                       │
├──────────────────────────────────────────────────────────────────────────┤
│ Filters                                                                  │
│ Org [All v] Site [All v] Type [All v] Status [All v] Backup [All v]      │
│ Docker [All v] Tags [_____] Search [_____________] [Export CSV]          │
│                                                                          │
│ Bulk Actions: [Assign Org/Site] [Apply Profile] [Enable Backup] [Tag]    │
│                                                                          │
│ Table                                                                    │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │● Status | Name | Type | Org | Site | WG IP | Local IP | Serial | Uptime│ │
│ │ ONLINE  | scn03| SCAN | A   | HQ   |10.10.0.23|192...|ABC123| 12d      │ │
│ │ OFFLINE | srv12| SERV | Int | SOC  |10.10.0.40|10... |XYZ...|  --      │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘

Inventory Columns (minimum)

status badge (online/offline/warn/crit)

device name

type (scanner/server)

org/site

wg_ip

local_ip

public_ip (optional column toggle)

model/serial/mac

uptime

last seen

Inventory API

GET /devices?filters=...

PATCH /devices/bulk (assign/tags/profile/modules)

3) DEVICE DETAILS (WF-020)
WF-020 — Device Header + Tabs (Common)
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-020] Device: CUST-A-SCN-03           Status: ONLINE ●                 │
│ Type: SCANNER   Billing: CUSTOMER        Uptime: 12d 4h                   │
│ WG: 10.10.0.23  Local: 192.168.1.50      Public: x.x.x.x                 │
│ Model: HP L1W21AV  Serial: ABC123   MAC: 00:11:22:33:44:55               │
│ Last Seen: 20s ago     OS: Ubuntu 24.04     Agent: v1.0.3                │
├──────────────────────────────────────────────────────────────────────────┤
│ Tabs: Overview | Metrics | Services | Docker | Files | Terminal | Backups │
│      Access | Actions | Audit | (Scanner) Greenbone | Scans | Vulns |Cfg  │
└──────────────────────────────────────────────────────────────────────────┘

Device Details Data Sources

GET /devices/{id}

GET /devices/{id}/latest (latest metrics + statuses)

Tabs call their own endpoints.

WF-021 — Overview Tab
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-021] Overview                                                        │
├──────────────────────────────────────────────────────────────────────────┤
│ Cards                                                                    │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│ │ CPU 12%      │ │ RAM 48%      │ │ Disk / 62%   │ │ Net TX/RX     │     │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘     │
│                                                                          │
│ Services Quick Status                                                    │
│ docker: running | wazuh: running | newrelic: running | rport: running    │
│ scanner: healthy (if scanner)                                            │
│                                                                          │
│ Security                                                                  │
│ Last Login IPs: [list last 10]   Failed logins (24h): 3                   │
│                                                                          │
│ Notes & Attachments (internal)                                            │
└──────────────────────────────────────────────────────────────────────────┘


API:

GET /devices/{id}/overview

WF-022 — Metrics Tab
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-022] Metrics                                                         │
├──────────────────────────────────────────────────────────────────────────┤
│ Time range: [1h v][6h][24h][7d]                                           │
│ Charts (CPU, RAM, Disk, Net)                                             │
│                                                                          │
│ Table: recent metric snapshots (timestamp, cpu, ram, disk, rx, tx)        │
└──────────────────────────────────────────────────────────────────────────┘


API:

GET /devices/{id}/metrics?range=...

WF-023 — Services Tab
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-023] Services                                                        │
├──────────────────────────────────────────────────────────────────────────┤
│ Search [_____]  Filter: [Running/Stopped]                                │
│                                                                          │
│ Service            State     Since        Actions                         │
│ docker             active    2d           [Restart] [Stop] [Logs]        │
│ wazuh-agent        active    12d          [Restart] [Stop] [Logs]        │
│ newrelic-infra     inactive  --           [Start] [Restart] [Logs]       │
│ rport              active    1d           ...                             │
│ (scanner only) gvmd / ospd-openvas / redis / pg ...                       │
└──────────────────────────────────────────────────────────────────────────┘


API:

GET /devices/{id}/services
Actions:

POST /devices/{id}/commands {type:"service_restart", service:"docker"}

command results show inline + stored in audit

WF-024 — Docker Tab
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-024] Docker                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ Containers:                                                              │
│ Name           Status   Restarts  CPU   MEM    Image       Actions        │
│ gvmd           running  0         2%    450M   ...         [Restart][Logs]│
│ ospd-openvas   running  1         8%    1.2G   ...         [Restart][Logs]│
│ ...                                                                        │
│                                                                          │
│ Alerts: [Stopped containers]                                              │
└──────────────────────────────────────────────────────────────────────────┘


API:

GET /devices/{id}/docker/containers
Actions:

POST /devices/{id}/commands {type:"docker_restart", container:"gvmd"}

WF-025 — Files Tab (SFTP Browser)
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-025] Files                                                           │
├──────────────────────────────────────────────────────────────────────────┤
│ Path: [/etc/__________] [Go]  [Upload] [Download] [New] [Delete]         │
│                                                                          │
│ Name             Type     Size     Modified           Actions             │
│ ssh/             dir      -        -                 [Open]              │
│ hostname         file     12B      2026-02-...        [Download]          │
│ ...                                                                        │
└──────────────────────────────────────────────────────────────────────────┘


Implementation options:

SFTP via WG (preferred for v1)

or agent file API (later)

WF-026 — Terminal Tab (Web SSH)
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-026] Terminal                                                        │
├──────────────────────────────────────────────────────────────────────────┤
│ Target: 10.10.0.23   User: [spectre]   [Connect] [Disconnect]            │
│                                                                          │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │  Web Terminal (SSH)                                                   │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│ Audit: session start/end recorded                                         │
└──────────────────────────────────────────────────────────────────────────┘

WF-027 — Backups Tab (per-device toggles)
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-027] Backups                                                         │
├──────────────────────────────────────────────────────────────────────────┤
│ Enabled: [ON/OFF]                                                        │
│ Mode: [OFF | FILE | FULL DISK | HYBRID]                                  │
│ FULL Method: [Recovery USB] (Online if supported: greyed/auto)           │
│ Schedule: [Daily 02:00 v]  Retention: [Keep last 4 v]                    │
│ Target: [BackupServer-A v]                                               │
│                                                                          │
│ Status                                                                    │
│ FILE last: success (12h ago) size 1.2GB  duration 3m                     │
│ FULL last: success (7d ago)  size 68GB   duration 42m                    │
│                                                                          │
│ Actions: [Backup Now] [Restore...] [Verify] [Prune]                      │
└──────────────────────────────────────────────────────────────────────────┘


API:

GET /devices/{id}/backups

POST /devices/{id}/commands {type:"backup_run", mode:"file"}

POST /devices/{id}/commands {type:"backup_run", mode:"full_recovery"}

restore uses command + recovery USB path

WF-028 — Access Tab
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-028] Access                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ SSH                                                                        │
│ - Rotate SSH password  [Generate] [Set]                                  │
│ - Manage SSH keys       [Upload Key] [Revoke]                            │
│                                                                          │
│ Auth telemetry                                                            │
│ - Last login IPs (10)                                                     │
│ - Failed logins (24h)                                                     │
│                                                                          │
│ Scanner-only                                                              │
│ - Change PIN [____] [Set PIN]                                            │
└──────────────────────────────────────────────────────────────────────────┘

WF-029 — Actions Tab (Command Center)
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-029] Actions                                                         │
├──────────────────────────────────────────────────────────────────────────┤
│ Safe Actions                                                              │
│ [Restart Service Bundle] [Update Agent] [Collect Diagnostics]             │
│                                                                          │
│ System Actions                                                            │
│ [Reboot] [Shutdown] [Change Hostname]                                     │
│                                                                          │
│ Recovery (High risk)                                                      │
│ [Boot to Recovery USB (next reboot)]                                      │
│ [Reinstall Base Image (Recovery)]                                         │
│ [Restore Full Disk Backup]                                                │
│                                                                          │
│ Scanner-only                                                              │
│ [Restart Greenbone Stack] [Sync Feeds] [Reset Scanner Config]             │
└──────────────────────────────────────────────────────────────────────────┘


Every button:

creates a command

requires RBAC

writes to audit log

shows command status/progress

WF-030 — Audit Tab (per-device)
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-030] Audit                                                           │
├──────────────────────────────────────────────────────────────────────────┤
│ Time            User        Action                   Result               │
│ 2026-02-17      op1         service_restart docker   success              │
│ 2026-02-16      admin       backup_full_recovery     success              │
│ 2026-02-16      admin       ssh_password_rotate      success              │
└──────────────────────────────────────────────────────────────────────────┘


API:

GET /devices/{id}/audit

4) SCANNER-ONLY TABS (WF-040 series)
WF-040 — Greenbone Summary
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-040] Greenbone                                                       │
├──────────────────────────────────────────────────────────────────────────┤
│ Health: OK / Warning / Critical                                           │
│ Feed: last update 2d ago  |  gvmd: running  |  ospd: running              │
│ Tasks: 24  | Running scans: 3  | Queue: 1                                  │
│                                                                          │
│ Actions: [Restart Stack] [Sync Feeds] [Diagnostics]                       │
└──────────────────────────────────────────────────────────────────────────┘


API:

GET /devices/{id}/scanner/summary

WF-041 — Scans
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-041] Scans                                                           │
├──────────────────────────────────────────────────────────────────────────┤
│ Running Scans (live/cached)                                               │
│ Task Name        Target         Started       Progress   Status           │
│ Weekly Scan A    10.0.0.0/24     10:02        42%        running          │
│ ...                                                                        │
│                                                                          │
│ Totals: running=3 queued=1 finished=last24h:12                            │
└──────────────────────────────────────────────────────────────────────────┘


API:

GET /devices/{id}/scanner/scans

WF-042 — Vulnerabilities
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-042] Vulnerabilities                                                  │
├──────────────────────────────────────────────────────────────────────────┤
│ Severity Breakdown                                                        │
│ Critical: 14  High: 62  Medium: 140  Low: 220                             │
│                                                                          │
│ Top 10 Vulns (latest report cache)                                        │
│ CVE/Name                 Severity   Affected Hosts                        │
│ CVE-xxxx                 9.8        12                                     │
│ ...                                                                        │
│                                                                          │
│ Top affected assets                                                       │
│ 192.168.1.10  Crit:5 High:12                                              │
└──────────────────────────────────────────────────────────────────────────┘


API:

GET /devices/{id}/scanner/vulns-summary

WF-043 — Scanner Config
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-043] Scanner Config                                                   │
├──────────────────────────────────────────────────────────────────────────┤
│ PIN: [Change PIN]                                                        │
│ Reset config: [Trigger Reset] (resets scanner UI config to known good)    │
│ Policy flags: [Enable/Disable features]                                   │
└──────────────────────────────────────────────────────────────────────────┘

5) ALERTS (WF-003)
WF-003 — Alerts List
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-003] Alerts                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ Filters: Severity [All] Org [All] Type [All] State [Open] Search [___]   │
│                                                                          │
│ Time      Sev   Device     Rule                 Message           Actions │
│ 10:22     CRIT  scn03      container_stopped     gvmd stopped     [Ack]   │
│ 09:10     WARN  srv12      offline_timeout      no heartbeat     [Ack]   │
│                                                                          │
│ Bulk: [Ack] [Mute 1h] [Mute 24h] [Resolve]                               │
└──────────────────────────────────────────────────────────────────────────┘


Alert detail drawer:

show event history

show “sent to BetterStack yes/no”

show related metrics

API:

GET /alerts

PATCH /alerts/{id} ack/resolve/mute

6) BACKUPS (FLEET VIEW) (WF-060)
WF-060 — Fleet Backup Dashboard
┌──────────────────────────────────────────────────────────────────────────┐
│ [WF-060] Backups                                                         │
├──────────────────────────────────────────────────────────────────────────┤
│ Summary: Enabled 22 | FILE 18 | FULL 6 | Failed last 24h 1                │
│                                                                          │
│ Table:                                                                    │
│ Device   Mode   Last FILE    Last FULL     Storage Used   Status          │
│ scn03    FILE   12h success  -             8GB           OK              │
│ srv01    HYBRID 6h success   7d success    220GB         OK              │
│ scn07    FULL   -            2d failed     68GB          FAIL            │
└──────────────────────────────────────────────────────────────────────────┘

7) SETTINGS (WF-070 series)
WF-070 — Module Profiles
Profiles:
- Scanner Default: monitoring,docker,scanner_ops,alerting,actions,(backup optional)
- Server Default: monitoring,docker(optional),alerting,actions,(backup optional)
- Internal Core: monitoring,docker,alerting,backups=HYBRID
Actions: [Create] [Edit] [Apply to selected devices]

WF-071 — Alert Rules

Create/edit rules (threshold, duration, severity, scope)

route to BetterStack target

WF-072 — BetterStack Integrations

targets by org/type: internal vs customer (even if internal-only, keep routing clean)

tokens/webhook endpoints stored securely

WF-073 — Backup Targets

BackupServer A (local ZFS)

BackupServer B (cloud)

credentials + connection tests

WF-074 — WireGuard Hub

status

connected peers count

IP pool usage

8) Command Flow (Technical Interaction Spec)
8.1 Standard action pattern (button → command → result)

UI click: Restart docker
→ POST /devices/{id}/commands

{ "type":"service_restart", "args":{"service":"docker"}, "priority":"normal" }


API:

validates RBAC

writes audit log entry (pending)

pushes command to queue

Agent:

polls or receives command

executes systemctl restart docker

returns result

API:

stores command result

updates audit log entry

UI shows success/fail

8.2 Recovery full-disk backup flow

UI click: “FULL backup (Recovery USB)”

API issues command: set_next_boot_recovery_usb

API issues command: reboot

Recovery USB boots, checks in:

device state: RECOVERY_MODE

Recovery agent runs backup stream and posts progress:

backup_started, %, backup_finished

Device reboots back to SSD

UI shows snapshot in catalog

9) Wireframe-to-API Mapping (cheat sheet)

WF-001 Dashboard → GET /dashboard/summary

WF-010 Inventory → GET /devices

WF-020 Device Header → GET /devices/{id}

WF-021 Overview → GET /devices/{id}/overview

WF-022 Metrics → GET /devices/{id}/metrics

WF-023 Services → GET /devices/{id}/services

WF-024 Docker → GET /devices/{id}/docker/containers

WF-025 Files → SFTP or GET /devices/{id}/files?path=...

WF-026 Terminal → SSH proxy

WF-027 Backups → GET /devices/{id}/backups

WF-040+ Scanner tabs → /devices/{id}/scanner/*

WF-003 Alerts → GET /alerts