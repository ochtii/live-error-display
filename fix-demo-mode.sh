#!/bin/bash

# Quick Fix: Disable Demo Mode (set NODE_ENV=production)

set -euo pipefail

readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

echo -e "${YELLOW}🔧 Fixing Demo Mode - Setting NODE_ENV=production${NC}"

# Stop current PM2 app
echo "Stopping current PM2 app..."
sudo -u www-data pm2 stop live-error-display 2>/dev/null || true

# Delete the app from PM2
echo "Removing app from PM2..."
sudo -u www-data pm2 delete live-error-display 2>/dev/null || true

# Start with explicit NODE_ENV=production
echo "Starting with NODE_ENV=production..."
cd /opt/live-error-display

# Check if ecosystem.config.json exists, otherwise start server.js directly
if [[ -f "ecosystem.config.json" ]]; then
    echo "Using ecosystem.config.json..."
    sudo -u www-data NODE_ENV=production pm2 start ecosystem.config.json
else
    echo "ecosystem.config.json not found, starting server.js directly..."
    sudo -u www-data NODE_ENV=production pm2 start server.js --name live-error-display
fi

# Save PM2 configuration
echo "Saving PM2 configuration..."
sudo -u www-data pm2 save

echo -e "${GREEN}✅ Demo mode disabled! App restarted with NODE_ENV=production${NC}"

# Show status
echo ""
echo "PM2 Status:"
sudo -u www-data pm2 status

echo ""
echo "App logs (last 20 lines):"
sudo -u www-data pm2 logs live-error-display --lines 20
