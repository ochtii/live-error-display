#!/bin/bash

# Live Error Display - Quick Fix für Auto-Deploy Probleme
# Behebt häufige Probleme und startet alles neu

set -euo pipefail

# Farben
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

REPO_DIR="/opt/live-error-display"
SERVICE_NAME="live-error-display"

echo -e "${BLUE}🔧 Live Error Display - Quick Fix${NC}"
echo "================================="
echo ""

# Root check
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Dieses Skript muss als root ausgeführt werden (sudo ./quickfix.sh)${NC}"
   exit 1
fi

# 1. Stop all services
echo -e "${YELLOW}🛑 Stopping services...${NC}"
systemctl stop live-error-display-deploy 2>/dev/null || echo "Deploy service was not running"
systemctl stop $SERVICE_NAME 2>/dev/null || echo "App service was not running"

# 2. Force update repository
echo -e "${YELLOW}🔄 Force updating repository...${NC}"
if [[ -d "$REPO_DIR" ]]; then
    cd "$REPO_DIR"
    
    # Ensure ownership
    chown -R www-data:www-data "$REPO_DIR"
    
    # Clean and reset
    sudo -u www-data git fetch origin main --force
    sudo -u www-data git reset --hard origin/main
    sudo -u www-data git clean -fd
    
    # Show current state
    local_commit=$(sudo -u www-data git rev-parse HEAD | cut -c1-7)
    echo "✅ Updated to commit: $local_commit"
    
    # Check for title change (our test)
    if grep -q "v1.1" public/index.html; then
        echo -e "${GREEN}✅ Test change detected in index.html (v1.1 found)${NC}"
    else
        echo -e "${RED}⚠️ Test change not found - check GitHub sync${NC}"
    fi
else
    echo -e "${RED}❌ Repository directory not found: $REPO_DIR${NC}"
    exit 1
fi

# 3. Install/update dependencies if needed
echo -e "${YELLOW}📦 Checking dependencies...${NC}"
if [[ -f "$REPO_DIR/package.json" && ! -d "$REPO_DIR/node_modules" ]]; then
    echo "Installing dependencies..."
    cd "$REPO_DIR"
    sudo -u www-data npm install --production --silent
fi

# 4. Restart services
echo -e "${YELLOW}🚀 Starting services...${NC}"
systemctl start $SERVICE_NAME
sleep 3

if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "${GREEN}✅ App service started successfully${NC}"
else
    echo -e "${RED}❌ App service failed to start${NC}"
    systemctl status $SERVICE_NAME --no-pager -l
fi

systemctl start live-error-display-deploy
sleep 2

if systemctl is-active --quiet live-error-display-deploy; then
    echo -e "${GREEN}✅ Deploy service started successfully${NC}"
else
    echo -e "${RED}❌ Deploy service failed to start${NC}"
    systemctl status live-error-display-deploy --no-pager -l
fi

# 5. Test application
echo -e "${YELLOW}🧪 Testing application...${NC}"
sleep 2

if curl -s --connect-timeout 10 http://localhost:8080 > /dev/null; then
    echo -e "${GREEN}✅ Application is responding on port 8080${NC}"
else
    echo -e "${RED}❌ Application is not responding${NC}"
fi

# 6. Show status
echo ""
echo -e "${BLUE}📊 Final Status:${NC}"
echo "App Service: $(systemctl is-active $SERVICE_NAME)"
echo "Deploy Service: $(systemctl is-active live-error-display-deploy)"

if [[ -d "$REPO_DIR" ]]; then
    cd "$REPO_DIR"
    echo "Current Commit: $(sudo -u www-data git rev-parse HEAD | cut -c1-7)"
    echo "Branch: $(sudo -u www-data git branch --show-current)"
fi

echo ""
echo -e "${GREEN}🎉 Quick fix complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Check your browser: http://YOUR-SERVER-IP:8080"
echo "2. Look for 'v1.1' in the title (test change)"
echo "3. Monitor logs: tail -f /var/log/live-error-display-deploy.log"
echo "4. If still issues, run: sudo ./diagnose.sh"
