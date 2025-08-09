#!/bin/bash

# GitHub Webhook Listener Setup Script
# ===================================

set -e  # Exit on any error

echo "🚀 Setting up GitHub Webhook Listener for Live Error Display"
echo "============================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WEBHOOK_USER="webhook"
WEBHOOK_DIR="/opt/live-error-display"
WEBHOOK_SERVICE="live-error-display-webhook"
WEBHOOK_PORT="9090"

echo -e "${BLUE}📋 Installation Summary:${NC}"
echo "  - Service User: $WEBHOOK_USER"
echo "  - Installation Directory: $WEBHOOK_DIR"
echo "  - Service Name: $WEBHOOK_SERVICE"
echo "  - Webhook Port: $WEBHOOK_PORT"
echo ""

# Function to check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
        exit 1
    fi
}

# Function to install Python dependencies
install_dependencies() {
    echo -e "${YELLOW}📦 Installing Python dependencies...${NC}"
    
    # Update package list
    apt-get update
    
    # Install Python and pip if not present
    apt-get install -y python3 python3-pip python3-venv
    
    # Install webhook dependencies
    cd $WEBHOOK_DIR
    python3 -m pip install -r webhook_requirements.txt
    
    echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
}

# Function to create webhook service user
create_webhook_user() {
    echo -e "${YELLOW}👤 Creating webhook service user...${NC}"
    
    if id "$WEBHOOK_USER" &>/dev/null; then
        echo -e "${BLUE}ℹ️ User $WEBHOOK_USER already exists${NC}"
    else
        useradd -r -s /bin/bash -d $WEBHOOK_DIR $WEBHOOK_USER
        echo -e "${GREEN}✅ User $WEBHOOK_USER created${NC}"
    fi
    
    # Ensure webhook user owns the directory
    chown -R $WEBHOOK_USER:$WEBHOOK_USER $WEBHOOK_DIR
    chmod +x $WEBHOOK_DIR/webhook_listener.py
}

# Function to create PM2 ecosystem configuration
setup_pm2_config() {
    echo -e "${YELLOW}⚙️ Setting up PM2 configuration...${NC}"
    
    # Ensure webhook listener is configured in ecosystem.config.js
    if grep -q "live-error-display-webhook" $WEBHOOK_DIR/ecosystem.config.js; then
        echo -e "${GREEN}✅ Webhook listener already configured in ecosystem.config.js${NC}"
    else
        echo -e "${RED}❌ Webhook listener not found in ecosystem.config.js${NC}"
        echo "Please ensure the live-error-display-webhook app is configured in ecosystem.config.js"
        exit 1
    fi
    
    # Update GitHub secret in ecosystem.config.js if needed
    echo -e "${BLUE}ℹ️ Remember to update GITHUB_WEBHOOK_SECRET in ecosystem.config.js${NC}"
}

# Function to test PM2 services
test_pm2_services() {
    echo -e "${YELLOW}🧪 Testing PM2 services...${NC}"
    
    # Wait for services to start
    sleep 5
    
    # Check PM2 status
    pm2 status
    
    # Test webhook health endpoint
    if curl -f http://localhost:$WEBHOOK_PORT/health &>/dev/null; then
        echo -e "${GREEN}✅ Webhook health endpoint responding${NC}"
    else
        echo -e "${YELLOW}⚠️ Webhook health endpoint not responding (may still be starting)${NC}"
    fi
    
    # Test main app (if running on port 8080)
    if curl -f http://localhost:8080/health &>/dev/null 2>&1 || curl -f http://localhost:8080/ &>/dev/null 2>&1; then
        echo -e "${GREEN}✅ Main application responding${NC}"
    else
        echo -e "${YELLOW}⚠️ Main application not responding (may not be started yet)${NC}"
    fi
}

# Function to configure firewall
configure_firewall() {
    echo -e "${YELLOW}🔥 Configuring firewall...${NC}"
    
    if command -v ufw &> /dev/null; then
        ufw allow $WEBHOOK_PORT/tcp comment "GitHub Webhook Listener"
        echo -e "${GREEN}✅ UFW rule added for port $WEBHOOK_PORT${NC}"
    elif command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-port=$WEBHOOK_PORT/tcp
        firewall-cmd --reload
        echo -e "${GREEN}✅ Firewalld rule added for port $WEBHOOK_PORT${NC}"
    else
        echo -e "${YELLOW}⚠️ No firewall detected. Please manually open port $WEBHOOK_PORT${NC}"
    fi
}

# Function to start PM2 services
start_pm2_services() {
    echo -e "${YELLOW}🚀 Starting PM2 services...${NC}"
    
    # Stop any existing PM2 processes
    pm2 stop ecosystem.config.js 2>/dev/null || true
    
    # Start all services from ecosystem config
    cd $WEBHOOK_DIR
    pm2 start ecosystem.config.js --env production
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup script
    pm2 startup
    
    echo -e "${GREEN}✅ PM2 services started${NC}"
}

# Main installation process
main() {
    echo -e "${BLUE}🔍 Starting installation process...${NC}"
    
    check_root
    install_dependencies
    create_webhook_user
    setup_pm2_config
    configure_firewall
    start_pm2_services
    test_pm2_services
    
    echo ""
    echo -e "${GREEN}🎉 Installation completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 Next Steps:${NC}"
    echo "1. Update the GitHub webhook secret in ecosystem.config.js"
    echo "2. Configure GitHub webhook (see WEBHOOK_GITHUB_SETUP.md)"
    echo "3. Test deployment with a push to the live branch"
    echo ""
    echo -e "${BLUE}📊 PM2 Management:${NC}"
    echo "  Status: pm2 status"
    echo "  Logs:   pm2 logs live-error-display-webhook"
    echo "  Stop:   pm2 stop live-error-display-webhook"
    echo "  Start:  pm2 start live-error-display-webhook"
    echo "  Reload: pm2 reload ecosystem.config.js --env production"
    echo ""
    echo -e "${BLUE}🌐 Webhook URL:${NC}"
    echo "  http://YOUR_SERVER_IP:$WEBHOOK_PORT/webhook"
}

# Run main function
main "$@"
