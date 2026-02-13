# Installation Guide - xSPECTRE Ops Console

Complete installation and setup instructions for both cloud infrastructure and device-side components.

---

## Overview

xSPECTRE Ops Console consists of:
1. **Cloud Infrastructure** (OVH/your cloud server)
2. **Device Agent** (scanners + servers)
3. **Recovery USB** (bare-metal recovery)

---

## Part 1: Cloud Infrastructure Setup

### Prerequisites

- Ubuntu 22.04 LTS or Debian 12 server
- Minimum 8 vCPU, 16GB RAM, 100GB disk
- Public IP address
- Root or sudo access

### 1.1 Initial Server Setup

```bash
# Update system
apt update && apt upgrade -y

# Install basic tools
apt install -y curl wget git build-essential ufw

# Set timezone
timedatectl set-timezone Australia/Sydney

# Configure firewall
ufw allow 22/tcp      # SSH
ufw allow 443/tcp     # HTTPS (Ops Console)
ufw allow 51820/udp   # WireGuard
ufw enable
```

### 1.2 Install WireGuard Hub

```bash
# Install WireGuard
apt install -y wireguard

# Generate server keys
umask 077
wg genkey | tee /etc/wireguard/server.key | wg pubkey > /etc/wireguard/server.pub

# Create WireGuard config
cat > /etc/wireguard/wg0.conf <<EOF
[Interface]
Address = 10.10.0.1/24
ListenPort = 51820
PrivateKey = $(cat /etc/wireguard/server.key)
SaveConfig = true

# Enable IP forwarding
PostUp = sysctl -w net.ipv4.ip_forward=1
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT
PostUp = iptables -A FORWARD -o wg0 -j ACCEPT
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT
PostDown = iptables -D FORWARD -o wg0 -j ACCEPT
EOF

# Enable IP forwarding permanently
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p

# Start WireGuard
systemctl enable wg-quick@wg0
systemctl start wg-quick@wg0

# Verify
wg show
```

Your WireGuard hub is now running on `10.10.0.1`, listening on UDP 51820.

### 1.3 Install Node.js (for API)

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify
node --version  # Should be v20.x
npm --version
```

### 1.4 Install PostgreSQL

```bash
# Install PostgreSQL 14+
apt install -y postgresql postgresql-contrib

# Start and enable
systemctl enable postgresql
systemctl start postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE DATABASE xspectre_ops;
CREATE USER xspectre WITH ENCRYPTED PASSWORD 'CHANGE_THIS_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE xspectre_ops TO xspectre;
\q
EOF
```

### 1.5 Install Redis (Optional, but recommended)

```bash
apt install -y redis-server

# Configure Redis
sed -i 's/^bind 127.0.0.1/bind 127.0.0.1/g' /etc/redis/redis.conf

systemctl enable redis-server
systemctl start redis-server
```

### 1.6 Clone and Setup Ops Console

```bash
# Create application directory
mkdir -p /opt/xspectre
cd /opt/xspectre

# Clone repository (or upload your code)
git clone https://github.com/your-org/xspectre-ops-console.git .

# Install API dependencies
cd cloud/api
npm install

# Install UI dependencies
cd ../ui
npm install
npm run build

cd /opt/xspectre
```

### 1.7 Configure Environment

```bash
# Create API environment file
cat > /opt/xspectre/cloud/api/.env <<EOF
# Database
DATABASE_URL=postgresql://xspectre:CHANGE_THIS_PASSWORD@localhost:5432/xspectre_ops

# Redis (optional)
REDIS_URL=redis://localhost:6379

# JWT Secret (generate a strong random string)
JWT_SECRET=$(openssl rand -hex 32)

# WireGuard Hub
WIREGUARD_INTERFACE=wg0
WIREGUARD_SUBNET=10.10.0.0/24
WIREGUARD_SERVER_IP=10.10.0.1
WIREGUARD_PUBLIC_KEY=$(cat /etc/wireguard/server.pub)

# BetterStack (optional)
BETTERSTACK_WEBHOOK_URL=https://uptime.betterstack.com/api/v1/...

# Backup Storage
BACKUP_STORAGE_PATH=/var/backups/xspectre

# API
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Security
SESSION_TIMEOUT_MINUTES=30
MAX_LOGIN_ATTEMPTS=5

# Cloud public IP (for device enrollment)
CLOUD_PUBLIC_IP=$(curl -s ifconfig.me)
CLOUD_DOMAIN=ops.xspectre.internal  # Or your actual domain
EOF

