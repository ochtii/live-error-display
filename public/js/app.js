// Live Error Display - Main JavaScript

class ErrorDisplay {
    constructor() {
        this.errors = [];
        this.bufferedErrors = []; // Errors received while not in live mode
        this.clients = 0;
        this.currentMode = 'live';
        this.eventSource = null;
        this.settings = this.loadSettings();
        this.archiveData = this.loadArchive();
        
        this.init();
    }

    // === INITIALIZATION === 
    init() {
        this.setupEventListeners();
        this.updateStats();
        this.connectSSE();
        this.setupModal();
        this.displayMode(this.currentMode);
        this.loadAndApplySettings();
        this.initPushNotifications();
    }

    setupEventListeners() {
        // Mode switching
        document.getElementById('liveBtn').addEventListener('click', () => this.switchMode('live'));
        document.getElementById('archiveBtn').addEventListener('click', () => this.switchMode('archive'));
        document.getElementById('settingsBtn').addEventListener('click', () => this.switchMode('settings'));
        document.getElementById('apiBtn').addEventListener('click', () => this.switchMode('api'));
        
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
            isServerBuffered: error.isServerBuffered || false
        };
        
        this.archiveData.unshift(archiveError);
        this.cleanupArchive();
        this.saveArchive();
    }

    saveArchive() {
        localStorage.setItem('errorDisplayArchive', JSON.stringify(this.archiveData));
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
            localStorage.removeItem('errorDisplayArchive');
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

    displayAPI() {
        // Update server URL with current location
        const serverUrl = `${window.location.protocol}//${window.location.host}`;
        document.getElementById('serverUrl').value = serverUrl;
        
        // Update all code examples with the actual server URL
        this.updateCodeExamples(serverUrl);
    }

    updateCodeExamples(serverUrl) {
        const codeBlocks = [
            'js-example', 'python-example', 'php-example', 
            'java-example', 'csharp-example', 'kotlin-example', 'curl-example',
            'powershell-example', 'cmd-example', 'macos-example', 'linux-example'
        ];
        
        codeBlocks.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = element.textContent.replace(/SERVER_URL/g, serverUrl);
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
        
        console.log(`[${new Date().toLocaleTimeString('de-DE')}] 🔌 Attempting SSE connection...`);
        this.eventSource = new EventSource('/live');
        
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
                    this.addError(data.error, true, data.error.isBuffered); // Mark as live received
                    // Sound und Benachrichtigung für neue Fehler
                    this.playNotificationSound('newError');
                } else if (this.settings.bufferOfflineErrors) {
                    // Buffer the error for later display
                    this.bufferedErrors.unshift({...data.error, isLive: true, buffered: true});
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
            this.updateStatus('offline');
            this.eventSource = null;
            // Sound und Benachrichtigung für getrennte Verbindung
            this.playNotificationSound('connectionClosed');
            this.showEventNotification('connectionClosed', 'Verbindung zum Server getrennt');
            
            // Reconnect after 5 seconds
            setTimeout(() => this.connectSSE(), 5000);
        };
    }

    disconnectSSE() {
        if (this.eventSource) {
            console.log(`[${new Date().toLocaleTimeString('de-DE')}] 🔌 SSE connection closed`);
            this.eventSource.close();
            this.eventSource = null;
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
        
        // Vereinfachte Kennzeichnung
        let receivedIndicator = 'Live empfangen';
        let indicatorClass = 'live';
        
        if (error.isServerBuffered === true || error.isServerBuffered === 'true') {
            receivedIndicator = 'In Abwesenheit empfangen';
            indicatorClass = 'buffered';
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
        if (!this.settings.enableSounds || !window.soundManager) return;
        
        const eventSettings = {
            newError: { enabled: this.settings.soundNewError },
            connectionSuccess: { enabled: this.settings.soundConnectionSuccess },
            connectionClosed: { enabled: this.settings.soundConnectionClosed },
            bufferedErrors: { enabled: this.settings.soundBufferedErrors },
            errorDeleted: { enabled: this.settings.soundErrorDeleted }
        };
        
        const setting = eventSettings[eventType];
        if (setting && setting.enabled) {
            const soundTypes = {
                newError: 'notification',
                connectionSuccess: 'success',
                connectionClosed: 'disconnect',
                bufferedErrors: 'chime',
                errorDeleted: 'delete'
            };
            
            window.soundManager.playSound(soundTypes[eventType]);
        }
    }
    
    // Benachrichtigungen anzeigen
    showEventNotification(eventType, message) {
        const eventSettings = {
            newError: { enabled: this.settings.notifyNewError, pushEnabled: this.settings.pushNewError },
            connectionSuccess: { enabled: this.settings.notifyConnectionSuccess, pushEnabled: this.settings.pushConnectionSuccess },
            connectionClosed: { enabled: this.settings.notifyConnectionClosed, pushEnabled: this.settings.pushConnectionClosed },
            bufferedErrors: { enabled: this.settings.notifyBufferedErrors, pushEnabled: this.settings.pushBufferedErrors }
        };
        
        const setting = eventSettings[eventType];
        if (setting) {
            // Website-Benachrichtigung
            if (setting.enabled) {
                this.showNotification(message, eventType === 'connectionClosed' ? 'warning' : 'success');
            }
            
            // Push-Benachrichtigung
            if (setting.pushEnabled) {
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.errorDisplay = new ErrorDisplay();
});

// Handle page visibility for SSE reconnection
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.errorDisplay) {
        window.errorDisplay.connectSSE();
    }
});
