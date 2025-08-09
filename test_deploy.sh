#!/bin/bash

# Test-Skript für deploy.sh
# Dieses Skript führt einen Test des Deploy-Skripts ohne tatsächliche Änderungen durch

# Pfad zum Deploy-Skript
DEPLOY_SCRIPT="./deploy.sh"

echo "=== Auto-Deploy Test ==="
echo "Dieses Skript testet, ob das Auto-Deploy-Skript korrekt konfiguriert ist."

# Prüfe, ob das Deploy-Skript existiert
if [[ ! -f "$DEPLOY_SCRIPT" ]]; then
    echo "❌ Deploy-Skript nicht gefunden: $DEPLOY_SCRIPT"
    exit 1
fi

# Prüfe, ob das Skript ausführbar ist
if [[ ! -x "$DEPLOY_SCRIPT" ]]; then
    echo "⚠️ Deploy-Skript ist nicht ausführbar. Führe chmod +x aus..."
    chmod +x "$DEPLOY_SCRIPT"
fi

# Führe das Deploy-Skript im Test-Modus aus
echo "🧪 Führe Deploy-Skript im Test-Modus aus..."
"$DEPLOY_SCRIPT" test

echo ""
echo "Um den tatsächlichen Auto-Deploy-Prozess zu starten:"
echo "1. Stelle sicher, dass PM2 installiert ist: npm install -g pm2"
echo "2. Führe das Deploy-Skript aus: sudo ./deploy.sh"
echo ""
echo "Für GitHub-Webhook-Integration:"
echo "1. Installiere Python-Abhängigkeiten: pip install flask gunicorn"
echo "2. Starte den Webhook-Server: ./deploy-webhook.sh"
echo "3. Konfiguriere den Webhook in den GitHub-Repository-Einstellungen"
