#!/bin/bash

# Live Error Display - Clean PM2 Setup Script
# Frische Installation ohne systemctl

set -euo pipefail

# Farben
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

echo -e "${BLUE}🚀 Live Error Display - Fresh PM2 Setup${NC}"
echo "======================================"

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

# 5. Configure firewall
echo -e "${YELLOW}🔥 Konfiguriere Firewall...${NC}"
ufw --force enable
ufw allow 22    # SSH
ufw allow 8080  # Application
ufw --force reload

# 6. Clone repository to ubuntu user home
echo -e "${YELLOW}📥 Repository Setup...${NC}"
if [[ ! -d "/home/ubuntu/live-error-display" ]]; then
    cd /home/ubuntu
    git clone https://github.com/ochtii/live-error-display.git
    chown -R ubuntu:ubuntu /home/ubuntu/live-error-display
    echo "✅ Repository geklont nach /home/ubuntu/live-error-display"
else
    echo "✅ Repository bereits vorhanden"
    cd /home/ubuntu/live-error-display
    chown -R ubuntu:ubuntu /home/ubuntu/live-error-display
    sudo -u ubuntu git pull
fi

# 7. Install NPM dependencies
echo -e "${YELLOW}📦 Installiere NPM Dependencies...${NC}"
cd /home/ubuntu/live-error-display
sudo -u ubuntu npm install --production

# 8. Setup PM2 as ubuntu user
echo -e "${YELLOW}🎯 Starte PM2 App als ubuntu User...${NC}"
sudo -u ubuntu pm2 kill 2>/dev/null || true
sudo -u ubuntu NODE_ENV=production PORT=8080 pm2 start server.js --name live-error-display
sudo -u ubuntu pm2 save

# 9. Setup PM2 to start on boot
echo -e "${YELLOW}🔧 Konfiguriere PM2 Autostart...${NC}"
sudo -u ubuntu pm2 startup | grep "sudo" | head -1 > /tmp/pm2_startup.sh
if [[ -s /tmp/pm2_startup.sh ]]; then
    bash /tmp/pm2_startup.sh
    rm /tmp/pm2_startup.sh
fi

# 10. Test the application
echo -e "${YELLOW}🧪 Teste Anwendung...${NC}"
sleep 3
if curl -s http://localhost:8080 >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Application läuft erfolgreich!${NC}"
else
    echo -e "${RED}⚠️ Application antwortet nicht auf Port 8080${NC}"
fi

echo -e "${GREEN}✅ Setup erfolgreich abgeschlossen!${NC}"
echo ""
echo -e "${BLUE}🎯 PM2 Status:${NC}"
sudo -u ubuntu pm2 status

echo ""
echo -e "${BLUE}📊 Nützliche Befehle:${NC}"
echo "• sudo -u ubuntu pm2 status         # Status anzeigen"
echo "• sudo -u ubuntu pm2 logs           # Logs anzeigen"
echo "• sudo -u ubuntu pm2 restart all    # App neustarten"
echo "• sudo -u ubuntu pm2 stop all       # App stoppen"
echo "• sudo -u ubuntu pm2 monit          # Monitoring"

echo ""
echo -e "${BLUE}🚀 Anwendung verfügbar:${NC}"
echo "• Web-Interface: http://$(hostname -I | awk '{print $1}'):8080"
echo "• Demo-Modus: AUS (NODE_ENV=production)"

echo ""
echo -e "${YELLOW}💡 Deploy-Skript für Auto-Updates:${NC}"
echo "• sudo chmod +x deploy.sh"
echo "• sudo ./deploy.sh"
