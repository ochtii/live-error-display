#!/bin/bash

# Migration Script: systemctl -> PM2
# Stoppt systemctl Services und migriert zu PM2

set -euo pipefail

readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNUNG]${NC} $1"
}

error() {
    echo -e "${RED}[FEHLER]${NC} $1" >&2
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    error "Dieses Skript muss als root ausgeführt werden"
    exit 1
fi

log "Starte Migration von systemctl zu PM2..."

# Stop and disable systemctl services if they exist
if systemctl is-active --quiet live-error-display 2>/dev/null; then
    log "Stoppe live-error-display systemctl Service..."
    systemctl stop live-error-display
    systemctl disable live-error-display
    log "live-error-display Service gestoppt und deaktiviert"
else
    warn "live-error-display Service nicht aktiv oder nicht vorhanden"
fi

if systemctl is-active --quiet live-error-display-deploy 2>/dev/null; then
    log "Stoppe live-error-display-deploy systemctl Service..."
    systemctl stop live-error-display-deploy
    systemctl disable live-error-display-deploy
    log "live-error-display-deploy Service gestoppt und deaktiviert"
else
    warn "live-error-display-deploy Service nicht aktiv oder nicht vorhanden"
fi

# Remove systemctl service files
SERVICE_FILES=(
    "/etc/systemd/system/live-error-display.service"
    "/etc/systemd/system/live-error-display-deploy.service"
)

for service_file in "${SERVICE_FILES[@]}"; do
    if [[ -f "$service_file" ]]; then
        log "Entferne $service_file..."
        rm -f "$service_file"
    fi
done

# Reload systemctl daemon
systemctl daemon-reload
log "systemctl daemon neu geladen"

# Check if PM2 is installed
if ! command -v pm2 >/dev/null 2>&1; then
    log "Installiere PM2..."
    npm install -g pm2
else
    log "PM2 ist bereits installiert"
fi

# Start PM2 app
REPO_DIR="/opt/live-error-display"
if [[ -d "$REPO_DIR" ]]; then
    cd "$REPO_DIR"
    
    # Create www-data user if not exists
    if ! id -u www-data >/dev/null 2>&1; then
        log "Erstelle www-data Benutzer..."
        useradd -r -s /bin/false www-data
    fi
    
    # Set correct ownership
    chown -R www-data:www-data "$REPO_DIR"
    
    # Start PM2 app
    if [[ -f "ecosystem.config.json" ]]; then
        log "Starte PM2 App mit ecosystem.config.json..."
        sudo -u www-data pm2 start ecosystem.config.json
    else
        log "Starte PM2 App direkt mit server.js..."
        sudo -u www-data pm2 start server.js --name live-error-display
    fi
    
    # Save PM2 configuration
    sudo -u www-data pm2 save
    
    # Setup PM2 startup
    pm2 startup
    
    log "PM2 App gestartet und konfiguriert"
else
    error "Repository-Verzeichnis $REPO_DIR nicht gefunden"
    exit 1
fi

# Test if application is running
sleep 3
if curl -s http://localhost:8080 >/dev/null 2>&1; then
    log "✅ Application läuft erfolgreich auf Port 8080"
else
    warn "⚠️  Application antwortet nicht auf Port 8080"
fi

log "🎉 Migration zu PM2 abgeschlossen!"
log ""
log "Nützliche PM2 Befehle:"
log "  sudo -u www-data pm2 status"
log "  sudo -u www-data pm2 logs live-error-display"
log "  sudo -u www-data pm2 restart live-error-display"
log "  sudo -u www-data pm2 monit"
