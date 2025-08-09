#!/bin/bash

# Auto-deployment script for Live Error Display
# This script handles continuous deployment without webhooks

# Configuration
REPO_URL="https://github.com/ochtii/live-error-display.git"
APP_DIR="/var/www/live-error-display"
LOG_FILE="$APP_DIR/deploy/deploy.log"
BRANCH="main"
CHECK_INTERVAL=60  # seconds between checks

# Create log directory if it doesn't exist
mkdir -p "$APP_DIR/deploy"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check for updates
check_for_updates() {
    log "Checking for updates..."
    
    # Fetch the latest changes
    git fetch origin $BRANCH
    
    # Get the hash of the current commit
    LOCAL_HASH=$(git rev-parse HEAD)
    
    # Get the hash of the latest commit on the remote branch
    REMOTE_HASH=$(git rev-parse origin/$BRANCH)
    
    # If they're different, we have updates
    if [ "$LOCAL_HASH" != "$REMOTE_HASH" ]; then
        log "Updates found! Local: $LOCAL_HASH, Remote: $REMOTE_HASH"
        return 0  # Updates available
    else
        log "No updates available."
        return 1  # No updates
    fi
}

# Function to deploy updates
deploy_updates() {
    log "Deploying updates..."
    
    # Pull the latest changes
    git pull origin $BRANCH
    
    # Install dependencies
    log "Installing dependencies..."
    npm install
    
    # Restart the service
    log "Restarting the service..."
    if [ -f "/etc/systemd/system/errordisplay.service" ]; then
        sudo systemctl restart errordisplay
    else
        # If no service is set up, kill any running node process and start a new one
        pkill -f "node server.js" || true
        nohup node server.js > "$APP_DIR/app.log" 2>&1 &
    fi
    
    log "Deployment completed successfully!"
}

# Main loop
main() {
    log "Starting auto-deployment service for Live Error Display"
    
    # Initial deployment
    if [ ! -d "$APP_DIR/.git" ]; then
        log "Initial setup - cloning repository..."
        git clone "$REPO_URL" "$APP_DIR"
        cd "$APP_DIR"
        npm install
    else
        cd "$APP_DIR"
    fi
    
    # Continuous deployment loop
    while true; do
        if check_for_updates; then
            deploy_updates
        fi
        
        log "Waiting $CHECK_INTERVAL seconds before next check..."
        sleep $CHECK_INTERVAL
    done
}

# Run the main function
main
