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
WEBHOOK_SERVICE="webhook-listener"
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

# Function to create systemd service
create_systemd_service() {
    echo -e "${YELLOW}⚙️ Creating systemd service...${NC}"
    
    cat > /etc/systemd/system/$WEBHOOK_SERVICE.service << EOF
[Unit]
Description=GitHub Webhook Listener for Live Error Display
After=network.target
Wants=network.target

[Service]
Type=simple
User=$WEBHOOK_USER
Group=$WEBHOOK_USER
WorkingDirectory=$WEBHOOK_DIR
Environment=PYTHONPATH=$WEBHOOK_DIR
Environment=GITHUB_WEBHOOK_SECRET=your_github_secret_here
Environment=WEBHOOK_PORT=$WEBHOOK_PORT
Environment=WEBHOOK_HOST=0.0.0.0
Environment=TARGET_BRANCH=live
ExecStart=/usr/bin/python3 $WEBHOOK_DIR/webhook_listener.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$WEBHOOK_SERVICE

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=$WEBHOOK_DIR /var/log

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    echo -e "${GREEN}✅ Systemd service created${NC}"
}

# Function to setup log rotation
setup_log_rotation() {
    echo -e "${YELLOW}📋 Setting up log rotation...${NC}"
    
    cat > /etc/logrotate.d/$WEBHOOK_SERVICE << EOF
/var/log/webhook-listener.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $WEBHOOK_USER $WEBHOOK_USER
    postrotate
        systemctl reload $WEBHOOK_SERVICE
    endscript
}
EOF

    echo -e "${GREEN}✅ Log rotation configured${NC}"
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

# Function to test webhook listener
test_webhook() {
    echo -e "${YELLOW}🧪 Testing webhook listener...${NC}"
    
    # Start the service
    systemctl start $WEBHOOK_SERVICE
    sleep 3
    
    # Check if service is running
    if systemctl is-active --quiet $WEBHOOK_SERVICE; then
        echo -e "${GREEN}✅ Webhook service is running${NC}"
        
        # Test health endpoint
        if curl -f http://localhost:$WEBHOOK_PORT/health &>/dev/null; then
            echo -e "${GREEN}✅ Health endpoint responding${NC}"
        else
            echo -e "${YELLOW}⚠️ Health endpoint not responding (this is normal if the service just started)${NC}"
        fi
    else
        echo -e "${RED}❌ Webhook service failed to start${NC}"
        echo "Check logs with: journalctl -u $WEBHOOK_SERVICE -f"
    fi
}

# Main installation process
main() {
    echo -e "${BLUE}🔍 Starting installation process...${NC}"
    
    check_root
    install_dependencies
    create_webhook_user
    create_systemd_service
    setup_log_rotation
    configure_firewall
    test_webhook
    
    echo ""
    echo -e "${GREEN}🎉 Installation completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 Next Steps:${NC}"
    echo "1. Edit the GitHub webhook secret in /etc/systemd/system/$WEBHOOK_SERVICE.service"
    echo "2. Reload systemd: sudo systemctl daemon-reload"
    echo "3. Enable service: sudo systemctl enable $WEBHOOK_SERVICE"
    echo "4. Start service: sudo systemctl start $WEBHOOK_SERVICE"
    echo "5. Configure GitHub webhook (see WEBHOOK_GITHUB_SETUP.md)"
    echo ""
    echo -e "${BLUE}📊 Service Management:${NC}"
    echo "  Status: sudo systemctl status $WEBHOOK_SERVICE"
    echo "  Logs:   sudo journalctl -u $WEBHOOK_SERVICE -f"
    echo "  Stop:   sudo systemctl stop $WEBHOOK_SERVICE"
    echo "  Start:  sudo systemctl start $WEBHOOK_SERVICE"
    echo ""
    echo -e "${BLUE}🌐 Webhook URL:${NC}"
    echo "  http://YOUR_SERVER_IP:$WEBHOOK_PORT/webhook"
}

# Run main function
main "$@"