# Secure the env file
chmod 600 /opt/xspectre/cloud/api/.env
```

### 1.8 Initialize Database

```bash
cd /opt/xspectre/cloud/api

# Run migrations
npm run db:migrate

# Seed initial data (creates xSPECTRE Internal org + admin user)
npm run db:seed
```

### 1.9 Setup Systemd Services

**API Service:**

```bash
cat > /etc/systemd/system/xspectre-api.service <<EOF
[Unit]
Description=xSPECTRE Ops Console API
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/xspectre/cloud/api
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node /opt/xspectre/cloud/api/server.js
Restart=on-failure
RestartSec=10

# Logging
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable xspectre-api
systemctl start xspectre-api
systemctl status xspectre-api
```

### 1.10 Install and Configure Nginx (Reverse Proxy)

```bash
apt install -y nginx certbot python3-certbot-nginx

# Create Nginx config
cat > /etc/nginx/sites-available/xspectre <<'EOF'
server {
    listen 80;
    server_name ops.xspectre.internal;  # Change to your domain

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ops.xspectre.internal;

    # SSL certificates (will be added by certbot)
    # ssl_certificate /etc/letsencrypt/live/ops.xspectre.internal/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/ops.xspectre.internal/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket for terminal
    location /ws/ {
        proxy_pass http://127.0.0.1:3000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # UI static files
    location / {
        root /opt/xspectre/cloud/ui/dist;
        try_files $uri $uri/ /index.html;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/xspectre /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Test config
nginx -t

# Restart Nginx
systemctl restart nginx
```

**Optional: Get SSL certificate (if using a real domain):**

```bash
certbot --nginx -d ops.xspectre.internal
```

### 1.11 Setup Backup Storage

```bash
# Create backup directories
mkdir -p /var/backups/xspectre/{file-backups,disk-images}

# Set permissions
chown -R root:root /var/backups/xspectre
chmod 700 /var/backups/xspectre

# Optional: Mount dedicated backup drive
# If you have a separate drive, format and mount it here
```

For production, consider ZFS:

```bash
# Install ZFS
apt install -y zfsutils-linux

# Create ZFS pool (example with 4 disks in RAIDZ2)
zpool create backup-pool raidz2 /dev/sdb /dev/sdc /dev/sdd /dev/sde

# Enable compression
zfs set compression=zstd backup-pool

# Set mount point
zfs set mountpoint=/var/backups/xspectre backup-pool

# Create datasets
zfs create backup-pool/file-backups
zfs create backup-pool/disk-images
```

### 1.12 Create First Admin User

```bash
cd /opt/xspectre/cloud/api

# Run user creation script
npm run create-user -- \
  --email admin@xspectre.internal \
  --username admin \
  --password CHANGE_THIS_PASSWORD \
  --role super_admin
```

### 1.13 Verify Installation

```bash
# Check all services
systemctl status xspectre-api
systemctl status postgresql
systemctl status redis
systemctl status nginx
systemctl status wg-quick@wg0

# Check logs
journalctl -u xspectre-api -f

# Test API
curl http://localhost:3000/health

# Access UI
# Open browser: https://ops.xspectre.internal (or your server IP)
```

---

## Part 2: Device Setup (Scanner/Server)

### 2.1 Bootstrap Script

This script will be run on each scanner/server to enroll it.

Save as `/tmp/bootstrap.sh` on the cloud server:

```bash
#!/bin/bash
set -e

# xSPECTRE Device Bootstrap Script
# Usage: curl -fsSL https://your-cloud/bootstrap.sh | sudo bash -s -- --claim-code CODE

CLAIM_CODE=""
API_URL="https://ops.xspectre.internal/api"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --claim-code)
            CLAIM_CODE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

if [ -z "$CLAIM_CODE" ]; then
    echo "Error: --claim-code required"
    echo "Usage: $0 --claim-code <CODE>"
    exit 1
fi

echo "=== xSPECTRE Device Enrollment ==="
echo "Claim code: $CLAIM_CODE"
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    OS_VERSION=$VERSION_ID
else
    echo "Error: Cannot detect OS"
    exit 1
fi

echo "Detected OS: $OS $OS_VERSION"

# Install WireGuard
echo "Installing WireGuard..."
case $OS in
    debian|ubuntu)
        apt update
        apt install -y wireguard curl jq
        ;;
    centos|rhel|almalinux|rocky)
        yum install -y epel-release
        yum install -y wireguard-tools curl jq
        ;;
    *)
        echo "Unsupported OS: $OS"
        exit 1
        ;;
