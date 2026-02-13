# Simple Deployment Steps

## Step 1: SSH into your server

Open a new terminal and connect:

```bash
ssh spectre@192.168.1.58
```

Password: `Sp3c7reS3cur1ty`

---

## Step 2: Copy-paste these commands (one block at a time)

### Update system
```bash
sudo apt update && sudo apt upgrade -y
```

### Install everything needed
```bash
sudo apt install -y curl wget git build-essential wireguard postgresql postgresql-contrib nginx
```

### Install Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Setup WireGuard
```bash
sudo mkdir -p /etc/wireguard
cd /etc/wireguard
sudo wg genkey | sudo tee server.key | sudo wg pubkey | sudo tee server.pub
```

```bash
sudo bash -c 'cat > /etc/wireguard/wg0.conf << EOF
[Interface]
Address = 10.10.0.1/24
ListenPort = 51820
PrivateKey = $(cat /etc/wireguard/server.key)
SaveConfig = true
PostUp = sysctl -w net.ipv4.ip_forward=1
EOF'
```

```bash
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0
```

### Create database
```bash
sudo -u postgres psql -c "CREATE DATABASE xspectre_ops;"
sudo -u postgres psql -c "CREATE USER xspectre WITH ENCRYPTED PASSWORD 'Sp3ctr3DB2026';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE xspectre_ops TO xspectre;"
```

### Clone project
```bash
sudo mkdir -p /opt/xspectre
sudo chown $USER:$USER /opt/xspectre
cd /opt/xspectre
git clone https://github.com/UveenAbey/ops-console.git .
```

### Install dependencies
```bash
cd /opt/xspectre/cloud/api
npm install
```

### Create config file
```bash
cat > /opt/xspectre/cloud/api/.env << 'EOF'
DATABASE_URL=postgresql://xspectre:Sp3ctr3DB2026@localhost:5432/xspectre_ops
JWT_SECRET=your-secret-key-change-this-later
WIREGUARD_INTERFACE=wg0
WIREGUARD_SUBNET=10.10.0.0/24
WIREGUARD_SERVER_IP=10.10.0.1
WIREGUARD_PUBLIC_KEY=$(sudo cat /etc/wireguard/server.pub)
CLOUD_PUBLIC_IP=192.168.1.58
CLOUD_DOMAIN=192.168.1.58
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
ADMIN_PASSWORD=Admin123!
BACKUP_STORAGE_PATH=/var/backups/xspectre
EOF
```

### Run database setup
```bash
cd /opt/xspectre/cloud/api
mkdir -p logs
npm run db:migrate
npm run db:seed
```

### Create service
```bash
sudo bash -c 'cat > /etc/systemd/system/xspectre-api.service << EOF
[Unit]
Description=xSPECTRE Ops Console API
After=network.target postgresql.service

[Service]
Type=simple
User=spectre
WorkingDirectory=/opt/xspectre/cloud/api
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node /opt/xspectre/cloud/api/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF'
```

### Start the service
```bash
sudo systemctl daemon-reload
sudo systemctl enable xspectre-api
sudo systemctl start xspectre-api
```

### Open firewall
```bash
sudo ufw allow 22
sudo ufw allow 3000
sudo ufw allow 51820/udp
sudo ufw --force enable
```

---

## Step 3: Check if it's working

```bash
sudo systemctl status xspectre-api
curl http://localhost:3000/health
```

---

## Access Your Console

Open browser: **http://192.168.1.58:3000/health**

**Login:**
- Email: `admin@xspectre.internal`
- Password: `Admin123!`

---

## If something goes wrong

```bash
# Check logs
sudo journalctl -u xspectre-api -f

# Restart service
sudo systemctl restart xspectre-api

# Check WireGuard
sudo wg show
```

---

That's it! Just copy each block into your SSH terminal and press Enter. 🎉
