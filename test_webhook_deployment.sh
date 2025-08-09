#!/bin/bash

# Webhook Deployment Test Script
# =============================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing Webhook Deployment System${NC}"
echo "====================================="

# Configuration
WEBHOOK_URL="http://localhost:9090"
APP_URL="http://localhost:8080"
PM2_APP_NAME="live-error-display"

# Function to check if service is running
check_service() {
    local service_name=$1
    local url=$2
    
    echo -e "${YELLOW}Checking $service_name...${NC}"
    
    if curl -f -s "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ $service_name is responding${NC}"
        return 0
    else
        echo -e "${RED}❌ $service_name is not responding${NC}"
        return 1
    fi
}

# Function to check PM2 status
check_pm2_status() {
    echo -e "${YELLOW}📊 PM2 Status:${NC}"
    
    if command -v pm2 &> /dev/null; then
        pm2 status
        echo ""
        echo -e "${CYAN}Webhook Listener Status:${NC}"
        pm2 show live-error-display-webhook 2>/dev/null || echo "Webhook listener not found in PM2"
        echo ""
        echo -e "${CYAN}Main App Status:${NC}"
        pm2 show live-error-display 2>/dev/null || echo "Main app not found in PM2"
    else
        echo "PM2 not installed or not in PATH"
    fi
}

# Function to test webhook endpoint
test_webhook_endpoint() {
    echo -e "${YELLOW}🔗 Testing webhook endpoints...${NC}"
    
    # Test health endpoint
    if check_service "Webhook Health" "$WEBHOOK_URL/health"; then
        response=$(curl -s "$WEBHOOK_URL/health")
        echo -e "${CYAN}Health Response: $response${NC}"
    fi
    
    # Test status endpoint
    if check_service "Webhook Status" "$WEBHOOK_URL/status"; then
        response=$(curl -s "$WEBHOOK_URL/status")
        echo -e "${CYAN}Status Response: $response${NC}"
    fi
}

# Function to test application
test_application() {
    echo -e "${YELLOW}🖥️ Testing main application...${NC}"
    
    if check_service "Main Application" "$APP_URL"; then
        echo -e "${GREEN}✅ Main application is running${NC}"
    fi
    
    # Test health endpoints if they exist
    if check_service "API Health" "$APP_URL/api/health"; then
        echo -e "${GREEN}✅ API health check passed${NC}"
    fi
    
    if check_service "DB Health" "$APP_URL/api/db/health"; then
        echo -e "${GREEN}✅ Database health check passed${NC}"
    fi
}

# Function to simulate webhook payload
simulate_webhook() {
    echo -e "${YELLOW}🎯 Simulating GitHub webhook payload...${NC}"
    
    # Create test payload
    payload=$(cat << 'EOF'
{
  "ref": "refs/heads/live",
  "commits": [
    {
      "id": "abc123def456",
      "message": "Test deployment commit",
      "author": {
        "name": "Test User"
      },
      "added": ["test_file.txt"],
      "modified": ["README.md"],
      "removed": []
    }
  ]
}
EOF
)
    
    # Note: This is just for testing the endpoint structure
    # Real webhooks require proper signature verification
    echo -e "${CYAN}Test payload prepared (signature verification required for real deployment)${NC}"
}

# Function to check logs
check_logs() {
    echo -e "${YELLOW}📋 Recent logs:${NC}"
    
    # Check PM2 logs
    if command -v pm2 &> /dev/null; then
        echo -e "${CYAN}Webhook listener logs (last 10 lines):${NC}"
        pm2 logs live-error-display-webhook --lines 10 --nostream 2>/dev/null || echo "No webhook listener logs available"
        
        echo ""
        echo -e "${CYAN}Main app logs (last 10 lines):${NC}"
        pm2 logs live-error-display --lines 10 --nostream 2>/dev/null || echo "No main app logs available"
    else
        echo "PM2 not available"
    fi
    
    # Check file logs
    if [ -f "./logs/live-error-display-webhook-combined.log" ]; then
        echo -e "${CYAN}Webhook file logs (last 5 lines):${NC}"
        tail -n 5 ./logs/live-error-display-webhook-combined.log
    fi
}

# Function to check Git status
check_git_status() {
    echo -e "${YELLOW}📂 Git repository status:${NC}"
    
    if [ -d "/opt/live-error-display/.git" ]; then
        cd /opt/live-error-display
        echo -e "${CYAN}Current branch: $(git rev-parse --abbrev-ref HEAD)${NC}"
        echo -e "${CYAN}Latest commit: $(git rev-parse --short HEAD)${NC}"
        echo -e "${CYAN}Remote status:${NC}"
        git status --porcelain || echo "Clean working directory"
    else
        echo -e "${RED}❌ Git repository not found in /opt/live-error-display${NC}"
    fi
}

# Function to show network status
check_network() {
    echo -e "${YELLOW}🌐 Network status:${NC}"
    
    # Check if ports are listening
    if netstat -tlnp 2>/dev/null | grep -q ":9090"; then
        echo -e "${GREEN}✅ Port 9090 (webhook) is listening${NC}"
    else
        echo -e "${RED}❌ Port 9090 (webhook) is not listening${NC}"
    fi
    
    if netstat -tlnp 2>/dev/null | grep -q ":8080"; then
        echo -e "${GREEN}✅ Port 8080 (application) is listening${NC}"
    else
        echo -e "${RED}❌ Port 8080 (application) is not listening${NC}"
    fi
}

# Function to run comprehensive test
run_comprehensive_test() {
    echo -e "${BLUE}🚀 Running comprehensive deployment test...${NC}"
    echo ""
    
    check_git_status
    echo ""
    
    check_network
    echo ""
    
    check_pm2_status
    echo ""
    
    test_webhook_endpoint
    echo ""
    
    test_application
    echo ""
    
    simulate_webhook
    echo ""
    
    check_logs
    echo ""
    
    echo -e "${BLUE}📊 Test Summary${NC}"
    echo "==============="
    echo -e "${GREEN}✅ Tests completed${NC}"
    echo ""
    echo -e "${BLUE}💡 Next Steps:${NC}"
    echo "1. If webhook listener is not running, start it:"
    echo "   pm2 start ecosystem.config.js --env production"
    echo "   OR"
    echo "   pm2 start live-error-display-webhook"
    echo ""
    echo "2. Test real deployment by pushing to 'live' branch:"
    echo "   git checkout live"
    echo "   git commit --allow-empty -m 'Test deployment'"
    echo "   git push origin live"
    echo ""
    echo "3. Monitor logs during deployment:"
    echo "   pm2 logs live-error-display-webhook"
    echo "   pm2 logs live-error-display"
}

# Main execution
case "${1:-test}" in
    "test"|"")
        run_comprehensive_test
        ;;
    "webhook")
        test_webhook_endpoint
        ;;
    "app")
        test_application
        ;;
    "logs")
        check_logs
        ;;
    "status")
        check_pm2_status
        check_network
        ;;
    "git")
        check_git_status
        ;;
    *)
        echo "Usage: $0 [test|webhook|app|logs|status|git]"
        echo ""
        echo "Commands:"
        echo "  test     - Run comprehensive test (default)"
        echo "  webhook  - Test webhook endpoints only"
        echo "  app      - Test main application only"
        echo "  logs     - Show recent logs"
        echo "  status   - Show PM2 and network status"
        echo "  git      - Show Git repository status"
        ;;
esac
