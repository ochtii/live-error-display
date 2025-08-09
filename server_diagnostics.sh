#!/bin/bash
# Server Diagnostics für Error Display App
# Diese Befehle auf dem Ubuntu Server 18.197.100.102 ausführen

echo "=== PM2 Status ==="
pm2 status

echo -e "\n=== PM2 Logs Webhook ==="
pm2 logs live-error-display-webhook --lines 20

echo -e "\n=== PM2 Logs App ==="
pm2 logs live-error-display --lines 20

echo -e "\n=== Git Repository Status ==="
cd /opt/live-error-display
git status
git log --oneline -5

echo -e "\n=== Git Remote Branches ==="
git branch -r

echo -e "\n=== Last Git Pull ==="
git log HEAD..origin/live --oneline

echo -e "\n=== Webhook Health Check ==="
curl -s http://localhost:9090/health

echo -e "\n=== App Health Check ==="
curl -s http://localhost:8088

echo -e "\n=== Port Status ==="
netstat -tlnp | grep -E "(8088|9090)"

echo -e "\n=== File Permissions ==="
ls -la /opt/live-error-display/
ls -la /opt/live-error-display/logs/

echo -e "\n=== Disk Space ==="
df -h /opt/

echo -e "\n=== System Load ==="
uptime
