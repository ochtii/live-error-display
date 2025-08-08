#!/bin/bash

# Live Error Display - Server Setup Script
# Installiert alle Dependencies und richtet das System ein

set -euo pipefail

# Farben
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

echo -e "${BLUE}🚀 Live Error Display - Server Setup${NC}"
echo "===================================="

# Root check
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Dieses Skript muss als root ausgeführt werden (sudo ./setup.sh)${NC}"
   exit 1
fi

echo -e "${YELLOW}📦 System wird aktualisiert...${NC}"
apt update -qq && apt upgrade -y -qq

echo -e "${YELLOW}📦 Installiere Node.js (LTS)...${NC}"
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - >/dev/null 2>&1
apt install -y nodejs

echo -e "${YELLOW}📦 Installiere Git und Tools...${NC}"
apt install -y git curl wget htop nano ufw

echo -e "${YELLOW}👤 Konfiguriere www-data User...${NC}"
usermod -s /bin/bash www-data
mkdir -p /var/www
chown www-data:www-data /var/www

echo -e "${YELLOW}📁 Erstelle Log-Verzeichnis...${NC}"
mkdir -p /var/log
touch /var/log/live-error-display-deploy.log
chown www-data:www-data /var/log/live-error-display-deploy.log

echo -e "${YELLOW}🔥 Konfiguriere Firewall...${NC}"
ufw --force enable
ufw allow 22    # SSH
ufw allow 8080  # Application
ufw --force reload

echo -e "${YELLOW}📥 Repository wird geklont...${NC}"
if [[ ! -d "/opt/live-error-display" ]]; then
    cd /opt
    git clone https://github.com/ochtii/live-error-display.git
    chown -R www-data:www-data /opt/live-error-display
    chmod +x /opt/live-error-display/deploy.sh
fi

echo -e "${YELLOW}📦 Installiere NPM Dependencies...${NC}"
cd /opt/live-error-display
sudo -u www-data npm install --production --silent

echo -e "${YELLOW}🎯 Erstelle systemd Service für Auto-Deploy...${NC}"
cat > /etc/systemd/system/live-error-display-deploy.service <<EOF
[Unit]
Description=Live Error Display Auto Deploy
After=network.target

[Service]
Type=simple
User=root
ExecStart=/opt/live-error-display/deploy.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable live-error-display-deploy

echo -e "${GREEN}✅ Setup erfolgreich abgeschlossen!${NC}"
echo ""
echo -e "${BLUE}🎯 Nächste Schritte:${NC}"
echo "1. Auto-Deploy starten:     sudo systemctl start live-error-display-deploy"
echo "2. Status prüfen:           sudo systemctl status live-error-display"
echo "3. Logs anzeigen:           tail -f /var/log/live-error-display-deploy.log"
echo "4. App öffnen:              http://$(hostname -I | awk '{print $1}'):8080"
echo ""
echo -e "${YELLOW}💡 Praktische Befehle:${NC}"
echo "• sudo systemctl stop live-error-display-deploy    # Auto-Deploy stoppen"
echo "• sudo systemctl restart live-error-display        # App neustarten"
echo "• sudo journalctl -u live-error-display -f         # App-Logs live"

# Auto-start deploy service
echo -e "${YELLOW}🚀 Starte Auto-Deploy Service...${NC}"
systemctl start live-error-display-deploy

echo -e "${GREEN}🎉 Live Error Display ist einsatzbereit!${NC}"
