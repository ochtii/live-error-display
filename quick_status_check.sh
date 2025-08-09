#!/bin/bash
# Quick Status Check

echo "=== Live Error Display Status ==="

echo "1. PM2 Status:"
pm2 status

echo -e "\n2. Port Status:"
echo "Port 8080 (App):"
netstat -tlnp | grep 8080
echo "Port 8088 (Webhook):"
netstat -tlnp | grep 8088

echo -e "\n3. Health Checks:"
echo "App (8080):"
curl -s http://localhost:8080 | head -5 || echo "❌ App nicht erreichbar"

echo "Webhook (8088):"
curl -s http://localhost:8088/health || echo "❌ Webhook nicht erreichbar"

echo -e "\n4. GitHub Webhook Test bereit:"
echo "Webhook URL: http://18.197.100.102:8088/webhook"

echo -e "\n=== Status Check abgeschlossen ==="
