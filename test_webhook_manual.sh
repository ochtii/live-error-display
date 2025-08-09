#!/bin/bash
# GitHub Webhook Test

WEBHOOK_URL="http://18.197.100.102:8088/webhook"
SECRET="dein-webhook-secret"  # Ersetze mit deinem echten Secret

echo "=== GitHub Webhook Test ==="

# Test 1: Health Check
echo "1. Health Check..."
curl -s "$WEBHOOK_URL/../health"
echo ""

# Test 2: Webhook Simulation
echo "2. Webhook Test (dummy payload)..."
PAYLOAD='{"ref":"refs/heads/live","repository":{"name":"live-error-display","clone_url":"https://github.com/ochtii/live-error-display.git"}}'

# Signature erstellen (benötigt den echten SECRET)
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -binary | xxd -p)

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"

echo ""
echo "Test abgeschlossen!"
