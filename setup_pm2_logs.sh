#!/bin/bash

# PM2 Log Directory Setup Script
# =============================

echo "🗂️ Setting up PM2 log directories..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/opt/live-error-display"
LOG_DIR="$PROJECT_DIR/logs"

# Create logs directory
echo -e "${YELLOW}📁 Creating logs directory...${NC}"
mkdir -p "$LOG_DIR"

# Set proper ownership and permissions
echo -e "${YELLOW}🔧 Setting permissions...${NC}"
sudo chown -R ubuntu:ubuntu "$LOG_DIR"
chmod -R 755 "$LOG_DIR"

# Create .gitkeep file to preserve directory in git
echo -e "${YELLOW}📝 Creating .gitkeep file...${NC}"
touch "$LOG_DIR/.gitkeep"

# Update .gitignore to ignore log files but keep directory
echo -e "${YELLOW}🚫 Updating .gitignore...${NC}"
if ! grep -q "logs/\*.log" "$PROJECT_DIR/.gitignore" 2>/dev/null; then
    echo "" >> "$PROJECT_DIR/.gitignore"
    echo "# PM2 Log files" >> "$PROJECT_DIR/.gitignore"
    echo "logs/*.log" >> "$PROJECT_DIR/.gitignore"
    echo "!logs/.gitkeep" >> "$PROJECT_DIR/.gitignore"
fi

echo -e "${GREEN}✅ Log directory setup completed!${NC}"
echo ""
echo -e "${BLUE}📊 Directory structure:${NC}"
ls -la "$LOG_DIR"
echo ""
echo -e "${BLUE}🚀 You can now start PM2:${NC}"
echo "  pm2 start ecosystem.config.js --env production"
echo ""
echo -e "${BLUE}📋 Log locations:${NC}"
echo "  Main app logs: $LOG_DIR/live-error-display-*.log"
echo "  Webhook logs:  $LOG_DIR/live-error-display-webhook-*.log"
