#!/bin/bash

# Fix www-data permissions for PM2 and Node.js

echo "🔧 Fixing www-data permissions..."

# Add www-data to ubuntu group
sudo usermod -a -G ubuntu www-data

# Set correct permissions for Node.js
sudo chmod +x /usr/bin/node
sudo chmod +x /usr/bin/npm

# Create PM2 home directory for www-data with correct permissions
sudo mkdir -p /home/www-data/.pm2
sudo chown -R www-data:www-data /home/www-data
sudo chmod -R 755 /home/www-data

# Alternative: Use ubuntu user's home for PM2
export PM2_HOME=/home/ubuntu/.pm2

echo "✅ Permissions fixed!"

# Now try to start with www-data again
cd /home/ubuntu/live-error-display

# Kill existing processes
sudo -u www-data PM2_HOME=/home/ubuntu/.pm2 pm2 kill 2>/dev/null || true

# Start with proper environment
sudo -u www-data PM2_HOME=/home/ubuntu/.pm2 NODE_ENV=production PORT=8080 pm2 start server.js --name live-error-display

# Save config
sudo -u www-data PM2_HOME=/home/ubuntu/.pm2 pm2 save

echo "🎉 App started with www-data user and correct permissions!"

# Show status
sudo -u www-data PM2_HOME=/home/ubuntu/.pm2 pm2 status
