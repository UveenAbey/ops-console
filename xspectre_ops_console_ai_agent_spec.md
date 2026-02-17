🚀 xSPECTRE Ops Console — AI Coding Agent Instruction File
🎯 PROJECT MISSION

Build an internal-only centralized infrastructure management platform called:

xSPECTRE Ops Console

This system manages:

50–60 scanners and servers

Mixed OS (Debian, Ubuntu, CentOS, AlmaLinux, custom)

Greenbone scanners

Docker-based services

Backup orchestration (FILE + FULL DISK)

Recovery USB workflow

Alerting integration with BetterStack

Subscription tracking (internal use only)

The system must be:

Plug-and-play (outbound-only WireGuard model)

Modular (device-type aware)

Secure (RBAC + audit logs)

Scalable to 100+ devices

🏗 SYSTEM ARCHITECTURE
Core Components

Backend API (Node.js + Express recommended)

PostgreSQL database

Web frontend (React + Next.js recommended)

Command queue system

WireGuard hub integration

xspectre-agent (separate service)

Backup orchestration module

Alert engine

BetterStack webhook integration

🗄 DATABASE SCHEMA (PostgreSQL)

Create the following tables:

organizations
id (uuid, pk)
name
type (internal/customer)
created_at

sites
id (uuid)
org_id (fk)
name
location

devices
id (uuid)
org_id (fk)
site_id (fk)
device_type (scanner/server)
billing_type (internal/customer)
hostname
wg_ip
local_ip
public_ip
model
serial
cpu
ram_mb
disk_total_gb
os_name
os_version
modules_enabled (jsonb)
status (online/offline/warn/critical)
first_seen
last_seen

device_facts
id
device_id
mac_addresses (jsonb)
disk_layout
kernel_version
docker_installed (bool)
created_at

heartbeats
device_id
cpu_usage
ram_usage
disk_usage (jsonb)
net_rx
net_tx
uptime_seconds
timestamp

services_status
device_id
service_name
status
last_updated

docker_containers
device_id
container_name
status
cpu_percent
memory_usage
restarts
image
updated_at

scanner_stats
device_id
tasks_total
running_scans
queued_scans
critical_count
high_count
medium_count
low_count
last_feed_sync
updated_at

alerts
id
device_id
severity
rule_name
message
state (open/ack/resolved)
created_at
ack_by
resolved_at

alert_rules
id
name
scope (global/device/org)
metric_type
threshold
duration_seconds
severity
enabled

subscriptions
device_id
plan_name
start_date
next_payment_date
status
notes

backups
device_id
mode (file/full/hybrid)
enabled (bool)
schedule
retention_count
target

backup_snapshots
device_id
snapshot_id
type (file/full)
size_gb
status
created_at

commands
id
device_id
command_type
args (jsonb)
status (pending/running/success/fail)
created_at
completed_at

audit_log
id
device_id
user_id
action
details
timestamp

🌐 BACKEND API CONTRACT

Base route: /api/v1

Devices

GET /devices

GET /devices/{id}

PATCH /devices/{id}

POST /devices/bulk

Agent endpoints

POST /agent/register

POST /agent/heartbeat

POST /agent/metrics

POST /agent/services

POST /agent/docker

POST /agent/scanner

Commands

POST /devices/{id}/command

GET /commands/{id}

Alerts

GET /alerts

PATCH /alerts/{id}

Backups

GET /devices/{id}/backups

POST /devices/{id}/backup

POST /devices/{id}/restore

Scanner

GET /devices/{id}/scanner/summary

GET /devices/{id}/scanner/scans

GET /devices/{id}/scanner/vulns

Dashboard

GET /dashboard/summary

🖥 FRONTEND STRUCTURE

Use Next.js with component-based structure.

Pages
/dashboard
/inventory
/inventory/[deviceId]
/alerts
/backups
/settings
/audit

Device Tabs (dynamic based on device_type)

Overview

Metrics

Services

Docker

Files

Terminal

Backups

Access

Actions

Audit

(scanner only)

Greenbone

Scans

Vulnerabilities

Scanner Config

🤖 XSPECTRE-AGENT REQUIREMENTS

Language: Go (preferred)

Responsibilities:

Maintain WireGuard connection

Send heartbeat every 60 seconds

Collect:

CPU

RAM

Disk

Network

Collect service states

Collect docker container stats

Query scanner stats (if enabled)

Poll for commands

Execute signed commands

Trigger backup workflows

Trigger recovery boot flag

💾 BACKUP SYSTEM REQUIREMENTS
Modes per device

OFF

FILE

FULL (Recovery USB)

HYBRID

FILE backup

restic

encrypted

incremental

FULL backup

Primary method:

Reboot to Recovery USB

Stream disk image to backup server

Recovery USB must:

Auto-connect WireGuard

Identify disk

Stream compressed image

Report progress

🚨 ALERT ENGINE

Engine must:

Evaluate rules against latest metrics

Prevent alert flapping (cooldown)

Store alert

Forward to BetterStack webhook if configured

Webhook payload example:

{
  "device": "scanner-03",
  "severity": "critical",
  "message": "Docker container gvmd stopped",
  "timestamp": "2026-02-17T10:22:00Z"
}

🔐 SECURITY REQUIREMENTS

JWT-based auth

RBAC enforcement

All command actions logged

SSH never exposed publicly

All device traffic via WireGuard

Validate agent tokens

📦 DELIVERABLES

AI agent must generate:

Backend project structure

PostgreSQL migration files

REST API implementation

Alert engine

Command queue logic

React frontend scaffolding

Basic UI for all wireframe screens

Agent server skeleton (Go)

README with setup instructions

🚫 CONSTRAINTS

Internal use only

No multi-tenant UI for customers

Must support 100+ devices

Must support mixed Linux OS

No inbound connections to devices

Avoid over-engineering v1

✅ ACCEPTANCE CRITERIA

System is complete when:

Device auto-registers and appears in inventory

Metrics update in real-time

Docker container state visible

Scanner stats visible without GSA login

Alert triggers and forwards to BetterStack

Backup mode configurable per device

Full disk restore via Recovery USB works

All actions logged in audit log

RBAC enforced correctly

🚀 PHASED IMPLEMENTATION PRIORITY

Phase 1:

Inventory

Monitoring

Alerts

Basic commands

Phase 2:

Docker + Scanner integration

BetterStack integration

Phase 3:

Backup + Recovery workflow