esac

# Generate WireGuard keys
echo "Generating WireGuard keys..."
umask 077
mkdir -p /etc/wireguard
wg genkey | tee /etc/wireguard/client.key | wg pubkey > /etc/wireguard/client.pub

CLIENT_PRIVATE_KEY=$(cat /etc/wireguard/client.key)
CLIENT_PUBLIC_KEY=$(cat /etc/wireguard/client.pub)

# Collect hardware facts
echo "Collecting hardware facts..."
HOSTNAME=$(hostname)
LOCAL_IP=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '^127\.' | head -n1)
MAC_ADDRESSES=$(ip link show | grep -oP '(?<=link/ether\s)[0-9a-f:]{17}' | tr '\n' ',' | sed 's/,$//')
SERIAL=$(dmidecode -s system-serial-number 2>/dev/null || echo "unknown")
MODEL=$(dmidecode -s system-product-name 2>/dev/null || echo "unknown")
MANUFACTURER=$(dmidecode -s system-manufacturer 2>/dev/null || echo "unknown")
CPU_MODEL=$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2 | xargs)
CPU_CORES=$(nproc)
RAM_GB=$(free -g | awk '/^Mem:/{print $2}')
DISK_GB=$(df / --output=size -BG | tail -1 | tr -d 'G')
OS_TYPE=$OS
OS_VERSION_FULL="$OS $OS_VERSION"
KERNEL=$(uname -r)

# Check if Docker is present
if command -v docker &> /dev/null; then
    DOCKER_PRESENT=true
else
    DOCKER_PRESENT=false
fi

# Check if LVM is present
if command -v lvm &> /dev/null && [ -d /dev/mapper ]; then
    LVM_PRESENT=true
else
    LVM_PRESENT=false
fi

# Enroll device
echo "Enrolling device..."
ENROLLMENT_RESPONSE=$(curl -s -X POST "$API_URL/enroll" \
    -H "Content-Type: application/json" \
    -d @- <<EOF
{
    "claim_code": "$CLAIM_CODE",
    "hostname": "$HOSTNAME",
    "wg_public_key": "$CLIENT_PUBLIC_KEY",
    "local_ip": "$LOCAL_IP",
    "mac_addresses": "$MAC_ADDRESSES",
    "manufacturer": "$MANUFACTURER",
    "model": "$MODEL",
    "serial_number": "$SERIAL",
    "cpu_model": "$CPU_MODEL",
    "cpu_cores": $CPU_CORES,
    "ram_gb": $RAM_GB,
    "disk_gb": $DISK_GB,
    "os_type": "$OS_TYPE",
    "os_version": "$OS_VERSION_FULL",
    "kernel_version": "$KERNEL",
    "docker_present": $DOCKER_PRESENT,
    "lvm_present": $LVM_PRESENT
}
EOF
)

# Parse response
if echo "$ENROLLMENT_RESPONSE" | jq -e .error > /dev/null 2>&1; then
    echo "Enrollment failed:"
    echo "$ENROLLMENT_RESPONSE" | jq -r .error
    exit 1
fi

WG_IP=$(echo "$ENROLLMENT_RESPONSE" | jq -r .wg_ip)
WG_SERVER_PUBLIC_KEY=$(echo "$ENROLLMENT_RESPONSE" | jq -r .wg_server_public_key)
WG_SERVER_ENDPOINT=$(echo "$ENROLLMENT_RESPONSE" | jq -r .wg_server_endpoint)
DEVICE_ID=$(echo "$ENROLLMENT_RESPONSE" | jq -r .device_id)

echo "Enrollment successful!"
echo "Device ID: $DEVICE_ID"
echo "WireGuard IP: $WG_IP"

# Create WireGuard config
cat > /etc/wireguard/wg0.conf <<EOF
[Interface]
Address = $WG_IP/24
PrivateKey = $CLIENT_PRIVATE_KEY

[Peer]
PublicKey = $WG_SERVER_PUBLIC_KEY
Endpoint = $WG_SERVER_ENDPOINT
AllowedIPs = 10.10.0.1/32
PersistentKeepalive = 25
EOF

# Start WireGuard
echo "Starting WireGuard..."
systemctl enable wg-quick@wg0
systemctl start wg-quick@wg0

# Verify connection
sleep 2
if ping -c 2 10.10.0.1 > /dev/null 2>&1; then
    echo "✓ WireGuard tunnel established"
else
    echo "✗ Warning: Cannot ping WireGuard hub"
