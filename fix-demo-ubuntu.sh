#!/bin/bash

# Quick Fix for Ubuntu Home Directory Setup
# Disable Demo Mode (set NODE_ENV=production)

set -euo pipefail

readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

echo -e "${YELLOW}🔧 Fixing Demo Mode - Ubuntu Home Setup${NC}"

# Stop current PM2 app
echo "Stopping current PM2 app..."
sudo -u www-data pm2 stop live-error-display 2>/dev/null || true

# Delete the app from PM2
echo "Removing app from PM2..."
sudo -u www-data pm2 delete live-error-display 2>/dev/null || true

# Go to the correct directory
echo "Changing to /home/ubuntu/live-error-display..."
cd /home/ubuntu/live-error-display

# Check if server.js exists and is readable
if [[ -f "server.js" ]]; then
    echo "✅ server.js found"
    ls -la server.js
else
    echo "❌ server.js not found!"
    exit 1
fi

# Set correct ownership for www-data
echo "Setting correct ownership..."
sudo chown -R www-data:www-data /home/ubuntu/live-error-display

# Start directly with server.js and explicit NODE_ENV
echo "Starting server.js with NODE_ENV=production..."
sudo -u www-data NODE_ENV=production pm2 start /home/ubuntu/live-error-display/server.js --name live-error-display

# Save PM2 configuration
echo "Saving PM2 configuration..."
sudo -u www-data pm2 save

echo -e "${GREEN}✅ Demo mode disabled! App restarted with NODE_ENV=production${NC}"

# Show status
echo ""
echo "PM2 Status:"
sudo -u www-data pm2 status

echo ""
echo "App logs (last 10 lines):"
sudo -u www-data pm2 logs live-error-display --lines 10
