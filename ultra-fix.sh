#!/bin/bash

# Ultra Simple Fix - Run as Ubuntu user instead of www-data

echo "🔧 Ultra Simple Demo Mode Fix - Ubuntu User"

# Kill any existing PM2 processes
pm2 kill 2>/dev/null || true

# Go to directory
cd /home/ubuntu/live-error-display

# Start with NODE_ENV=production as ubuntu user
NODE_ENV=production PORT=8080 pm2 start server.js --name live-error-display

# Save config
pm2 save

echo "✅ Done! App should be running without demo mode"
echo ""
echo "Status:"
pm2 status

echo ""
echo "Last few log lines:"
pm2 logs live-error-display --lines 5

echo ""
echo "🌐 Access: http://$(curl -s ifconfig.me):8080"