fi

# Install xspectre-agent
echo "Installing xSPECTRE agent..."
mkdir -p /opt/xspectre

# Download agent binary (adjust URL to your actual location)
curl -fsSL "$API_URL/downloads/xspectre-agent" -o /opt/xspectre/agent
chmod +x /opt/xspectre/agent

# Create agent config
cat > /etc/xspectre/agent.conf <<EOF
{
    "device_id": "$DEVICE_ID",
    "api_url": "$API_URL",
    "wg_interface": "wg0",
    "heartbeat_interval": 60,
    "log_level": "info"
}
EOF

# Create systemd service
cat > /etc/systemd/system/xspectre-agent.service <<EOF
[Unit]
Description=xSPECTRE Agent
After=network.target wg-quick@wg0.service

[Service]
Type=simple
ExecStart=/opt/xspectre/agent
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start agent
systemctl daemon-reload
systemctl enable xspectre-agent
systemctl start xspectre-agent

echo ""
echo "=== Enrollment Complete ==="
echo "Device is now managed by xSPECTRE Ops Console"
echo "View in dashboard: https://ops.xspectre.internal"
echo ""
```

Make it downloadable:

```bash
# On cloud server
cp /tmp/bootstrap.sh /opt/xspectre/cloud/api/public/bootstrap.sh
chmod +r /opt/xspectre/cloud/api/public/bootstrap.sh
```

### 2.2 Enrolling a New Device

**On Ops Console:**
1. Navigate to Inventory → Add Device
2. Select device type (Scanner/Server)
3. Select billing type (Customer/Internal)
4. Assign to org/site
5. Generate claim code (copy it)

**On the device:**

```bash
curl -fsSL https://ops.xspectre.internal/api/downloads/bootstrap.sh | \
  sudo bash -s -- --claim-code <CLAIM_CODE>
```

The device will automatically enroll and appear in your inventory.

---

## Part 3: Recovery USB Creation

### 3.1 Build Recovery USB Image

On a Linux workstation:

```bash
# Download Alpine Linux minimal ISO
wget https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/x86_64/alpine-standard-3.19.0-x86_64.iso

# Mount ISO
mkdir /mnt/alpine-iso
mount -o loop alpine-standard-3.19.0-x86_64.iso /mnt/alpine-iso

# Create working directory
mkdir -p /tmp/recovery-usb
cp -r /mnt/alpine-iso/* /tmp/recovery-usb/

# Customize for xSPECTRE
cd /tmp/recovery-usb

# Add WireGuard and tools
# (Modify boot config to auto-install packages)

# Add xSPECTRE recovery script
mkdir -p overlay/opt/xspectre
cat > overlay/opt/xspectre/recovery.sh <<'EOF'
#!/bin/sh
# xSPECTRE Recovery Mode
# ... (recovery logic here)
EOF

# Create bootable USB image
# (Use tools like grub-mkrescue or xorriso)

# Write to USB
dd if=xspectre-recovery.iso of=/dev/sdX bs=4M status=progress
sync
```

### 3.2 Installing Recovery USB in Devices

1. Insert USB into internal USB port
2. Configure BIOS:
   - Boot order: 1) SSD, 2) USB
   - Enable "fallback to USB if SSD fails"
3. Save and reboot

---

## Troubleshooting

### WireGuard Not Connecting

```bash
# On device
wg show
ip a show wg0
ping 10.10.0.1

# Check firewall
ufw status

# Check WireGuard logs
journalctl -u wg-quick@wg0
```

### Agent Not Starting

```bash
systemctl status xspectre-agent
journalctl -u xspectre-agent -f

# Check config
cat /etc/xspectre/agent.conf
```

### API Not Responding

```bash
systemctl status xspectre-api
journalctl -u xspectre-api -f

# Check database connection
psql -U xspectre -d xspectre_ops -h localhost
```

---

## Next Steps

1. Configure alert rules (Settings → Alerts)
2. Setup BetterStack integration
3. Enable backups for critical devices
4. Create additional operator users
5. Configure scanner schedules
6. Set up automated reports

---

## Security Hardening (Production)

```bash
# Disable root SSH
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd

# Install fail2ban
apt install -y fail2ban

# Configure automatic security updates
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Regular backups of database
# Add to crontab:
0 2 * * * pg_dump xspectre_ops | gzip > /var/backups/xspectre-db-$(date +\%Y\%m\%d).sql.gz
```

---

For support: Contact your xSPECTRE infrastructure team.
