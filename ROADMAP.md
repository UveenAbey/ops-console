# Implementation Roadmap

## Phase 1: MVP (Weeks 1-3) 🎯

**Goal:** Basic device enrollment, monitoring, and dashboard

### Week 1: Cloud Infrastructure
- [ ] Deploy PostgreSQL database
- [ ] Run migrations (create 18 tables)
- [ ] Seed initial data (xSPECTRE Internal org + admin user)
- [ ] Deploy API server with systemd
- [ ] Configure Nginx reverse proxy
- [ ] Set up WireGuard hub (wg0, UDP 51820)
- [ ] Test enrollment endpoint manually

### Week 2: Device Agent (Go)
- [ ] Create Go project structure
- [ ] Implement heartbeat sender (60s interval)
- [ ] Implement metrics collector:
  - [ ] CPU usage (via /proc/stat)
  - [ ] RAM usage (via /proc/meminfo)
  - [ ] Disk usage (df command)
  - [ ] Network stats (via /proc/net/dev)
  - [ ] Service status (systemctl)
  - [ ] Docker containers (Docker API)
- [ ] Implement enrollment flow (claim code)
- [ ] Package as systemd service
- [ ] Test on Ubuntu 22.04 + Debian 12

### Week 3: Frontend Dashboard
- [ ] Initialize Next.js project with TypeScript
- [ ] Implement authentication (JWT)
- [ ] Build dashboard:
  - [ ] 8 KPI cards (devices online, alerts, scans, etc.)
  - [ ] Recent alerts widget
  - [ ] Offline devices list
  - [ ] Scanner health summary
- [ ] Build device inventory list with filters
- [ ] Build basic device detail page (Overview tab)
- [ ] Add WebSocket for real-time updates

**Deliverable:** Working system with enrollment, monitoring, and basic UI

---

## Phase 2: Core Features (Weeks 4-6) 🔧

**Goal:** Remote actions, alerting, and multi-tenant

### Week 4: Commands & Actions
- [ ] Implement command queue system
- [ ] Add command signing (prevent replay attacks)
- [ ] Device-side command executor:
  - [ ] Reboot
  - [ ] Change hostname
  - [ ] Restart services
  - [ ] Run diagnostics
- [ ] UI: Actions tab with recent actions history
- [ ] UI: Audit log viewer

### Week 5: Alerting System
- [ ] Background job: Alert rule evaluator (runs every 60s)
- [ ] Implement alert rules:
  - [ ] CPU high
  - [ ] Disk full
  - [ ] Service down
  - [ ] Device offline
- [ ] Integrate BetterStack webhooks
- [ ] UI: Alerts module with acknowledge/resolve
- [ ] UI: Alert rules configuration

### Week 6: Multi-Tenant & Subscriptions
- [ ] Organizations CRUD API
- [ ] Sites CRUD API
- [ ] Subscription tracking
- [ ] Device assignment to orgs/sites
- [ ] UI: Settings pages (orgs, sites, users, roles)
- [ ] UI: Subscription management

**Deliverable:** Production-ready platform for internal devices

---

## Phase 3: Scanner Operations (Weeks 7-9) 🔍

**Goal:** Greenbone integration and vulnerability tracking

### Week 7: Greenbone Integration
- [ ] Agent: Implement GMP client (Greenbone Management Protocol)
- [ ] Agent: Collect scanner stats:
  - [ ] Tasks (total, running, queued)
  - [ ] Scans (running, completed 24h)
  - [ ] Feed status (NVT count, last update)
  - [ ] Vulnerability counts (critical/high/medium/low)
- [ ] API: Scanner stats endpoints
- [ ] Database: scanner_stats table

### Week 8: Scanner UI
- [ ] UI: Greenbone tab (stack health, feed status, tasks)
- [ ] UI: Scans tab (active scans with progress bars)
- [ ] UI: Vulnerabilities tab:
  - [ ] Severity breakdown pie chart
  - [ ] Top 10 CVEs table
  - [ ] Top affected assets
- [ ] UI: Scanner Ops aggregate view (fleet-wide)

### Week 9: Scanner Actions
- [ ] Remote actions:
  - [ ] Restart Greenbone stack
  - [ ] Sync feeds
  - [ ] Run diagnostics
  - [ ] Download logs
- [ ] Agent: Greenbone service control
- [ ] UI: Quick actions on Greenbone tab

**Deliverable:** Full scanner fleet visibility and control

---

## Phase 4: Backup & Recovery (Weeks 10-12) 💾

**Goal:** Automated backups and bare-metal recovery

### Week 10: File-Level Backups
- [ ] Install restic on backup server
- [ ] Agent: Implement restic wrapper
- [ ] Agent: Backup orchestrator (schedule, execute, verify)
- [ ] API: Backup configuration endpoints
- [ ] API: Backups catalog endpoints
- [ ] Background job: Backup scheduler (cron)
- [ ] UI: Backups tab (config, recent backups, restore button)

### Week 11: Recovery USB Creation
- [ ] Build Alpine Linux minimal image
- [ ] Include WireGuard client
- [ ] Add xspectre-recovery script:
  - [ ] Auto-detect network and connect
  - [ ] Register with API as "RECOVERY MODE"
  - [ ] Wait for commands (backup SSD, restore image, reinstall)
