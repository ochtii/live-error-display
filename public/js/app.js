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
        
        // Session Management
        this.currentSession = null;
        this.loadCurrentSession();
        
        this.init();
    }

    // === INITIALIZATION === 
    async init() {
        this.setupEventListeners();
        this.updateStats();
        this.setupModal();
        this.loadAndApplySettings();
        this.initPushNotifications();
        this.updateSessionDisplay();
        
        // Try to load last active session automatically
        if (!this.currentSession) {
            const loaded = await this.loadLastActiveSession();
            if (!loaded) {
                this.showSessionRequiredMessage();
                return; // Don't connect SSE or display mode without session
            }
        }
        
        this.connectSSE();
        this.displayMode(this.currentMode);
    }

    setupEventListeners() {
        // Mode switching
        document.getElementById('liveBtn').addEventListener('click', () => this.switchMode('live'));
        document.getElementById('archiveBtn').addEventListener('click', () => this.switchMode('archive'));
        document.getElementById('settingsBtn').addEventListener('click', () => this.switchMode('settings'));
        document.getElementById('apiBtn').addEventListener('click', () => this.switchMode('api'));
        
        // Session Management (with null checks)
        const sessionBtn = document.getElementById('sessionBtn');
        const copyToken = document.getElementById('copyToken');
        const sessionManager = document.getElementById('sessionManager');
        const saveSession = document.getElementById('saveSession');
        const endSession = document.getElementById('endSession');
        const copyTokenHeader = document.getElementById('copyTokenHeader');
        const sessionEndLink = document.getElementById('sessionEndLink');
        const autoSaveCheckbox = document.getElementById('autoSaveCheckbox');
        
        if (sessionBtn) sessionBtn.addEventListener('click', () => this.openSessionManager());
        if (copyToken) copyToken.addEventListener('click', () => this.copySessionToken());
        if (sessionManager) sessionManager.addEventListener('click', () => this.openSessionManager());
        if (saveSession) saveSession.addEventListener('click', () => this.saveCurrentSession());
        if (endSession) endSession.addEventListener('click', () => this.clearSession());
        if (copyTokenHeader) copyTokenHeader.addEventListener('click', () => this.copySessionToken());
        if (sessionEndLink) sessionEndLink.addEventListener('click', () => this.endCurrentSession());
        if (autoSaveCheckbox) autoSaveCheckbox.addEventListener('change', (e) => this.toggleAutoSave(e.target.checked));
        
        // Session Manager inline controls
        const createNewSessionBtn = document.getElementById('createNewSessionBtn');
        const restoreSessionBtn = document.getElementById('restoreSessionBtn');
        const refreshLastSessionsBtn = document.getElementById('refreshLastSessionsBtn');
        
        if (createNewSessionBtn) createNewSessionBtn.addEventListener('click', () => this.createNewSessionInline());
        if (restoreSessionBtn) restoreSessionBtn.addEventListener('click', () => this.restoreSessionFromToken());
        if (refreshLastSessionsBtn) refreshLastSessionsBtn.addEventListener('click', () => this.loadLastSessionsInline());
        
        // Settings
        document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
        document.getElementById('clearStorage').addEventListener('click', () => this.clearArchive());
        document.getElementById('showAllData').addEventListener('click', () => this.showAllLocalStorageData());
        document.getElementById('deleteAllData').addEventListener('click', () => this.deleteAllData());
        
        // Push-Permission Button wird später in initPushNotifications hinzugefügt
        
        // Range slider updates
        document.getElementById('archiveRetentionDays').addEventListener('input', (e) => {
            document.getElementById('retentionValue').textContent = e.target.value;
        });
        
        document.getElementById('maxArchiveItems').addEventListener('input', (e) => {
            document.getElementById('maxItemsValue').textContent = e.target.value;
        });
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
            soundErrorDeleted: true, // Neuer Sound für gelöschte Fehler
            showDeleteConfirmation: true // Neue Einstellung für Lösch-Bestätigung
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

    updateStorageInfo() {
        const archiveSize = this.getArchiveSize();
        const storageUsed = this.getStorageUsed();
        
        document.getElementById('archiveCount').textContent = this.archiveData.length;
        document.getElementById('storageSize').textContent = this.formatBytes(storageUsed);
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
            sessionToken: this.currentSession?.token // Track which session the error belongs to
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

    // === MODE SWITCHING ===
    switchMode(mode) {
        this.currentMode = mode;
        
        // Update session activity
        this.updateSessionActivity();
        
        // Update button states
        document.getElementById('liveBtn').classList.toggle('active', mode === 'live');
        document.getElementById('archiveBtn').classList.toggle('active', mode === 'archive');
        document.getElementById('settingsBtn').classList.toggle('active', mode === 'settings');
        document.getElementById('apiBtn').classList.toggle('active', mode === 'api');
        
        this.displayMode(mode);
    }

    displayMode(mode) {
        // Hide all containers
        document.getElementById('errorsContainer').style.display = 'none';
        document.getElementById('settingsContainer').style.display = 'none';
        document.getElementById('apiPanel').style.display = 'none';
        
        if (mode === 'live') {
            document.getElementById('errorsContainer').style.display = 'flex';
            this.connectSSE();
            this.updateStatus('online');
            
            // Load session-specific errors from server
            this.loadSessionErrors();
            
            // Add buffered errors to live view and archive them
            if (this.bufferedErrors.length > 0 && this.settings.bufferOfflineErrors) {
                // Add to live errors and archive each buffered error
                for (const bufferedError of this.bufferedErrors) {
                    this.errors.unshift(bufferedError);
                    this.saveToArchive(bufferedError, false); // Archive the buffered error
                }
                this.bufferedErrors = [];
                
                // Limit live errors to 100
                if (this.errors.length > 100) {
                    this.errors = this.errors.slice(0, 100);
                }
            }
            
            this.displayErrors(this.errors);
        } else if (mode === 'archive') {
            document.getElementById('errorsContainer').style.display = 'flex';
            this.disconnectSSE();
            this.updateStatus('archive');
            this.displayArchive();
        } else if (mode === 'settings') {
            document.getElementById('settingsContainer').style.display = 'block';
            this.disconnectSSE();
            this.updateStatus('settings');
            this.displaySettings();
        } else if (mode === 'api') {
            document.getElementById('apiPanel').style.display = 'block';
            this.disconnectSSE();
            this.updateStatus('📋 API');
            this.displayAPI();
        } else if (mode === 'session-manager') {
            const sessionManagerContainer = document.getElementById('sessionManagerContainer');
            if (sessionManagerContainer) {
                sessionManagerContainer.style.display = 'block';
                // Initialize session manager content
                this.updateCurrentSessionCard();
                this.loadLastSessionsInline(); // Load last sessions instead of saved sessions
                this.updateSessionManagerState();
            }
            this.disconnectSSE();
            this.updateStatus('🔑 Session Manager');
        }
    }

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
    
    updateSessionManagerState() {
        // Update session manager based on current session state
        const hasActiveSession = !!this.currentSession;
        
        // Get session creation and restoration cards
        const createCard = document.querySelector('.session-card:has(#createNewSessionBtn)');
        const restoreCard = document.querySelector('.session-card:has(#restoreSessionBtn)');
        
        if (hasActiveSession) {
            // Disable session creation and restoration when session is active
            this.disableSessionCard(createCard, 'Neue Session erstellen', 'aktuelle Session beenden');
            this.disableSessionCard(restoreCard, 'Session wiederherstellen', 'aktuelle Session beenden');
            
            // For saved sessions, also disable the saved sessions list
            const savedSessionsCard = document.querySelector('.session-card:has(#inlineSavedSessions)');
            if (this.isSessionSaved()) {
                this.disableSessionCard(savedSessionsCard, 'Gespeicherte Sessions verwenden', 'aktuelle Session beenden', false);
            } else {
                // For unsaved sessions, enable the saved sessions card
                this.enableSessionCard(savedSessionsCard);
            }
        } else {
            // Enable session creation and restoration when no session is active
            const savedSessionsCard = document.querySelector('.session-card:has(#inlineSavedSessions)');
            this.enableSessionCard(createCard);
            this.enableSessionCard(restoreCard);
            this.enableSessionCard(savedSessionsCard);
        }
    }
    
    disableSessionCard(card, action, requirement, grayOut = true) {
        if (!card) return;
        
        // Add disabled class only if graying out
        if (grayOut) {
            card.classList.add('session-card-disabled');
        }
        
        // Disable all inputs and buttons
        const inputs = card.querySelectorAll('input, button');
        inputs.forEach(input => {
            input.disabled = true;
        });
        
        // Add warning message if not already present and if graying out
        if (grayOut) {
            let warningDiv = card.querySelector('.session-warning');
            if (!warningDiv) {
                warningDiv = document.createElement('div');
                warningDiv.className = 'session-warning';
                warningDiv.innerHTML = `
                    <div class="warning-content">
                        <span class="warning-icon">⚠️</span>
                        <span class="warning-text">Um ${action} zu können, müssen Sie zuerst die ${requirement}.</span>
                        <span class="session-end-text" onclick="window.errorDisplay.clearSession()">
                            Session beenden ✖
                        </span>
                    </div>
                `;
                card.appendChild(warningDiv);
            }
        }
    }
    
    enableSessionCard(card) {
        if (!card) return;
        
        // Remove disabled class
        card.classList.remove('session-card-disabled');
        
        // Enable all inputs and buttons
        const inputs = card.querySelectorAll('input, button');
        inputs.forEach(input => {
            input.disabled = false;
        });
        
        // Remove warning message
        const warningDiv = card.querySelector('.session-warning');
        if (warningDiv) {
            warningDiv.remove();
        }
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
            // JavaScript
            'js-send', 'js-get', 'js-live', 'js-clear',
            // Python
            'py-send', 'py-get', 'py-monitor', 'py-clear',
            // PHP
            'php-send', 'php-get', 'php-clear',
            // Andere Sprachen (werden später hinzugefügt)
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

    copyServerUrl() {
        const serverUrlInput = document.getElementById('serverUrl');
        this.copyTextToClipboard(serverUrlInput.value, 'Server-URL kopiert!');
    }

    copyCode(codeId) {
        const codeElement = document.getElementById(codeId);
        this.copyTextToClipboard(codeElement.textContent, 'Code kopiert!');
    }

    async copyTextToClipboard(text, successMessage) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                this.fallbackCopyToClipboard(text);
            }
            this.showNotification(successMessage, 'success');
        } catch (err) {
            console.error('Copy failed:', err);
            try {
                this.fallbackCopyToClipboard(text);
                this.showNotification(successMessage, 'success');
            } catch (fallbackErr) {
                this.showNotification('Kopieren nicht verfügbar - Text manuell markieren und Strg+C drücken', 'warning');
            }
        }
    }

    // === SSE CONNECTION ===
    connectSSE() {
        if (this.eventSource) return;
        
        // Include session token in SSE connection if available
        let sseUrl = '/live';
        if (this.currentSession && this.currentSession.token) {
            sseUrl += `?session=${encodeURIComponent(this.currentSession.token)}`;
        }
        
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
                    // Korrekte Kennzeichnung: isServerBuffered = data.error.isBuffered (vom Server)
                    this.addError(data.error, true, data.error.isBuffered);
                    // Sound und Benachrichtigung für neue Fehler
                    this.playNotificationSound('newError');
                } else if (this.settings.bufferOfflineErrors) {
                    // Buffer the error for later display - diese sind lokal gepuffert, nicht server-gepuffert
                    this.bufferedErrors.unshift({...data.error, isLive: false, buffered: true, isServerBuffered: data.error.isBuffered});
                }
                // Note: Archiving is now handled automatically in addError()
            } else if (data.type === 'clients') {
                this.clients = data.count;
                this.updateStats();
            } else if (data.type === 'buffered_notification') {
                this.showBufferedNotification(data.count, data.oldestError);
            } else if (data.type === 'delete') {
                // Handle server-side error deletion
                if (this.currentMode === 'live') {
                    // Check if this deletion is for the current session or global
                    const isForCurrentSession = !data.sessionToken || 
                        (this.currentSession && data.sessionToken === this.currentSession.token);
                    
                    if (isForCurrentSession) {
                        // Remove the error from the live errors array
                        if (data.index >= 0 && data.index < this.errors.length) {
                            this.errors.splice(data.index, 1);
                            this.displayErrors(this.errors);
                            this.updateStats();
                            this.showNotification('Fehler vom Server gelöscht', 'info');
                        }
                    }
                }
            } else if (data.type === 'clear') {
                // Handle server-side clear all errors
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
            
            // Sound und Benachrichtigung für getrennte Verbindung
            this.playNotificationSound('connectionClosed');
            this.showEventNotification('connectionClosed', 'Verbindung zum Server getrennt');
            
            this.eventSource = null;
            
            // NO AUTOMATIC RECONNECT - only reconnect when switching to live mode
            console.log('🔌 SSE disconnected - manual reconnection required via Live tab');
        };
    }

    disconnectSSE() {
        if (this.eventSource) {
            console.log(`[${new Date().toLocaleTimeString('de-DE')}] 🔌 SSE connection manually closed`);
            this.eventSource.close();
            this.eventSource = null;
            
            // Update status und Benachrichtigung auch bei manueller Trennung
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

    // === UNSAVED CHANGES TRACKING ===
    markAsUnsaved() {
        if (!this.autoSaveEnabled && this.currentSession && this.isSessionSaved()) {
            this.hasUnsavedChanges = true;
            this.updateUnsavedChangesIndicator();
        }
    }

    markAsSaved() {
        this.hasUnsavedChanges = false;
        this.updateUnsavedChangesIndicator();
    }

    updateUnsavedChangesIndicator() {
        const indicator = document.getElementById('unsavedChangesIndicator');
        if (!indicator) return;

        const shouldShow = !this.autoSaveEnabled && 
                          this.hasUnsavedChanges && 
                          this.currentSession && 
                          this.isSessionSaved();

        indicator.style.display = shouldShow ? 'flex' : 'none';
    }

    async saveCurrentSessionDirect() {
        if (!this.currentSession || !this.isSessionSaved()) {
            this.showNotification('Keine gespeicherte Session zum Aktualisieren', 'error');
            return;
        }

        // Get the stored password for this session
        const sessionData = this.getStoredSavedSession(this.currentSession.token);
        if (!sessionData || !sessionData.password) {
            this.showNotification('Session-Passwort nicht gefunden. Bitte Session erneut speichern.', 'error');
            return;
        }

        try {
            const success = await this.saveSessionToServer(sessionData.password);
            if (success) {
                this.markAsSaved();
                this.showNotification('Session erfolgreich aktualisiert!', 'success');
            }
        } catch (error) {
            console.error('Fehler beim direkten Speichern:', error);
            this.showNotification('Fehler beim Speichern der Session', 'error');
        }
    }

    displayErrors(errors, isArchive = false) {
        const container = document.getElementById('errorsContainer');
        container.innerHTML = '';
        
        if (errors.length === 0) {
            container.innerHTML = `
                <div class="error-card">
                    <div class="error-header">
                        <div class="error-info">
                            <div class="error-preview">
                                ${isArchive ? '📂 Keine archivierten Fehler vorhanden' : '🎉 Keine aktuellen Fehler'}
                            </div>
                            <div class="error-meta">
                                <span>${isArchive ? 'Archiv ist leer' : 'System läuft stabil'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            return;
        }
        
        errors.forEach((error, index) => {
            const card = this.createErrorCard(error, index, isArchive);
            container.appendChild(card);
        });
    }

    createErrorCard(error, index, isArchive = false) {
        const card = document.createElement('div');
        card.className = 'error-card fade-in';
        
        const id = `error-${Date.now()}-${index}`;
        const firstLine = error.message.split('\n')[0].substring(0, 100);
        const timestamp = isArchive ? 
            `🕒 ${new Date(error.archivedAt).toLocaleString('de-DE')} (archiviert)` :
            `🕒 ${error.timestamp}`;
        
        // Einfache Kennzeichnung ohne Badge
        let receivedIndicator = '';
        let indicatorClass = '';
        
        if (error.isServerBuffered === true || error.isServerBuffered === 'true') {
            receivedIndicator = 'Gepuffert empfangen';
            indicatorClass = 'buffered';
        } else {
            receivedIndicator = 'Live empfangen';
            indicatorClass = 'live';
        }
        
        card.innerHTML = `
            <div class="error-header" onclick="this.parentElement.querySelector('.error-content').classList.toggle('open'); this.querySelector('.expand-indicator').classList.toggle('expanded')">
                <div class="error-actions-buttons">
                    ${!isArchive ? `<button class="archive-error-btn" onclick="event.stopPropagation(); errorDisplay.archiveError(${index})" title="Fehler archivieren">📁</button>` : ''}
                    <button class="delete-error-btn" onclick="event.stopPropagation(); errorDisplay.deleteError(${index}, ${isArchive})" title="Fehler löschen">🗑️</button>
                </div>
                <div class="error-info">
                    <div class="error-preview">${this.escapeHtml(firstLine)}${error.message.length > 100 ? '...' : ''}</div>
                    <div class="error-meta">
                        <span>${timestamp}</span>
                        <span>🌐 ${this.cleanIP(error.ip)}</span>
                        <span class="live-indicator ${indicatorClass}">${receivedIndicator}</span>
                        ${isArchive ? '<span>📂 Archiviert</span>' : ''}
                    </div>
                </div>
                <div class="expand-indicator">
                    <div class="expand-line expand-line-1"></div>
                    <div class="expand-line expand-line-2"></div>
                </div>
            </div>
            <div class="error-content">
                <div class="error-body">
                    <div class="error-text" id="text-${id}">${this.escapeHtml(error.message)}</div>
                    <div class="error-actions">
                        <button class="action-btn" onclick="errorDisplay.formatText('${id}', 'original')">Original</button>
                        <button class="action-btn" onclick="errorDisplay.formatText('${id}', 'indent')">Einrücken</button>
                        <button class="action-btn" onclick="errorDisplay.formatText('${id}', 'quote')">Zitat</button>
                        <button class="action-btn" onclick="errorDisplay.formatText('${id}', 'code')">Code-Block</button>
                    </div>
                </div>
                <button class="copy-btn action-btn" onclick="window.errorDisplay.copyToClipboard('${id}', this)">📋 Kopieren</button>
            </div>
        `;
        
        return card;
    }

    // === UI UPDATES ===
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

    // === UTILITY FUNCTIONS ===
    formatText(id, format) {
        const element = document.getElementById(`text-${id}`);
        const originalText = element.dataset.original || element.textContent;
        
        if (!element.dataset.original) {
            element.dataset.original = originalText;
        }
        
        let formattedText;
        switch (format) {
            case 'original':
                formattedText = originalText;
                break;
            case 'indent':
                formattedText = originalText.split('\n').map(line => '    ' + line).join('\n');
                break;
            case 'quote':
                formattedText = originalText.split('\n').map(line => '> ' + line).join('\n');
                break;
            case 'code':
                formattedText = '```\n' + originalText + '\n```';
                break;
            default:
                formattedText = originalText;
        }
        
        element.textContent = formattedText;
    }

    async copyToClipboard(id, button) {
        const element = document.getElementById(`text-${id}`);
        const text = element.textContent;
        
        try {
            // Moderne Clipboard API versuchen
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback für ältere Browser oder HTTP-Verbindungen
                this.fallbackCopyToClipboard(text);
            }
            
            const originalText = button.textContent;
            button.textContent = '✅ Kopiert!';
            button.style.background = 'rgba(16, 185, 129, 0.3)';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '';
            }, 2000);
            
        } catch (err) {
            console.error('Copy failed:', err);
            // Fallback versuchen wenn moderne API fehlschlägt
            try {
                this.fallbackCopyToClipboard(text);
                const originalText = button.textContent;
                button.textContent = '✅ Kopiert!';
                button.style.background = 'rgba(16, 185, 129, 0.3)';
                
                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.background = '';
                }, 2000);
            } catch (fallbackErr) {
                this.showNotification('Kopieren nicht verfügbar - Text manuell markieren und Strg+C drücken', 'warning');
            }
        }
    }
    
    // Fallback für ältere Browser
    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (!successful) {
                throw new Error('execCommand failed');
            }
        } finally {
            document.body.removeChild(textArea);
        }
    }

    // === ERROR DELETION ===
    deleteError(index, isArchive = false) {
        if (this.settings.showDeleteConfirmation) {
            this.showDeleteConfirmation(index, isArchive);
        } else {
            this.performDeleteError(index, isArchive);
        }
    }

    showDeleteConfirmation(index, isArchive) {
        const errorData = isArchive ? this.archiveData[index] : this.errors[index];
        const errorPreview = errorData.message.substring(0, 100) + (errorData.message.length > 100 ? '...' : '');
        
        const modal = document.createElement('div');
        modal.className = 'delete-confirmation-modal';
        modal.innerHTML = `
            <div class="delete-confirmation-content">
                <div class="delete-confirmation-header">
                    <span class="delete-icon">🗑️</span>
                    <h3>Fehler löschen</h3>
                </div>
                <div class="delete-confirmation-body">
                    <p>Möchten Sie diesen Fehler wirklich löschen?</p>
                    <div class="error-preview-box">
                        <strong>Zeitstempel:</strong> ${errorData.timestamp}<br>
                        <strong>IP:</strong> ${this.cleanIP(errorData.ip)}<br>
                        <strong>Nachricht:</strong> ${this.escapeHtml(errorPreview)}
                    </div>
                    <label class="dont-ask-again">
                        <input type="checkbox" id="dontAskAgain">
                        Nicht erneut fragen
                    </label>
                </div>
                <div class="delete-confirmation-actions">
                    <button class="cancel-btn" onclick="this.closest('.delete-confirmation-modal').remove()">Abbrechen</button>
                    <button class="delete-btn" onclick="errorDisplay.confirmDelete(${index}, ${isArchive}, document.getElementById('dontAskAgain').checked); this.closest('.delete-confirmation-modal').remove()">Löschen</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Modal mit Escape-Taste schließen
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    confirmDelete(index, isArchive, dontAskAgain) {
        if (dontAskAgain) {
            this.settings.showDeleteConfirmation = false;
            localStorage.setItem('errorDisplaySettings', JSON.stringify(this.settings));
        }
        this.performDeleteError(index, isArchive);
    }

    performDeleteError(index, isArchive) {
        if (isArchive) {
            // Fehler aus Archiv löschen (Server-API für Sessions, lokal für Legacy)
            if (this.currentSession && this.currentSession.token) {
                this.deleteErrorFromArchive(index);
            } else {
                // Fallback für lokales Archiv
                this.archiveData.splice(index, 1);
                this.saveArchive();
                this.displayErrors(this.archiveData, true);
                this.showNotification(`Fehler aus Archiv gelöscht`, 'success');
            }
        } else {
            // Fehler aus Live-Liste löschen (sowohl lokal als auch auf dem Server)
            this.deleteErrorFromServer(index);
        }
        
        this.updateStats();
        
        // Sound für erfolgreiche Löschung
        this.playNotificationSound('errorDeleted');
    }

    async deleteErrorFromArchive(index) {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Session token ist für Archive-Löschung erforderlich
            if (this.currentSession && this.currentSession.token) {
                headers['x-session-token'] = this.currentSession.token;
            } else {
                throw new Error('Session token required for archive operations');
            }
            
            const response = await fetch(`${this.serverUrl}/archive/${index}`, {
                method: 'DELETE',
                headers: headers
            });

            if (response.ok) {
                const result = await response.json();
                // Lokale Löschung
                this.archiveData.splice(index, 1);
                this.displayErrors(this.archiveData, true);
                this.showNotification(`Archivierter Fehler gelöscht`, 'success');
            } else {
                throw new Error(`Server error: ${response.status}`);
            }
        } catch (error) {
            console.error('Fehler beim Löschen des archivierten Fehlers:', error);
            this.showNotification('Fehler beim Löschen vom Archiv-Server', 'error');
            
            // Fallback: Lokale Löschung wenn Server-Request fehlschlägt
            this.archiveData.splice(index, 1);
            this.saveArchive();
            this.displayErrors(this.archiveData, true);
        }
    }

    async deleteErrorFromServer(index) {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Add session token if available
            if (this.currentSession && this.currentSession.token) {
                headers['x-session-token'] = this.currentSession.token;
            }
            
            const response = await fetch(`${this.serverUrl}/error/${index}`, {
                method: 'DELETE',
                headers: headers
            });

            if (response.ok) {
                const result = await response.json();
                // Lokale Löschung wird durch SSE-Nachricht vom Server ausgelöst
                this.showNotification(`Live-Fehler gelöscht`, 'success');
            } else {
                throw new Error(`Server error: ${response.status}`);
            }
        } catch (error) {
            console.error('Fehler beim Löschen des Fehlers:', error);
            this.showNotification('Fehler beim Löschen vom Server', 'error');
            
            // Fallback: Lokale Löschung wenn Server-Request fehlschlägt
            this.errors.splice(index, 1);
            this.displayErrors(this.errors);
        }
    }

    // === ERROR ARCHIVING ===
    archiveError(index) {
        if (index < 0 || index >= this.errors.length) {
            this.showNotification('Fehler-Index ungültig', 'error');
            return;
        }

        const error = this.errors[index];
        
        // Manuell archivieren (unabhängig von autoArchive Einstellung)
        const archiveError = {
            ...error,
            archivedAt: new Date().toISOString(),
            id: Date.now() + Math.random(),
            isLive: error.isLive || false,
            isServerBuffered: error.isServerBuffered || false,
            sessionToken: this.currentSession?.token,
            manuallyArchived: true // Kennzeichnung für manuelle Archivierung
        };
        
        this.archiveData.unshift(archiveError);
        this.saveArchive();
        
        // Entferne den Fehler aus der Live-Liste
        this.errors.splice(index, 1);
        this.displayErrors(this.errors);
        this.updateStats();
        
        this.showNotification('Fehler archiviert', 'success');
        this.playNotificationSound('errorDeleted'); // Verwende den gleichen Sound wie beim Löschen
    }

    archiveExistingErrors() {
        // Archiviere alle aktuellen Live-Fehler beim Session-Load
        if (this.errors.length > 0) {
            console.log(`📁 Archiviere ${this.errors.length} bestehende Fehler bei Session-Load`);
            
            this.errors.forEach(error => {
                const archiveError = {
                    ...error,
                    archivedAt: new Date().toISOString(),
                    id: Date.now() + Math.random(),
                    isLive: error.isLive || false,
                    isServerBuffered: error.isServerBuffered || false,
                    sessionToken: this.currentSession?.token,
                    autoArchivedOnLoad: true // Kennzeichnung für automatische Archivierung beim Session-Load
                };
                
                this.archiveData.unshift(archiveError);
            });
            
            // Speichere das Archiv
            this.saveArchive();
            
            // Leere die Live-Fehler-Liste
            this.errors = [];
            
            this.showNotification(`${this.archiveData.length} bestehende Fehler archiviert`, 'info');
        }
    }

    showBufferedNotification(count, oldestErrorTime) {
        // Sound und Benachrichtigung für gepufferte Fehler
        this.playNotificationSound('bufferedErrors');
        this.showEventNotification('bufferedErrors', `${count} Fehler in Abwesenheit empfangen`);
        
        const oldestTime = oldestErrorTime ? 
            new Date(oldestErrorTime).toLocaleString('de-DE') : 
            'unbekannt';
            
        const notification = document.createElement('div');
        notification.className = 'buffered-notification';
        notification.innerHTML = `
            <div class="notification-header">
                <span class="notification-icon">📦</span>
                <strong>Fehler in Abwesenheit empfangen!</strong>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
            </div>
            <div class="notification-body">
                <p>${count} Fehler wurden empfangen während kein Client verbunden war.</p>
                <small>Ältester Fehler: ${oldestTime}</small>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: 400px;
            background: var(--background-card);
            border: 2px solid var(--warning);
            border-radius: 1rem;
            padding: 1rem;
            color: var(--text-primary);
            z-index: 1001;
            animation: slideInRight 0.3s ease;
            backdrop-filter: blur(20px);
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 10000);
    }

    showNotification(message, type = 'info') {
        // Simple notification system
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: var(--background-card);
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
            color: var(--text-primary);
            z-index: 1001;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
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

    // === NEUE FUNKTIONEN ===
    
    // Push-Benachrichtigungen initialisieren
    initPushNotifications() {
        // Kurz warten bis DOM vollständig geladen ist
        setTimeout(() => {
            this.updatePushPermissionStatus();
        }, 100);
    }
    
    // Push-Berechtigung prüfen und Status aktualisieren
    updatePushPermissionStatus() {
        const statusElement = document.getElementById('pushStatus');
        const buttonElement = document.getElementById('requestPushPermission');
        
        if (!statusElement || !buttonElement) {
            console.error('Push-Elemente nicht gefunden im DOM');
            return;
        }
        
        if (!('Notification' in window)) {
            statusElement.textContent = 'Browser unterstützt keine Push-Benachrichtigungen';
            statusElement.className = 'push-status denied';
            return;
        }
        
        const permission = Notification.permission;
        
        switch (permission) {
            case 'granted':
                statusElement.textContent = '✅ Berechtigung erteilt';
                statusElement.className = 'push-status granted';
                buttonElement.style.display = 'none';
                break;
            case 'denied':
                statusElement.textContent = '❌ Berechtigung verweigert';
                statusElement.className = 'push-status denied';
                buttonElement.textContent = '🔧 Berechtigung zurücksetzen';
                buttonElement.style.display = 'inline-block';
                buttonElement.onclick = () => this.showPermissionResetInstructions();
                
                // Zusätzlichen Button für erneuten Versuch hinzufügen
                let retryButton = document.getElementById('retryPushPermission');
                if (!retryButton) {
                    retryButton = document.createElement('button');
                    retryButton.id = 'retryPushPermission';
                    retryButton.className = 'btn btn-outline';
                    retryButton.style.marginLeft = '0.5rem';
                    retryButton.textContent = '🔔 Berechtigung anfordern';
                    retryButton.onclick = () => this.requestPushPermission();
                    buttonElement.parentNode.appendChild(retryButton);
                }
                break;
            case 'default':
                statusElement.textContent = '⚠️ Berechtigung erforderlich';
                statusElement.className = 'push-status default';
                buttonElement.textContent = '🔔 Berechtigung anfordern';
                buttonElement.style.display = 'inline-block';
                buttonElement.onclick = () => this.requestPushPermission();
                break;
        }
    }
    
    // Push-Berechtigung anfordern
    async requestPushPermission() {
        try {
            const permission = await Notification.requestPermission();
            this.updatePushPermissionStatus();
            
            if (permission === 'granted') {
                this.showNotification('Push-Benachrichtigungen aktiviert!', 'success');
            } else if (permission === 'denied') {
                this.showNotification('Push-Benachrichtigungen wurden abgelehnt', 'warning');
            }
        } catch (error) {
            console.error('Fehler beim Anfordern der Push-Berechtigung:', error);
            this.showNotification('Fehler beim Anfordern der Berechtigung', 'error');
        }
    }
    
    // Anleitung zum Zurücksetzen der Berechtigung
    showPermissionResetInstructions() {
        const instructions = `
So können Sie Push-Benachrichtigungen aktivieren:

🔧 Chrome/Edge:
METHODE 1 - Über die Adressleiste:
1. Klicken Sie auf das Schloss-Symbol (🔒) in der Adressleiste
2. Klicken Sie bei "Benachrichtigungen" auf "Blockiert"
3. Wählen Sie "Zulassen" aus
4. Laden Sie die Seite neu (F5)

METHODE 2 - Falls "Blockiert, um deine Privatsphäre zu schützen":
1. Öffnen Sie Chrome-Einstellungen (chrome://settings/)
2. Gehen Sie zu "Datenschutz und Sicherheit" > "Website-Einstellungen"
3. Klicken Sie auf "Benachrichtigungen" 
4. Fügen Sie diese Website zu "Zulassen" hinzu
5. Laden Sie die Seite neu (F5)

🦊 Firefox:
1. Klicken Sie auf das Schild-Symbol in der Adressleiste
2. Klicken Sie auf "Berechtigung entfernen"
3. Laden Sie die Seite neu und erlauben Sie Benachrichtigungen

🍎 Safari:
1. Safari > Einstellungen > Websites > Benachrichtigungen
2. Entfernen Sie diese Website aus der Liste
3. Laden Sie die Seite neu

💡 TIPP: Nach dem Zurücksetzen laden Sie die Seite neu und klicken Sie auf "Zulassen" wenn die Berechtigung angefragt wird.
        `;
        
        this.showInstructionModal('Push-Benachrichtigungen aktivieren', instructions);
    }
    
    // Modal speziell für Anleitungen (ohne Kopieren-Button)
    showInstructionModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'data-modal';
        modal.innerHTML = `
            <div class="data-modal-content">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3>${this.escapeHtml(title)}</h3>
                    <button class="btn btn-outline" onclick="this.closest('.data-modal').remove()">✕ Schließen</button>
                </div>
                <div class="data-display" style="white-space: pre-wrap;">${this.escapeHtml(content)}</div>
            </div>
        `;
        
        // Schließen bei Klick außerhalb
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        document.body.appendChild(modal);
    }
    
    // Push-Benachrichtigung senden
    sendPushNotification(title, body, icon = '/favicon.ico') {
        if (Notification.permission !== 'granted') return;
        
        try {
            const notification = new Notification(title, {
                body: body,
                icon: icon,
                badge: '/favicon.ico',
                tag: 'error-display',
                requireInteraction: false,
                silent: false
            });
            
            // Benachrichtigung nach 5 Sekunden automatisch schließen
            setTimeout(() => {
                notification.close();
            }, 5000);
            
            // Klick-Handler für Fokus auf Fenster
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            
        } catch (error) {
            console.error('Fehler beim Senden der Push-Benachrichtigung:', error);
        }
    }
    
    // Einstellungen laden und anwenden
    loadAndApplySettings() {
        // Form-Felder mit aktuellen Einstellungen befüllen
        document.getElementById('archiveRetentionDays').value = this.settings.archiveRetentionDays;
        document.getElementById('retentionValue').textContent = this.settings.archiveRetentionDays;
        document.getElementById('maxArchiveItems').value = this.settings.maxArchiveItems;
        document.getElementById('maxItemsValue').textContent = this.settings.maxArchiveItems;
        document.getElementById('autoArchive').checked = this.settings.autoArchive;
        document.getElementById('bufferOfflineErrors').checked = this.settings.bufferOfflineErrors;
        document.getElementById('showDeleteConfirmation').checked = this.settings.showDeleteConfirmation;
        
        // Sound-Einstellungen
        document.getElementById('enableSounds').checked = this.settings.enableSounds;
        document.getElementById('notifyNewError').checked = this.settings.notifyNewError;
        document.getElementById('soundNewError').checked = this.settings.soundNewError;
        document.getElementById('pushNewError').checked = this.settings.pushNewError;
        document.getElementById('notifyConnectionSuccess').checked = this.settings.notifyConnectionSuccess;
        document.getElementById('soundConnectionSuccess').checked = this.settings.soundConnectionSuccess;
        document.getElementById('pushConnectionSuccess').checked = this.settings.pushConnectionSuccess;
        document.getElementById('notifyConnectionClosed').checked = this.settings.notifyConnectionClosed;
        document.getElementById('soundConnectionClosed').checked = this.settings.soundConnectionClosed;
        document.getElementById('pushConnectionClosed').checked = this.settings.pushConnectionClosed;
        document.getElementById('notifyBufferedErrors').checked = this.settings.notifyBufferedErrors;
        document.getElementById('soundBufferedErrors').checked = this.settings.soundBufferedErrors;
        document.getElementById('pushBufferedErrors').checked = this.settings.pushBufferedErrors;
        document.getElementById('soundErrorDeleted').checked = this.settings.soundErrorDeleted;
        
        // Sound-Manager konfigurieren
        if (window.soundManager) {
            window.soundManager.setEnabled(this.settings.enableSounds);
        }
        
        // Push-Benachrichtigungen initialisieren
        this.initPushNotifications();
    }
    
    // Alle LocalStorage Daten anzeigen
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
    
    // Alle Daten löschen mit Sicherheitsabfrage
    deleteAllData() {
        const confirmText = 'ALLE DATEN LÖSCHEN';
        const userInput = prompt(`Warnung: Diese Aktion löscht ALLE gespeicherten Daten unwiderruflich!\n\nGeben Sie "${confirmText}" ein, um fortzufahren:`);
        
        if (userInput === confirmText) {
            // Alle errorDisplay-bezogenen Daten löschen
            const keysToDelete = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('errorDisplay')) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => localStorage.removeItem(key));
            
            // UI zurücksetzen
            this.archiveData = [];
            this.errors = [];
            this.settings = this.loadSettings();
            this.updateStorageStats();
            this.displayErrors([]);
            
            this.showNotification('Alle Daten wurden gelöscht', 'success');
        } else if (userInput !== null) {
            this.showNotification('Löschvorgang abgebrochen', 'warning');
        }
    }
    
    // Modal für Datenanzeige
    showDataModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'data-modal';
        modal.innerHTML = `
            <div class="data-modal-content">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3>${title}</h3>
                    <button class="btn btn-outline" onclick="this.closest('.data-modal').remove()">✕ Schließen</button>
                </div>
                <div class="data-display">${content}</div>
                <div style="margin-top: 1rem;">
                    <button class="btn btn-outline" onclick="navigator.clipboard.writeText(\`${content.replace(/`/g, '\\`')}\`).then(() => window.errorDisplay.showNotification('In Zwischenablage kopiert', 'success'))">📋 Kopieren</button>
                </div>
            </div>
        `;
        
        // Schließen bei Klick außerhalb
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        document.body.appendChild(modal);
    }
    
    // Sound-Test-Funktion
    testSound(eventType) {
        if (!window.soundManager) return;
        
        // Standard-Sound-Typen verwenden
        const soundTypes = {
            newError: 'notification',
            connectionSuccess: 'success',
            connectionClosed: 'disconnect',
            bufferedErrors: 'chime',
            errorDeleted: 'delete'
        };
        
        const soundType = soundTypes[eventType];
        if (soundType) {
            window.soundManager.playSound(soundType);
        }
    }
    
    // Sound-Events
    playNotificationSound(eventType) {
        console.log(`🔊 playNotificationSound called with: ${eventType}`);
        console.log(`🔊 enableSounds: ${this.settings.enableSounds}`);
        console.log(`🔊 soundManager exists: ${!!window.soundManager}`);
        
        if (!this.settings.enableSounds || !window.soundManager) {
            console.log(`🔊 Sound blocked - enableSounds: ${this.settings.enableSounds}, soundManager: ${!!window.soundManager}`);
            return;
        }
        
        const eventSettings = {
            newError: { enabled: this.settings.soundNewError },
            connectionSuccess: { enabled: this.settings.soundConnectionSuccess },
            connectionClosed: { enabled: this.settings.soundConnectionClosed },
            bufferedErrors: { enabled: this.settings.soundBufferedErrors },
            errorDeleted: { enabled: this.settings.soundErrorDeleted }
        };
        
        const setting = eventSettings[eventType];
        console.log(`🔊 Event setting for ${eventType}:`, setting);
        
        if (setting && setting.enabled) {
            const soundTypes = {
                newError: 'notification',
                connectionSuccess: 'success',
                connectionClosed: 'disconnect',
                bufferedErrors: 'chime',
                errorDeleted: 'delete'
            };
            
            const soundType = soundTypes[eventType];
            console.log(`🔊 Playing sound: ${soundType}`);
            window.soundManager.playSound(soundType);
        } else {
            console.log(`🔊 Sound not enabled for event: ${eventType}`);
        }
    }
    
    // Benachrichtigungen anzeigen
    showEventNotification(eventType, message) {
        const eventSettings = {
            newError: { enabled: this.settings.notifyNewError, pushEnabled: this.settings.pushNewError },
            connectionSuccess: { enabled: this.settings.notifyConnectionSuccess, pushEnabled: this.settings.pushConnectionSuccess },
            connectionClosed: { enabled: this.settings.notifyConnectionClosed, pushEnabled: this.settings.pushConnectionClosed },
            bufferedErrors: { enabled: this.settings.notifyBufferedErrors, pushEnabled: false } // Keine Push-Benachrichtigung für gepufferte Fehler
        };
        
        const setting = eventSettings[eventType];
        if (setting) {
            // Website-Benachrichtigung
            if (setting.enabled) {
                this.showNotification(message, eventType === 'connectionClosed' ? 'warning' : 'success');
            }
            
            // Push-Benachrichtigung nur wenn Browser nicht aktiv ist (außer bei gepufferten Fehlern)
            if (setting.pushEnabled && (eventType === 'newError' || document.hidden)) {
                const titles = {
                    newError: 'Neuer Fehler',
                    connectionSuccess: 'Verbindung hergestellt',
                    connectionClosed: 'Verbindung getrennt',
                    bufferedErrors: 'Gepufferte Fehler'
                };
                
                this.sendPushNotification(titles[eventType], message);
            }
        }
    }

    // === SESSION MANAGEMENT ===
    loadCurrentSession() {
        const sessionData = localStorage.getItem('currentSession');
        if (sessionData) {
            try {
                const session = JSON.parse(sessionData);
                
                // Update lastAccessed for session persistence
                const now = Date.now();
                const lastAccessed = new Date(session.lastAccessed || session.createdAt || now);
                const timeSinceLastAccess = now - lastAccessed.getTime();
                const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
                
                // Only check age if session hasn't been accessed recently
                if (timeSinceLastAccess > maxAge && session.createdAt) {
                    console.log('🕐 Session older than 24 hours since last access, removing from localStorage');
                    localStorage.removeItem('currentSession');
                    this.showNotification('Session abgelaufen (24h inaktiv) - neue Session erforderlich', 'warning');
                    return;
                }
                
                // Only load unsaved sessions from localStorage
                if (!session.isSaved) {
                    // Update lastAccessed timestamp
                    session.lastAccessed = new Date().toISOString();
                    this.currentSession = session;
                    
                    // Save updated session back to localStorage
                    localStorage.setItem('currentSession', JSON.stringify(this.currentSession));
                    
                    console.log('📂 Loaded unsaved session from localStorage:', {
                        name: this.currentSession.name,
                        tokenPreview: this.currentSession.token?.substring(0, 16) + '...',
                        lastAccessed: this.currentSession.lastAccessed
                    });
                    this.updateSessionDisplay();
                    
                    // Validate session token with server
                    this.validateSessionToken();
                } else {
                    // Saved sessions should not be in localStorage
                    console.log('🧹 Removing saved session from localStorage (should be server-side only)');
                    localStorage.removeItem('currentSession');
                }
            } catch (error) {
                console.error('Failed to load session data:', error);
                localStorage.removeItem('currentSession');
                this.showNotification('Fehlerhafte Session-Daten entfernt', 'warning');
            }
        } else {
            console.log('📂 No session found in localStorage');
        }
    }
    
    getStoredSavedSession(token) {
        const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
        return savedSessions.find(session => session.token === token);
    }
    
    checkForRecoverableSessions() {
        const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
        if (savedSessions.length > 0) {
            console.log(`🔍 Found ${savedSessions.length} saved sessions that could be restored`);
            setTimeout(() => {
                this.showNotification(`${savedSessions.length} gespeicherte Session(s) verfügbar - Session Manager öffnen zum Wiederherstellen`, 'info');
            }, 2000);
        }
    }
    
    async validateSessionToken() {
        if (!this.currentSession?.token) return;
        
        try {
            const response = await fetch(`${this.serverUrl}/api/session/${this.currentSession.token}`);
            if (!response.ok) {
                console.warn('❌ Session token validation failed, clearing session');
                this.showNotification('Session ungültig - neue Session wird erstellt', 'warning');
                this.clearSession();
                
                // Automatically create a new session
                setTimeout(() => {
                    this.createNewSessionInline();
                }, 1000);
            } else {
                console.log('✅ Session token validated successfully');
            }
        } catch (error) {
            console.warn('⚠️ Could not validate session token:', error);
            // Don't clear session if server is unreachable, but show warning
            this.showNotification('Verbindung zum Server nicht möglich - Session-Status unbekannt', 'warning');
        }
    }

    async createNewSession() {
        try {
            const response = await fetch(`${this.serverUrl}/api/token`);
            if (response.ok) {
                const data = await response.json();
                this.currentSession = {
                    name: data.session.name,
                    token: data.token,
                    createdAt: data.session.createdAt,
                    lastModified: data.session.lastModified,
                    modifiedBy: data.session.modifiedBy,
                    errorCount: data.session.errorCount,
                    hasPassword: data.session.hasPassword,
                    isSaved: false // New sessions are not saved initially
                };
                localStorage.setItem('currentSession', JSON.stringify(this.currentSession));
                this.updateSessionDisplay();
                
                // Connect to SSE with new session token
                this.disconnectSSE();
                this.connectSSE();
                
                console.log('✅ New session created:', {
                    name: this.currentSession.name,
                    token: this.currentSession.token.substring(0, 16) + '...'
                });
                return this.currentSession;
            } else {
                console.error('Failed to create session:', response.status);
                this.showNotification('Fehler beim Erstellen der Session', 'error');
            }
        } catch (error) {
            console.error('Failed to create session:', error);
            this.showNotification('Verbindungsfehler beim Erstellen der Session', 'error');
        }
        return null;
    }

    restoreSession(sessionData) {
        this.currentSession = sessionData;
        localStorage.setItem('currentSession', JSON.stringify(this.currentSession));
        this.updateSessionDisplay();
    }

    clearSession() {
        this.currentSession = null;
        localStorage.removeItem('currentSession');
        this.updateSessionDisplay();
    }

    updateSessionDisplay() {
        const sessionBar = document.getElementById('sessionBar');
        const sessionName = document.getElementById('sessionName');
        const sessionToken = document.getElementById('sessionToken');
        
        // Header session info elements
        const headerSession = document.getElementById('headerSession');
        const sessionNameHeader = document.getElementById('sessionNameHeader');
        const sessionTokenHeader = document.getElementById('sessionTokenHeader');
        const autoSaveToggle = document.getElementById('autoSaveToggle');
        
        console.log('🔄 Updating session display:', {
            hasSession: !!this.currentSession,
            sessionName: this.currentSession?.name,
            tokenPreview: this.currentSession?.token?.substring(0, 16) + '...',
            isSessionSaved: this.isSessionSaved()
        });
        
        if (this.currentSession) {
            const sessionNameText = this.currentSession.name || 'Unbenannte Session';
            const tokenPreview = this.currentSession.token.substring(0, 16) + '...';
            
            // Check if session is saved to determine display location
            if (this.isSessionSaved()) {
                // Show in header permanently for saved sessions
                sessionBar.style.display = 'none';
                headerSession.style.display = 'flex';
                sessionNameHeader.textContent = sessionNameText;
                sessionTokenHeader.textContent = tokenPreview;
                
                // Show auto-save toggle for saved sessions
                if (autoSaveToggle) {
                    autoSaveToggle.style.display = 'flex';
                }
            } else {
                // Show session bar with hide option for unsaved sessions
                sessionBar.style.display = 'flex';
                headerSession.style.display = 'none';
                sessionName.textContent = sessionNameText;
                sessionToken.textContent = tokenPreview;
                
                // Hide auto-save toggle for unsaved sessions
                if (autoSaveToggle) {
                    autoSaveToggle.style.display = 'none';
                }
            }            // Also update the header controls to show session status
            this.updateHeaderSessionStatus(true);
        } else {
            sessionBar.style.display = 'none';
            headerSession.style.display = 'none';
            if (autoSaveToggle) {
                autoSaveToggle.style.display = 'none';
            }
            this.updateHeaderSessionStatus(false);
        }
        
        // Update unsaved changes indicator
        this.updateUnsavedChangesIndicator();
    }
    
    isSessionSaved() {
        if (!this.currentSession) return false;
        // Check if session is marked as saved (server-side only)
        return this.currentSession.isSaved === true;
    }
    
    saveCurrentSessionToStorage() {
        if (!this.currentSession) return;
        
        // Update last accessed time for unsaved sessions
        if (!this.currentSession.isSaved) {
            this.currentSession.lastAccessed = new Date().toISOString();
            // Only save unsaved sessions to localStorage
            localStorage.setItem('currentSession', JSON.stringify(this.currentSession));
        }
        // Saved sessions are not stored in localStorage - they exist only server-side
    }
    
    endCurrentSession() {
        this.clearSession();
        this.showNotification('Session beendet', 'info');
    }
    
    updateHeaderSessionStatus(hasSession) {
        const sessionBtn = document.getElementById('sessionBtn');
        if (sessionBtn) {
            if (hasSession) {
                sessionBtn.innerHTML = '🔑 Session ✅';
                sessionBtn.classList.add('session-active');
            } else {
                sessionBtn.innerHTML = '🔑 Session';
                sessionBtn.classList.remove('session-active');
            }
        }
    }

    openSessionManager() {
        this.switchMode('session-manager');
    }

    copySessionToken() {
        if (this.currentSession && this.currentSession.token) {
            // Check if clipboard API is available
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(this.currentSession.token).then(() => {
                    this.showNotification('Session-Token kopiert!', 'success');
                }).catch(err => {
                    console.error('Failed to copy token:', err);
                    this.fallbackCopyToClipboard(this.currentSession.token);
                });
            } else {
                this.fallbackCopyToClipboard(this.currentSession.token);
            }
        }
    }

    fallbackCopyToClipboard(text) {
        // Fallback method for older browsers or insecure contexts
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showNotification('Session-Token kopiert!', 'success');
        } catch (err) {
            console.error('Fallback copy failed:', err);
            this.showNotification('Kopieren fehlgeschlagen. Token: ' + text, 'error');
        }
        
        document.body.removeChild(textArea);
    }

    // Override error reporting to include session token
    async reportError(message, source = 'manual', level = 'error') {
        if (!this.currentSession) {
            this.showNotification('Keine aktive Session - Error kann nicht gesendet werden', 'error');
            return false;
        }

        const error = {
            message: message,
            timestamp: new Date().toISOString(),
            source: source,
            level: level,
            sessionToken: this.currentSession.token
        };

        try {
            const response = await fetch(`${this.serverUrl}/error`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-session-token': this.currentSession.token
                },
                body: JSON.stringify(error)
            });

            if (response.ok) {
                console.log('✅ Error sent to server');
                return true;
            } else if (response.status === 400 || response.status === 401) {
                const errorData = await response.json();
                console.error('❌ Session error:', errorData.error);
                this.showNotification(`Error: ${errorData.error}`, 'error');
                return false;
            } else {
                console.error('❌ Failed to send error to server:', response.status);
                return false;
            }
        } catch (err) {
            console.error('❌ Error sending to server:', err);
            return false;
        }
    }

    saveCurrentSession() {
        if (this.currentSession) {
            // Show modal for save options including password
            this.showSaveSessionModal();
        } else {
            this.showNotification('Keine aktive Session zum Speichern', 'warning');
        }
    }
    
    showSaveSessionModal() {
        // Create modal for save session options
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>📁 Session speichern</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="input-group">
                        <label>Session Name</label>
                        <input type="text" id="saveSessionName" value="${this.currentSession.name}" class="session-input">
                    </div>
                    <div class="input-group">
                        <label>Passwort für gespeicherte Session *</label>
                        <input type="password" id="saveSessionPassword" placeholder="Sicheres Passwort eingeben" class="session-input" required>
                        <small class="input-hint">� Passwort ist erforderlich (min. 4 Zeichen)</small>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Abbrechen</button>
                    <button class="btn btn-primary" onclick="window.errorDisplay.confirmSaveSession()">Speichern</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    confirmSaveSession() {
        const name = document.getElementById('saveSessionName').value.trim();
        const password = document.getElementById('saveSessionPassword').value.trim();
        
        if (!name) {
            this.showNotification('Bitte Session Name eingeben', 'warning');
            return;
        }
        
        if (!password) {
            this.showNotification('Passwort ist erforderlich für gespeicherte Sessions', 'warning');
            return;
        }
        
        if (password.length < 4) {
            this.showNotification('Passwort muss mindestens 4 Zeichen lang sein', 'warning');
            return;
        }
        
        // Update current session with new name for server-side saving
        this.currentSession.name = name;
        
        // Save session server-side with password
        this.saveSessionToServer(password).then((success) => {
            if (success) {
                // Clear ALL localStorage data when session is saved
                this.clearLocalStorageForSavedSession();
                
                // Close modal
                document.querySelector('.modal-overlay').remove();
                
                this.showNotification('Session serverseitig gespeichert! Browser-Daten wurden gelöscht.', 'success');
                this.updateSessionDisplay();
                this.markAsSaved(); // Mark as saved and hide unsaved changes indicator
                
                // Refresh session manager if open
                if (this.currentMode === 'session-manager') {
                    this.loadSavedSessionsInline();
                }
            }
        });
    }
    
    async saveSessionToServer(password) {
        try {
            const response = await fetch(`${this.serverUrl}/api/session/${this.currentSession.token}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: this.currentSession.name,
                    password: password || null,
                    archiveData: this.archiveData || []
                })
            });
            
            if (response.ok) {
                // Mark session as saved
                this.currentSession.isSaved = true;
                this.currentSession.hasPassword = !!password;
                return true;
            } else {
                this.showNotification('Fehler beim Speichern der Session', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error saving session:', error);
            this.showNotification('Verbindungsfehler beim Speichern', 'error');
            return false;
        }
    }
    
    clearLocalStorageForSavedSession() {
        // Clear all localStorage data when session becomes server-side only
        localStorage.removeItem('currentSession');
        localStorage.removeItem('savedSessions');
        localStorage.removeItem('errorArchive');
        localStorage.removeItem(`errorArchive_${this.currentSession.token}`);
        
        console.log('🧹 Cleared localStorage - session is now server-side only');
    }

    showSessionRequiredMessage() {
        const errorsContainer = document.getElementById('errorsContainer');
        if (errorsContainer) {
            errorsContainer.innerHTML = `
                <div class="session-required">
                    <div class="session-required-content">
                        <h2>🔑 Session erforderlich</h2>
                        <p>Für die Nutzung der Error Display App benötigen Sie eine gültige Session.</p>
                        <div class="session-actions-large">
                            <button class="btn btn-primary" onclick="window.errorDisplay.openSessionManager()">
                                🔑 Session Manager öffnen
                            </button>
                            <button class="btn btn-secondary" onclick="window.errorDisplay.createNewSession().then(() => window.location.reload())">
                                ✨ Neue Session erstellen
                            </button>
                        </div>
                        <div class="session-info-text">
                            <h3>Was ist eine Session?</h3>
                            <p>Eine Session ermöglicht es Ihnen:</p>
                            <ul>
                                <li>🔐 Sichere API-Authentifizierung mit individuellem Token</li>
                                <li>📊 Separate Error-Logs pro Session</li>
                                <li>💾 Session-basierte Datenspeicherung</li>
                                <li>🔄 Session-Wiederherstellung</li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        }

        // Hide controls that require a session
        const controls = document.querySelector('.controls');
        if (controls) {
            const sessionBtn = controls.querySelector('#sessionBtn');
            controls.querySelectorAll('.btn').forEach(btn => {
                if (btn !== sessionBtn) {
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                }
            });
        }
    }

    // Override session methods to reload page after session changes
    async createNewSession() {
        const session = await super.createNewSession?.() || await this.createNewSessionInternal();
        if (session) {
            window.location.reload();
        }
        return session;
    }

    async createNewSessionInternal() {
        try {
            const response = await fetch(`${this.serverUrl}/api/token`);
            if (response.ok) {
                const data = await response.json();
                this.currentSession = {
                    name: data.sessionName,
                    token: data.token,
                    created: new Date().toISOString()
                };
                localStorage.setItem('currentSession', JSON.stringify(this.currentSession));
                this.updateSessionDisplay();
                return this.currentSession;
            }
        } catch (error) {
            console.error('Failed to create session:', error);
        }
        return null;
    }

    restoreSession(sessionData) {
        this.currentSession = sessionData;
        localStorage.setItem('currentSession', JSON.stringify(this.currentSession));
        this.updateSessionDisplay();
        window.location.reload(); // Reload to reinitialize with session
    }

    clearSession() {
        this.currentSession = null;
        localStorage.removeItem('currentSession');
        this.updateSessionDisplay();
        window.location.reload(); // Reload to show session required message
    }
    
    onSessionLoaded() {
        // Called when a session is loaded (created or restored)
        // This unlocks all tabs and starts SSE connection
        console.log('🎯 Session loaded globally, enabling full app functionality');
        
        // Hide session required message if visible
        const errorsContainer = document.getElementById('errorsContainer');
        if (errorsContainer && errorsContainer.querySelector('.session-required')) {
            errorsContainer.innerHTML = '';
        }
        
        // Archiviere alle aktuellen Live-Fehler beim Session-Load
        this.archiveExistingErrors();
        
        // Load session-specific archive if available
        this.loadSessionArchive();
        
        // Connect SSE if not already connected
        if (!this.eventSource || this.eventSource.readyState !== EventSource.OPEN) {
            this.connectSSE();
        }
        
        // Switch to live mode to show the app is now functional
        this.displayMode('live');
        
        // Update all UI elements
        this.updateStats();
        this.updateSessionDisplay();
        
        // Enable all controls that were disabled
        const controls = document.querySelector('.controls');
        if (controls) {
            controls.querySelectorAll('.btn').forEach(btn => {
                btn.disabled = false;
                btn.style.opacity = '1';
            });
        }
        
        // Force a complete UI refresh
        setTimeout(() => {
            this.displayMode(this.currentMode);
        }, 100);
    }
    
    async loadSessionArchive() {
        // Check if restored session has archived data
        const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
        const savedSession = savedSessions.find(s => s.token === this.currentSession.token);
        
        if (savedSession && savedSession.archiveData) {
            console.log('📂 Loading session-specific archive data');
            this.archiveData = savedSession.archiveData;
        } else {
            // Initialize empty archive for new session
            this.archiveData = [];
        }
        
        // Store in localStorage with session-specific key
        localStorage.setItem(`archive_${this.currentSession.token}`, JSON.stringify(this.archiveData));
    }

    async createNewSessionInline() {
        try {
            const name = document.getElementById('newSessionName').value.trim();
            const saveLocally = document.getElementById('saveSessionLocally').checked;
            
            const requestData = {};
            if (name) requestData.name = name;
            // No password field - sessions are created without password protection
            
            // Use POST for new API with name support
            const response = await fetch(`${this.serverUrl}/api/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            if (response.ok) {
                const data = await response.json();
                this.currentSession = {
                    name: data.session.name,
                    token: data.token,
                    createdAt: data.session.createdAt || new Date().toISOString(),
                    lastModified: data.session.lastModified,
                    modifiedBy: data.session.modifiedBy,
                    hasPassword: data.session.hasPassword,
                    isSaved: false, // Mark as unsaved
                    lastAccessed: new Date().toISOString()
                };
                
                // Save to last sessions if checkbox is checked
                if (saveLocally) {
                    this.saveToLastSessions(this.currentSession);
                    this.setLastActiveSession(this.currentSession.token);
                }
                
                // Only save unsaved sessions to localStorage
                this.saveCurrentSessionToStorage();
                this.updateSessionDisplay();
                this.showNotification(saveLocally ? 'Session erstellt und gespeichert' : 'Session erstellt', 'success');
                
                // Clear input fields
                document.getElementById('newSessionName').value = '';
                
                // Update current session display in session manager
                this.updateCurrentSessionCard();
                
                // Global session load - unlock tabs and connect
                this.onSessionLoaded();
                
                return this.currentSession;
            } else {
                const errorData = await response.json();
                this.showNotification(`Fehler: ${errorData.error}`, 'error');
            }
        } catch (error) {
            console.error('Failed to create session:', error);
            this.showNotification('Fehler beim Erstellen der Session', 'error');
        }
        return null;
    }

    async restoreSessionFromToken() {
        const token = document.getElementById('sessionTokenInput').value.trim();
        const password = document.getElementById('sessionPasswordInput').value;
        
        if (!token) {
            this.showNotification('Bitte geben Sie einen Session Token ein', 'warning');
            return;
        }

        try {
            // Try POST first with password
            let response = await fetch(`${this.serverUrl}/api/session/${token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });
            
            let data = await response.json();
            
            // If POST fails with 401 and password required, show specific error
            if (!response.ok && response.status === 401 && data.requiresPassword) {
                if (!password) {
                    this.showNotification('Diese Session ist passwortgeschützt. Bitte Passwort eingeben.', 'warning');
                } else {
                    this.showNotification('Falsches Passwort!', 'error');
                }
                return;
            }
            
            // If POST fails, try GET for backwards compatibility (only for non-protected sessions)
            if (!response.ok) {
                response = await fetch(`${this.serverUrl}/api/session/${token}`);
                data = await response.json();
                
                if (!response.ok && response.status === 401 && data.requiresPassword) {
                    this.showNotification('Diese Session ist passwortgeschützt. Bitte Passwort eingeben.', 'warning');
                    return;
                }
            }
            
            if (data.success) {
                this.currentSession = {
                    name: data.session.name,
                    token: token,
                    createdAt: data.session.createdAt || data.session.created,
                    lastModified: data.session.lastModified,
                    modifiedBy: data.session.modifiedBy,
                    hasPassword: data.session.hasPassword
                };
                localStorage.setItem('currentSession', JSON.stringify(this.currentSession));
                this.updateSessionDisplay();
                this.showNotification(`Session "${data.session.name}" erfolgreich geladen!`, 'success');
                
                // Clear input fields
                document.getElementById('sessionTokenInput').value = '';
                document.getElementById('sessionPasswordInput').value = '';
                
                this.updateCurrentSessionCard();
                
                // Global session load - unlock tabs and connect
                this.onSessionLoaded();
            } else {
                this.showNotification(`Fehler: ${data.error}`, 'error');
            }
        } catch (error) {
            console.error('Error restoring session:', error);
            this.showNotification('Verbindungsfehler beim Laden der Session', 'error');
        }
    }

    updateCurrentSessionCard() {
        const currentSessionCard = document.getElementById('currentSessionCard');
        if (!currentSessionCard) return;

        if (this.currentSession) {
            currentSessionCard.style.display = 'block';
            currentSessionCard.innerHTML = `
                <div class="session-card current-session">
                    <h2>🟢 Aktuelle Session</h2>
                    <div class="session-details">
                        <div class="session-detail">
                            <label>Name:</label>
                            <span>${this.currentSession.name}</span>
                        </div>
                        <div class="session-detail">
                            <label>Token:</label>
                            <code class="token-display">${this.currentSession.token}</code>
                            <button class="btn btn-small" onclick="window.errorDisplay.copySessionToken()">📋</button>
                        </div>
                        <div class="session-detail">
                            <label>Erstellt:</label>
                            <span>${new Date(this.currentSession.created).toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="session-actions">
                        <button class="btn btn-success" onclick="window.errorDisplay.switchMode('live')">
                            📡 Zu Live-View
                        </button>
                        ${this.currentSession.isSaved ? 
                            `<button class="btn btn-warning" onclick="window.errorDisplay.confirmDeleteCurrentSession()">
                                🗑️ Session löschen
                            </button>` : ''
                        }
                        <button class="btn btn-danger" onclick="window.errorDisplay.clearSession()">
                            ${this.currentSession.isSaved ? '🔚 Session beenden' : '❌ Session beenden'}
                        </button>
                    </div>
                </div>
            `;
        } else {
            currentSessionCard.style.display = 'none';
        }
    }

    async loadSavedSessionsInline() {
        const container = document.getElementById('inlineSavedSessions');
        if (!container) return;

        // Load saved sessions from server instead of localStorage
        try {
            const response = await fetch(`${this.serverUrl}/api/sessions/saved`);
            if (!response.ok) {
                container.innerHTML = '<p class="no-sessions">Fehler beim Laden der Sessions</p>';
                return;
            }
            
            const data = await response.json();
            const savedSessions = data.sessions || [];
            
            if (savedSessions.length === 0) {
                container.innerHTML = '<p class="no-sessions">Keine Sessions gespeichert</p>';
                return;
            }

            // Sort sessions by last modification date (newest first)
            savedSessions.sort((a, b) => new Date(b.savedAt || b.lastModified) - new Date(a.savedAt || a.lastModified));

            container.innerHTML = savedSessions.map(session => {
                const createdDate = new Date(session.createdAt || session.created);
                const savedDate = new Date(session.savedAt || session.lastModified);
                const modifiedDate = session.lastModified ? new Date(session.lastModified) : null;
                
                return `
                    <div class="saved-session-item">
                        <div class="saved-session-info">
                            <div class="session-name">
                                ${session.name}
                                <span class="password-icon" title="Passwortgeschützt">🔒</span>
                            </div>
                            <div class="session-meta">
                                <div class="session-dates">
                                    <div><strong>Erstellt:</strong> ${createdDate.toLocaleDateString('de-DE')} ${createdDate.toLocaleTimeString('de-DE')}</div>
                                    <div><strong>Gespeichert:</strong> ${savedDate.toLocaleDateString('de-DE')} ${savedDate.toLocaleTimeString('de-DE')}</div>
                                    ${modifiedDate ? `<div><strong>Letzte Änderung:</strong> ${modifiedDate.toLocaleDateString('de-DE')} ${modifiedDate.toLocaleTimeString('de-DE')} (${session.modifiedBy || 'System'})</div>` : ''}
                                </div>
                            </div>
                            <code class="session-token-preview">${session.token.substring(0, 16)}...</code>
                        </div>
                        <div class="saved-session-actions">
                            <button class="btn btn-small btn-primary" onclick="window.errorDisplay.restoreSessionFromSaved('${session.token}', true)">
                                🔄 Laden
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading saved sessions:', error);
            container.innerHTML = '<p class="no-sessions">Verbindungsfehler beim Laden der Sessions</p>';
        }
    }

    // === LAST SESSIONS MANAGEMENT ===
    saveToLastSessions(sessionData) {
        const lastSessions = this.getLastSessions();
        
        // Check if session already exists
        const existingIndex = lastSessions.findIndex(s => s.token === sessionData.token);
        
        const lastSession = {
            token: sessionData.token,
            name: sessionData.name,
            createdAt: sessionData.createdAt,
            lastAccessed: new Date().toISOString(),
            hasPassword: sessionData.hasPassword,
            lastActive: false // Will be set to true when loading
        };
        
        console.log('💾 Debug: saveToLastSessions() called with:', {sessionData, lastSession, existingIndex});
        
        if (existingIndex >= 0) {
            // Update existing session
            lastSessions[existingIndex] = lastSession;
        } else {
            // Add new session
            lastSessions.unshift(lastSession);
        }
        
        // Keep only last 10 sessions
        if (lastSessions.length > 10) {
            lastSessions.splice(10);
        }

        localStorage.setItem('lastSessions', JSON.stringify(lastSessions));
        console.log('✅ Debug: Saved to localStorage:', lastSessions);
    }    getLastSessions() {
        const stored = localStorage.getItem('lastSessions');
        const sessions = stored ? JSON.parse(stored) : [];
        console.log('🔍 Debug: getLastSessions() returned:', sessions);
        return sessions;
    }
    
    setLastActiveSession(token) {
        const lastSessions = this.getLastSessions();
        
        // Set all to inactive
        lastSessions.forEach(session => session.lastActive = false);
        
        // Set current session to active
        const currentSession = lastSessions.find(s => s.token === token);
        if (currentSession) {
            currentSession.lastActive = true;
            currentSession.lastAccessed = new Date().toISOString();
        }
        
        localStorage.setItem('lastSessions', JSON.stringify(lastSessions));
    }
    
    async validateAndCleanupLastSessions() {
        const lastSessions = this.getLastSessions();
        const validSessions = [];
        
        for (const session of lastSessions) {
            try {
                // Check if session still exists on server
                const response = await fetch(`${this.serverUrl}/api/session/${session.token}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ password: session.password })
                });
                
                if (response.ok) {
                    validSessions.push(session);
                } else {
                    console.log(`🧹 Removing invalid session from last sessions: ${session.name}`);
                }
            } catch (error) {
                console.log(`🧹 Removing session due to validation error: ${session.name}`);
            }
        }
        
        // Update storage with only valid sessions
        localStorage.setItem('lastSessions', JSON.stringify(validSessions));
        return validSessions;
    }
    
    async loadLastActiveSession() {
        const lastSessions = this.getLastSessions();
        const activeSession = lastSessions.find(s => s.lastActive === true);
        
        if (activeSession) {
            console.log(`🔄 Auto-loading last active session: ${activeSession.name}`);
            try {
                await this.restoreLastSession(activeSession.token);
                return true;
            } catch (error) {
                console.error('Failed to restore last active session:', error);
                // Remove invalid session
                this.removeFromLastSessions(activeSession.token);
            }
        }
        
        return false;
    }
    
    async restoreLastSession(token) {
        try {
            const response = await fetch(`${this.serverUrl}/api/session/${token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password: '' })
            });

            if (response.ok) {
                const data = await response.json();
                this.currentSession = {
                    name: data.session.name,
                    token: data.session.token,
                    createdAt: data.session.createdAt,
                    lastModified: data.session.lastModified,
                    modifiedBy: data.session.modifiedBy,
                    hasPassword: data.session.hasPassword,
                    isSaved: true,
                    lastAccessed: new Date().toISOString()
                };
                
                // Update last sessions
                this.saveToLastSessions(this.currentSession);
                this.setLastActiveSession(token);
                
                this.updateSessionDisplay();
                return true;
            } else {
                throw new Error(`Server error: ${response.status}`);
            }
        } catch (error) {
            console.error('Failed to restore session:', error);
            throw error;
        }
    }
    
    removeFromLastSessions(token) {
        const lastSessions = this.getLastSessions();
        const filtered = lastSessions.filter(s => s.token !== token);
        localStorage.setItem('lastSessions', JSON.stringify(filtered));
    }
    
    async loadLastSessionsInline() {
        console.log('🔄 Debug: loadLastSessionsInline() called');
        try {
            // Validate and cleanup first
            const validSessions = await this.validateAndCleanupLastSessions();
            console.log('✅ Debug: validSessions:', validSessions);
            
            const container = document.getElementById('inlineLastSessions');
            console.log('📦 Debug: container found:', !!container);
            if (!container) return;
            
            if (validSessions.length === 0) {
                container.innerHTML = '<p class="no-sessions">Keine letzten Sessions gefunden</p>';
                return;
            }
            
            let html = '';
            validSessions.forEach(session => {
                const isActive = session.lastActive === true;
                const lastAccessed = new Date(session.lastAccessed).toLocaleString('de-DE');
                
                html += `
                    <div class="session-item ${isActive ? 'active-session' : ''}">
                        <div class="session-item-header">
                            <span class="session-item-name">${this.escapeHtml(session.name)} ${isActive ? '(Aktiv)' : ''}</span>
                            <span class="session-item-date">${lastAccessed}</span>
                        </div>
                        <div class="session-item-token">
                            <code>${session.token.substring(0, 16)}...</code>
                            ${session.hasPassword ? '<span class="password-indicator">🔒</span>' : ''}
                        </div>
                        <div class="session-item-actions">
                            <button class="btn btn-small btn-primary" onclick="errorDisplay.restoreFromLastSessions('${session.token}')">
                                🔄 Laden
                            </button>
                            <button class="btn btn-small btn-danger" onclick="errorDisplay.removeFromLastSessionsAndRefresh('${session.token}')">
                                🗑️
                            </button>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        } catch (error) {
            console.error('Error loading last sessions:', error);
            const container = document.getElementById('inlineLastSessions');
            if (container) {
                container.innerHTML = '<p class="error-state">Fehler beim Laden der letzten Sessions</p>';
            }
        }
    }
    
    async restoreFromLastSessions(token) {
        const lastSessions = this.getLastSessions();
        const session = lastSessions.find(s => s.token === token);
        
        if (session) {
            try {
                await this.restoreLastSession(token);
                this.showNotification(`Session "${session.name}" wiederhergestellt`, 'success');
                this.onSessionLoaded();
                this.loadLastSessionsInline(); // Refresh display
            } catch (error) {
                this.showNotification('Fehler beim Wiederherstellen der Session', 'error');
                this.removeFromLastSessions(token);
                this.loadLastSessionsInline(); // Refresh display
            }
        }
    }
    
    removeFromLastSessionsAndRefresh(token) {
        this.removeFromLastSessions(token);
        this.loadLastSessionsInline();
        this.showNotification('Session aus letzten Sessions entfernt', 'info');
    }

    async restoreSessionFromSaved(token, requirePassword = true) {
        if (requirePassword) {
            // Show password prompt modal for all saved sessions
            this.showPasswordPromptModal(token);
            return;
        }
        
        // This should not be reached anymore since all saved sessions require password
        await this.restoreSessionWithPassword(token, null);
    }
    
    showPasswordPromptModal(token) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>🔒 Passwort erforderlich</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <p>Diese gespeicherte Session ist passwortgeschützt.</p>
                    <div class="input-group">
                        <input type="password" id="savedSessionPassword" placeholder="Passwort eingeben..." class="session-input" onkeypress="if(event.key==='Enter') window.errorDisplay.confirmRestoreWithPassword('${token}')">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Abbrechen</button>
                    <button class="btn btn-primary" onclick="window.errorDisplay.confirmRestoreWithPassword('${token}')">Laden</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Focus password input
        setTimeout(() => document.getElementById('savedSessionPassword').focus(), 100);
    }
    
    async confirmRestoreWithPassword(token) {
        const password = document.getElementById('savedSessionPassword').value;
        
        if (!password) {
            this.showNotification('Bitte Passwort eingeben', 'warning');
            return;
        }
        
        // Close modal
        document.querySelector('.modal-overlay').remove();
        
        // Check if this is the saved password or the session password
        const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
        const savedSession = savedSessions.find(s => s.token === token);
        
        if (savedSession && savedSession.savedPassword) {
            // Check against saved password first
            if (savedSession.savedPassword === password) {
                await this.restoreSessionWithPassword(token, null);
            } else {
                this.showNotification('Falsches Passwort für gespeicherte Session!', 'error');
            }
        } else {
            // Try with session password
            await this.restoreSessionWithPassword(token, password);
        }
    }
    
    async restoreSessionWithPassword(token, password) {
        try {
            // Use POST with password
            const response = await fetch(`${this.serverUrl}/api/session/${token}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentSession = {
                    name: data.session.name,
                    token: token,
                    createdAt: data.session.createdAt || data.session.created,
                    lastModified: data.session.lastModified,
                    modifiedBy: data.session.modifiedBy,
                    hasPassword: data.session.hasPassword,
                    isSaved: true // Mark as saved since it was loaded from server
                };
                
                // DO NOT save restored sessions to localStorage - they are server-side only
                console.log('📂 Restored saved session from server (no localStorage)');
                
                this.updateSessionDisplay();
                this.showNotification(`Session "${data.session.name}" erfolgreich geladen!`, 'success');
                this.updateCurrentSessionCard();
                
                // Restore archived data from server if available
                if (data.session.archive) {
                    console.log('📂 Restoring archived data for session');
                    this.archiveData = data.session.archive;
                }
                
                // Automatically switch to live view and refresh
                this.switchMode('live');
                this.showNotification(`Session "${data.session.name}" geladen - zur Live-Ansicht gewechselt`, 'success');
                
                // Global session load - unlock tabs and connect
                this.onSessionLoaded();
            } else if (response.status === 401) {
                this.showNotification('Falsches Passwort!', 'error');
            } else {
                this.showNotification('Session nicht mehr gültig', 'error');
            }
        } catch (error) {
            console.error('Error restoring session:', error);
            this.showNotification('Verbindungsfehler beim Laden der Session', 'error');
        }
    }

    deleteSavedSession(token) {
        const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
        const filteredSessions = savedSessions.filter(session => session.token !== token);
        localStorage.setItem('savedSessions', JSON.stringify(filteredSessions));
        this.loadSavedSessionsInline();
        this.showNotification('Session aus Speicher entfernt', 'success');
    }

    // Update session activity timestamp
    updateSessionActivity() {
        if (this.currentSession && !this.currentSession.isSaved) {
            this.currentSession.lastAccessed = new Date().toISOString();
            localStorage.setItem('currentSession', JSON.stringify(this.currentSession));
        }
    }

    confirmDeleteCurrentSession() {
        if (!this.currentSession || !this.currentSession.isSaved) {
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>⚠️ Session löschen</h2>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <p><strong>Sind Sie sicher, dass Sie die Session "${this.currentSession.name}" dauerhaft löschen möchten?</strong></p>
                    <p>⚠️ Diese Aktion kann nicht rückgängig gemacht werden!</p>
                    <p>Alle gespeicherten Daten und Archiveinträge gehen verloren.</p>
                    <div class="input-group">
                        <label>Zur Bestätigung geben Sie "LÖSCHEN" ein:</label>
                        <input type="text" id="deleteConfirmInput" placeholder="LÖSCHEN" class="session-input">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Abbrechen</button>
                    <button class="btn btn-danger" onclick="window.errorDisplay.executeDeleteCurrentSession()">Unwiderruflich löschen</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    async executeDeleteCurrentSession() {
        const confirmInput = document.getElementById('deleteConfirmInput');
        if (!confirmInput || confirmInput.value !== 'LÖSCHEN') {
            this.showNotification('Bitte "LÖSCHEN" eingeben zur Bestätigung', 'warning');
            return;
        }

        if (!this.currentSession || !this.currentSession.isSaved) {
            return;
        }

        try {
            const response = await fetch(`${this.serverUrl}/api/session/${this.currentSession.token}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showNotification(`Session "${this.currentSession.name}" wurde dauerhaft gelöscht`, 'success');
                
                // Clear current session
                this.clearSession();
                
                // Close modal
                document.querySelector('.modal-overlay').remove();
                
                // Refresh saved sessions list
                this.loadSavedSessionsInline();
            } else {
                this.showNotification('Fehler beim Löschen der Session', 'error');
            }
        } catch (error) {
            console.error('Error deleting session:', error);
            this.showNotification('Verbindungsfehler beim Löschen', 'error');
        }
    }

    async toggleAutoSave(checked) {
        if (!this.currentSession || !this.isSessionSaved()) {
            return;
        }
        
        this.autoSaveEnabled = checked;
        
        if (this.autoSaveEnabled) {
            // Save current session to server immediately when auto-save is enabled
            await this.saveToServer();
            this.markAsSaved();
            this.showNotification('Auto-Save aktiviert - Änderungen werden automatisch gespeichert', 'success');
        } else {
            this.showNotification('Auto-Save deaktiviert', 'info');
            // Check if there are unsaved changes and show indicator
            if (this.errors.length > 0) {
                this.markAsUnsaved();
            }
        }
        
        // Update the indicator visibility
        this.updateUnsavedChangesIndicator();
    }
    
    async saveToServer() {
        if (!this.currentSession || !this.isSessionSaved()) {
            return;
        }
        
        try {
            const response = await fetch(`/api/session/${this.currentSession.token}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    password: this.currentSession.password,
                    archive: this.currentSession.archive
                })
            });
            
            if (response.ok) {
                console.log('Session auto-saved to server');
                this.markAsSaved();
            } else {
                console.error('Failed to auto-save session');
            }
        } catch (error) {
            console.error('Error during auto-save:', error);
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.errorDisplay = new ErrorDisplay();
});

// Handle page visibility - only reconnect if in live mode
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
