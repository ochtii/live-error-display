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

check_dependencies_silent() {
  for cmd in git npm node pm2; do
    if ! command -v $cmd &> /dev/null; then
      error "$cmd nicht gefunden. Bitte installieren."
    fi
  done
  
  # PM2 Version prüfen (still) - ohne bc dependency
  local pm2_version=$(pm2 -v 2>/dev/null || echo "0")
  # Einfache Versionsprüfung ohne bc
  local major_version=$(echo "$pm2_version" | cut -d. -f1)
  if [ "$major_version" -lt 5 ] 2>/dev/null; then
    return 1
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
  npm install --silent
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
    if sudo -u $PM2_USER pm2 list | grep -q "$SERVICE_NAME"; then
      sudo -u $PM2_USER pm2 reload "$config_file"
    else
      sudo -u $PM2_USER pm2 start "$config_file"
    fi
  fi
  
  # PM2 Startup speichern, damit es beim Neustart automatisch startet
  sudo -u $PM2_USER pm2 save
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
  
  # Ab hier gibt es Änderungen - erster Log (Zeile 1 von 2)
  success "Deployment: Änderungen werden installiert..."
  
  # Detailliertes Feedback zu den Änderungen in einer Datei statt Logs
  if [ -f "/tmp/pull_output.txt" ] || [ -f "/tmp/changed_files.txt" ] || [ -f "/tmp/commit_log.txt" ]; then
    # Alle Outputs in eine Datei zusammenführen für späteren Zugriff
    {
      echo "=== Git Pull Ausgabe ==="
      cat /tmp/pull_output.txt 2>/dev/null
      echo
      echo "=== Geänderte Dateien ==="
      cat /tmp/changed_files.txt 2>/dev/null
      echo
      echo "=== Commit-Logs ==="
      cat /tmp/commit_log.txt 2>/dev/null
    } > /tmp/deploy_details.log
  fi
  
  # Funktionen ohne Logs ausführen
  handle_merge_conflicts_silent
  install_dependencies_silent
  build_app_silent
  setup_pm2_silent
  
  # Abschluss-Log (Zeile 2 von 2)
  success "Deployment erfolgreich abgeschlossen - Details in /tmp/deploy_details.log"
  release_lock_silent
  
  # Temp-Dateien aufräumen
  rm -f /tmp/pull_output.txt /tmp/changed_files.txt /tmp/commit_log.txt
  
  return 0  # Deployment erfolgreich durchgeführt
}

# === HAUPTPROGRAMM ===
check_dependencies_silent

# Reduzierte Startmeldung - nur 1 Zeile
success "Live Error Display Auto-Deploy gestartet (Repository: $REPO_URL)"

# Logdatei ohne Ausgabe initialisieren
if [ ! -f "$LOG_FILE" ]; then
  touch "$LOG_FILE" 2>/dev/null || error "Konnte Logdatei nicht erstellen: $LOG_FILE"
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
