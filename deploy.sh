#!/bin/bash
set -e

echo "=========================================="
echo "xSPECTRE Ops Console - Automated Deployment"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get server public IP
PUBLIC_IP=$(curl -s ifconfig.me)
echo "Detected public IP: $PUBLIC_IP"
echo ""

# Update system
echo -e "${YELLOW}[1/12] Updating system packages...${NC}"
sudo apt update
sudo apt upgrade -y

# Install prerequisites
echo -e "${YELLOW}[2/12] Installing prerequisites...${NC}"
sudo apt install -y curl wget git build-essential ufw

# Install WireGuard
echo -e "${YELLOW}[3/12] Installing WireGuard...${NC}"
sudo apt install -y wireguard

# Generate WireGuard keys
echo -e "${YELLOW}[4/12] Generating WireGuard keys...${NC}"
sudo mkdir -p /etc/wireguard
cd /etc/wireguard
if [ ! -f server.key ]; then
    sudo wg genkey | sudo tee server.key | sudo wg pubkey | sudo tee server.pub
fi
WG_PRIVATE_KEY=$(sudo cat server.key)
WG_PUBLIC_KEY=$(sudo cat server.pub)

# Create WireGuard config
echo -e "${YELLOW}[5/12] Configuring WireGuard...${NC}"
sudo tee /etc/wireguard/wg0.conf > /dev/null <<EOF
[Interface]
Address = 10.10.0.1/24
ListenPort = 51820
PrivateKey = $WG_PRIVATE_KEY
SaveConfig = true

# Enable IP forwarding
PostUp = sysctl -w net.ipv4.ip_forward=1
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT
PostUp = iptables -A FORWARD -o wg0 -j ACCEPT
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT
PostDown = iptables -D FORWARD -o wg0 -j ACCEPT
EOF

# Enable IP forwarding
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Start WireGuard
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0

echo -e "${GREEN}✓ WireGuard configured on 10.10.0.1:51820${NC}"

# Install Node.js 20
echo -e "${YELLOW}[6/12] Installing Node.js 20...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Install PostgreSQL
echo -e "${YELLOW}[7/12] Installing PostgreSQL...${NC}"
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and user
echo -e "${YELLOW}[8/12] Setting up database...${NC}"
DB_PASSWORD=$(openssl rand -hex 16)

sudo -u postgres psql <<EOF
DROP DATABASE IF EXISTS xspectre_ops;
DROP USER IF EXISTS xspectre;
CREATE DATABASE xspectre_ops;
CREATE USER xspectre WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE xspectre_ops TO xspectre;
ALTER DATABASE xspectre_ops OWNER TO xspectre;
\q
EOF

echo -e "${GREEN}✓ Database created with password: $DB_PASSWORD${NC}"

# Clone repository
echo -e "${YELLOW}[9/12] Cloning repository...${NC}"
sudo mkdir -p /opt/xspectre
sudo chown $USER:$USER /opt/xspectre
cd /opt/xspectre

if [ -d ".git" ]; then
    git pull origin main
else
    git clone https://github.com/UveenAbey/ops-console.git .
fi

# Install API dependencies
echo -e "${YELLOW}[10/12] Installing API dependencies...${NC}"
cd /opt/xspectre/cloud/api
npm install

# Create .env file
echo -e "${YELLOW}[11/12] Configuring environment...${NC}"
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_PASSWORD=$(openssl rand -hex 12)

cat > /opt/xspectre/cloud/api/.env <<EOF
# Database
DATABASE_URL=postgresql://xspectre:$DB_PASSWORD@localhost:5432/xspectre_ops

# JWT Secret
JWT_SECRET=$JWT_SECRET

# WireGuard
WIREGUARD_INTERFACE=wg0
WIREGUARD_SUBNET=10.10.0.0/24
WIREGUARD_SERVER_IP=10.10.0.1
WIREGUARD_PUBLIC_KEY=$WG_PUBLIC_KEY

# Cloud Server
CLOUD_PUBLIC_IP=$PUBLIC_IP
CLOUD_DOMAIN=$PUBLIC_IP

# API
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Admin
ADMIN_PASSWORD=$ADMIN_PASSWORD

# Security
SESSION_TIMEOUT_MINUTES=30
MAX_LOGIN_ATTEMPTS=5

# Monitoring
HEARTBEAT_INTERVAL=60
DEVICE_OFFLINE_THRESHOLD=3
METRICS_RETENTION_DAYS=90

# Backup
BACKUP_STORAGE_PATH=/var/backups/xspectre
EOF

chmod 600 /opt/xspectre/cloud/api/.env

# Create logs directory
sudo mkdir -p /opt/xspectre/cloud/api/logs
sudo chown $USER:$USER /opt/xspectre/cloud/api/logs

# Create backup directory
sudo mkdir -p /var/backups/xspectre
sudo chown $USER:$USER /var/backups/xspectre

# Run database migrations
echo -e "${YELLOW}[12/12] Running database migrations...${NC}"
cd /opt/xspectre/cloud/api
npm run db:migrate

# Seed initial data
echo "Seeding initial data..."
npm run db:seed

# Create systemd service
echo "Creating systemd service..."
sudo tee /etc/systemd/system/xspectre-api.service > /dev/null <<EOF
[Unit]
Description=xSPECTRE Ops Console API
After=network.target postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/xspectre/cloud/api
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node /opt/xspectre/cloud/api/server.js
Restart=on-failure
RestartSec=10

StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Start service
sudo systemctl daemon-reload
sudo systemctl enable xspectre-api
sudo systemctl start xspectre-api

# Configure firewall
echo "Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 51820/udp
sudo ufw --force enable

# Wait for service to start
sleep 3

# Check service status
echo ""
echo "=========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo "Service Status:"
sudo systemctl status xspectre-api --no-pager || true
echo ""
echo "API Health Check:"
curl -s http://localhost:3000/health | python3 -m json.tool || echo "API not responding yet"
echo ""
echo "=========================================="
echo "CREDENTIALS (SAVE THESE!):"
echo "=========================================="
echo ""
echo "Web Console: http://$PUBLIC_IP:3000"
echo "Admin Email: admin@xspectre.internal"
echo "Admin Password: $ADMIN_PASSWORD"
echo ""
echo "WireGuard Public Key: $WG_PUBLIC_KEY"
echo "Database Password: $DB_PASSWORD"
echo ""
echo "=========================================="
echo "NEXT STEPS:"
echo "=========================================="
echo ""
echo "1. Access the console: http://$PUBLIC_IP:3000/health"
echo "2. Login with admin credentials above"
echo "3. Change admin password in Settings"
echo "4. Create your first device with claim code"
echo "5. Install Nginx reverse proxy (optional)"
echo ""
echo "View logs: sudo journalctl -u xspectre-api -f"
echo "Restart API: sudo systemctl restart xspectre-api"
echo "Check WireGuard: sudo wg show"
echo ""
