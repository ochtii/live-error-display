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
        
        // Session Management
        this.currentSession = null;
        this.loadCurrentSession();
        
        this.init();
    }

    // === INITIALIZATION === 
    init() {
        this.setupEventListeners();
        this.updateStats();
        this.setupModal();
        this.loadAndApplySettings();
        this.initPushNotifications();
        this.updateSessionDisplay();
        
        // Check for valid session before proceeding
        if (!this.currentSession) {
            this.showSessionRequiredMessage();
            return; // Don't connect SSE or display mode without session
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
        
        if (sessionBtn) sessionBtn.addEventListener('click', () => this.openSessionManager());
        if (copyToken) copyToken.addEventListener('click', () => this.copySessionToken());
        if (sessionManager) sessionManager.addEventListener('click', () => this.openSessionManager());
        if (saveSession) saveSession.addEventListener('click', () => this.saveCurrentSession());
        if (endSession) endSession.addEventListener('click', () => this.clearSession());
        
        // Session Manager inline controls
        const createNewSessionBtn = document.getElementById('createNewSessionBtn');
        const restoreSessionBtn = document.getElementById('restoreSessionBtn');
        const refreshSavedSessionsBtn = document.getElementById('refreshSavedSessionsBtn');
        
        if (createNewSessionBtn) createNewSessionBtn.addEventListener('click', () => this.createNewSessionInline());
        if (restoreSessionBtn) restoreSessionBtn.addEventListener('click', () => this.restoreSessionFromToken());
        if (refreshSavedSessionsBtn) refreshSavedSessionsBtn.addEventListener('click', () => this.loadSavedSessionsInline());
        
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
    }

    saveArchive() {
        if (this.currentSession) {
            // Save to session-specific archive
            const sessionArchiveKey = `archive_${this.currentSession.token}`;
            localStorage.setItem(sessionArchiveKey, JSON.stringify(this.archiveData));
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
            
            // Add buffered errors to live view
            if (this.bufferedErrors.length > 0 && this.settings.bufferOfflineErrors) {
                this.errors = [...this.bufferedErrors, ...this.errors];
                this.bufferedErrors = [];
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
                this.loadSavedSessionsInline();
                this.updateSessionManagerState();
            }
            this.disconnectSSE();
            this.updateStatus('🔑 Session Manager');
        }
        
        // Always show session manager at the bottom of every page
        this.showSessionManagerAtBottom();
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
        } else {
            // Enable session creation and restoration when no session is active
            this.enableSessionCard(createCard);
            this.enableSessionCard(restoreCard);
        }
    }
    
    disableSessionCard(card, action, requirement) {
        if (!card) return;
        
        // Add disabled class
        card.classList.add('session-card-disabled');
        
        // Disable all inputs and buttons
        const inputs = card.querySelectorAll('input, button');
        inputs.forEach(input => {
            input.disabled = true;
        });
        
        // Add warning message if not already present
        let warningDiv = card.querySelector('.session-warning');
        if (!warningDiv) {
            warningDiv = document.createElement('div');
            warningDiv.className = 'session-warning';
            warningDiv.innerHTML = `
                <div class="warning-content">
                    <span class="warning-icon">⚠️</span>
                    <span class="warning-text">Um ${action} zu können, müssen Sie zuerst die ${requirement}.</span>
                    <button class="btn btn-small btn-danger" onclick="window.errorDisplay.clearSession()">
                        🔚 Session beenden
                    </button>
                </div>
            `;
            card.appendChild(warningDiv);
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
    
    showSessionManagerAtBottom() {
        // Ensure session manager is visible at the bottom of all pages
        const sessionManagerContainer = document.getElementById('sessionManagerContainer');
        if (sessionManagerContainer && this.currentMode !== 'session-manager') {
            // Create a compact session manager footer if it doesn't exist
            let footerManager = document.getElementById('sessionManagerFooter');
            if (!footerManager) {
                footerManager = document.createElement('div');
                footerManager.id = 'sessionManagerFooter';
                footerManager.className = 'session-manager-footer';
                footerManager.innerHTML = `
                    <div class="session-footer-content">
                        <div class="session-footer-info">
                            <span class="session-footer-title">🔑 Session Manager</span>
                            <button class="btn btn-small btn-primary" onclick="window.errorDisplay.openSessionManager()">
                                Verwalten
                            </button>
                        </div>
                    </div>
                `;
                document.body.appendChild(footerManager);
            }
            
            // Update footer based on session state
            this.updateSessionFooter(footerManager);
        }
    }
    
    updateSessionFooter(footer) {
        if (!footer) return;
        
        const infoDiv = footer.querySelector('.session-footer-info');
        if (!infoDiv) return;
        
        if (this.currentSession) {
            infoDiv.innerHTML = `
                <span class="session-footer-title">🔑 ${this.currentSession.name}</span>
                <div class="session-footer-actions">
                    <button class="btn btn-small btn-secondary" onclick="window.errorDisplay.saveCurrentSession()">
                        💾 Speichern
                    </button>
                    <button class="btn btn-small btn-danger" onclick="window.errorDisplay.clearSession()">
                        🔚 Beenden
                    </button>
                    <button class="btn btn-small btn-primary" onclick="window.errorDisplay.openSessionManager()">
                        ⚙️ Verwalten
                    </button>
                </div>
            `;
        } else {
            infoDiv.innerHTML = `
                <span class="session-footer-title">🔑 Keine Session aktiv</span>
                <button class="btn btn-small btn-primary" onclick="window.errorDisplay.openSessionManager()">
                    Session erstellen
                </button>
            `;
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
                // Korrekte Übertragung der Server-Buffer-Information
                const archiveError = {...data.error, isServerBuffered: data.error.isBuffered};
                this.saveToArchive(archiveError, true);
            } else if (data.type === 'clients') {
                this.clients = data.count;
                this.updateStats();
            } else if (data.type === 'buffered_notification') {
                this.showBufferedNotification(data.count, data.oldestError);
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
        this.errors.unshift(errorWithMeta);
        if (this.errors.length > 100) this.errors.pop();
        
        this.displayErrors(this.errors);
        this.updateStats();
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
                <button class="delete-error-btn" onclick="event.stopPropagation(); errorDisplay.deleteError(${index}, ${isArchive})" title="Fehler löschen">🗑️</button>
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
            // Fehler aus Archiv löschen
            this.archiveData.splice(index, 1);
            this.saveArchive();
            this.displayErrors(this.archiveData, true);
            this.showNotification(`Fehler aus Archiv gelöscht`, 'success');
        } else {
            // Fehler aus Live-Liste löschen
            this.errors.splice(index, 1);
            this.displayErrors(this.errors);
            this.showNotification(`Live-Fehler gelöscht`, 'success');
        }
        
        this.updateStats();
        
        // Sound für erfolgreiche Löschung
        this.playNotificationSound('errorDeleted');
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
                this.currentSession = JSON.parse(sessionData);
                console.log('📂 Loaded session from localStorage:', {
                    name: this.currentSession.name,
                    tokenPreview: this.currentSession.token?.substring(0, 16) + '...'
                });
                this.updateSessionDisplay();
                
                // Validate session token with server
                this.validateSessionToken();
            } catch (error) {
                console.error('Failed to load session data:', error);
                localStorage.removeItem('currentSession');
            }
        } else {
            console.log('📂 No session found in localStorage');
        }
    }
    
    async validateSessionToken() {
        if (!this.currentSession?.token) return;
        
        try {
            const response = await fetch(`${this.serverUrl}/api/session/${this.currentSession.token}`);
            if (!response.ok) {
                console.warn('❌ Session token validation failed, clearing session');
                this.showNotification('Session ungültig - neue Session erforderlich', 'warning');
                this.clearSession();
            } else {
                console.log('✅ Session token validated successfully');
            }
        } catch (error) {
            console.warn('⚠️ Could not validate session token:', error);
            // Don't clear session if server is unreachable
        }
    }

    async createNewSession() {
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
        
        console.log('🔄 Updating session display:', {
            hasSession: !!this.currentSession,
            sessionName: this.currentSession?.name,
            tokenPreview: this.currentSession?.token?.substring(0, 16) + '...'
        });
        
        if (this.currentSession) {
            sessionBar.style.display = 'flex';
            sessionName.textContent = this.currentSession.name || 'Unbenannte Session';
            sessionToken.textContent = this.currentSession.token.substring(0, 16) + '...';
            
            // Also update the header controls to show session status
            this.updateHeaderSessionStatus(true);
        } else {
            sessionBar.style.display = 'none';
            this.updateHeaderSessionStatus(false);
        }
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
            navigator.clipboard.writeText(this.currentSession.token).then(() => {
                this.showNotification('Session-Token kopiert!', 'success');
            }).catch(err => {
                console.error('Failed to copy token:', err);
            });
        }
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
                        <label>Passwort für gespeicherte Session (optional)</label>
                        <input type="password" id="saveSessionPassword" placeholder="Passwort (leer = kein Passwort)" class="session-input">
                        <small class="input-hint">💡 Dieses Passwort wird für die gespeicherte Session verwendet</small>
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
        const password = document.getElementById('saveSessionPassword').value;
        
        if (!name) {
            this.showNotification('Bitte Session Name eingeben', 'warning');
            return;
        }
        
        const sessionData = {
            ...this.currentSession,
            name: name,
            savedAt: new Date().toISOString(),
            savedPassword: password || null,
            hasPassword: !!password,
            // Include current archive data
            archiveData: this.archiveData || []
        };
        
        const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
        savedSessions.push(sessionData);
        localStorage.setItem('savedSessions', JSON.stringify(savedSessions));
        
        // Close modal
        document.querySelector('.modal-overlay').remove();
        
        this.showNotification('Session gespeichert!', 'success');
        this.loadSavedSessionsInline();
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
                    createdAt: data.session.createdAt,
                    lastModified: data.session.lastModified,
                    modifiedBy: data.session.modifiedBy,
                    hasPassword: data.session.hasPassword
                };
                localStorage.setItem('currentSession', JSON.stringify(this.currentSession));
                this.updateSessionDisplay();
                this.showNotification('Session erfolgreich erstellt!', 'success');
                
                // Clear input field
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
                        <button class="btn btn-danger" onclick="window.errorDisplay.clearSession()">
                            ❌ Session beenden
                        </button>
                    </div>
                </div>
            `;
        } else {
            currentSessionCard.style.display = 'none';
        }
    }

    loadSavedSessionsInline() {
        const container = document.getElementById('inlineSavedSessions');
        if (!container) return;

        const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
        
        if (savedSessions.length === 0) {
            container.innerHTML = '<p class="no-sessions">Keine Sessions gespeichert</p>';
            return;
        }

        // Sort sessions by last modification date (newest first)
        savedSessions.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

        container.innerHTML = savedSessions.map(session => {
            const createdDate = new Date(session.createdAt || session.created);
            const savedDate = new Date(session.savedAt);
            const modifiedDate = session.lastModified ? new Date(session.lastModified) : null;
            
            return `
                <div class="saved-session-item">
                    <div class="saved-session-info">
                        <div class="session-name">
                            ${session.name}
                            ${session.hasPassword ? '<span class="password-icon" title="Passwortgeschützt">🔒</span>' : ''}
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
                        <button class="btn btn-small btn-primary" onclick="window.errorDisplay.restoreSessionFromSaved('${session.token}', ${session.hasPassword})">
                            🔄 Laden
                        </button>
                        <button class="btn btn-small btn-danger" onclick="window.errorDisplay.deleteSavedSession('${session.token}')">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async restoreSessionFromSaved(token, hasPassword = false) {
        if (hasPassword) {
            // Show password prompt modal for protected sessions
            this.showPasswordPromptModal(token);
            return;
        }
        
        // For non-protected sessions, restore directly
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
                    hasPassword: data.session.hasPassword
                };
                localStorage.setItem('currentSession', JSON.stringify(this.currentSession));
                this.updateSessionDisplay();
                this.showNotification(`Session "${data.session.name}" erfolgreich geladen!`, 'success');
                this.updateCurrentSessionCard();
                
                // Delete saved session from list after successful loading
                this.deleteSavedSession(token);
                
                // Restore archived data if available
                const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
                const savedSession = savedSessions.find(s => s.token === token);
                if (savedSession && savedSession.archiveData) {
                    console.log('📂 Restoring archived data for session');
                    this.archiveData = savedSession.archiveData;
                    this.saveArchive(); // Save to session-specific archive key
                }
                
                // Global session load - unlock tabs and connect
                this.onSessionLoaded();
            } else if (response.status === 401) {
                this.showNotification('Falsches Passwort!', 'error');
            } else {
                this.showNotification('Session nicht mehr gültig', 'error');
                this.deleteSavedSession(token);
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
