#!/bin/bash
# Test Webhook Logging Output

echo "=== Webhook Logging Test ==="

echo "1. PM2 Logs (nur stderr = Fehler):"
pm2 logs live-error-display-webhook --err --lines 5

echo -e "\n2. PM2 Logs (nur stdout = normale Ausgabe):"
pm2 logs live-error-display-webhook --out --lines 5

echo -e "\n3. PM2 Logs (alle):"
pm2 logs live-error-display-webhook --lines 10

echo -e "\n4. Test Webhook mit curl:"
curl -X POST http://localhost:8088/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -d '{"zen":"Logging test"}'

echo -e "\n\n5. Logs nach Test (stdout):"
pm2 logs live-error-display-webhook --out --lines 3

echo -e "\n6. Logs nach Test (stderr):"
pm2 logs live-error-display-webhook --err --lines 3

echo -e "\n=== Test abgeschlossen ==="