- [ ] Configure UEFI + Legacy BIOS boot
- [ ] Test boot sequence on HP L1W21AV hardware
- [ ] Document USB creation process

### Week 12: Full Disk Backups
- [ ] Agent: Implement full disk backup trigger
- [ ] Recovery USB: dd+zstd pipeline for disk imaging
- [ ] API: Restore orchestration (trigger USB boot remotely)
- [ ] UI: Recovery actions (require super_admin role)
- [ ] Test full restore workflow (backup → wipe → restore → verify)

**Deliverable:** Enterprise-grade backup and recovery system

---

## Phase 5: Advanced Features (Weeks 13+) 🚀

**Goal:** Polish and advanced functionality

### Week 13: Web Terminal & File Manager
- [ ] API: SSH proxy over WireGuard
- [ ] UI: Web terminal (xterm.js + WebSocket)
- [ ] API: SFTP server
- [ ] UI: File manager (browse, upload, download, delete)
- [ ] Security: Audit all file operations

### Week 14: Reporting & Analytics
- [ ] Database: Reports schema (scheduled reports, templates)
- [ ] API: Generate PDF reports
- [ ] UI: Reports module:
  - [ ] Fleet health report
  - [ ] Vulnerability summary report
  - [ ] Uptime report
  - [ ] Compliance report
- [ ] Schedule automated weekly/monthly reports

### Week 15: Performance Optimization
- [ ] Database: Enable TimescaleDB for metrics_rollup
- [ ] Database: Partition audit_log by month
- [ ] API: Implement caching (Redis)
- [ ] UI: Lazy loading and pagination optimization
- [ ] Load testing (simulate 500 devices)

### Week 16: Production Hardening
- [ ] Security audit
- [ ] Penetration testing (internal)
- [ ] Disaster recovery testing
- [ ] Documentation review
- [ ] Operator training sessions
- [ ] Deployment to production environment

**Deliverable:** Production-hardened platform ready for 50-60+ devices

---

## Post-Launch: Continuous Improvement 🔄

### Ongoing Tasks
- [ ] Monitor system performance and optimize
- [ ] Respond to operator feedback
- [ ] Add new integrations (Wazuh, NewRelic, etc.)
- [ ] Expand to 100+ devices (scale infrastructure)
- [ ] Advanced automation (auto-remediation, playbooks)
- [ ] Mobile app for on-call operators
- [ ] Multi-region support

---

## Resource Allocation

### Development Team (Recommended)
- **1x Full-stack Developer** (backend + frontend)
- **1x DevOps Engineer** (infrastructure + agent)
- **0.5x UI/UX Designer** (wireframes → mockups)
- **0.25x Security Consultant** (audit + hardening)

### Estimated Total Time
- **MVP:** 3 weeks
- **Core Features:** 3 weeks
- **Scanner Ops:** 3 weeks
- **Backup & Recovery:** 3 weeks
- **Advanced Features:** 4+ weeks
- **Total:** 16+ weeks for full platform

### Budget Considerations
- **Cloud server:** $100-200/month (OVH or AWS)
- **BetterStack:** $0-50/month (depending on alert volume)
- **Development time:** 4 months @ 1.5 FTE
- **Hardware:** USB drives for recovery ($10/device)

---

## Success Metrics

### Technical Metrics
- [ ] Enrollment time < 5 minutes per device
- [ ] Heartbeat latency < 2 seconds
- [ ] Dashboard load time < 3 seconds
- [ ] 99.9% uptime for management platform
- [ ] Alert delivery < 60 seconds from trigger

### Business Metrics
- [ ] 50-60 devices enrolled in first 3 months
- [ ] Zero data loss from backup/recovery
- [ ] Reduce manual device management time by 80%
- [ ] Operator satisfaction score > 8/10
- [ ] Zero security incidents related to platform

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Agent compatibility issues** | Test on all target OS versions early |
| **WireGuard tunnel instability** | Implement auto-reconnect + keepalive monitoring |
| **Database performance at scale** | Implement indexes + partitioning from day 1 |
| **Recovery USB fails to boot** | Test on actual hardware, support Legacy BIOS |
| **Greenbone API changes** | Version lock GMP protocol, test upgrades in staging |
| **Operator training required** | Create comprehensive docs + video tutorials |
| **Single point of failure (cloud)** | Plan multi-region architecture for Phase 6 |

---

## Decision Points

### Technology Choices Still Needed:
1. **Agent Language:** Go (recommended) vs Node.js
   - **Go Pros:** Single binary, low resources, fast
   - **Node.js Pros:** Same language as API, easier development
   - **Recommendation:** Go for production, Node.js for prototype

2. **Frontend Framework:** React vs Vue vs Next.js
   - **Recommendation:** Next.js (SSR, API routes, TypeScript)

3. **Backup Storage:** ZFS vs ext4
   - **Recommendation:** ZFS (compression, snapshots, integrity)

4. **Recovery USB Base:** Alpine vs Debian
   - **Recommendation:** Alpine (smaller, 2-4GB vs 8GB+)

---

**Last Updated:** December 2024  
**Status:** Planning Phase  
**Next Milestone:** Phase 1 Week 1 (Cloud Infrastructure Deployment)
