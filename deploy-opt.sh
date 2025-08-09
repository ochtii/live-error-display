#!/bin/bash

# Live Error Display - Auto-Deploy Script für /opt (root)
# Prüft jede Sekunde auf Git-Änderungen und deployed automatisch
# Test-Kommentar für PowerShell Commit & Push Test

# Entferne -e flag um zu verhindern, dass Script bei return 1 beendet wird
set -uo pipefail

# === KONFIGURATION ===
REPO_DIR="/opt/live-error-display"
REPO_URL="https://github.com/ochtii/live-error-display.git"
SERVICE_NAME="live-error-display"
LOG_FILE="/var/log/live-error-display-deploy.log"
LOCK_FILE="/tmp/live-error-display-deploy.lock"
CHECK_INTERVAL=1
PM2_USER="ubuntu"

# PM2 Home-Verzeichnis automatisch erkennen
detect_pm2_home() {
  # Wenn PM2_HOME bereits gesetzt ist, verwende es
  if [ -n "$PM2_HOME" ] && [ -d "$PM2_HOME" ]; then
    return 0
  fi
  
  # Versuche bestehende PM2-Instanz über ps zu finden
  local pm2_daemon_proc=$(ps aux | grep "PM2 v" | grep -v grep | head -1)
  if [ -n "$pm2_daemon_proc" ]; then
    # Extrahiere PM2_HOME aus dem Prozess
    local pm2_home_from_ps=$(echo "$pm2_daemon_proc" | grep -o "PM2_HOME=[^ ]*" | cut -d= -f2 2>/dev/null || echo "")
    if [ -n "$pm2_home_from_ps" ] && [ -d "$pm2_home_from_ps" ]; then
      export PM2_HOME="$pm2_home_from_ps"
      return 0
    fi
  fi
  
  # Versuche PM2-Daemon Socket-Dateien zu finden
  for possible_home in /root/.pm2 $HOME/.pm2 /home/*/.pm2; do
    if [ -d "$possible_home" ] && [ -S "$possible_home/rpc.sock" ]; then
      export PM2_HOME="$possible_home"
      return 0
    fi
  done
  
  # Letzter Fallback: Standard PM2_HOME NICHT setzen um bestehende Instanz zu verwenden
  # PM2 wird automatisch die aktuelle Instanz verwenden
  unset PM2_HOME
}

# PM2 Home beim Start erkennen
detect_pm2_home

# Farben (mit Terminal-Check für bessere Kompatibilität)
if [ -t 1 ]; then
  readonly RED='\033[0;31m'
  readonly GREEN='\033[0;32m'
  readonly YELLOW='\033[1;33m'
  readonly BLUE='\033[0;34m'
  readonly PURPLE='\033[0;35m'
  readonly CYAN='\033[0;36m'
  readonly BOLD='\033[1m'
  readonly NC='\033[0m' # No Color
else
  readonly RED=''
  readonly GREEN=''
  readonly YELLOW=''
  readonly BLUE=''
  readonly PURPLE=''
  readonly CYAN=''
  readonly BOLD=''
  readonly NC=''
fi

# Signal Handler für graceful shutdown
cleanup() {
  log "${YELLOW}Signal empfangen. Stoppe Deploy-Skript...${NC}"
  if [ -f "$LOCK_FILE" ]; then
    rm -f "$LOCK_FILE"
    log "${GREEN}Lock-Datei entfernt.${NC}"
  fi
  log "${GREEN}Deploy-Skript gestoppt.${NC}"
  exit 0
}

# Signal Handler registrieren
trap cleanup SIGTERM SIGINT SIGQUIT

# === FUNKTIONEN ===
log() {
  local msg="$1"
  echo -e "[$(date +'%Y-%m-%d %H:%M:%S')] $msg" | tee -a "$LOG_FILE"
}

error() {
  log "${RED}FEHLER:${NC} $1"
  exit 1
}

warn() {
  log "${YELLOW}WARNUNG:${NC} $1"
}

info() {
  log "${BLUE}INFO:${NC} $1"
}

success() {
  log "${GREEN}ERFOLG:${NC} $1"
}

show_status() {
  log "${CYAN}${BOLD}=== DEPLOY-SKRIPT STATUS ===${NC}"
  log "${BLUE}PID:${NC} $$"
  log "${BLUE}Lock-Datei:${NC} $LOCK_FILE"
  log "${BLUE}Log-Datei:${NC} $LOG_FILE"
  log "${BLUE}Repo-Verzeichnis:${NC} $REPO_DIR"
  log "${BLUE}PM2_HOME:${NC} $PM2_HOME"
  log "${CYAN}${BOLD}==============================${NC}"
  log ""
  log "${YELLOW}Zum manuellen Stoppen der Skripte:${NC}"
  log "${PURPLE}1. Deploy-Skript stoppen:${NC} kill $$"
  log "${PURPLE}2. PM2 Prozesse stoppen:${NC} pm2 stop all"
  log "${PURPLE}3. PM2 Prozesse löschen:${NC} pm2 delete all"
  log "${PURPLE}4. Lock-Datei entfernen:${NC} rm -f $LOCK_FILE"
  log ""
}

debug_pm2_setup() {
  info "=== PM2 DEBUG INFORMATION ==="
  info "PM2_HOME: ${PM2_HOME:-'(unset - using default)'}"
  info "Current User: $(whoami)"
  info "PM2 Version: $(pm2 -v 2>/dev/null || echo 'Not found')"
  
  # Zeige PM2-Daemon Informationen
  local pm2_daemon=$(ps aux | grep "PM2 v" | grep -v grep | head -1)
  if [ -n "$pm2_daemon" ]; then
    info "PM2 Daemon: AKTIV"
    info "Daemon Process: $pm2_daemon"
  else
    warn "PM2 Daemon: NICHT GEFUNDEN"
  fi
  
  # Zeige Socket-Dateien
  if [ -n "$PM2_HOME" ] && [ -d "$PM2_HOME" ]; then
    info "PM2 Socket Dateien:"
    ls -la "$PM2_HOME"/*.sock 2>/dev/null | while read line; do info "  $line"; done || warn "  Keine Socket-Dateien gefunden"
  fi
  
  info "PM2 List Output:"
  pm2 list 2>/dev/null || warn "PM2 list command failed"
  info "=========================="
}

check_dependencies_silent() {
  # Prüfe nur auf PM2 - andere Dependencies sind optional für den stillen Modus
  if ! command -v pm2 &> /dev/null; then
    # Statt error() zu verwenden, geben wir eine stille Warnung aus und fahren fort
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNUNG: PM2 nicht gefunden" >> "$LOG_FILE" 2>/dev/null
    return 1
  fi
  
  # PM2 Version prüfen (still) - ohne bc dependency
  local pm2_version=$(pm2 -v 2>/dev/null || echo "0")
  # Einfache Versionsprüfung ohne bc
  local major_version=$(echo "$pm2_version" | cut -d. -f1 2>/dev/null || echo "0")
  if [ "$major_version" -lt 5 ] 2>/dev/null; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNUNG: PM2 Version $pm2_version gefunden. Version 5.0+ empfohlen." >> "$LOG_FILE" 2>/dev/null
  fi
  return 0
}

acquire_lock_silent() {
  # Prüfen, ob der Lockfile bereits existiert und der Prozess noch läuft
  if [ -f "$LOCK_FILE" ]; then
    local pid=$(cat "$LOCK_FILE")
    if ps -p "$pid" > /dev/null; then
      # Lock konnte nicht erworben werden - still
      return 1
    fi
  fi
  
  # Schreibe die aktuelle PID in den Lockfile
  echo $$ > "$LOCK_FILE"
  return 0
}

release_lock_silent() {
  if [ -f "$LOCK_FILE" ]; then
    rm "$LOCK_FILE"
  fi
}

init_repo_silent() {
  # Prüfen, ob das Repo-Verzeichnis existiert
  if [ ! -d "$REPO_DIR" ]; then
    mkdir -p "$REPO_DIR"
    git clone -q "$REPO_URL" "$REPO_DIR"
  else
    cd "$REPO_DIR"
    
    # Alle ungetrackten und geänderten Dateien zurücksetzen - mit reduzierter Ausgabe
    git reset --hard HEAD > /dev/null
    git clean -fd > /dev/null
  fi
}

pull_changes() {
  # Absolut stille Prüfung auf Änderungen
  cd "$REPO_DIR"
  
  # Aktuelle Commit-ID speichern
  local old_commit=$(git rev-parse HEAD)
  
  # Änderungen holen aber Output speichern für den Fall von Änderungen
  local pull_output=$(git pull -q origin main 2>&1)
  
  # Neue Commit-ID
  local new_commit=$(git rev-parse HEAD)
  
  # Prüfen, ob es Änderungen gab
  if [ "$old_commit" == "$new_commit" ]; then
    # Keine Ausgabe für keine Änderungen, um Logs zu reduzieren
    return 1
  else
    success "Neue Änderungen gefunden: $old_commit -> $new_commit"
    # Speichere die Änderungen für detailliertes Feedback
    echo "$pull_output" > /tmp/pull_output.txt
    # Geänderte Dateien speichern
    git diff --name-status $old_commit $new_commit > /tmp/changed_files.txt
    # Speichere den Commit-Log
    git log --pretty=format:"%h - %an, %ar : %s" $old_commit..$new_commit > /tmp/commit_log.txt
    return 0
  fi
}

handle_merge_conflicts() {
  info "Prüfe auf Merge-Konflikte..."
  
  # Prüfe, ob wir uns in einem Merge-Zustand befinden
  if [ -f "$REPO_DIR/.git/MERGE_HEAD" ]; then
    warn "Merge-Konflikt erkannt. Versuche automatische Lösung..."
    
    # Versuche, mit der --strategy-option theirs zu lösen
    if git merge --abort && git pull -s recursive -X theirs origin main; then
      success "Merge-Konflikt automatisch gelöst."
    else
      error "Konnte Merge-Konflikt nicht automatisch lösen. Manuelle Intervention erforderlich."
    fi
  fi
}

install_dependencies() {
  info "Installiere Abhängigkeiten..."
  cd "$REPO_DIR"
  
  if [ -f "package.json" ]; then
    # Versuche zuerst npm ci, dann npm install bei Synchronisationsproblemen
    if npm ci 2>/dev/null; then
      success "Abhängigkeiten erfolgreich installiert (npm ci)."
    else
      warn "npm ci fehlgeschlagen - versuche npm install..."
      if npm install; then
        success "Abhängigkeiten erfolgreich installiert (npm install)."
      else
        error "Fehler beim Installieren der Abhängigkeiten!"
      fi
    fi
  else
    warn "Keine package.json gefunden. Überspringe Abhängigkeiten."
  fi
}

build_app() {
  info "Baue Anwendung..."
  cd "$REPO_DIR"
  
  # Prüfe, ob ein build-Skript in package.json existiert
  if grep -q '"build"' package.json; then
    if npm run build; then
      success "Build erfolgreich."
    else
      error "Build fehlgeschlagen!"
    fi
  else
    warn "Kein Build-Skript gefunden. Überspringe Build."
  fi
}

setup_pm2() {
  info "Konfiguriere PM2..."
  cd "$REPO_DIR"
  
  # PM2 Ecosystem-Datei suchen
  if [ -f "ecosystem.config.js" ]; then
    info "PM2 Ecosystem-Datei gefunden."
    local config_file="ecosystem.config.js"
  elif [ -f "ecosystem.config.json" ]; then
    info "PM2 Ecosystem-Datei gefunden."
    local config_file="ecosystem.config.json"
  else
    warn "Keine PM2 Ecosystem-Datei gefunden. Erstelle Standard-Konfiguration..."
    
    # Erstelle eine einfache Ecosystem-Datei
    cat > ecosystem.config.js << EOL
module.exports = {
  apps: [{
    name: "${SERVICE_NAME}",
    script: "server.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "500M",
    env: {
      NODE_ENV: "production",
      PORT: 8080
    }
  }]
};
EOL
    local config_file="ecosystem.config.js"
    success "Standard-Konfiguration erstellt."
  fi
  
  # PM2 neu starten oder neustarten
  if pm2 list | grep -q "$SERVICE_NAME"; then
    info "Service existiert bereits. Starte neu..."
    if pm2 reload "$config_file" --update-env; then
      success "Service erfolgreich neugestartet."
    else
      error "Fehler beim Neustarten des Services!"
    fi
  else
    info "Service existiert noch nicht. Starte neu..."
    if pm2 start "$config_file"; then
      success "Service erfolgreich gestartet."
    else
      error "Fehler beim Starten des Services!"
    fi
  fi
  
  # PM2 Startup speichern, damit es beim Neustart automatisch startet
  info "Speichere PM2-Konfiguration für Autostart..."
  pm2 save
  
  # Aktuelle PM2 Prozesse nach Deployment anzeigen
  info "PM2 Prozesse nach Deployment:"
  pm2 list --no-color | head -10 | while IFS= read -r line; do
    info "  $line"
  done
}

# === STILLE VERSIONEN DER FUNKTIONEN ===
# Diese Funktionen führen die gleichen Aktionen aus wie die Originalfunktionen,
# geben aber keine Logs aus, um die Ausgabe auf maximal 2 Zeilen zu halten

handle_merge_conflicts_silent() {
  cd "$REPO_DIR"
  
  # Prüfe, ob wir uns in einem Merge-Zustand befinden
  if [ -f "$REPO_DIR/.git/MERGE_HEAD" ]; then
    # Versuche, mit der --strategy-option theirs zu lösen
    git merge --abort && git pull -s recursive -X theirs origin main
  fi
}

install_dependencies_silent() {
  cd "$REPO_DIR"
  # Versuche zuerst npm ci, dann npm install bei Synchronisationsproblemen
  if ! npm ci --silent 2>/dev/null; then
    npm install --silent
  fi
}

build_app_silent() {
  cd "$REPO_DIR"
  if [ -f "$REPO_DIR/package.json" ]; then
    # Prüfe, ob ein build-Skript existiert
    if grep -q '"build"' package.json; then
      npm run build --silent
    fi
  fi
}

setup_pm2_silent() {
  cd "$REPO_DIR"
  
  # Pfad zur Konfigurationsdatei
  local config_file="$REPO_DIR/ecosystem.config.js"
  
  # Wenn die PM2-Konfigurationsdatei existiert
  if [ -f "$config_file" ]; then
    # Prüfe, ob der Service bereits läuft
    if pm2 list | grep -q "$SERVICE_NAME"; then
      pm2 reload "$config_file" 2>/dev/null
    else
      pm2 start "$config_file" 2>/dev/null
    fi
  fi
  
  # PM2 Startup speichern, damit es beim Neustart automatisch startet
  pm2 save 2>/dev/null
  
  # Zeige aktive Prozesse in einer Zeile
  local active_count=$(pm2 list | grep -c "online" 2>/dev/null || echo "0")
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] INFO: PM2 Prozesse aktiv: $active_count" >> "$LOG_FILE" 2>/dev/null
}

# === DETAILLIERTE DEPLOYMENT-FUNKTIONEN ===
# Diese Funktionen geben umfassende Logs aus, wenn Änderungen erkannt werden

perform_detailed_deployment() {
  info "=== DETAILLIERTES DEPLOYMENT GESTARTET ==="
  
  # Detaillierte Git-Informationen ausgeben
  show_git_details
  
  # Detaillierte Dateianalyse
  analyze_changed_files
  
  # Merge-Konflikte behandeln
  handle_merge_conflicts
  
  # Dependencies installieren
  install_dependencies
  
  # Anwendung bauen
  build_app
  
  # PM2 Debug-Informationen anzeigen
  debug_pm2_setup
  
  # PM2 Services mit detailliertem Feedback verwalten
  manage_pm2_services
  
  # API Health Check durchführen
  perform_health_check
  
  success "=== DETAILLIERTES DEPLOYMENT ABGESCHLOSSEN ==="
}

show_git_details() {
  info "=== GIT DETAILS ==="
  
  if [ -f "/tmp/pull_output.txt" ]; then
    info "Git Pull Ausgabe:"
    cat /tmp/pull_output.txt | while IFS= read -r line; do
      info "  $line"
    done
  fi
  
  if [ -f "/tmp/commit_log.txt" ]; then
    info "Neue Commits:"
    cat /tmp/commit_log.txt | while IFS= read -r line; do
      info "  📝 $line"
    done
  fi
  
  # Aktuelle Branch und Remote Info
  cd "$REPO_DIR"
  local current_branch=$(git rev-parse --abbrev-ref HEAD)
  local current_commit=$(git rev-parse HEAD)
  local commit_message=$(git log -1 --pretty=format:"%s")
  local commit_author=$(git log -1 --pretty=format:"%an")
  local commit_date=$(git log -1 --pretty=format:"%ad" --date=relative)
  
  info "Branch: $current_branch"
  info "Aktueller Commit: $current_commit"
  info "Commit Message: $commit_message"
  info "Autor: $commit_author ($commit_date)"
}

analyze_changed_files() {
  info "=== DATEI-ANALYSE ==="
  
  if [ -f "/tmp/changed_files.txt" ]; then
    local file_count=$(wc -l < /tmp/changed_files.txt)
    info "Anzahl geänderter Dateien: $file_count"
    
    # Kategorisiere Dateien
    local js_files=$(grep -E '\.(js|ts|jsx|tsx)$' /tmp/changed_files.txt | wc -l)
    local css_files=$(grep -E '\.(css|scss|sass)$' /tmp/changed_files.txt | wc -l)
    local html_files=$(grep -E '\.(html|htm)$' /tmp/changed_files.txt | wc -l)
    local config_files=$(grep -E '\.(json|yml|yaml|config\.js)$' /tmp/changed_files.txt | wc -l)
    local server_files=$(grep -E 'server\.js|app\.js|index\.js' /tmp/changed_files.txt | wc -l)
    
    [ "$js_files" -gt 0 ] && info "  📜 JavaScript/TypeScript Dateien: $js_files"
    [ "$css_files" -gt 0 ] && info "  🎨 CSS/Styling Dateien: $css_files"
    [ "$html_files" -gt 0 ] && info "  🌐 HTML Dateien: $html_files"
    [ "$config_files" -gt 0 ] && info "  ⚙️  Konfigurationsdateien: $config_files"
    [ "$server_files" -gt 0 ] && warn "  🔧 Server-Dateien geändert: $server_files (Neustart erforderlich)"
    
    info "Detaillierte Dateiliste:"
    cat /tmp/changed_files.txt | while IFS= read -r line; do
      local status=$(echo "$line" | cut -f1)
      local file=$(echo "$line" | cut -f2)
      case "$status" in
        "A") info "  ➕ Hinzugefügt: $file" ;;
        "M") info "  ✏️  Geändert: $file" ;;
        "D") info "  ❌ Gelöscht: $file" ;;
        "R"*) info "  🔄 Umbenannt: $file" ;;
        *) info "  ❓ $status: $file" ;;
      esac
    done
  fi
}

manage_pm2_services() {
  info "=== PM2 SERVICE MANAGEMENT ==="
  
  cd "$REPO_DIR"
  
  # Aktuelle PM2 Prozesse auflisten
  info "Aktuelle PM2 Prozesse vor Deployment:"
  info "PM2_HOME: ${PM2_HOME:-'(using default)'}"
  if pm2 list 2>/dev/null; then
    pm2 list --no-color | head -20 | while IFS= read -r line; do
      info "  $line"
    done
  else
    warn "Keine PM2 Prozesse gefunden oder PM2 nicht verfügbar"
  fi
  
  # PM2 Ecosystem-Datei verwalten
  local config_file=""
  if [ -f "ecosystem.config.js" ]; then
    config_file="ecosystem.config.js"
    info "Verwende ecosystem.config.js"
  elif [ -f "ecosystem.config.json" ]; then
    config_file="ecosystem.config.json"
    info "Verwende ecosystem.config.json"
  else
    warn "Keine PM2 Ecosystem-Datei gefunden. Erstelle Standard-Konfiguration..."
    create_default_ecosystem
    config_file="ecosystem.config.js"
  fi
  
  # Prozesse neu starten/starten
  restart_pm2_processes "$config_file"
  
  # PM2 Status nach Neustart
  info "PM2 Prozesse nach Deployment:"
  sudo -u $PM2_USER pm2 list --no-color | while IFS= read -r line; do
    info "  $line"
  done
  
  # PM2 Logs der letzten Minuten anzeigen
  info "Aktuelle PM2 Logs (letzte 10 Zeilen):"
  sudo -u $PM2_USER pm2 logs --lines 10 --no-color | while IFS= read -r line; do
    info "  $line"
  done
}

create_default_ecosystem() {
  cat > ecosystem.config.js << EOL
module.exports = {
  apps: [{
    name: "${SERVICE_NAME}",
    script: "server.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "500M",
    env: {
      NODE_ENV: "production",
      PORT: 8080
    },
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    error_file: "/var/log/${SERVICE_NAME}-error.log",
    out_file: "/var/log/${SERVICE_NAME}-out.log",
    log_file: "/var/log/${SERVICE_NAME}-combined.log",
    health_check_url: "http://localhost:8080/api/health",
    health_check_grace_period: 3000,
    min_uptime: "10s",
    max_restarts: 10,
    restart_delay: 1000
  }]
};
EOL
  success "Standard PM2 Ecosystem-Konfiguration erstellt"
}

restart_pm2_processes() {
  local config_file="$1"
  
  info "Verwende Konfigurationsdatei: $config_file"
  
  # Prüfe, ob Service bereits läuft
  if sudo -u $PM2_USER pm2 list | grep -q "$SERVICE_NAME"; then
    info "Service '$SERVICE_NAME' läuft bereits. Führe Reload durch..."
    
    # Graceful reload für Zero-Downtime
    if sudo -u $PM2_USER pm2 reload "$config_file" --update-env; then
      success "✅ Service '$SERVICE_NAME' erfolgreich neu geladen"
    else
      warn "Reload fehlgeschlagen. Versuche Restart..."
      if sudo -u $PM2_USER pm2 restart "$config_file"; then
        success "✅ Service '$SERVICE_NAME' erfolgreich neu gestartet"
      else
        error "❌ Fehler beim Neustarten des Services '$SERVICE_NAME'!"
      fi
    fi
  else
    info "Service '$SERVICE_NAME' läuft nicht. Starte neu..."
    if sudo -u $PM2_USER pm2 start "$config_file"; then
      success "✅ Service '$SERVICE_NAME' erfolgreich gestartet"
    else
      error "❌ Fehler beim Starten des Services '$SERVICE_NAME'!"
    fi
  fi
  
  # Warte kurz, damit der Service hochfahren kann
  info "Warte 3 Sekunden auf Service-Start..."
  sleep 3
  
  # PM2 Konfiguration speichern
  info "Speichere PM2-Konfiguration für Autostart..."
  if sudo -u $PM2_USER pm2 save; then
    success "✅ PM2-Konfiguration gespeichert"
  else
    warn "⚠️  Warnung: PM2-Konfiguration konnte nicht gespeichert werden"
  fi
}

perform_health_check() {
  info "=== API HEALTH CHECK ==="
  
  local health_url="http://localhost:8080/health"
  local api_url="http://localhost:8080/api/status"
  local max_attempts=5
  local attempt=1
  
  info "Führe Health Check durch..."
  info "Health Check URL: $health_url"
  info "API Status URL: $api_url"
  
  while [ $attempt -le $max_attempts ]; do
    info "Versuch $attempt/$max_attempts..."
    
    # Health Check
    local health_response=$(curl -s -w "%{http_code}" -o /tmp/health_response.txt "$health_url" 2>/dev/null || echo "000")
    
    if [ "$health_response" = "200" ]; then
      success "✅ Health Check erfolgreich (HTTP 200)"
      
      # Zeige Health Check Response
      if [ -f "/tmp/health_response.txt" ]; then
        local health_content=$(cat /tmp/health_response.txt)
        info "Health Response: $health_content"
      fi
      
      # API Status Check
      local api_response=$(curl -s -w "%{http_code}" -o /tmp/api_response.txt "$api_url" 2>/dev/null || echo "000")
      
      if [ "$api_response" = "200" ]; then
        success "✅ API Status Check erfolgreich (HTTP 200)"
        
        if [ -f "/tmp/api_response.txt" ]; then
          local api_content=$(cat /tmp/api_response.txt)
          info "API Response: $api_content"
        fi
      else
        warn "⚠️  API Status Check fehlgeschlagen (HTTP $api_response)"
        if [ -f "/tmp/api_response.txt" ]; then
          local api_content=$(cat /tmp/api_response.txt)
          warn "API Error Response: $api_content"
        fi
      fi
      
      # Memory und CPU Info
      show_system_status
      
      # Cleanup
      rm -f /tmp/health_response.txt /tmp/api_response.txt
      return 0
      
    elif [ "$health_response" = "000" ]; then
      warn "⚠️  Keine Verbindung möglich (Versuch $attempt/$max_attempts)"
    else
      warn "⚠️  Health Check fehlgeschlagen: HTTP $health_response (Versuch $attempt/$max_attempts)"
      if [ -f "/tmp/health_response.txt" ]; then
        local error_content=$(cat /tmp/health_response.txt)
        warn "Error Response: $error_content"
      fi
    fi
    
    if [ $attempt -lt $max_attempts ]; then
      info "Warte 5 Sekunden vor nächstem Versuch..."
      sleep 5
    fi
    
    attempt=$((attempt + 1))
  done
  
  error "❌ Health Check nach $max_attempts Versuchen fehlgeschlagen!"
  
  # Zeige PM2 Status bei fehlgeschlagenem Health Check
  warn "PM2 Status bei fehlgeschlagenem Health Check:"
  sudo -u $PM2_USER pm2 status --no-color | while IFS= read -r line; do
    warn "  $line"
  done
  
  # Cleanup
  rm -f /tmp/health_response.txt /tmp/api_response.txt
  return 1
}

show_system_status() {
  info "=== SYSTEM STATUS ==="
  
  # Memory Information
  local memory_info=$(free -h | grep "^Mem:" | awk '{print "Gesamt: "$2", Verwendet: "$3", Verfügbar: "$7}')
  info "💾 Memory: $memory_info"
  
  # Disk Space
  local disk_info=$(df -h "$REPO_DIR" | tail -1 | awk '{print "Verfügbar: "$4"/"$2" ("$5" verwendet)"}')
  info "💿 Disk Space: $disk_info"
  
  # Load Average
  local load_avg=$(uptime | awk -F'load average:' '{print $2}')
  info "⚡ Load Average:$load_avg"
  
  # PM2 Memory Usage
  if command -v pm2 >/dev/null 2>&1; then
    info "🔧 PM2 Memory Usage:"
    sudo -u $PM2_USER pm2 monit --no-color | head -10 | while IFS= read -r line; do
      info "  $line"
    done
  fi
}

deploy() {
  # Völlig still, wenn keine Änderungen
  
  if ! acquire_lock_silent; then
    return 1  # Kein Deployment durchgeführt
  fi
  
  # Hauptfunktionen - kein Log
  init_repo_silent
  pull_changes
  local changes_found=$?
  
  # Wenn keine Änderungen gefunden wurden
  if [ $changes_found -eq 1 ]; then
    release_lock_silent
    return 1  # Kein Deployment durchgeführt
  fi
  
  # Ab hier gibt es Änderungen - verwende detailliertes Deployment
  success "🚀 ÄNDERUNGEN ERKANNT - Starte detailliertes Deployment..."
  
  # Führe detailliertes Deployment durch
  perform_detailed_deployment
  local deployment_result=$?
  
  # Release Lock
  release_lock_silent
  
  # Temp-Dateien aufräumen
  rm -f /tmp/pull_output.txt /tmp/changed_files.txt /tmp/commit_log.txt
  
  if [ $deployment_result -eq 0 ]; then
    success "🎉 DEPLOYMENT ERFOLGREICH ABGESCHLOSSEN!"
    return 0  # Deployment erfolgreich durchgeführt
  else
    error "💥 DEPLOYMENT FEHLGESCHLAGEN!"
    return 1
  fi
}

# === HAUPTPROGRAMM ===
check_dependencies_silent

# Zeige Skript-Status und Stopp-Anleitungen
show_status

# Reduzierte Startmeldung - nur 1 Zeile
success "Live Error Display Auto-Deploy gestartet (Repository: $REPO_URL)"

# Logdatei ohne Ausgabe initialisieren
if [ ! -f "$LOG_FILE" ]; then
  touch "$LOG_FILE" 2>/dev/null || {
    # Fallback: Verwende /tmp wenn /var/log nicht verfügbar ist
    LOG_FILE="/tmp/live-error-display-deploy.log"
    touch "$LOG_FILE" 2>/dev/null
  }
fi

# Initialer Deploy beim Start - still ausführen
deploy

# Fortlaufende Überwachung - auf 2 Zeilen reduziert
success "Überwachung aktiv - prüfe alle $CHECK_INTERVAL Sekunden"

# Stiller Modus
while true; do
  # Kein Log für reguläre Prüfungen
  deploy
  
  # Bei Änderungen werden logs innerhalb von deploy ausgegeben
  if [ $? -eq 0 ]; then
    # Längere Pause nach Deployment um System zu entlasten
    sleep $((CHECK_INTERVAL * 5))
    # Nach Deployment: Eine einzelne Zeile zur Bestätigung der Wiederaufnahme
    success "Überwachung fortgesetzt - prüfe alle $CHECK_INTERVAL Sekunden"
  else
    sleep $CHECK_INTERVAL
  fi
done
