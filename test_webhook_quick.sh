#!/bin/bash
# Quick Webhook Test

echo "=== Webhook Test ==="

WEBHOOK_URL="http://18.197.100.102:8088/webhook"
HEALTH_URL="http://18.197.100.102:8088/health"

echo "1. Health Check:"
curl -s "$HEALTH_URL" | jq . 2>/dev/null || curl -s "$HEALTH_URL"

echo -e "\n2. Ping Test:"
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -H "X-Hub-Signature-256: sha256=test" \
  -d '{"zen":"GitHub webhook test"}'

echo -e "\n\n3. Server Status:"
echo "Port 8088 (Webhook):"
curl -s "$HEALTH_URL"

echo -e "\nPort 8080 (App):"
curl -s "http://18.197.100.102:8080" | head -1

echo -e "\n=== Test abgeschlossen ==="
