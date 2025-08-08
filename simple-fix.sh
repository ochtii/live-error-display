#!/bin/bash

# Super Simple Fix - Just restart with NODE_ENV=production

echo "🔧 Simple Demo Mode Fix"

# Kill all PM2 processes for www-data
sudo -u www-data pm2 kill

# Set ownership
sudo chown -R www-data:www-data /home/ubuntu/live-error-display

# Start with full path and NODE_ENV
cd /home/ubuntu/live-error-display
sudo -u www-data NODE_ENV=production PORT=8080 pm2 start /home/ubuntu/live-error-display/server.js --name live-error-display

# Save config
sudo -u www-data pm2 save

echo "✅ Done! Check status:"
sudo -u www-data pm2 status
sudo -u www-data pm2 logs live-error-display --lines 5
