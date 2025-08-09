#!/bin/bash

# Quick Python Dependencies Installation
# =====================================

echo "🐍 Installing Python dependencies for webhook listener..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Installing..."
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip
fi

# Install dependencies
echo "📦 Installing Python packages..."
pip3 install -r webhook_requirements.txt

echo "✅ Python dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Configure GitHub webhook secret in ecosystem.config.js"
echo "2. Start webhook listener: pm2 start ecosystem.config.js"
echo "3. Test deployment: ./test_webhook_deployment.sh"
