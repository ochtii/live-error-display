#!/bin/bash

# Live Error Display - Stopp-Skript
# Stoppt alle Deploy-Prozesse und PM2-Services

echo "🛑 Stoppe Live Error Display Deploy-Prozesse..."

# 1. Deploy-Skript stoppen
echo "1️⃣  Stoppe Deploy-Skript..."
pkill -f "deploy-opt.sh" && echo "✅ Deploy-Skript gestoppt" || echo "❌ Kein Deploy-Skript gefunden"

# 2. PM2 Prozesse stoppen
echo "2️⃣  Stoppe PM2-Prozesse..."
if command -v pm2 >/dev/null 2>&1; then
    pm2 stop live-error-display 2>/dev/null && echo "✅ live-error-display gestoppt"
    pm2 stop live-error-display-deploy 2>/dev/null && echo "✅ live-error-display-deploy gestoppt"
    pm2 delete live-error-display 2>/dev/null && echo "✅ live-error-display gelöscht"
    pm2 delete live-error-display-deploy 2>/dev/null && echo "✅ live-error-display-deploy gelöscht"
    pm2 save
else
    echo "❌ PM2 nicht gefunden"
fi

# 3. Lock-Dateien entfernen
echo "3️⃣  Entferne Lock-Dateien..."
rm -f /tmp/live-error-display-deploy.lock && echo "✅ Lock-Datei entfernt"
rm -f /tmp/pull_output.txt /tmp/changed_files.txt /tmp/commit_log.txt && echo "✅ Temp-Dateien entfernt"

# 4. Port 8080 freigeben (falls blockiert)
echo "4️⃣  Prüfe Port 8080..."
PORT_PID=$(lsof -ti:8080 2>/dev/null)
if [ -n "$PORT_PID" ]; then
    kill -9 $PORT_PID && echo "✅ Port 8080 freigegeben"
else
    echo "✅ Port 8080 ist frei"
fi

# 5. Finale Überprüfung
echo "5️⃣  Finale Überprüfung..."
REMAINING=$(ps aux | grep -E "(deploy-opt|live-error-display)" | grep -v grep | wc -l)
if [ "$REMAINING" -eq 0 ]; then
    echo "🎉 Alle Prozesse erfolgreich gestoppt!"
else
    echo "⚠️  Noch $REMAINING Prozesse aktiv:"
    ps aux | grep -E "(deploy-opt|live-error-display)" | grep -v grep
    echo ""
    echo "🔧 Force-Kill mit: sudo pkill -9 -f 'live-error-display'"
fi

echo "✅ Stopp-Vorgang abgeschlossen."
