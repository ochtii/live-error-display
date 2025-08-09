module.expor      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 8088
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8088
      }, apps: [
    {
      // Main Live Error Display Application
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
        PORT: 8088
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8088
      },
      
      // Logging configuration
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/live-error-display-error.log',
      out_file: './logs/live-error-display-out.log',
      log_file: './logs/live-error-display-combined.log',
      
      // Advanced PM2 features
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 1000,
      
      // Health monitoring
      health_check_url: 'http://localhost:8088/api/health',
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
      // GitHub Webhook Listener for Auto-Deployment
      name: 'live-error-display-webhook',
      script: '/opt/live-error-display/webhook_listener.py',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      
      // Environment for webhook listener
      env: {
        NODE_ENV: 'production',
        WEBHOOK_PORT: 9090,
        WEBHOOK_HOST: '0.0.0.0',
        TARGET_BRANCH: 'live',
        GITHUB_WEBHOOK_SECRET: 'FUT_ORSCH_BEIDL_TRINK_MA_NO_A_SEIDL'
      },
      
      // Logging for webhook listener
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/live-error-display-webhook-error.log',
      out_file: './logs/live-error-display-webhook-out.log',
      log_file: './logs/live-error-display-webhook-combined.log',
      
      // Restart configuration for webhook listener
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 3000,
      
      // Kill timeout for graceful shutdown
      kill_timeout: 8000,
      
      // Python interpreter
      interpreter: '/usr/bin/python3',
      interpreter_args: ''
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'ochtii',
      host: ['18.197.100.102'],
      ref: 'origin/live',
      repo: 'https://github.com/ochtii/live-error-display.git',
      path: '/opt/live-error-display',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'echo "Setting up production environment"',
      'post-setup': 'echo "Production environment setup complete"'
    }
  }
};
