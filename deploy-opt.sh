#!/bin/bash

# Live Error Display - Auto-Deploy Script für /opt (root user)
# Prüft jede Sekunde auf Git-Änderungen und deployed automatisch

set -euo pipefail

# === KONFIGURATION ===
REPO_DIR="/opt/live-error-display"
REPO_URL="https://github.com/ochtii/live-error-display.git"
SERVICE_NAME="live-error-display"
LOG_FILE="/var/log/live-error-display-deploy.log"
LOCK_FILE="/tmp/live-error-display-deploy.lock"
CHECK_INTERVAL=1
PM2_USER="root"

# Farben
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

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

check_dependencies() {
  info "Prüfe Abhängigkeiten..."
  
  for cmd in git npm node pm2; do
    if ! command -v $cmd &> /dev/null; then
      error "$cmd nicht gefunden. Bitte installieren."
    fi
  done
  
  # PM2 Version prüfen
  local pm2_version=$(pm2 -v 2>/dev/null || echo "0")
  if [[ $(echo "$pm2_version < 5.0" | bc -l) -eq 1 ]]; then
    warn "PM2 Version $pm2_version gefunden. Version 5.0+ empfohlen."
  else
    info "PM2 Version $pm2_version OK."
  fi
}

acquire_lock() {
  info "Versuche Lock zu erwerben..."
  
  # Prüfen, ob der Lockfile bereits existiert und der Prozess noch läuft
  if [ -f "$LOCK_FILE" ]; then
    local pid=$(cat "$LOCK_FILE")
    if ps -p "$pid" > /dev/null; then
      warn "Ein anderer Deploy-Prozess (PID: $pid) läuft bereits. Überspringe."
      return 1
    else
      warn "Verwaister Lockfile gefunden. Überschreibe."
    fi
  fi
  
  # Schreibe die aktuelle PID in den Lockfile
  echo $$ > "$LOCK_FILE"
  info "Lock erworben. PID: $$"
  return 0
}

release_lock() {
  info "Gebe Lock frei..."
  if [ -f "$LOCK_FILE" ]; then
    rm "$LOCK_FILE"
    info "Lock freigegeben."
  else
    warn "Lockfile nicht gefunden!"
  fi
}

init_repo() {
  info "Initialisiere Repository..."
  
  # Prüfen, ob das Repo-Verzeichnis existiert
  if [ ! -d "$REPO_DIR" ]; then
    info "Repository-Verzeichnis existiert nicht. Klone frisch..."
    mkdir -p "$REPO_DIR"
    git clone "$REPO_URL" "$REPO_DIR"
  else
    info "Repository-Verzeichnis existiert bereits. Setze auf bekannten Zustand zurück..."
    cd "$REPO_DIR"
    
    # Alle ungetrackten und geänderten Dateien zurücksetzen
    git reset --hard HEAD
    git clean -fd
  fi
}

pull_changes() {
  # Reduzierte Logs auf 2 Zeilen
  cd "$REPO_DIR"
  
  # Aktuelle Commit-ID speichern
  local old_commit=$(git rev-parse HEAD)
  
  # Änderungen holen
  git pull origin main
  
  # Neue Commit-ID
  local new_commit=$(git rev-parse HEAD)
  
  # Prüfen, ob es Änderungen gab
  if [ "$old_commit" == "$new_commit" ]; then
    # Keine Ausgabe für keine Änderungen, um Logs zu reduzieren
    return 1
  else
    success "Neue Änderungen gefunden: $old_commit -> $new_commit"
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
    if npm ci; then
      success "Abhängigkeiten erfolgreich installiert."
    else
      error "Fehler beim Installieren der Abhängigkeiten!"
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
    if sudo -u $PM2_USER pm2 reload "$config_file" --update-env; then
      success "Service erfolgreich neugestartet."
    else
      error "Fehler beim Neustarten des Services!"
    fi
  else
    info "Service existiert noch nicht. Starte neu..."
    if sudo -u $PM2_USER pm2 start "$config_file"; then
      success "Service erfolgreich gestartet."
    else
      error "Fehler beim Starten des Services!"
    fi
  fi
  
  # PM2 Startup speichern, damit es beim Neustart automatisch startet
  info "Speichere PM2-Konfiguration für Autostart..."
  sudo -u $PM2_USER pm2 save
}

deploy() {
  # Nur ausgeben wenn wirklich etwas passiert
  
  if ! acquire_lock; then
    return 0
  fi
  
  # Hauptfunktionen
  init_repo
  pull_changes || { release_lock; return 0; }
  
  # Ab hier gibt es Änderungen, die wir deployen müssen
  info "Starte Deployment-Prozess..."
  handle_merge_conflicts
  install_dependencies
  build_app
  setup_pm2
  
  success "Deployment abgeschlossen!"
  release_lock
}

# === HAUPTPROGRAMM ===
check_dependencies

info "=== Live Error Display Auto-Deploy gestartet ==="
info "Repository: $REPO_URL"
info "Zielverzeichnis: $REPO_DIR"
info "Service-Name: $SERVICE_NAME"
info "Prüfintervall: $CHECK_INTERVAL Sekunde(n)"

# Logdatei initialisieren
if [ ! -f "$LOG_FILE" ]; then
  touch "$LOG_FILE" || error "Konnte Logdatei nicht erstellen: $LOG_FILE"
  info "Logdatei erstellt: $LOG_FILE"
fi

# Initialer Deploy beim Start
deploy

# Fortlaufende Überwachung
info "Starte fortlaufende Überwachung..."
while true; do
  deploy
  sleep $CHECK_INTERVAL
done
