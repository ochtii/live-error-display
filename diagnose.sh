#!/bin/bash

# Live Error Display - Diagnose-Skript für Auto-Deploy Probleme
# Überprüft alle Aspekte des Auto-Deploy Systems

set -euo pipefail

# Farben
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

REPO_DIR="/opt/live-error-display"
SERVICE_NAME="live-error-display"
LOG_FILE="/var/log/live-error-display-deploy.log"

echo -e "${BLUE}🔍 Live Error Display - Auto-Deploy Diagnose${NC}"
echo "================================================="
echo ""

# 1. Systemd Services Status
echo -e "${YELLOW}📊 1. Systemd Services Status:${NC}"
echo "App Service:"
systemctl status $SERVICE_NAME --no-pager -l || echo "❌ Service nicht aktiv"
echo ""
echo "Deploy Service:"
systemctl status live-error-display-deploy --no-pager -l || echo "❌ Deploy Service nicht aktiv"
echo ""

# 2. Repository Status
echo -e "${YELLOW}📂 2. Repository Status:${NC}"
if [[ -d "$REPO_DIR" ]]; then
    cd "$REPO_DIR"
    echo "Repository Pfad: $REPO_DIR"
    echo "Owner: $(stat -c '%U:%G' "$REPO_DIR" 2>/dev/null || echo 'unknown')"
    echo "Current Branch: $(sudo -u www-data git branch --show-current 2>/dev/null || echo 'unknown')"
    echo "Local Commit: $(sudo -u www-data git rev-parse HEAD 2>/dev/null | cut -c1-7 || echo 'unknown')"
    echo "Remote URL: $(sudo -u www-data git remote get-url origin 2>/dev/null || echo 'unknown')"
    echo ""
    
    # Git status
    echo "Git Status:"
    sudo -u www-data git status --porcelain 2>/dev/null || echo "Git status failed"
    echo ""
    
    # Fetch test
    echo "Testing git fetch:"
    if sudo -u www-data git fetch origin main 2>&1; then
        echo "✅ Git fetch successful"
        remote_commit=$(sudo -u www-data git rev-parse refs/remotes/origin/main 2>/dev/null | cut -c1-7 || echo 'unknown')
        echo "Remote Commit: $remote_commit"
        local_commit=$(sudo -u www-data git rev-parse HEAD 2>/dev/null | cut -c1-7 || echo 'unknown')
        
        if [[ "$local_commit" != "$remote_commit" ]]; then
            echo -e "${RED}⚠️ LOCAL IS BEHIND REMOTE!${NC}"
            commits_behind=$(sudo -u www-data git rev-list --count HEAD..refs/remotes/origin/main 2>/dev/null || echo "0")
            echo "Commits behind: $commits_behind"
            echo ""
            echo "Recent remote commits:"
            sudo -u www-data git log --oneline -3 refs/remotes/origin/main 2>/dev/null || echo "No commits"
        else
            echo -e "${GREEN}✅ Local and remote are in sync${NC}"
        fi
    else
        echo -e "${RED}❌ Git fetch failed${NC}"
    fi
else
    echo -e "${RED}❌ Repository directory $REPO_DIR does not exist!${NC}"
fi
echo ""

# 3. Deploy Logs
echo -e "${YELLOW}📝 3. Deploy Logs (last 20 lines):${NC}"
if [[ -f "$LOG_FILE" ]]; then
    tail -20 "$LOG_FILE" || echo "Could not read log file"
else
    echo "❌ Log file $LOG_FILE does not exist"
fi
echo ""

# 4. Process Check
echo -e "${YELLOW}🔄 4. Running Processes:${NC}"
echo "Deploy processes:"
ps aux | grep -E "(deploy\.sh|live-error-display)" | grep -v grep || echo "No deploy processes found"
echo ""

# 5. File Permissions
echo -e "${YELLOW}🔒 5. File Permissions:${NC}"
if [[ -d "$REPO_DIR" ]]; then
    echo "Repository ownership:"
    ls -la "$REPO_DIR" | head -5
    echo ""
    echo "Key files:"
    ls -la "$REPO_DIR"/{server.js,deploy.sh,public/index.html} 2>/dev/null || echo "Some files missing"
else
    echo "❌ Repository directory not found"
fi
echo ""

# 6. Network Test
echo -e "${YELLOW}🌐 6. Network Connectivity:${NC}"
echo "Testing GitHub connectivity:"
if curl -s --connect-timeout 5 https://github.com/ochtii/live-error-display.git > /dev/null; then
    echo "✅ GitHub reachable"
else
    echo "❌ GitHub not reachable"
fi

echo "Testing local app:"
if curl -s --connect-timeout 5 http://localhost:8080 > /dev/null; then
    echo "✅ Local app responding"
else
    echo "❌ Local app not responding"
fi
echo ""

# 7. Manual Deploy Test
echo -e "${YELLOW}🧪 7. Manual Deploy Test:${NC}"
if [[ -d "$REPO_DIR" && -f "$REPO_DIR/deploy.sh" ]]; then
    echo "Running deploy script test mode..."
    cd "$REPO_DIR"
    timeout 30 sudo ./deploy.sh test 2>&1 || echo "Deploy test completed or timed out"
else
    echo "❌ Deploy script not found"
fi
echo ""

# 8. Recommendations
echo -e "${YELLOW}💡 8. Recommendations:${NC}"
echo ""

if ! systemctl is-active --quiet live-error-display-deploy; then
    echo -e "${RED}🔧 Deploy service is not running!${NC}"
    echo "   Start it with: sudo systemctl start live-error-display-deploy"
    echo ""
fi

if [[ -d "$REPO_DIR" ]]; then
    cd "$REPO_DIR"
    local_commit=$(sudo -u www-data git rev-parse HEAD 2>/dev/null | cut -c1-7 || echo 'unknown')
    remote_commit=$(sudo -u www-data git rev-parse refs/remotes/origin/main 2>/dev/null | cut -c1-7 || echo 'unknown')
    
    if [[ "$local_commit" != "$remote_commit" ]]; then
        echo -e "${RED}🔧 Manual update needed!${NC}"
        echo "   Run: cd $REPO_DIR && sudo -u www-data git reset --hard origin/main"
        echo "   Then restart: sudo systemctl restart $SERVICE_NAME"
        echo ""
    fi
fi

echo -e "${GREEN}✅ Diagnose complete!${NC}"
echo ""
echo "If problems persist:"
echo "1. Check logs: tail -f $LOG_FILE"
echo "2. Restart deploy: sudo systemctl restart live-error-display-deploy"
echo "3. Manual update: cd $REPO_DIR && sudo -u www-data git reset --hard origin/main"
