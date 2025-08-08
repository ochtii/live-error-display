#!/bin/bash

# Live Error Display - PM2 Setup Script
# Installiert PM2 und richtet das System ohne systemctl ein

set -euo pipefail

# Farben
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

echo -e "${BLUE}🚀 Live Error Display - PM2 Setup${NC}"
echo "==================================="

# Root check
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Dieses Skript muss als root ausgeführt werden (sudo ./setup-pm2.sh)${NC}"
   exit 1
fi

# 1. System update
echo -e "${YELLOW}📦 System wird aktualisiert...${NC}"
apt update -qq && apt upgrade -y -qq

# 2. Install Node.js if not present
echo -e "${YELLOW}📦 Prüfe Node.js Installation...${NC}"
if ! command -v node >/dev/null 2>&1; then
    echo "Installiere Node.js (LTS)..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - >/dev/null 2>&1
    apt install -y nodejs
else
    echo "✅ Node.js bereits installiert: $(node --version)"
fi

# 3. Install PM2 globally
echo -e "${YELLOW}📦 Installiere PM2...${NC}"
npm install -g pm2@latest

# 4. Install Git and tools
echo -e "${YELLOW}📦 Installiere Git und Tools...${NC}"
apt install -y git curl wget htop nano ufw

# 5. Setup www-data user
echo -e "${YELLOW}👤 Konfiguriere www-data User...${NC}"
usermod -s /bin/bash www-data
mkdir -p /var/www
chown www-data:www-data /var/www

# 6. Create log directories
echo -e "${YELLOW}📁 Erstelle Log-Verzeichnisse...${NC}"
mkdir -p /var/log
touch /var/log/live-error-display-deploy.log
touch /var/log/live-error-display-app.log
touch /var/log/live-error-display-out.log
touch /var/log/live-error-display-error.log
chown www-data:www-data /var/log/live-error-display-*.log

# 7. Configure firewall
echo -e "${YELLOW}🔥 Konfiguriere Firewall...${NC}"
ufw --force enable
ufw allow 22    # SSH
ufw allow 8080  # Application
ufw --force reload

# 8. Clone repository if not exists
echo -e "${YELLOW}📥 Repository Setup...${NC}"
if [[ ! -d "/opt/live-error-display" ]]; then
    cd /opt
    git clone https://github.com/ochtii/live-error-display.git
    chown -R www-data:www-data /opt/live-error-display
fi

# 9. Install NPM dependencies
echo -e "${YELLOW}📦 Installiere NPM Dependencies...${NC}"
cd /opt/live-error-display
sudo -u www-data npm install --production --silent

# 10. Setup PM2 for www-data user
echo -e "${YELLOW}🎯 Konfiguriere PM2 für www-data...${NC}"
sudo -u www-data pm2 kill 2>/dev/null || true
sudo -u www-data pm2 start ecosystem.config.json
sudo -u www-data pm2 save
sudo -u www-data pm2 startup systemd -u www-data --hp /var/www

# Execute the startup command that PM2 provides
echo -e "${YELLOW}🔧 Installiere PM2 Startup...${NC}"
# Get the startup command from PM2 and execute it
startup_cmd=$(sudo -u www-data pm2 startup systemd -u www-data --hp /var/www | grep "sudo" | head -1)
if [[ -n "$startup_cmd" ]]; then
    echo "Executing: $startup_cmd"
    eval "$startup_cmd"
fi

# 11. Remove old systemctl services if they exist
echo -e "${YELLOW}🗑️ Entferne alte systemctl Services...${NC}"
systemctl stop live-error-display 2>/dev/null || true
systemctl disable live-error-display 2>/dev/null || true
systemctl stop live-error-display-deploy 2>/dev/null || true
systemctl disable live-error-display-deploy 2>/dev/null || true

rm -f /etc/systemd/system/live-error-display.service
rm -f /etc/systemd/system/live-error-display-deploy.service
systemctl daemon-reload

echo -e "${GREEN}✅ Setup erfolgreich abgeschlossen!${NC}"
echo ""
echo -e "${BLUE}🎯 PM2 Status:${NC}"
sudo -u www-data pm2 status

echo ""
echo -e "${BLUE}📊 Nützliche PM2 Befehle:${NC}"
echo "• sudo -u www-data pm2 status              # Status anzeigen"
echo "• sudo -u www-data pm2 logs                # Logs anzeigen"
echo "• sudo -u www-data pm2 restart all         # App neustarten"
echo "• sudo -u www-data pm2 stop all            # App stoppen"
echo "• sudo -u www-data pm2 monit               # Monitoring"

echo ""
echo -e "${BLUE}🚀 Anwendung verfügbar:${NC}"
echo "• Web-Interface: http://$(hostname -I | awk '{print $1}'):8080"
echo "• Logs: sudo -u www-data pm2 logs"

echo ""
echo -e "${YELLOW}💡 Auto-Deploy wird separat gestartet...${NC}"
