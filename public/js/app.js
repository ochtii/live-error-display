// Live Error Display - Main JavaScript

class ErrorDisplay {
    constructor() {
        // Server läuft auf demselben Host und Port wie das Frontend
        this.serverUrl = `${window.location.protocol}//${window.location.host}`;
        
        console.log(`🔗 Server URL: ${this.serverUrl}`);
        
        this.errors = [];
        this.bufferedErrors = []; // Errors received while not in live mode
        this.clients = 0;
        this.currentMode = 'live';
        this.eventSource = null;
        this.settings = this.loadSettings();
        this.archiveData = this.loadArchive();
        this.autoSaveEnabled = false; // Auto-save is disabled by default
        this.hasUnsavedChanges = false; // Track unsaved changes
        
        // Session Management - delegiert an SessionManager
        this.sessionManager = new SessionManager(this);
        
        // Delegate session access to session manager
        Object.defineProperty(this, 'currentSession', {
            get: function() { return this.sessionManager.currentSession; },
            set: function(value) { this.sessionManager.currentSession = value; }
        });
        
        this.init();
    }

    // === INITIALIZATION === 
    async init() {
        // Session Manager initialisieren
        this.sessionManager.loadCurrentSession();
        
        // Always start with clean UI state
        this.forceCleanUIState();
        
        // Check for server restart and clear old data if needed
        await this.checkServerRestartAndClearData();
        
        this.setupEventListeners();
        this.updateStats();
        this.setupModal();
        this.loadAndApplySettings();
        this.initPushNotifications();
        this.updateSessionDisplay();
        
        // Always show start page first
        this.enforceStartPageState();
        
        // Validate session state after UI is clean
        await this.validateAndUpdateUIState();
        
        // Start auto-cleanup timer for deleted sessions
        this.startAutoCleanupTimer();
    }

    // === SESSION DELEGATION ===
    updateSessionDisplay() { this.sessionManager.updateSessionDisplay(); }
    copySessionToken() { this.sessionManager.copySessionToken(); }
    clearSession() { this.sessionManager.clearSession(); }
    createNewSessionInline() { this.sessionManager.createNewSession(); }
    openSessionManager() { this.sessionManager.showSessionManager(); }
    saveCurrentSession() { this.sessionManager.saveCurrentSession(); }
    endCurrentSession() { this.sessionManager.endCurrentSession(); }
    toggleAutoSave(enabled) { this.sessionManager.toggleAutoSave(enabled); }
    restoreSessionFromToken() { this.sessionManager.restoreSessionFromToken(); }
    loadLastSessionsInline() { this.sessionManager.loadLastSessionsInline(); }
    updateCurrentSessionCard() { this.sessionManager.updateCurrentSessionCard(); }
    updateSessionManagerState() { this.sessionManager.updateSessionManagerState(); }
    setRandomPlaceholder() { this.sessionManager.setRandomPlaceholder(); }
    isSessionSaved() { return this.sessionManager.isSessionSaved(); }
    updateSessionActivity() { this.sessionManager.updateSessionActivity(); }
    markAsUnsaved() { this.sessionManager.markAsUnsaved(); }
    markAsSaved() { this.sessionManager.markAsSaved(); }
    updateUnsavedChangesIndicator() { this.sessionManager.updateUnsavedChangesIndicator(); }
    saveCurrentSessionDirect() { this.sessionManager.saveCurrentSessionDirect(); }
    
    // === UI STATE MANAGEMENT ===
    forceCleanUIState() {
        console.log('🧹 Forcing clean UI state');
        
        // Hide session bar
        const sessionBar = document.getElementById('sessionBar');
        if (sessionBar) sessionBar.style.display = 'none';
        
        // Show start page
        this.showStartPage();
        
        // Reset navigation buttons
        this.updateNavigationState(false);
    }

