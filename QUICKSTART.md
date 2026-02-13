# xSPECTRE Ops Console - Quick Start

## 🎯 Project Status

**Documentation:** ✅ Complete  
**Cloud Infrastructure:** ⏳ Ready for deployment  
**Agent:** ⏳ Needs development  
**Recovery USB:** ⏳ Needs creation  
**Frontend UI:** ⏳ Needs development

---

## 📁 Project Structure

```
xspectre-ops-console/
├── README.md                          # Main project overview
├── QUICKSTART.md                      # This file
├── docs/
│   ├── architecture.md                # Complete system architecture (900+ lines)
│   ├── database-schema.md             # PostgreSQL schema (18 tables)
│   ├── wireframes.md                  # UI specifications (all screens)
│   └── installation.md                # Step-by-step installation guide
├── cloud/
│   └── api/
│       ├── package.json               # Node.js dependencies
│       ├── server.js                  # Express API server + WebSocket
│       ├── utils/
│       │   ├── database.js            # PostgreSQL connection pool
│       │   └── logger.js              # Winston logging
│       ├── routes/
│       │   ├── enroll.js              # Device enrollment endpoint
│       │   └── heartbeat.js           # Telemetry ingestion
│       └── scripts/
│           ├── migrate.js             # Database migrations
│           └── seed.js                # Seed initial data
└── agent/                             # Device agent (TODO)
```

---

## 🚀 Getting Started (3 Steps)

### Step 1: Deploy Cloud Infrastructure

```bash
# On your OVH cloud server (or any Ubuntu/Debian server)

# Clone repository
cd /opt
git clone https://github.com/your-org/xspectre-ops-console.git xspectre
cd xspectre

# Follow the complete installation guide
cat docs/installation.md

# Quick summary:
# 1. Install WireGuard (UDP 51820)
# 2. Install PostgreSQL 14+
# 3. Install Node.js 20 LTS
# 4. Setup database (migrate + seed)
# 5. Configure .env
# 6. Start API service
# 7. Setup Nginx reverse proxy
```

**Estimated time:** 30-45 minutes

### Step 2: Build Device Agent

The agent needs to be developed in Go or Node.js. See architecture docs for specifications.

**Key features:**
- Heartbeat sender (60s interval)
- Metrics collector (CPU, RAM, disk, network, services, Docker containers)
- Scanner stats collector (Greenbone GMP integration)
- Command executor (receive and execute remote commands)
- Backup orchestrator (restic wrapper + Recovery USB trigger)

**Estimated development time:** 1-2 weeks

### Step 3: Create Recovery USB

Build a bootable USB image with:
- Alpine Linux minimal or Debian netinst
- WireGuard pre-configured
- Auto-connect to cloud hub (10.10.0.1)
- Recovery mode script (backup SSD, restore image, reinstall OS)

**Estimated time:** 2-3 days

---

## 📊 What's Complete

### ✅ Documentation (100%)
- [README.md](README.md) - Full project overview
- [docs/architecture.md](docs/architecture.md) - Complete technical architecture with diagrams
- [docs/database-schema.md](docs/database-schema.md) - Production-ready PostgreSQL schema (18 tables)
- [docs/wireframes.md](docs/wireframes.md) - All UI screens wireframed
- [docs/installation.md](docs/installation.md) - Step-by-step deployment guide

### ✅ Backend API Scaffolding (40%)
- ✅ Express server with WebSocket
- ✅ Database connection pooling
- ✅ Logging with Winston
- ✅ Enrollment endpoint (with WireGuard peer auto-add)
- ✅ Heartbeat ingestion endpoint
- ✅ Database migrations script
- ✅ Seeding script (creates xSPECTRE Internal org + admin user)
- ⏳ TODO: Device CRUD routes
- ⏳ TODO: Command queue routes
- ⏳ TODO: Alert routes
- ⏳ TODO: Backup routes
- ⏳ TODO: Authentication middleware (JWT)
- ⏳ TODO: Background jobs (alert evaluator, backup scheduler, device monitor)

### ⏳ Device Agent (0%)
- Not yet started
- Needs Go or Node.js implementation
- Specification documented in architecture.md

