#!/bin/bash

# Migration Script: Move repository to /opt and update all configs

set -euo pipefail

readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly RED='\033[0;31m'
readonly NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNUNG]${NC} $1"
}

error() {
    echo -e "${RED}[FEHLER]${NC} $1"
    exit 1
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error "Dieses Skript muss als root ausgeführt werden"
fi

log "🚀 Migration zu /opt/live-error-display startet..."

# 1. Stop all PM2 processes
log "Stoppe alle PM2 Prozesse..."
pm2 stop all 2>/dev/null || true
sudo -u ubuntu pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
sudo -u ubuntu pm2 delete all 2>/dev/null || true

# 2. Create /opt directory and move repository
log "Verschiebe Repository nach /opt..."
if [[ -d "/home/ubuntu/live-error-display" ]]; then
    if [[ -d "/opt/live-error-display" ]]; then
        log "Lösche altes /opt/live-error-display..."
        rm -rf /opt/live-error-display
    fi
    
    mv /home/ubuntu/live-error-display /opt/live-error-display
    chown -R root:root /opt/live-error-display
    chmod -R 755 /opt/live-error-display
    log "✅ Repository verschoben nach /opt/live-error-display"
else
    if [[ ! -d "/opt/live-error-display" ]]; then
        log "Klone Repository neu nach /opt..."
        cd /opt
        git clone https://github.com/ochtii/live-error-display.git
        chown -R root:root /opt/live-error-display
        chmod -R 755 /opt/live-error-display
    fi
fi

# 3. Update deploy-ubuntu.sh
log "Aktualisiere deploy-ubuntu.sh für /opt Pfad..."
cd /opt/live-error-display
sed -i 's|REPO_DIR="/home/ubuntu/live-error-display"|REPO_DIR="/opt/live-error-display"|g' deploy-ubuntu.sh
sed -i 's|PM2_USER="ubuntu"|PM2_USER="root"|g' deploy-ubuntu.sh

# 4. Install dependencies
log "Installiere NPM Dependencies..."
npm install --production

# 5. Setup PM2 app as root
log "Starte PM2 App als root..."
NODE_ENV=production PORT=8080 pm2 start server.js --name live-error-display
pm2 save

# 6. Start deploy script in PM2
log "Starte Deploy-Skript in PM2..."
pm2 start deploy-ubuntu.sh --name live-error-display-deploy --interpreter bash -- monitor
pm2 save

# 7. Setup PM2 startup
log "Konfiguriere PM2 Startup..."
pm2 startup | grep "sudo" | head -1 > /tmp/pm2_startup.sh
if [[ -s /tmp/pm2_startup.sh ]]; then
    bash /tmp/pm2_startup.sh
    rm /tmp/pm2_startup.sh
fi

# 8. Create log file with correct permissions
log "Erstelle Log-Datei..."
touch /var/log/live-error-display-deploy.log
chmod 666 /var/log/live-error-display-deploy.log

# 9. Test application
log "Teste Anwendung..."
sleep 3
if curl -s http://localhost:8080 >/dev/null 2>&1; then
    log "✅ Application läuft erfolgreich auf Port 8080"
else
    warn "⚠️ Application antwortet nicht auf Port 8080"
fi

log "🎉 Migration erfolgreich abgeschlossen!"
log ""
log "📊 PM2 Status:"
pm2 status

log ""
log "📍 Neuer Pfad: /opt/live-error-display"
log "🌐 URL: http://$(hostname -I | awk '{print $1}'):8080"
log "📝 Logs: pm2 logs live-error-display"
log "🔄 Deploy Logs: pm2 logs live-error-display-deploy"

log ""
log "🔧 Nützliche Befehle:"
log "  pm2 status"
log "  pm2 logs live-error-display"
log "  pm2 logs live-error-display-deploy"
log "  pm2 restart all"
