#!/bin/bash
# Manual Update Script - Falls Webhook nicht funktioniert

echo "=== Manual Update der Error Display App ==="

cd /opt/live-error-display

echo "1. Git Pull vom live Branch..."
git pull origin live

echo "2. Dependencies aktualisieren..."
npm install

echo "3. PM2 Prozesse neu starten..."
pm2 restart live-error-display
pm2 restart live-error-display-webhook

echo "4. Status prüfen..."
pm2 status

echo "5. Health Checks..."
sleep 3
curl -s http://localhost:8088
echo ""
curl -s http://localhost:9090/health
echo ""

echo "Update abgeschlossen!"
