#!/usr/bin/env python3
"""
GitHub Webhook Listener for Live Error Display Auto-Deployment
=============================================================

This service listens for GitHub webhooks and automatically deploys
the latest version from the live branch to the production server.

Features:
- Secure webhook validation using GitHub secret
- Detailed colored logging with file change tracking
- PM2 process management integration
- Health checks (API and database)
- Environment variable configuration
- Error handling and recovery

Author: GitHub Copilot
Date: August 2025
"""

import os
import sys
import json
import hmac
import hashlib
import subprocess
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import signal
import time

# Third-party imports
try:
    from flask import Flask, request, jsonify
    from colorama import Fore, Back, Style, init
    import requests
except ImportError as e:
    print(f"Missing required packages. Install with: pip install flask colorama requests")
    sys.exit(1)

# Initialize colorama for Windows compatibility
init(autoreset=True)

class ColoredFormatter(logging.Formatter):
    """Custom formatter with colored output"""
    
    COLORS = {
        'DEBUG': Fore.CYAN,
        'INFO': Fore.GREEN,
        'WARNING': Fore.YELLOW,
        'ERROR': Fore.RED,
        'CRITICAL': Fore.RED + Back.WHITE + Style.BRIGHT
    }
    
    def format(self, record):
        color = self.COLORS.get(record.levelname, '')
        record.levelname = f"{color}{record.levelname}{Style.RESET_ALL}"
        return super().format(record)

