#!/bin/bash

# Live Error Display - Complete Auto-Deploy Script
# Prüft jede Sekunde auf Git-Änderungen und deployed automatisch

set -euo pipefail

# === KONFIGURATION ===
REPO_DIR="/opt/live-error-display"
REPO_URL="https://github.com/ochtii/live-error-display.git"
SERVICE_NAME="live-error-display"
LOG_FILE="/var/log/live-error-display-deploy.log"
LOCK_FILE="/tmp/live-error-display-deploy.lock"
CHECK_INTERVAL=1

# Farben
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# === FUNKTIONEN ===
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error_exit() {
    echo -e "${RED}FEHLER: $1${NC}" >&2
    log "FEHLER: $1"
    cleanup
    exit 1
}

cleanup() {
    [[ -f "$LOCK_FILE" ]] && rm -f "$LOCK_FILE"
}

check_prerequisites() {
    command -v git >/dev/null 2>&1 || error_exit "Git ist nicht installiert"
    command -v node >/dev/null 2>&1 || error_exit "Node.js ist nicht installiert"
    command -v npm >/dev/null 2>&1 || error_exit "npm ist nicht installiert"
    
    [[ $EUID -eq 0 ]] || error_exit "Skript muss als root ausgeführt werden"
}

create_systemd_service() {
    local service_file="/etc/systemd/system/$SERVICE_NAME.service"
    
    if [[ ! -f "$service_file" ]]; then
        log "Erstelle systemd Service..."
        cat > "$service_file" <<EOF
[Unit]
Description=Live Error Display Server
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$REPO_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
EOF
        systemctl daemon-reload
        systemctl enable "$SERVICE_NAME"
        log "Systemd Service erstellt und aktiviert"
    fi
}

setup_repository() {
    if [[ ! -d "$REPO_DIR" ]]; then
        log "Klone Repository..."
        mkdir -p "$REPO_DIR"
        git clone "$REPO_URL" "$REPO_DIR" || error_exit "Git Clone fehlgeschlagen"
        chown -R www-data:www-data "$REPO_DIR"
    fi
    
    cd "$REPO_DIR"
    sudo -u www-data git config --global --add safe.directory "$REPO_DIR"
    sudo -u www-data git config pull.rebase false
}

install_dependencies() {
    if [[ -f "$REPO_DIR/package.json" && ! -d "$REPO_DIR/node_modules" ]]; then
        log "Installiere Dependencies (erste Installation)..."
        cd "$REPO_DIR"
        sudo -u www-data npm install --production --silent || error_exit "npm install fehlgeschlagen"
    fi
}

update_dependencies() {
    if [[ -f "$REPO_DIR/package.json" ]]; then
        log "Aktualisiere Dependencies..."
        cd "$REPO_DIR"
        sudo -u www-data npm install --production --silent || error_exit "npm install fehlgeschlagen"
    fi
}

restart_service() {
    log "Starte Service neu..."
    systemctl restart "$SERVICE_NAME"
    sleep 3
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log "✓ Service erfolgreich gestartet"
        return 0
    else
        log "✗ Service-Start fehlgeschlagen"
        systemctl status "$SERVICE_NAME" --no-pager
        return 1
    fi
}

deploy() {
    cd "$REPO_DIR"
    
    local current_commit=$(sudo -u www-data git rev-parse HEAD 2>/dev/null || echo "unknown")
    
    # Fetch remote changes (silent)
    sudo -u www-data git fetch origin main >/dev/null 2>&1 || {
        # Nur loggen wenn es häufiger fehlschlägt
        return 1
    }
    
    local remote_commit=$(sudo -u www-data git rev-parse origin/main 2>/dev/null || echo "unknown")
    
    if [[ "$current_commit" != "$remote_commit" ]]; then
        echo -e "${YELLOW}🔄 Update erkannt: ${current_commit:0:7} → ${remote_commit:0:7}${NC}"
        log "Update erkannt: ${current_commit:0:7} → ${remote_commit:0:7}"
        
        # Backup
        local backup_dir="/tmp/live-error-display-backup-$(date +%s)"
        cp -r "$REPO_DIR" "$backup_dir"
        
        # Update
        sudo -u www-data git reset --hard origin/main || {
            log "Git reset fehlgeschlagen, restore backup"
            rm -rf "$REPO_DIR"
            mv "$backup_dir" "$REPO_DIR"
            return 1
        }
        
        # Check for package.json changes
        if sudo -u www-data git diff --name-only "$current_commit" "$remote_commit" 2>/dev/null | grep -q "package.json"; then
            log "package.json geändert, aktualisiere Dependencies..."
            update_dependencies
        fi
        
        # Restart service
        if restart_service; then
            echo -e "${GREEN}✅ Deployment erfolgreich!${NC}"
            log "Deployment erfolgreich"
            rm -rf "$backup_dir"
        else
            echo -e "${RED}❌ Service-Neustart fehlgeschlagen${NC}"
            log "Service-Neustart fehlgeschlagen, restore backup"
            rm -rf "$REPO_DIR"
            mv "$backup_dir" "$REPO_DIR"
            restart_service
            return 1
        fi
        
        return 0
    fi
    
    return 1
}

# === MAIN ===
main() {
    # Signal handlers
    trap cleanup EXIT INT TERM
    
    # Lock check
    if [[ -f "$LOCK_FILE" ]] && kill -0 "$(cat "$LOCK_FILE")" 2>/dev/null; then
        error_exit "Deploy-Skript läuft bereits (PID: $(cat "$LOCK_FILE"))"
    fi
    echo $$ > "$LOCK_FILE"
    
    echo -e "${BLUE}🚀 Live Error Display - Auto Deploy${NC}"
    log "Auto-Deploy gestartet"
    
    # Setup
    check_prerequisites
    setup_repository
    create_systemd_service
    install_dependencies
    
    # Initial service start
    if ! systemctl is-active --quiet "$SERVICE_NAME"; then
        restart_service
    fi
    
    echo -e "${GREEN}📡 Überwachung aktiv - prüfe alle ${CHECK_INTERVAL}s auf Updates${NC}"
    echo -e "${YELLOW}💡 Drücke Ctrl+C zum Beenden${NC}"
    log "Überwachung gestartet"
    
    local check_count=0
    local last_status_time=0
    
    while true; do
        if deploy; then
            check_count=0
        else
            ((check_count++))
            # Status nur alle 5 Minuten ausgeben (300 Sekunden)
            local current_time=$(date +%s)
            if (( current_time - last_status_time >= 300 )); then
                echo -e "${BLUE}📊 Status: Aktiv (${check_count} Checks seit letztem Update)${NC}"
                last_status_time=$current_time
            fi
        fi
        
        sleep "$CHECK_INTERVAL"
    done
}

# Start
main "$@"
