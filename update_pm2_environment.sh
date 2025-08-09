#!/bin/bash
# PM2 Environment Update Script

echo "=== PM2 Environment Update für neue Ports ==="

cd /opt/live-error-display

echo "1. Aktuelle PM2 Prozesse stoppen..."
pm2 stop live-error-display-webhook
pm2 stop live-error-display

echo "2. PM2 Prozesse löschen (um Environment zu clearen)..."
pm2 delete live-error-display-webhook
pm2 delete live-error-display

echo "3. Git Pull für neue Konfiguration..."
git pull origin live

echo "4. PM2 Prozesse mit neuer Konfiguration starten..."
pm2 start ecosystem.config.js --env production

echo "5. PM2 Status prüfen..."
pm2 status

echo "6. Environment Variables prüfen..."
pm2 env 0

echo "7. Port Check..."
sleep 3
netstat -tlnp | grep -E "(8080|8088)"

echo "8. Health Checks..."
curl -s http://localhost:8080 || echo "App (8080) nicht erreichbar"
curl -s http://localhost:8088/health || echo "Webhook (8088) nicht erreichbar"

echo "=== Update abgeschlossen! ==="
