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
    
    # Ensure proper ownership
    chown -R www-data:www-data "$REPO_DIR"
    
    # Git configuration
    sudo -u www-data git config --global --add safe.directory "$REPO_DIR"
    sudo -u www-data git config pull.rebase false
    sudo -u www-data git config user.email "deploy@live-error-display"
    sudo -u www-data git config user.name "Auto Deploy"
    
    # Ensure remote is properly set
    if ! sudo -u www-data git remote get-url origin >/dev/null 2>&1; then
        log "Setting up remote origin..."
        sudo -u www-data git remote add origin "$REPO_URL"
    else
        log "Updating remote URL..."
        sudo -u www-data git remote set-url origin "$REPO_URL"
    fi
    
    # Ensure we're on main branch and tracking origin/main
    local current_branch=$(sudo -u www-data git branch --show-current 2>/dev/null || echo "")
    if [[ "$current_branch" != "main" ]]; then
        log "Switching to main branch..."
        sudo -u www-data git checkout -B main 2>/dev/null || sudo -u www-data git checkout main
    fi
    
    # Set up tracking
    sudo -u www-data git branch --set-upstream-to=origin/main main 2>/dev/null || true
    
    # Initial fetch
    log "Performing initial fetch..."
    sudo -u www-data git fetch origin main 2>&1 | tee -a "$LOG_FILE" || log "Initial fetch failed"
    
    log "Repository Setup abgeschlossen - Owner: $(stat -c '%U:%G' "$REPO_DIR")"
    log "Current branch: $(sudo -u www-data git branch --show-current)"
    log "Remote URL: $(sudo -u www-data git remote get-url origin)"
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
    
    # Ensure clean working directory
    if [[ -n "$(sudo -u www-data git status --porcelain 2>/dev/null)" ]]; then
        log "Bereinige Working Directory..."
        sudo -u www-data git checkout -- . 2>/dev/null || true
        sudo -u www-data git clean -fd 2>/dev/null || true
    fi
    
    local current_commit=$(sudo -u www-data git rev-parse HEAD 2>/dev/null || echo "unknown")
    log "Aktueller lokaler Commit: ${current_commit:0:7}"
    
    # Force fetch with explicit refspec
    log "Fetching remote changes..."
    if sudo -u www-data git fetch origin main:refs/remotes/origin/main --force 2>&1 | tee -a "$LOG_FILE"; then
        log "Git fetch erfolgreich"
    else
        log "WARNUNG: Git fetch fehlgeschlagen"
        return 1
    fi
    
    local remote_commit=$(sudo -u www-data git rev-parse refs/remotes/origin/main 2>/dev/null || echo "unknown")
    log "Remote Commit: ${remote_commit:0:7}"
    
    # Additional checks for change detection
    local commits_behind=$(sudo -u www-data git rev-list --count HEAD..refs/remotes/origin/main 2>/dev/null || echo "0")
    log "Commits behind remote: $commits_behind"
    
    if [[ "$current_commit" != "$remote_commit" ]] || [[ "$commits_behind" -gt 0 ]]; then
        echo -e "${YELLOW}🔄 Update erkannt: ${current_commit:0:7} → ${remote_commit:0:7} ($commits_behind commits behind)${NC}"
        log "Update erkannt: ${current_commit:0:7} → ${remote_commit:0:7} ($commits_behind commits)"
        
        # Log current status before update
        log "Vor Update - Aktueller Branch: $(sudo -u www-data git branch --show-current)"
        log "Vor Update - Working Directory Status: $(sudo -u www-data git status --porcelain)"
        
        # Backup
        local backup_dir="/tmp/live-error-display-backup-$(date +%s)"
        cp -r "$REPO_DIR" "$backup_dir"
        log "Backup erstellt: $backup_dir"
        
        # Update mit detailliertem Logging
        log "Führe git reset --hard origin/main aus..."
        if sudo -u www-data git reset --hard origin/main 2>&1 | tee -a "$LOG_FILE"; then
            log "Git reset erfolgreich"
            # Verify update
            local new_commit=$(sudo -u www-data git rev-parse HEAD)
            log "Nach Update - Neuer Commit: ${new_commit:0:7}"
            if [[ "$new_commit" == "$remote_commit" ]]; then
                log "✓ Commit-Verifikation erfolgreich"
            else
                log "⚠ WARNUNG: Commit-Verifikation fehlgeschlagen - erwartet: ${remote_commit:0:7}, erhalten: ${new_commit:0:7}"
            fi
        else
            log "Git reset fehlgeschlagen, restore backup"
            rm -rf "$REPO_DIR"
            mv "$backup_dir" "$REPO_DIR"
            return 1
        fi
        
        # Check for package.json changes
        if sudo -u www-data git diff --name-only "$current_commit" "$remote_commit" 2>/dev/null | grep -q "package.json"; then
            log "package.json geändert, aktualisiere Dependencies..."
            update_dependencies
        fi
        
        # Verify file changes
        log "Prüfe Datei-Änderungen..."
        local changed_files=$(sudo -u www-data git diff --name-only "$current_commit" "$remote_commit" 2>/dev/null | wc -l)
        log "Anzahl geänderter Dateien: $changed_files"
        if (( changed_files > 0 )); then
            log "Geänderte Dateien:"
            sudo -u www-data git diff --name-only "$current_commit" "$remote_commit" 2>/dev/null | while read -r file; do
                log "  - $file"
                if [[ -f "$REPO_DIR/$file" ]]; then
                    log "    ✓ Datei existiert lokal"
                else
                    log "    ✗ Datei fehlt lokal!"
                fi
            done
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
test_git_detection() {
    echo -e "${BLUE}🧪 Testing Git Change Detection${NC}"
    cd "$REPO_DIR"
    
    local current_commit=$(sudo -u www-data git rev-parse HEAD 2>/dev/null || echo "unknown")
    echo "Current local commit: ${current_commit:0:7}"
    
    echo "Fetching remote..."
    sudo -u www-data git fetch origin main 2>&1
    
    local remote_commit=$(sudo -u www-data git rev-parse refs/remotes/origin/main 2>/dev/null || echo "unknown")
    echo "Remote commit: ${remote_commit:0:7}"
    
    local commits_behind=$(sudo -u www-data git rev-list --count HEAD..refs/remotes/origin/main 2>/dev/null || echo "0")
    echo "Commits behind: $commits_behind"
    
    echo "Recent remote commits:"
    sudo -u www-data git log --oneline -5 refs/remotes/origin/main 2>/dev/null || echo "No remote commits found"
    
    echo "Git status:"
    sudo -u www-data git status --porcelain
    
    if [[ "$current_commit" != "$remote_commit" ]] || [[ "$commits_behind" -gt 0 ]]; then
        echo -e "${GREEN}✅ Changes detected!${NC}"
    else
        echo -e "${YELLOW}⚠️ No changes detected${NC}"
    fi
}

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
    local last_debug_time=0
    
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
            
            # Debug-Info alle 10 Minuten (600 Sekunden)
            if (( current_time - last_debug_time >= 600 )); then
                cd "$REPO_DIR"
                local current_commit=$(sudo -u www-data git rev-parse HEAD 2>/dev/null || echo "unknown")
                local remote_commit=$(sudo -u www-data git rev-parse refs/remotes/origin/main 2>/dev/null || echo "unknown")
                log "Debug - Local: ${current_commit:0:7}, Remote: ${remote_commit:0:7}"
                log "Debug - Last fetch: $(sudo -u www-data git log -1 --format='%H %s' refs/remotes/origin/main 2>/dev/null || echo 'unknown')"
                last_debug_time=$current_time
            fi
        fi
        
        sleep "$CHECK_INTERVAL"
    done
}

# Start
if [[ "${1:-}" == "test" ]]; then
    echo -e "${BLUE}🧪 Running in test mode${NC}"
    check_prerequisites
    setup_repository
    test_git_detection
    exit 0
fi

main "$@"