### ⏳ Frontend UI (0%)
- Not yet started
- All screens wireframed in docs/wireframes.md
- Recommended: React or Next.js

### ⏳ Recovery USB (0%)
- Not yet started
- Design documented in architecture.md (backup & recovery section)

---

## 🎨 Key Features (From Requirements)

### Core Management
- ✅ Designed: Device inventory with org/site grouping
- ✅ Designed: Real-time monitoring (CPU, RAM, disk, network)
- ✅ Designed: Service status tracking
- ✅ Designed: Docker container monitoring
- ✅ Designed: Remote command execution (reboot, hostname change, etc.)
- ✅ Designed: Web terminal (SSH over WireGuard)
- ✅ Designed: File manager (SFTP browser)

### Scanner-Specific Features
- ✅ Designed: Greenbone stack health monitoring
- ✅ Designed: Active scan progress tracking
- ✅ Designed: Vulnerability aggregation (critical/high/medium/low)
- ✅ Designed: Top CVEs across fleet
- ✅ Designed: Scanner operations dashboard
- ✅ Designed: Feed sync status

### Alerting
- ✅ Designed: Configurable alert rules (CPU, disk, service down, device offline)
- ✅ Designed: BetterStack webhook integration
- ✅ Designed: Email/SMS/Slack notifications
- ✅ Designed: Alert acknowledgment workflow
- ✅ Designed: Cooldown periods to prevent spam

### Backup & Recovery
- ✅ Designed: Per-device backup toggle (OFF/FILE/FULL/HYBRID)
- ✅ Designed: File-level backups (restic incremental)
- ✅ Designed: Full disk backups (Recovery USB method)
- ✅ Designed: ZFS storage backend with compression
- ✅ Designed: Backup verification and restore testing
- ✅ Designed: USB-based bare-metal recovery system

### Multi-Tenant
- ✅ Designed: Customer vs Internal device tracking
- ✅ Designed: Subscription management (billable customer devices)
- ✅ Designed: Org/site hierarchy
- ✅ Designed: Per-org billing and subscription status

### Security & Compliance
- ✅ Designed: RBAC (super_admin, operator, read_only)
- ✅ Designed: Audit log (1-year minimum retention)
- ✅ Designed: Encrypted backups (AES-256)
- ✅ Designed: Signed remote commands (prevent replay attacks)
- ✅ Designed: 2FA support for users
- ✅ Designed: Internal-only platform (no customer access)

---

## 🔐 Security Notes

This platform is **internal-only** for xSPECTRE SOC operators:
- **No customer access** to the Ops Console
- All devices connect **outbound-only** (no port forwarding at customer sites)
- WireGuard overlay network (10.10.0.0/24) isolates management traffic
- Backups are encrypted at rest (AES-256)
- All remote commands are signed and expire after 5 minutes
- Audit log tracks all operator actions

---

## 📈 Scale Targets

| Scale | Infrastructure |
|-------|----------------|
| **Current (50-60 devices)** | Single server (8 vCPU, 16GB RAM) |
| **100-500 devices** | Separate DB server, load-balanced API, backup cluster |
| **500+ devices** | Multi-region deployment, edge nodes, S3 storage, Kafka event bus |

Current design targets **50-500 devices** on single server architecture.

---

## 🛠️ Technology Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | React/Vue/Next.js (TBD) |
| **Backend API** | Node.js + Express |
| **Database** | PostgreSQL 14+ |
| **Cache** | Redis (optional) |
| **VPN** | WireGuard (self-hosted hub) |
| **Agent** | Go or Node.js (TBD) |
| **Backups** | restic (file-level), dd+zstd (full disk) |
| **Storage** | ZFS RAIDZ2 with compression |
| **Alerting** | BetterStack webhooks |
| **Logging** | Winston (API), journald (devices) |
| **Monitoring** | Custom metrics + PostgreSQL time-series |

---

## 🔗 Network Architecture

