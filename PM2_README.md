# PM2 Configuration Guide

## Overview
This project uses PM2 for process management in production. The configuration includes both the main application and the auto-deployment script.

## Files
- `ecosystem.config.js` - PM2 configuration for all processes
- `deploy-opt.sh` - Auto-deployment script with PM2 integration

## Applications Managed

### 1. Live Error Display App (`live-error-display`)
- **Script**: `server.js`
- **Port**: 8080
- **Environment**: Production
- **Features**:
  - Auto-restart on crashes
  - Memory limit: 500MB
  - Health monitoring via `/api/health`
  - Comprehensive logging
  - Source map support

### 2. Auto-Deploy Service (`live-error-display-deploy`)
- **Script**: `deploy-opt.sh`
- **Purpose**: Monitors git repository for changes
- **Features**:
  - Automatic deployment on git changes
  - Detailed logging of deployment process
  - PM2 process management
  - Health checks after deployment

## PM2 Commands

### Basic Operations
```bash
# Start all services
npm run pm2:start

# Stop all services
npm run pm2:stop

# Restart all services
npm run pm2:restart

# Reload services (zero-downtime)
npm run pm2:reload

# Delete all services
npm run pm2:delete
```

### Monitoring
```bash
# View process status
npm run pm2:status

# View logs
npm run pm2:logs

# Real-time monitoring
npm run pm2:monit

# View logs for specific app
pm2 logs live-error-display
pm2 logs live-error-display-deploy
```

### Advanced Operations
```bash
# Scale the main app to 2 instances
pm2 scale live-error-display 2

# Restart only the main app
pm2 restart live-error-display

# View detailed info
pm2 show live-error-display

# Flush logs
pm2 flush
```

## Deployment

### Production Setup
```bash
# Setup deployment keys
npm run deploy:setup

# Deploy to production
npm run deploy:prod
```

### Manual Deployment
```bash
# On the server
cd /opt/live-error-display
git pull origin main
npm install
pm2 reload ecosystem.config.js --env production
```

## Health Monitoring

The application provides comprehensive health endpoints:

### Health Check Endpoint
`GET /api/health`
```json
{
  "status": "ok",
  "timestamp": 1691234567890,
  "uptime": 3600.123,
  "memory": { ... },
  "version": "v18.17.0",
  "environment": "production",
  "port": 8080,
  "sessions": {
    "directory": "/opt/live-error-display/sessions",
    "count": 5
  }
}
```

### Status Endpoint
`GET /api/status`
- Detailed system information
- Memory usage
- CPU information
- Load averages
- Process information

## Log Files

All logs are stored in `/var/log/`:
- `live-error-display-error.log` - Application errors
- `live-error-display-out.log` - Application output
- `live-error-display-combined.log` - Combined logs
- `live-error-display-deploy-*.log` - Deployment logs

## Auto-Deployment

The deployment script (`deploy-opt.sh`) automatically:
1. Monitors git repository every second
2. Detects changes and pulls updates
3. Installs dependencies if needed
4. Performs health checks
5. Reloads PM2 processes with zero downtime
6. Provides detailed logging of all operations

## Troubleshooting

### Common Issues
```bash
# Check if PM2 is running
pm2 status

# Check application logs
pm2 logs live-error-display --lines 50

# Check deployment logs
pm2 logs live-error-display-deploy --lines 50

# Restart everything
pm2 restart all

# Kill and restart PM2 daemon
pm2 kill
pm2 resurrect
```

### Log Analysis
```bash
# Monitor real-time logs
pm2 logs --raw | grep ERROR

# Check memory usage
pm2 monit

# Export PM2 configuration
pm2 save

# Startup script (run once)
pm2 startup
pm2 save
```

## Configuration Customization

Edit `ecosystem.config.js` to customize:
- Instance count
- Memory limits
- Environment variables
- Log file locations
- Health check intervals
- Restart policies

After changes, reload the configuration:
```bash
pm2 reload ecosystem.config.js --env production
```
