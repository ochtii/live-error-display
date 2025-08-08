#!/bin/bash

# Quick Fix: Resolve Git conflicts and restart deploy

echo "🔧 Fixing Git conflicts in /opt/live-error-display..."

cd /opt/live-error-display

# Stash any local changes
echo "Stashing local changes..."
git stash

# Force pull latest changes
echo "Force pulling latest changes..."
git fetch origin main
git reset --hard origin/main

# Restart PM2 apps
echo "Restarting PM2 apps..."
pm2 restart live-error-display
pm2 restart live-error-display-deploy

echo "✅ Fix completed!"
echo ""
echo "Status:"
pm2 status

echo ""
echo "Latest files:"
ls -la deploy-test-2.js 2>/dev/null && echo "✅ deploy-test-2.js found" || echo "❌ deploy-test-2.js missing"