```
                        Internet
                           │
                           │
                    ┌──────▼──────┐
                    │  OVH Cloud  │
                    │   Server    │
                    │             │
                    │ ┌─────────┐ │
                    │ │   API   │ │
                    │ │   UI    │ │
                    │ │   DB    │ │
                    │ │ WireGuard│ │ 10.10.0.1
                    │ │   Hub   │ │
                    │ └─────────┘ │
                    └─────┬───────┘
                          │
              WireGuard Overlay (10.10.0.0/24)
              │           │           │
    ┌─────────▼───┐   ┌──▼──────┐   ┌▼──────────┐
    │ Scanner A1  │   │Scanner  │   │ Server B1 │
    │ 10.10.0.20  │   │   A2    │   │10.10.0.50 │
    │             │   │10.10.0.21│  │           │
    │ Customer A  │   │Customer │   │Customer B │
    │   Site 1    │   │  Site2  │   │  Site 1   │
    └─────────────┘   └─────────┘   └───────────┘
         Local              Local         Local
       192.168.1.x       172.16.0.x    10.0.0.x
```

**Key Points:**
- Devices connect **outbound only** (no inbound ports needed at customer sites)
- Management traffic flows over WireGuard overlay
- Scanners can scan local networks (not affected by WireGuard)
- Cloud hub is single point of access

---

## 📞 Next Steps

### For Development Team:

1. **Immediate (Week 1):**
   - Deploy cloud infrastructure following `docs/installation.md`
   - Test enrollment API endpoint
   - Create demo device for testing

2. **Short-term (Weeks 2-3):**
   - Develop device agent (Go recommended)
   - Implement remaining API routes (devices, commands, alerts)
   - Build frontend dashboard MVP

3. **Medium-term (Weeks 4-6):**
   - Create Recovery USB image
   - Implement backup orchestration
   - Integrate BetterStack alerting
   - Build scanner-specific features (Greenbone GMP)

4. **Long-term (Weeks 7-12):**
   - Advanced features (file manager, web terminal)
   - Automated reports
   - Multi-region support planning
   - Load testing and optimization

### For Operators:

1. Read `docs/architecture.md` to understand system design
2. Review `docs/wireframes.md` to see planned UI
3. Provide feedback on feature priorities
4. Help test enrollment flow once agent is ready

---

## 📚 Documentation Index

| Document | Purpose | Status |
|----------|---------|--------|
| [README.md](README.md) | Project overview | ✅ Complete |
| [QUICKSTART.md](QUICKSTART.md) | This quick reference | ✅ Complete |
| [docs/architecture.md](docs/architecture.md) | Technical architecture | ✅ Complete |
| [docs/database-schema.md](docs/database-schema.md) | Database design | ✅ Complete |
| [docs/wireframes.md](docs/wireframes.md) | UI specifications | ✅ Complete |
| [docs/installation.md](docs/installation.md) | Deployment guide | ✅ Complete |

---

## ❓ Common Questions

**Q: Why WireGuard instead of Tailscale?**  
A: Self-hosted WireGuard gives us complete control, zero cost, and unlimited devices. Tailscale would cost money and have device limits.

**Q: Can customers access the Ops Console?**  
A: No. This is an **internal-only** platform for xSPECTRE SOC operators. Customers never see or access it.

**Q: How does plug-and-play enrollment work?**  
A: Operator creates device in UI → gets claim code → runs bootstrap script on device with claim code → device auto-enrolls and appears in dashboard. Zero manual configuration needed.

**Q: What if a device's SSD dies?**  
A: The internal USB Recovery drive can boot automatically, connect to cloud, and restore from the latest full disk backup. Bare-metal recovery without operator intervention.

**Q: How do backups work for 60 devices?**  
A: Per-device toggle. You decide which devices need backups (OFF/FILE/FULL/HYBRID). Internal servers might not need backups, but customer scanners probably do.

**Q: Does this affect Greenbone scanning?**  
A: No. WireGuard is for management only (10.10.0.0/24). Greenbone scans local networks normally over the device's physical NIC.

**Q: What if WireGuard tunnel goes down?**  
A: Device becomes "offline" in dashboard, alerts fire (if configured), but local services continue running. Greenbone keeps scanning. When tunnel reconnects, device auto-rejoins.

---

## 🐛 Reporting Issues

This is an internal project. Report issues to your infrastructure team lead.

---

**Last Updated:** December 2024  
**Project Lead:** xSPECTRE Infrastructure Team  
**Status:** Planning & Early Development