    enforceStartPageState() {
        console.log('🔒 Enforcing start page state');
        
        // Force start page display
        this.showStartPage();
        this.updateNavigationState(false);
        
        // Clear any active error displays
        const errorsContainer = document.getElementById('errorsContainer');
        if (errorsContainer) errorsContainer.innerHTML = '';
    }

    showStartPage() {
        console.log('📋 Showing start page (session manager)');
        
        // Set current mode to start
        this.currentMode = 'start';
        
        // Hide all containers
        document.getElementById('errorsContainer').style.display = 'none';
        document.getElementById('settingsContainer').style.display = 'none';
        document.getElementById('apiPanel').style.display = 'none';
        
        // Show session manager container as start page
        const sessionManagerContainer = document.getElementById('sessionManagerContainer');
        if (sessionManagerContainer) {
            sessionManagerContainer.style.display = 'block';
        }
        
        // Reset all navigation buttons to inactive
        const buttons = ['liveBtn', 'archiveBtn', 'settingsBtn', 'apiBtn', 'sessionBtn'];
        buttons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) btn.classList.remove('active');
        });
        
        // Ensure session UI is hidden when no session active
        if (!this.sessionManager.currentSession) {
            const sessionBar = document.getElementById('sessionBar');
            const headerSession = document.getElementById('headerSession');
            
            if (sessionBar) sessionBar.style.display = 'none';
            if (headerSession) headerSession.style.display = 'none';
        }
    }

    // === MODE SWITCHING ===
    switchMode(mode) {
        console.log(`🔄 Switching to mode: ${mode}`);
        
        // Block access to certain modes without session
        if (!this.sessionManager.currentSession && ['live', 'archive', 'api'].includes(mode)) {
            console.log(`🚫 Access to ${mode} blocked: No active session`);
            this.showStartPage();
            return;
        }
        
        this.currentMode = mode;
        
        // Update button states
        const buttons = ['liveBtn', 'archiveBtn', 'settingsBtn', 'apiBtn', 'sessionBtn'];
        buttons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.classList.toggle('active', btnId === mode + 'Btn');
            }
        });
        
        // Hide all containers
        const containers = ['errorsContainer', 'settingsContainer', 'apiPanel', 'sessionManagerContainer'];
        containers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) container.style.display = 'none';
        });
        
        // Show appropriate container
        if (mode === 'live') {
            document.getElementById('errorsContainer').style.display = 'block';
            this.connectSSE();
        } else if (mode === 'settings') {
            document.getElementById('settingsContainer').style.display = 'block';
            this.disconnectSSE();
        } else if (mode === 'api') {
            document.getElementById('apiPanel').style.display = 'block';
            this.disconnectSSE();
        } else if (mode === 'archive') {
            document.getElementById('errorsContainer').style.display = 'block';
            this.disconnectSSE();
        } else if (mode === 'session-manager') {
            document.getElementById('sessionManagerContainer').style.display = 'block';
            this.disconnectSSE();
        }
        
        console.log(`✅ Mode switched to: ${mode}`);
    }

    updateNavigationState(hasSession) {
        const navButtons = ['liveBtn', 'archiveBtn', 'apiBtn'];
        navButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.disabled = !hasSession;
                btn.classList.toggle('disabled', !hasSession);
            }
        });
    }

    setupEventListeners() {
        // Mode switching - with null checks
        const liveBtn = document.getElementById('liveBtn');
        const archiveBtn = document.getElementById('archiveBtn');
        const settingsBtn = document.getElementById('settingsBtn');
        const apiBtn = document.getElementById('apiBtn');
        const sessionBtn = document.getElementById('sessionBtn');
        
        if (liveBtn) liveBtn.addEventListener('click', () => this.switchMode('live'));
        if (archiveBtn) archiveBtn.addEventListener('click', () => this.switchMode('archive'));
        if (settingsBtn) settingsBtn.addEventListener('click', () => this.switchMode('settings'));
        if (apiBtn) apiBtn.addEventListener('click', () => this.switchMode('api'));
        if (sessionBtn) sessionBtn.addEventListener('click', () => this.switchMode('session-manager'));
        
        // Session Management Event Listeners - delegiert an SessionManager
        this.sessionManager.setupSessionEventListeners();
        
        // Settings - with null checks
        const saveSettings = document.getElementById('saveSettings');
        const clearStorage = document.getElementById('clearStorage');
        const showAllData = document.getElementById('showAllData');
        const deleteAllData = document.getElementById('deleteAllData');
        const archiveRetentionDays = document.getElementById('archiveRetentionDays');
        const maxArchiveItems = document.getElementById('maxArchiveItems');
        
        if (saveSettings) saveSettings.addEventListener('click', () => this.saveSettings());
        if (clearStorage) clearStorage.addEventListener('click', () => this.clearArchive());
        if (showAllData) showAllData.addEventListener('click', () => this.showAllLocalStorageData());
        if (deleteAllData) deleteAllData.addEventListener('click', () => this.deleteAllData());
        
        // Range slider updates - with null checks
        if (archiveRetentionDays) {
            archiveRetentionDays.addEventListener('input', (e) => {
                const retentionValue = document.getElementById('retentionValue');
                if (retentionValue) retentionValue.textContent = e.target.value;
            });
        }
        
        if (maxArchiveItems) {
            maxArchiveItems.addEventListener('input', (e) => {
                const maxItemsValue = document.getElementById('maxItemsValue');
                if (maxItemsValue) maxItemsValue.textContent = e.target.value;
            });
        }
    }

    // === SETTINGS MANAGEMENT ===
    loadSettings() {
        const defaults = {
            archiveRetentionDays: 7,
            maxArchiveItems: 1000,
            autoArchive: true,
            bufferOfflineErrors: true,
            enableSounds: true,
            notifyNewError: true,
            soundNewError: true,
            pushNewError: true,
            notifyConnectionSuccess: true,
            soundConnectionSuccess: true,
            pushConnectionSuccess: true,
            notifyConnectionClosed: true,
            soundConnectionClosed: true,
            pushConnectionClosed: true,
            notifyBufferedErrors: true,
            soundBufferedErrors: true,
            pushBufferedErrors: true,
            soundErrorDeleted: true,
            showDeleteConfirmation: true
        };
        
        const saved = localStorage.getItem('errorDisplaySettings');
        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    }

    saveSettings() {
        const formData = new FormData(document.getElementById('settingsForm'));
        
        this.settings = {
            archiveRetentionDays: parseInt(formData.get('archiveRetentionDays')),
            maxArchiveItems: parseInt(formData.get('maxArchiveItems')),
            autoArchive: formData.get('autoArchive') === 'on',
            bufferOfflineErrors: formData.get('bufferOfflineErrors') === 'on',
            enableSounds: formData.get('enableSounds') === 'on',
            notifyNewError: formData.get('notifyNewError') === 'on',
            soundNewError: formData.get('soundNewError') === 'on',
            pushNewError: formData.get('pushNewError') === 'on',
            notifyConnectionSuccess: formData.get('notifyConnectionSuccess') === 'on',
            soundConnectionSuccess: formData.get('soundConnectionSuccess') === 'on',
            pushConnectionSuccess: formData.get('pushConnectionSuccess') === 'on',
            notifyConnectionClosed: formData.get('notifyConnectionClosed') === 'on',
            soundConnectionClosed: formData.get('soundConnectionClosed') === 'on',
            pushConnectionClosed: formData.get('pushConnectionClosed') === 'on',
            notifyBufferedErrors: formData.get('notifyBufferedErrors') === 'on',
            soundBufferedErrors: formData.get('soundBufferedErrors') === 'on',
            pushBufferedErrors: formData.get('pushBufferedErrors') === 'on',
            soundErrorDeleted: formData.get('soundErrorDeleted') === 'on',
            showDeleteConfirmation: formData.get('showDeleteConfirmation') === 'on'
        };
        
        localStorage.setItem('errorDisplaySettings', JSON.stringify(this.settings));
        this.cleanupArchive();
        
        // Sound-Manager konfigurieren
        if (window.soundManager) {
            window.soundManager.setEnabled(this.settings.enableSounds);
        }
        
        this.showNotification('Einstellungen gespeichert', 'success');
    }

    // === ARCHIVE MANAGEMENT ===
    loadArchive() {
        // Load session-specific archive if session exists
        if (this.currentSession) {
            const sessionArchiveKey = `archive_${this.currentSession.token}`;
            const stored = localStorage.getItem(sessionArchiveKey);
            return stored ? JSON.parse(stored) : [];
        }
        
        // Fallback to global archive for backwards compatibility
        const stored = localStorage.getItem('errorDisplayArchive');
        return stored ? JSON.parse(stored) : [];
    }

    saveToArchive(error, isLive = false) {
        if (!this.settings.autoArchive) return;
        
        const archiveError = {
            ...error,
            archivedAt: new Date().toISOString(),
            id: Date.now() + Math.random(),
            isLive: isLive,
            isServerBuffered: error.isServerBuffered || false,
            sessionToken: this.currentSession?.token
        };
        
        this.archiveData.unshift(archiveError);
        this.cleanupArchive();
        this.saveArchive();
        
        // Auto-save if enabled and session is saved
        if (this.autoSaveEnabled && this.isSessionSaved()) {
            this.saveToServer();
        }
    }

    saveArchive() {
        if (this.currentSession) {
            // Save to session-specific archive
            const sessionArchiveKey = `archive_${this.currentSession.token}`;
            localStorage.setItem(sessionArchiveKey, JSON.stringify(this.archiveData));
            
            // Update session's archive property for server sync
            this.currentSession.archive = this.archiveData;
        } else {
            // Fallback to global archive
            localStorage.setItem('errorDisplayArchive', JSON.stringify(this.archiveData));
        }
    }

    cleanupArchive() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.settings.archiveRetentionDays);
        
        // Remove old items
        this.archiveData = this.archiveData.filter(error => 
            new Date(error.archivedAt) > cutoffDate
        );
        
        // Limit max items
        if (this.archiveData.length > this.settings.maxArchiveItems) {
            this.archiveData = this.archiveData.slice(0, this.settings.maxArchiveItems);
        }
        
        this.saveArchive();
    }

    clearArchive() {
        if (confirm('Sind Sie sicher, dass Sie das gesamte Archiv löschen möchten?')) {
            this.archiveData = [];
            
            // Clear session-specific archive
            if (this.currentSession) {
                localStorage.removeItem(`archive_${this.currentSession.token}`);
            } else {
                // Fallback to global archive
                localStorage.removeItem('errorDisplayArchive');
            }
            
            this.updateStorageInfo();
            this.showNotification('Archiv geleert', 'success');
            
            if (this.currentMode === 'archive') {
                this.displayArchive();
            }
        }
    }

    // === SERVER VALIDATION ===
    async checkServerRestartAndClearData() {
        try {
            // Get server start time
            const response = await fetch(`${this.serverUrl}/api/server-info`);
            if (!response.ok) return;
            
            const serverInfo = await response.json();
            const serverStartTime = new Date(serverInfo.startTime).getTime();
            
            // Check if we have stored server start time
            const storedServerStart = localStorage.getItem('serverStartTime');
            
            if (storedServerStart) {
                const lastKnownStart = parseInt(storedServerStart);
                
                // If server was restarted (different start time), clear all data
                if (serverStartTime !== lastKnownStart) {
                    await this.clearAllBrowserDataWithNotification();
                }
            } else {
                // First visit - check if there's any existing data
                const hasExistingData = this.hasAnyLocalStorageData();
                if (hasExistingData) {
                    await this.clearAllBrowserDataWithNotification();
                }
            }
            
            // Store current server start time
            localStorage.setItem('serverStartTime', serverStartTime.toString());
            
        } catch (error) {
            console.warn('Could not check server restart status:', error);
            // If we can't reach server but have old data, clear it anyway
            const hasExistingData = this.hasAnyLocalStorageData();
            if (hasExistingData) {
                await this.clearAllBrowserDataWithNotification();
            }
        }
    }

    hasAnyLocalStorageData() {
        const keys = ['currentSession', 'lastSessions', 'settings', 'serverStartTime'];
        return keys.some(key => localStorage.getItem(key) !== null);
    }

    async validateAndUpdateUIState() {
        // Session validation wird von SessionManager übernommen
        await this.sessionManager.validateAndUpdateUIState();
    }

    startAutoCleanupTimer() {
        // Session cleanup wird von SessionManager übernommen
        this.sessionManager.startSessionAutoCleanupTimer();
    }

    // === SSE CONNECTION ===
    connectSSE() {
        // Prevent SSE connection without active session
        if (!this.currentSession || !this.currentSession.token) {
            console.log('🚫 SSE connection blocked: No active session');
            this.showStartPage();
            return;
        }
        
        if (this.eventSource) return;
        
        // Include session token in SSE connection
        let sseUrl = '/live';
        sseUrl += `?session=${encodeURIComponent(this.currentSession.token)}`;
        
        console.log(`[${new Date().toLocaleTimeString('de-DE')}] 🔌 Attempting SSE connection to ${sseUrl}...`);
        this.eventSource = new EventSource(sseUrl);
        
        this.eventSource.onopen = () => {
            console.log(`[${new Date().toLocaleTimeString('de-DE')}] ✅ SSE connected successfully`);
            this.updateStatus('online');
            // Sound und Benachrichtigung für erfolgreiche Verbindung
            this.playNotificationSound('connectionSuccess');
            this.showEventNotification('connectionSuccess', 'Verbindung zum Server hergestellt');
        };
        
        this.eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'error') {
                if (this.currentMode === 'live') {
                    this.addError(data.error, true, data.error.isBuffered);
                    this.playNotificationSound('newError');
                } else if (this.settings.bufferOfflineErrors) {
                    this.bufferedErrors.unshift({...data.error, isLive: false, buffered: true, isServerBuffered: data.error.isBuffered});
                }
            } else if (data.type === 'clients') {
                this.clients = data.count;
                this.updateStats();
            } else if (data.type === 'buffered_notification') {
                this.showBufferedNotification(data.count, data.oldestError);
            } else if (data.type === 'delete') {
                if (this.currentMode === 'live') {
                    const isForCurrentSession = !data.sessionToken || 
                        (this.currentSession && data.sessionToken === this.currentSession.token);
                    
                    if (isForCurrentSession) {
                        if (data.index >= 0 && data.index < this.errors.length) {
                            this.errors.splice(data.index, 1);
                            this.displayErrors(this.errors);
                            this.updateStats();
                            this.showNotification('Fehler vom Server gelöscht', 'info');
                        }
                    }
                }
            } else if (data.type === 'clear') {
                if (this.currentMode === 'live') {
                    this.errors = [];
                    this.displayErrors(this.errors);
                    this.updateStats();
                    this.showNotification('Alle Fehler vom Server gelöscht', 'info');
                }
            }
        };
        
        this.eventSource.onerror = () => {
            console.log(`[${new Date().toLocaleTimeString('de-DE')}] ❌ SSE connection error`);
            this.updateStatus('offline');
            
            this.playNotificationSound('connectionClosed');
            this.showEventNotification('connectionClosed', 'Verbindung zum Server getrennt');
            
            this.eventSource = null;
            
            console.log('🔌 SSE disconnected - manual reconnection required via Live tab');
        };
    }

    disconnectSSE() {
        if (this.eventSource) {
            console.log(`[${new Date().toLocaleTimeString('de-DE')}] 🔌 SSE connection manually closed`);
            this.eventSource.close();
            this.eventSource = null;
            
            this.updateStatus('offline');
            this.playNotificationSound('connectionClosed');
            this.showEventNotification('connectionClosed', 'Verbindung manuell getrennt');
        }
    }

    // === ERROR HANDLING ===
    addError(error, isLive = false, isServerBuffered = false) {
        if (this.currentMode !== 'live') return;
        
        const errorWithMeta = {
            ...error, 
            isLive: isLive,
            isServerBuffered: isServerBuffered
        };
        
        // Add to live errors array (for current display)
        this.errors.unshift(errorWithMeta);
        if (this.errors.length > 100) this.errors.pop();
        
        // Also save to archive automatically (persistent storage)
        this.saveToArchive(errorWithMeta, isLive);
        
        this.displayErrors(this.errors);
        this.updateStats();
        
        // Update session activity
        this.updateSessionActivity();
        
        // Auto-save if enabled and session is saved
        if (this.autoSaveEnabled && this.isSessionSaved()) {
            this.saveToServer();
        } else {
            // Mark as having unsaved changes if auto-save is disabled
            this.markAsUnsaved();
        }
    }

    async loadSessionErrors() {
        if (!this.currentSession) return;
        
        try {
            const headers = {
                'x-session-token': this.currentSession.token
            };
            
            const response = await fetch(`${this.serverUrl}/errors`, { headers });
            
            if (response.ok) {
                const data = await response.json();
                this.errors = data.errors || [];
                console.log(`📊 Loaded ${this.errors.length} session-specific errors`);
            } else if (response.status === 401) {
                console.error('❌ Invalid session token for loading errors');
                this.showNotification('Session ungültig - bitte neue Session erstellen', 'error');
            }
        } catch (error) {
            console.error('❌ Failed to load session errors:', error);
        }
    }

    // === DISPLAY FUNCTIONS ===
    displaySettings() {
        // Populate form with current settings
        const retentionSlider = document.getElementById('archiveRetentionDays');
        const maxItemsSlider = document.getElementById('maxArchiveItems');
        
        retentionSlider.value = this.settings.archiveRetentionDays;
        maxItemsSlider.value = this.settings.maxArchiveItems;
        
        document.getElementById('retentionValue').textContent = this.settings.archiveRetentionDays;
        document.getElementById('maxItemsValue').textContent = this.settings.maxArchiveItems;
        
        document.getElementById('autoArchive').checked = this.settings.autoArchive;
        document.getElementById('bufferOfflineErrors').checked = this.settings.bufferOfflineErrors;
        
        this.updateStorageInfo();
    }

    displayArchive() {
        this.displayErrors(this.archiveData, true);
        this.updateStats();
    }

    displayAPI() {
        // Update server URL with current location
        const serverUrl = `${window.location.protocol}//${window.location.host}`;
        document.getElementById('serverUrl').value = serverUrl;
        
        // Update session token display
        const sessionTokenInfo = document.getElementById('sessionTokenInfo');
        const apiSessionToken = document.getElementById('apiSessionToken');
        
        if (this.currentSession && this.currentSession.token) {
            sessionTokenInfo.style.display = 'block';
            apiSessionToken.value = this.currentSession.token;
        } else {
            sessionTokenInfo.style.display = 'none';
        }
        
        // Update all code examples with the actual server URL
        this.updateCodeExamples(serverUrl);
        
        // Initialize syntax highlighting after a brief delay to ensure DOM is ready
        setTimeout(() => {
            if (typeof Prism !== 'undefined') {
                Prism.highlightAll();
            }
        }, 100);
    }

    updateCodeExamples(serverUrl) {
        const codeBlocks = [
            'js-send', 'js-get', 'js-live', 'js-clear',
            'py-send', 'py-get', 'py-monitor', 'py-clear',
            'php-send', 'php-get', 'php-clear',
            'java-example', 'csharp-example', 'kotlin-example', 
            'curl-example', 'powershell-example', 'cmd-example', 'macos-example', 'linux-example'
        ];
        
        codeBlocks.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = element.textContent.replace(/SERVER_URL/g, serverUrl);
                element.textContent = element.textContent.replace(/http:\/\/localhost:3000/g, serverUrl);
            }
        });
    }

    // === UTILITY FUNCTIONS ===
    updateStatus(status) {
        const statusElement = document.getElementById('connectionStatus');
        const statusText = document.getElementById('status-text');
        const statusIcon = document.getElementById('status-icon');
        
        statusElement.className = `status ${status}`;
        
        const statusConfig = {
            online: { text: 'Live', icon: '📡' },
            offline: { text: 'Offline', icon: '🔴' },
            archive: { text: 'Archiv', icon: '📂' },
            settings: { text: 'Einstellungen', icon: '⚙️' }
        };
        
        const config = statusConfig[status] || { text: status, icon: '❓' };
        statusText.textContent = config.text;
        statusIcon.textContent = config.icon;
    }

    updateStats() {
        document.getElementById('totalErrors').textContent = 
            this.currentMode === 'live' ? this.errors.length : this.archiveData.length;
        document.getElementById('connectedClients').textContent = this.clients;
    }

    updateStorageInfo() {
        const archiveSize = this.getArchiveSize();
        const storageUsed = this.getStorageUsed();
        
        document.getElementById('archiveCount').textContent = this.archiveData.length;
        document.getElementById('storageSize').textContent = this.formatBytes(storageUsed);
    }

    getArchiveSize() {
        return this.archiveData.length;
    }

    getStorageUsed() {
        const archive = localStorage.getItem('errorDisplayArchive') || '';
        const settings = localStorage.getItem('errorDisplaySettings') || '';
        return new Blob([archive + settings]).size;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    cleanIP(ip) {
        return ip === 'unknown' ? 'Unbekannt' : ip.replace('::ffff:', '');
    }

    setupModal() {
        // Add CSS for slide-in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    showNotification(message, type = 'info') {
        // Enhanced notification system with stacking
        const notificationContainer = this.getOrCreateNotificationContainer();
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Apply styles
        this.applyNotificationStyles(notification);
        
        // Add to container (stacking automatically handled by container)
        notificationContainer.appendChild(notification);
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
                // Remove container if empty
                if (notificationContainer.children.length === 0) {
                    notificationContainer.remove();
                }
            }
        }, 4000);
    }

    getOrCreateNotificationContainer() {
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1002;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }
        return container;
    }

    applyNotificationStyles(notification) {
        notification.style.cssText = `
            padding: 1rem 1.5rem;
            background: var(--background-card);
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
            color: var(--text-primary);
            animation: slideInRight 0.3s ease;
            backdrop-filter: blur(20px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            max-width: 350px;
            word-wrap: break-word;
            pointer-events: auto;
            cursor: pointer;
        `;
        
        // Click to dismiss
        notification.addEventListener('click', () => {
            notification.remove();
        });
        
        // Type-specific styling
        switch (notification.className.split(' ')[1]) {
            case 'success':
                notification.style.borderColor = 'var(--success)';
                notification.style.background = 'rgba(34, 197, 94, 0.1)';
                break;
            case 'error':
                notification.style.borderColor = 'var(--danger)';
                notification.style.background = 'rgba(239, 68, 68, 0.1)';
                break;
            case 'warning':
                notification.style.borderColor = 'var(--warning)';
                notification.style.background = 'rgba(245, 158, 11, 0.1)';
                break;
            case 'info':
                notification.style.borderColor = 'var(--primary)';
                notification.style.background = 'rgba(59, 130, 246, 0.1)';
                break;
        }
    }

    // === ERROR DELETION & MANAGEMENT ===
    deleteError(index, isArchive = false) {
        if (this.settings.showDeleteConfirmation) {
            this.showDeleteConfirmation(index, isArchive);
        } else {
            this.performDeleteError(index, isArchive);
        }
    }

    async clearAllBrowserDataWithNotification() {
        this.showNotification('Bestehende Daten gefunden... werden überprüft', 'info');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const validSessionsCount = await this.sessionManager.validateAndPreserveSessions();
        
        const keysToKeep = validSessionsCount > 0 ? ['lastSessions'] : [];
        const allKeys = Object.keys(localStorage);
        
        for (const key of allKeys) {
            if (!keysToKeep.includes(key)) {
                localStorage.removeItem(key);
            }
        }
        
        this.currentSession = null;
        if (validSessionsCount === 0) {
            this.lastSessions = [];
        }
        
        if (validSessionsCount > 0) {
            this.showNotification(`${validSessionsCount} gültige Sessions gefunden`, 'success');
        } else {
            this.showNotification('Erfolgreich alle Browserdaten gelöscht', 'success');
        }
        
        this.enforceStartPageState();
    }

    // === Weitere delegierte Funktionen ===
    showAllLocalStorageData() {
        const allData = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('errorDisplay')) {
                try {
                    allData[key] = JSON.parse(localStorage.getItem(key));
                } catch (e) {
                    allData[key] = localStorage.getItem(key);
                }
            }
        }
        this.showDataModal('Alle gespeicherten Daten', JSON.stringify(allData, null, 2));
    }

    deleteAllData() {
        const confirmText = 'ALLE DATEN LÖSCHEN';
        const userInput = prompt(`Warnung: Diese Aktion löscht ALLE gespeicherten Daten unwiderruflich!\n\nGeben Sie "${confirmText}" ein, um fortzufahren:`);
        
        if (userInput === confirmText) {
            const keysToDelete = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('errorDisplay')) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => localStorage.removeItem(key));
            
            this.archiveData = [];
            this.errors = [];
            this.settings = this.loadSettings();
            this.updateStorageInfo();
            this.displayErrors([]);
            
            this.showNotification('Alle Daten wurden gelöscht', 'success');
        } else if (userInput !== null) {
            this.showNotification('Löschvorgang abgebrochen', 'warning');
        }
    }

    showDataModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'data-modal';
        modal.innerHTML = `
            <div class="data-modal-content">
                <h3>${title}</h3>
                <div class="data-display">${content}</div>
                <button class="btn btn-outline" onclick="this.closest('.data-modal').remove()">✕ Schließen</button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // === WEITERE FUNKTIONEN ===
    performDeleteError(index, isArchive) { /* Implementation delegiert */ }
    archiveError(index) { /* Implementation delegiert */ }
    formatText(id, format) { /* Implementation delegiert */ }
    async copyToClipboard(id, button) { /* Implementation delegiert */ }
    fallbackCopyToClipboard(text) { /* Implementation delegiert */ }
    initPushNotifications() { /* Implementation delegiert */ }
    playNotificationSound(eventType) { /* Implementation delegiert */ }
    showEventNotification(eventType, message) { /* Implementation delegiert */ }
    sendPushNotification(title, body, icon) { /* Implementation delegiert */ }
    loadAndApplySettings() { /* Implementation delegiert */ }
    showBufferedNotification(count, oldestErrorTime) { /* Implementation delegiert */ }
    copyServerUrl() { /* Implementation delegiert */ }
    copyCode(codeId) { /* Implementation delegiert */ }
    async copyTextToClipboard(text, successMessage) { /* Implementation delegiert */ }
    togglePasswordVisibility(inputId) { /* Implementation delegiert */ }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.errorDisplay = new ErrorDisplay();
    window.app = window.errorDisplay;
});

// Handle page visibility
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.errorDisplay && window.errorDisplay.currentMode === 'live') {
        console.log('📡 Page visible - reconnecting SSE in live mode');
        window.errorDisplay.connectSSE();
    }
});

// Listen for session manager messages
window.addEventListener('message', (event) => {
    if (event.data.type === 'sessionRestored') {
        window.errorDisplay.restoreSession(event.data.session);
    }
});