class WebhookListener:
    """GitHub Webhook Listener for Auto-Deployment"""
    
    def __init__(self):
        self.app = Flask(__name__)
        self.setup_logging()
        self.load_config()
        self.setup_routes()
        
        # PM2 configuration
        self.pm2_app_name = "live-error-display"
        self.server_path = "/opt/live-error-display/server.js"
        self.repo_path = "/opt/live-error-display"
        
        # Health check URLs
        self.health_check_url = "http://localhost:8080/api/health"
        self.db_health_url = "http://localhost:8080/api/db/health"
        
    def setup_logging(self):
        """Configure detailed logging with colors"""
        self.logger = logging.getLogger('webhook_listener')
        self.logger.setLevel(logging.DEBUG)
        
        # Console handler with colors
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_formatter = ColoredFormatter(
            f'{Fore.BLUE}%(asctime)s{Style.RESET_ALL} - '
            f'{Fore.MAGENTA}%(name)s{Style.RESET_ALL} - '
            f'%(levelname)s - %(message)s'
        )
        console_handler.setFormatter(console_formatter)
        
        # File handler for persistent logging
        log_file = "/var/log/webhook-listener.log"
        file_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        try:
            file_handler = logging.FileHandler(log_file)
            file_handler.setLevel(logging.DEBUG)
            file_handler.setFormatter(file_formatter)
            self.logger.addHandler(file_handler)
        except PermissionError:
            self.logger.warning(f"Cannot write to {log_file}, using local file")
            # Use local logs directory instead
            local_log_dir = "./logs"
            os.makedirs(local_log_dir, exist_ok=True)
            local_log_file = os.path.join(local_log_dir, "webhook-listener.log")
            file_handler = logging.FileHandler(local_log_file)
            file_handler.setLevel(logging.DEBUG)
            file_handler.setFormatter(file_formatter)
            self.logger.addHandler(file_handler)
        
        self.logger.addHandler(console_handler)
        
    def load_config(self):
        """Load configuration from environment variables"""
        self.github_secret = os.getenv('GITHUB_WEBHOOK_SECRET')
        if not self.github_secret:
            self.logger.error(f"{Fore.RED}GITHUB_WEBHOOK_SECRET environment variable not set!{Style.RESET_ALL}")
            sys.exit(1)
            
        self.port = int(os.getenv('WEBHOOK_PORT', 8088))
        self.host = os.getenv('WEBHOOK_HOST', '0.0.0.0')
        self.target_branch = os.getenv('TARGET_BRANCH', 'live')
        
        self.logger.info(f"{Fore.GREEN}Configuration loaded:{Style.RESET_ALL}")
        self.logger.info(f"  Port: {self.port}")
        self.logger.info(f"  Host: {self.host}")
        self.logger.info(f"  Target Branch: {self.target_branch}")
        
    def setup_routes(self):
        """Setup Flask routes"""
        
        @self.app.route('/webhook', methods=['POST'])
        def github_webhook():
            return self.handle_webhook()
            
        @self.app.route('/health', methods=['GET'])
        def health_check():
            return jsonify({
                'status': 'healthy',
                'timestamp': datetime.now().isoformat(),
                'service': 'webhook-listener'
            })
            
        @self.app.route('/status', methods=['GET'])
        def status():
            return jsonify({
                'pm2_status': self.get_pm2_status(),
                'last_deployment': getattr(self, 'last_deployment', None),
                'uptime': time.time() - getattr(self, 'start_time', time.time())
            })
    
    def verify_signature(self, payload_body: bytes, signature_header: str) -> bool:
        """Verify GitHub webhook signature"""
        if not signature_header:
            return False
            
        try:
            sha_name, signature = signature_header.split('=')
            if sha_name != 'sha256':
                return False
                
            mac = hmac.new(
                self.github_secret.encode('utf-8'),
                msg=payload_body,
                digestmod=hashlib.sha256
            )
            
            return hmac.compare_digest(mac.hexdigest(), signature)
        except Exception as e:
            self.logger.error(f"Signature verification error: {e}")
            return False
    
    def handle_webhook(self) -> Tuple[Dict, int]:
        """Handle incoming GitHub webhook"""
        try:
            # Get raw payload
            payload_body = request.get_data()
            signature_header = request.headers.get('X-Hub-Signature-256')
            
            # Verify signature
            if not self.verify_signature(payload_body, signature_header):
                self.logger.warning(f"{Fore.YELLOW}Invalid webhook signature{Style.RESET_ALL}")
                return {'error': 'Invalid signature'}, 401
            
            # Parse JSON payload
            payload = request.get_json()
            
            # Check if it's a push event to target branch
            if payload.get('ref') != f'refs/heads/{self.target_branch}':
                self.logger.info(f"Ignoring push to {payload.get('ref', 'unknown')} branch")
                return {'message': 'Branch ignored'}, 200
            
            self.logger.info(f"{Fore.GREEN}🚀 Webhook received for {self.target_branch} branch{Style.RESET_ALL}")
            
            # Log commit information
            commits = payload.get('commits', [])
            self.log_commits(commits)
            
            # Start deployment process
            success = self.deploy()
            
            if success:
                self.last_deployment = datetime.now().isoformat()
                return {'message': 'Deployment successful'}, 200
            else:
                return {'error': 'Deployment failed'}, 500
                
        except Exception as e:
            self.logger.error(f"{Fore.RED}Webhook handling error: {e}{Style.RESET_ALL}")
            return {'error': str(e)}, 500
    
    def log_commits(self, commits: List[Dict]):
        """Log detailed commit information"""
        self.logger.info(f"{Fore.CYAN}📝 Commits received: {len(commits)}{Style.RESET_ALL}")
        
        for commit in commits:
            author = commit.get('author', {}).get('name', 'Unknown')
            message = commit.get('message', 'No message')
            commit_id = commit.get('id', '')[:8]
            
            self.logger.info(f"  {Fore.YELLOW}[{commit_id}]{Style.RESET_ALL} {message} by {author}")
            
            # Log file changes
            added = commit.get('added', [])
            modified = commit.get('modified', [])
            removed = commit.get('removed', [])
            
            for file in added:
                self.logger.info(f"    {Fore.GREEN}++++ {file}{Style.RESET_ALL}")
            for file in modified:
                self.logger.info(f"    {Fore.YELLOW}~~~~ {file}{Style.RESET_ALL}")
            for file in removed:
                self.logger.info(f"    {Fore.RED}---- {file}{Style.RESET_ALL}")
    
    def deploy(self) -> bool:
        """Execute deployment process"""
        self.logger.info(f"{Fore.BLUE}🔄 Starting deployment process...{Style.RESET_ALL}")
        
        try:
            # Step 1: Stop PM2 process
            self.logger.info(f"{Fore.YELLOW}1. Stopping PM2 process: {self.pm2_app_name}{Style.RESET_ALL}")
            if not self.stop_pm2_process():
                return False
            
            # Step 2: Pull latest changes
            self.logger.info(f"{Fore.YELLOW}2. Pulling latest changes from {self.target_branch}{Style.RESET_ALL}")
            if not self.git_pull():
                return False
            
            # Step 3: Install dependencies
            self.logger.info(f"{Fore.YELLOW}3. Installing dependencies{Style.RESET_ALL}")
            if not self.install_dependencies():
                return False
            
            # Step 4: Flush PM2 logs
            self.logger.info(f"{Fore.YELLOW}4. Flushing PM2 logs{Style.RESET_ALL}")
            self.flush_pm2_logs()
            
            # Step 5: Start PM2 process
            self.logger.info(f"{Fore.YELLOW}5. Starting PM2 process{Style.RESET_ALL}")
            if not self.start_pm2_process():
                return False
            
            # Step 6: Health checks
            self.logger.info(f"{Fore.YELLOW}6. Performing health checks{Style.RESET_ALL}")
            if not self.perform_health_checks():
                self.logger.warning(f"{Fore.YELLOW}Health checks failed, but deployment continued{Style.RESET_ALL}")
            
            self.logger.info(f"{Fore.GREEN}✅ Deployment completed successfully!{Style.RESET_ALL}")
            self.print_deployment_summary()
            return True
            
        except Exception as e:
            self.logger.error(f"{Fore.RED}❌ Deployment failed: {e}{Style.RESET_ALL}")
            return False
    
    def run_command(self, command: str, cwd: str = None) -> Tuple[bool, str]:
        """Run shell command and return success status and output"""
        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=cwd or self.repo_path,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            if result.returncode == 0:
                self.logger.debug(f"Command succeeded: {command}")
                return True, result.stdout
            else:
                self.logger.error(f"Command failed: {command}")
                self.logger.error(f"Error output: {result.stderr}")
                return False, result.stderr
                
        except subprocess.TimeoutExpired:
            self.logger.error(f"Command timed out: {command}")
            return False, "Command timed out"
        except Exception as e:
            self.logger.error(f"Command execution error: {e}")
            return False, str(e)
    
    def stop_pm2_process(self) -> bool:
        """Stop PM2 process"""
        success, output = self.run_command(f"pm2 stop {self.pm2_app_name}")
        if success:
            self.logger.info(f"  {Fore.GREEN}✓ PM2 process stopped{Style.RESET_ALL}")
        else:
            self.logger.warning(f"  {Fore.YELLOW}PM2 stop failed (process might not be running){Style.RESET_ALL}")
        return True  # Continue even if stop fails
    
    def git_pull(self) -> bool:
        """Pull latest changes from git"""
        # Ensure we're on the correct branch
        success, _ = self.run_command(f"git checkout {self.target_branch}")
        if not success:
            self.logger.error(f"  {Fore.RED}✗ Failed to checkout {self.target_branch}{Style.RESET_ALL}")
            return False
        
        # Reset any local changes (force overwrite)
        success, _ = self.run_command("git reset --hard HEAD")
        if not success:
            self.logger.error(f"  {Fore.RED}✗ Failed to reset local changes{Style.RESET_ALL}")
            return False
        
        # Pull latest changes
        success, output = self.run_command(f"git pull origin {self.target_branch}")
        if success:
            self.logger.info(f"  {Fore.GREEN}✓ Git pull successful{Style.RESET_ALL}")
            # Log git changes
            lines = output.split('\n')
            for line in lines:
                if line.strip():
                    if 'file changed' in line or 'files changed' in line:
                        self.logger.info(f"    {Fore.CYAN}{line.strip()}{Style.RESET_ALL}")
            return True
        else:
            self.logger.error(f"  {Fore.RED}✗ Git pull failed{Style.RESET_ALL}")
            return False
    
    def install_dependencies(self) -> bool:
        """Install npm dependencies"""
        success, output = self.run_command("npm install --production")
        if success:
            self.logger.info(f"  {Fore.GREEN}✓ Dependencies installed{Style.RESET_ALL}")
            return True
        else:
            self.logger.error(f"  {Fore.RED}✗ Dependency installation failed{Style.RESET_ALL}")
            return False
    
    def flush_pm2_logs(self):
        """Flush PM2 logs"""
        success, _ = self.run_command(f"pm2 flush {self.pm2_app_name}")
        if success:
            self.logger.info(f"  {Fore.GREEN}✓ PM2 logs flushed{Style.RESET_ALL}")
        else:
            self.logger.warning(f"  {Fore.YELLOW}PM2 log flush failed{Style.RESET_ALL}")
    
    def start_pm2_process(self) -> bool:
        """Start PM2 process"""
        success, output = self.run_command(f"pm2 start {self.pm2_app_name}")
        if success:
            self.logger.info(f"  {Fore.GREEN}✓ PM2 process started{Style.RESET_ALL}")
            return True
        else:
            # Try starting with ecosystem file
            success, output = self.run_command("pm2 start ecosystem.config.js --env production")
            if success:
                self.logger.info(f"  {Fore.GREEN}✓ PM2 process started with ecosystem config{Style.RESET_ALL}")
                return True
            else:
                self.logger.error(f"  {Fore.RED}✗ PM2 start failed{Style.RESET_ALL}")
                return False
    
    def perform_health_checks(self) -> bool:
        """Perform API and database health checks"""
        # Wait for service to start
        self.logger.info(f"  Waiting for service to start...")
        time.sleep(10)
        
        # API Health Check
        try:
            response = requests.get(self.health_check_url, timeout=10)
            if response.status_code == 200:
                self.logger.info(f"  {Fore.GREEN}✓ API health check passed{Style.RESET_ALL}")
                api_healthy = True
            else:
                self.logger.warning(f"  {Fore.YELLOW}⚠ API health check failed: {response.status_code}{Style.RESET_ALL}")
                api_healthy = False
        except Exception as e:
            self.logger.warning(f"  {Fore.YELLOW}⚠ API health check error: {e}{Style.RESET_ALL}")
            api_healthy = False
        
        # Database Health Check
        try:
            response = requests.get(self.db_health_url, timeout=10)
            if response.status_code == 200:
                self.logger.info(f"  {Fore.GREEN}✓ Database health check passed{Style.RESET_ALL}")
                db_healthy = True
            else:
                self.logger.warning(f"  {Fore.YELLOW}⚠ Database health check failed: {response.status_code}{Style.RESET_ALL}")
                db_healthy = False
        except Exception as e:
            self.logger.warning(f"  {Fore.YELLOW}⚠ Database health check error: {e}{Style.RESET_ALL}")
            db_healthy = False
        
        return api_healthy and db_healthy
    
    def get_pm2_status(self) -> Dict:
        """Get PM2 process status"""
        success, output = self.run_command(f"pm2 jlist")
        if success:
            try:
                processes = json.loads(output)
                for proc in processes:
                    if proc.get('name') == self.pm2_app_name:
                        return {
                            'status': proc.get('pm2_env', {}).get('status'),
                            'pid': proc.get('pid'),
                            'uptime': proc.get('pm2_env', {}).get('pm_uptime'),
                            'restarts': proc.get('pm2_env', {}).get('restart_time')
                        }
            except:
                pass
        return {'status': 'unknown'}
    
    def print_deployment_summary(self):
        """Print detailed deployment summary"""
        self.logger.info(f"\n{Fore.CYAN}{'='*60}{Style.RESET_ALL}")
        self.logger.info(f"{Fore.CYAN}🎉 DEPLOYMENT SUMMARY{Style.RESET_ALL}")
        self.logger.info(f"{Fore.CYAN}{'='*60}{Style.RESET_ALL}")
        
        # Git information
        success, branch_output = self.run_command("git rev-parse --abbrev-ref HEAD")
        success, commit_output = self.run_command("git rev-parse --short HEAD")
        
        if success:
            self.logger.info(f"📍 Current Branch: {Fore.GREEN}{branch_output.strip()}{Style.RESET_ALL}")
            self.logger.info(f"📍 Current Commit: {Fore.GREEN}{commit_output.strip()}{Style.RESET_ALL}")
        
        # PM2 Status
        pm2_status = self.get_pm2_status()
        status_color = Fore.GREEN if pm2_status.get('status') == 'online' else Fore.RED
        self.logger.info(f"🔧 PM2 Status: {status_color}{pm2_status.get('status', 'unknown')}{Style.RESET_ALL}")
        
        if pm2_status.get('pid'):
            self.logger.info(f"🔧 Process ID: {pm2_status['pid']}")
        
        # Environment Information
        self.logger.info(f"🌍 Environment: {Fore.YELLOW}production{Style.RESET_ALL}")
        self.logger.info(f"🚪 Port: {Fore.YELLOW}8088{Style.RESET_ALL}")
        self.logger.info(f"📁 Path: {Fore.YELLOW}{self.repo_path}{Style.RESET_ALL}")
        
        # Deployment time
        self.logger.info(f"⏰ Deployed: {Fore.GREEN}{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{Style.RESET_ALL}")
        
        self.logger.info(f"{Fore.CYAN}{'='*60}{Style.RESET_ALL}\n")
    
    def run(self):
        """Start the webhook listener"""
        self.start_time = time.time()
        
        self.logger.info(f"{Fore.GREEN}🚀 Starting GitHub Webhook Listener{Style.RESET_ALL}")
        self.logger.info(f"📡 Listening on {self.host}:{self.port}")
        self.logger.info(f"🌿 Target branch: {self.target_branch}")
        self.logger.info(f"📦 PM2 app: {self.pm2_app_name}")
        
        try:
            self.app.run(
                host=self.host,
                port=self.port,
                debug=False,
                threaded=True
            )
        except KeyboardInterrupt:
            self.logger.info(f"\n{Fore.YELLOW}🛑 Webhook listener stopped{Style.RESET_ALL}")
        except Exception as e:
            self.logger.error(f"{Fore.RED}❌ Server error: {e}{Style.RESET_ALL}")

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    print(f"\n{Fore.YELLOW}🛑 Received shutdown signal{Style.RESET_ALL}")
    sys.exit(0)

if __name__ == '__main__':
    # Handle shutdown signals
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Start webhook listener
    listener = WebhookListener()
    listener.run()
