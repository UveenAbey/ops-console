#!/bin/bash
# xSPECTRE Agent Installation Script
# Version: 1.0.0

set -e

echo "╔════════════════════════════════════════════╗"
echo "║  xSPECTRE Agent Installation Script        ║"
echo "║  Version: 1.0.0                            ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root or with sudo"
   exit 1
fi

echo "✓ Running with root privileges"
echo ""

# Create directories
echo "📁 Creating installation directories..."
mkdir -p /opt/xspectre-agent
mkdir -p /var/lib/xspectre-agent
mkdir -p /var/log/xspectre-agent
chmod 755 /opt/xspectre-agent

# Copy agent files
echo "📦 Installing agent files..."
cat > /opt/xspectre-agent/agent <<'AGENTEOF'
#!/bin/bash

source /var/lib/xspectre-agent/config.conf

# Generate device ID from enrollment key (use first 20 chars alphanumeric)
DEVICE_ID=$(echo "$ENROLLMENT_KEY" | head -c 20 | tr -cd 'a-zA-Z0-9')
CONSOLE_URL=$(echo "$CONSOLE_URL" | sed 's|/$||')

while true; do
  TIMESTAMP=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
  LOG_FILE="/var/log/xspectre-agent/agent.log"
  
  # Get CPU usage from /proc/stat
  CPU_USAGE=$(awk '/^cpu / {usage=($2+$4)*100/($2+$4+$5)} END {printf "%0.0f", usage}' /proc/stat)
  
  # Get memory info
  MEM_TOTAL=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
  MEM_AVAIL=$(awk '/MemAvailable/ {print $2}' /proc/meminfo)
  MEM_USED=$((MEM_TOTAL - MEM_AVAIL))
  RAM_USAGE=$(awk "BEGIN {printf \"%0.1f\", ($MEM_USED/$MEM_TOTAL)*100}")
  
  # Get uptime
  UPTIME_SECONDS=$(cat /proc/uptime | cut -d' ' -f1 | cut -d'.' -f1)
  
  # Log heartbeat locally
  echo "[$TIMESTAMP] Agent heartbeat - CPU: ${CPU_USAGE}% RAM: ${RAM_USAGE}%" >> "$LOG_FILE"
  
  # Send heartbeat to console
  curl -s -X POST "${CONSOLE_URL}/api/heartbeat/${DEVICE_ID}" \
    -H "Content-Type: application/json" \
    -d "{
      \"enrollment_key\": \"$ENROLLMENT_KEY\",
      \"cpu_usage_percent\": ${CPU_USAGE:-0},
      \"ram_usage_percent\": ${RAM_USAGE:-0},
      \"uptime_seconds\": ${UPTIME_SECONDS:-0}
    }" > /dev/null 2>&1 &
  
  sleep 60
done
AGENTEOF
chmod 755 /opt/xspectre-agent/agent

# Create systemd service
echo "⚙️  Setting up systemd service..."
cat > /etc/systemd/system/xspectre-agent.service <<EOF
[Unit]
Description=xSPECTRE Agent
After=network.target

[Service]
Type=simple
User=root
ExecStart=/opt/xspectre-agent/agent
Restart=always
RestartSec=10
StandardOutput=append:/var/log/xspectre-agent/agent.log
StandardError=append:/var/log/xspectre-agent/agent.log

[Install]
WantedBy=multi-user.target
EOF

chmod 644 /etc/systemd/system/xspectre-agent.service

# Prompt for enrollment key
echo ""
echo "🔑 Please enter your enrollment key:"
read -r ENROLLMENT_KEY

if [ -z "$ENROLLMENT_KEY" ]; then
  echo "❌ Enrollment key cannot be empty"
  exit 1
fi

# Save enrollment configuration
cat > /var/lib/xspectre-agent/config.conf <<EOF
ENROLLMENT_KEY=$ENROLLMENT_KEY
CONSOLE_URL=http://192.168.1.58:3000
AGENT_VERSION=1.0.0
INSTALLED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

chmod 600 /var/lib/xspectre-agent/config.conf

# Enable and start service
echo ""
echo "🚀 Starting xSPECTRE Agent service..."
systemctl daemon-reload
systemctl enable xspectre-agent.service
systemctl start xspectre-agent.service

# Verify installation
sleep 2
if systemctl is-active --quiet xspectre-agent.service; then
  echo ""
  echo "╔════════════════════════════════════════════╗"
  echo "║  ✅ Installation Completed Successfully!   ║"
  echo "╚════════════════════════════════════════════╝"
  echo ""
  echo "Agent Details:"
  echo "  • Service Name: xspectre-agent"
  echo "  • Installation Path: /opt/xspectre-agent"
  echo "  • Configuration: /var/lib/xspectre-agent/config.conf"
  echo "  • Logs: /var/log/xspectre-agent/agent.log"
  echo ""
  echo "Useful Commands:"
  echo "  • Check status: sudo systemctl status xspectre-agent"
  echo "  • View logs: sudo tail -f /var/log/xspectre-agent/agent.log"
  echo "  • Restart: sudo systemctl restart xspectre-agent"
  echo "  • Stop: sudo systemctl stop xspectre-agent"
  echo ""
else
  echo ""
  echo "⚠️  Service is starting (may take a moment)..."
  echo ""
  echo "Check status with: sudo systemctl status xspectre-agent"
  echo "View logs with: sudo tail -f /var/log/xspectre-agent/agent.log"
  echo ""
fi
