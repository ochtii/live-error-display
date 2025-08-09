#!/bin/bash
# Debug PM2 Environment Variables

echo "=== PM2 Environment Debug ==="

echo "1. PM2 Status:"
pm2 status

echo -e "\n2. PM2 Prozess Details:"
pm2 show live-error-display-webhook

echo -e "\n3. Environment Variables für Webhook:"
pm2 env live-error-display-webhook

echo -e "\n4. PM2 Logs (letzte 10 Zeilen):"
pm2 logs live-error-display-webhook --lines 10

echo -e "\n5. Aktive Ports prüfen:"
netstat -tlnp | grep -E "(8080|8088|9090)"

echo -e "\n6. Prozesse auf Port 9090:"
sudo lsof -i :9090 2>/dev/null || echo "Kein Prozess auf Port 9090"

echo -e "\n7. Prozesse auf Port 8088:"
sudo lsof -i :8088 2>/dev/null || echo "Kein Prozess auf Port 8088"

echo -e "\n8. ecosystem.config.js Webhook Port:"
grep -A 5 "WEBHOOK_PORT" /opt/live-error-display/ecosystem.config.js

echo "=== Debug abgeschlossen ==="
