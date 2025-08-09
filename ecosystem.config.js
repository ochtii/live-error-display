module.exports = {
  apps: [
    {
      // Main Live Error Display Application (Test Comment)
      name: 'live-error-display',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 8080
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8080
      },
      
      // Logging configuration
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/live-error-display-error.log',
      out_file: '/var/log/live-error-display-out.log',
      log_file: '/var/log/live-error-display-combined.log',
      
      // Advanced PM2 features
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 1000,
      
      // Health monitoring
      health_check_url: 'http://localhost:8080/api/health',
      health_check_grace_period: 3000,
      
      // Process management
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 3000,
      
      // Source map support for better error tracking
      source_map_support: true
      
      // Instance variables
    //   instance_var: 'INSTANCE_ID'
    },
    
    {
      // Auto-Deploy Service
      name: 'live-error-display-deploy',
      script: '/opt/live-error-display/deploy-opt.sh',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '100M',
      
      // Environment for deploy script
      env: {
        NODE_ENV: 'production',
        DEPLOY_ENV: 'production'
      },
      
      // Logging for deploy script
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/live-error-display-deploy-error.log',
      out_file: '/var/log/live-error-display-deploy-out.log',
      log_file: '/var/log/live-error-display-deploy-combined.log',
      
      // Restart configuration for deploy script
      min_uptime: '30s',
      max_restarts: 5,
      restart_delay: 5000,
      
      // Deploy script should restart less frequently
      kill_timeout: 10000,
      
      // Interpreter for shell script
      interpreter: '/bin/bash',
      interpreter_args: ''
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'ubuntu',
      host: ['18.197.100.102'],
      ref: 'origin/main',
      repo: 'https://github.com/ochtii/live-error-display.git',
      path: '/opt/live-error-display',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'echo "Setting up production environment"',
      'post-setup': 'echo "Production environment setup complete"'
    }
  }
};
