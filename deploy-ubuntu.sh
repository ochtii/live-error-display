#!/bin/bash

# Live Error Display - Auto-Deploy Script für Ubuntu User
# Prüft jede Sekunde auf Git-Änderungen und deployed automatisch

set -euo pipefail

# === KONFIGURATION ===
REPO_DIR="/home/ubuntu/live-error-display"
REPO_URL="https://github.com/ochtii/live-error-display.git"
SERVICE_NAME="live-error-display"
LOG_FILE="/var/log/live-error-display-deploy.log"
LOCK_FILE="/tmp/live-error-display-deploy.lock"
CHECK_INTERVAL=1
PM2_USER="ubuntu"

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
    command -v pm2 >/dev/null 2>&1 || error_exit "PM2 ist nicht installiert"
    
    [[ $EUID -eq 0 ]] || error_exit "Skript muss als root ausgeführt werden"
}

setup_repository() {
    if [[ ! -d "$REPO_DIR" ]]; then
        log "Klone Repository..."
        sudo -u "$PM2_USER" git clone "$REPO_URL" "$REPO_DIR" || error_exit "Git Clone fehlgeschlagen"
    fi
    
    cd "$REPO_DIR"
    chown -R "$PM2_USER:$PM2_USER" "$REPO_DIR"
    
    # Git-Konfiguration für ubuntu User
    sudo -u "$PM2_USER" git config --global --add safe.directory "$REPO_DIR"
    sudo -u "$PM2_USER" git config pull.rebase false
    sudo -u "$PM2_USER" git config user.email "deploy@live-error-display"
    sudo -u "$PM2_USER" git config user.name "Auto Deploy"
    
    log "Repository Setup abgeschlossen"
}

check_pm2_app() {
    if sudo -u "$PM2_USER" pm2 describe "$SERVICE_NAME" >/dev/null 2>&1; then
        log "PM2 App '$SERVICE_NAME' läuft bereits"
        return 0
    else
        log "Starte PM2 App..."
        cd "$REPO_DIR"
        sudo -u "$PM2_USER" NODE_ENV=production PORT=8080 pm2 start server.js --name "$SERVICE_NAME"
        sudo -u "$PM2_USER" pm2 save
        log "PM2 App gestartet"
    fi
}

restart_service() {
    log "Starte PM2 App neu..."
    sudo -u "$PM2_USER" pm2 stop "$SERVICE_NAME" 2>/dev/null || true
    sleep 2
    sudo -u "$PM2_USER" NODE_ENV=production PORT=8080 pm2 start "$REPO_DIR/server.js" --name "$SERVICE_NAME"
    
    sleep 3
    if curl -s http://localhost:8080 >/dev/null 2>&1; then
        log "✅ App erfolgreich gestartet"
        sudo -u "$PM2_USER" pm2 save
        return 0
    else
        log "❌ App ist nicht erreichbar"
        return 1
    fi
}

install_dependencies() {
    cd "$REPO_DIR"
    if [[ -f "package.json" ]]; then
        log "Installiere Dependencies..."
        sudo -u "$PM2_USER" npm install --production 2>&1 | tee -a "$LOG_FILE"
        log "Dependencies installiert"
    fi
}

check_for_changes() {
    cd "$REPO_DIR"
    
    # Fetch latest changes
    sudo -u "$PM2_USER" git fetch origin main 2>/dev/null || return 1
    
    # Compare with remote
    local local_commit=$(sudo -u "$PM2_USER" git rev-parse HEAD 2>/dev/null || echo "")
    local remote_commit=$(sudo -u "$PM2_USER" git rev-parse origin/main 2>/dev/null || echo "")
    
    if [[ "$local_commit" != "$remote_commit" && -n "$remote_commit" ]]; then
        log "🔄 Änderungen erkannt: $local_commit -> $remote_commit"
        return 0
    fi
    
    return 1
}

deploy() {
    cd "$REPO_DIR"
    
    log "🚀 Starte Deployment..."
    
    # Backup current state
    local backup_branch="backup-$(date +%Y%m%d-%H%M%S)"
    sudo -u "$PM2_USER" git branch "$backup_branch" 2>/dev/null || true
    
    # Pull changes
    if sudo -u "$PM2_USER" git pull origin main 2>&1 | tee -a "$LOG_FILE"; then
        log "✅ Git Pull erfolgreich"
        
        # Install dependencies if package.json changed
        install_dependencies
        
        # Restart service
        if restart_service; then
            log "🎉 Deployment erfolgreich abgeschlossen"
            return 0
        else
            log "❌ Service-Restart fehlgeschlagen, rollback..."
            sudo -u "$PM2_USER" git reset --hard "$backup_branch"
            restart_service
            return 1
        fi
    else
        log "❌ Git Pull fehlgeschlagen"
        return 1
    fi
}

# === MAIN FUNCTIONS ===
init() {
    log "🚀 Live Error Display Auto-Deploy startet..."
    
    # Setup
    check_prerequisites
    setup_repository
    check_pm2_app
    install_dependencies
    
    # Initial service check
    if ! sudo -u "$PM2_USER" pm2 describe "$SERVICE_NAME" | grep -q "online" 2>/dev/null; then
        log "Starte PM2 App initial..."
        restart_service
    else
        log "PM2 App läuft bereits"
    fi
    
    log "✅ Initialisierung abgeschlossen"
}

monitor() {
    log "🔍 Auto-Deploy Monitoring startet (Intervall: ${CHECK_INTERVAL}s)"
    
    while true; do
        if check_for_changes; then
            if deploy; then
                log "✅ Auto-Deploy erfolgreich"
            else
                log "❌ Auto-Deploy fehlgeschlagen"
            fi
        fi
        sleep "$CHECK_INTERVAL"
    done
}

main() {
    # Lock-Datei erstellen
    if [[ -f "$LOCK_FILE" ]]; then
        error_exit "Deploy-Skript läuft bereits (Lock-Datei: $LOCK_FILE)"
    fi
    
    touch "$LOCK_FILE"
    trap cleanup EXIT
    
    case "${1:-}" in
        "init")
            init
            ;;
        "monitor")
            monitor
            ;;
        "deploy")
            init
            deploy
            ;;
        *)
            init
            monitor
            ;;
    esac
}

# Skript ausführen
main "$@"
