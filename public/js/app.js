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
    }

    setupEventListeners() {
        // Mode switching
        document.getElementById('liveBtn').addEventListener('click', () => this.switchMode('live'));
        document.getElementById('archiveBtn').addEventListener('click', () => this.switchMode('archive'));
        document.getElementById('settingsBtn').addEventListener('click', () => this.switchMode('settings'));
        
        // Settings
        document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
        document.getElementById('clearStorage').addEventListener('click', () => this.clearArchive());
        document.getElementById('showAllData').addEventListener('click', () => this.showAllLocalStorageData());
        document.getElementById('deleteAllData').addEventListener('click', () => this.deleteAllData());
        
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
            notifyConnectionSuccess: true,
            soundConnectionSuccess: true,
            notifyConnectionClosed: true,
            soundConnectionClosed: true
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
            notifyConnectionSuccess: formData.get('notifyConnectionSuccess') === 'on',
            soundConnectionSuccess: formData.get('soundConnectionSuccess') === 'on',
            notifyConnectionClosed: formData.get('notifyConnectionClosed') === 'on',
            soundConnectionClosed: formData.get('soundConnectionClosed') === 'on'
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
        
        this.displayMode(mode);
    }

    displayMode(mode) {
        // Hide all containers
        document.getElementById('errorsContainer').style.display = 'none';
        document.getElementById('settingsContainer').style.display = 'none';
        
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

    // === SSE CONNECTION ===
    connectSSE() {
        if (this.eventSource) return;
        
        console.log(`[${new Date().toLocaleTimeString('de-DE')}] 🔌 Attempting SSE connection...`);
        this.eventSource = new EventSource('/events');
        
        this.eventSource.onopen = () => {
            console.log(`[${new Date().toLocaleTimeString('de-DE')}] ✅ SSE connected successfully`);
            this.updateStatus('online');
            // Sound-Benachrichtigung für erfolgreiche Verbindung
            this.playNotificationSound('connectionSuccess');
        };
        
        this.eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'error') {
                if (this.currentMode === 'live') {
                    this.addError(data.error, true, data.error.isBuffered); // Mark as live received
                    // Sound-Benachrichtigung für neue Fehler
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
            // Sound-Benachrichtigung für getrennte Verbindung
            this.playNotificationSound('connectionClosed');
            
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
            <div class="error-header" onclick="this.parentElement.querySelector('.error-content').classList.toggle('open'); this.querySelector('.toggle-icon').classList.toggle('open')">
                <div class="error-info">
                    <div class="error-preview">${this.escapeHtml(firstLine)}${error.message.length > 100 ? '...' : ''}</div>
                    <div class="error-meta">
                        <span>${timestamp}</span>
                        <span>🌐 ${this.cleanIP(error.ip)}</span>
                        <span class="live-indicator ${indicatorClass}">${receivedIndicator}</span>
                        ${isArchive ? '<span>📂 Archiviert</span>' : ''}
                    </div>
                </div>
                <div class="toggle-icon">▶</div>
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
                <button class="copy-btn action-btn" onclick="errorDisplay.copyToClipboard('${id}', this)">📋 Kopieren</button>
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
            await navigator.clipboard.writeText(text);
            const originalText = button.textContent;
            button.textContent = '✅ Kopiert!';
            button.style.background = 'rgba(16, 185, 129, 0.3)';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '';
            }, 2000);
        } catch (err) {
            console.error('Copy failed:', err);
            this.showNotification('Kopieren fehlgeschlagen', 'error');
        }
    }

    showBufferedNotification(count, oldestErrorTime) {
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
    
    // Einstellungen laden und anwenden
    loadAndApplySettings() {
        // Form-Felder mit aktuellen Einstellungen befüllen
        document.getElementById('archiveRetentionDays').value = this.settings.archiveRetentionDays;
        document.getElementById('retentionValue').textContent = this.settings.archiveRetentionDays;
        document.getElementById('maxArchiveItems').value = this.settings.maxArchiveItems;
        document.getElementById('maxItemsValue').textContent = this.settings.maxArchiveItems;
        document.getElementById('autoArchive').checked = this.settings.autoArchive;
        document.getElementById('bufferOfflineErrors').checked = this.settings.bufferOfflineErrors;
        
        // Sound-Einstellungen
        document.getElementById('enableSounds').checked = this.settings.enableSounds;
        document.getElementById('notifyNewError').checked = this.settings.notifyNewError;
        document.getElementById('soundNewError').checked = this.settings.soundNewError;
        document.getElementById('notifyConnectionSuccess').checked = this.settings.notifyConnectionSuccess;
        document.getElementById('soundConnectionSuccess').checked = this.settings.soundConnectionSuccess;
        document.getElementById('notifyConnectionClosed').checked = this.settings.notifyConnectionClosed;
        document.getElementById('soundConnectionClosed').checked = this.settings.soundConnectionClosed;
        
        // Sound-Manager konfigurieren
        if (window.soundManager) {
            window.soundManager.setEnabled(this.settings.enableSounds);
        }
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
            connectionClosed: 'disconnect'
        };
        
        const soundType = soundTypes[eventType];
        if (soundType) {
            window.soundManager.testSound(eventType, soundType);
        }
    }
    
    // Sound-Events
    playNotificationSound(eventType) {
        if (!this.settings.enableSounds || !window.soundManager) return;
        
        const eventSettings = {
            newError: { enabled: this.settings.soundNewError, type: 'notification' },
            connectionSuccess: { enabled: this.settings.soundConnectionSuccess, type: 'success' },
            connectionClosed: { enabled: this.settings.soundConnectionClosed, type: 'disconnect' }
        };
        
        const setting = eventSettings[eventType];
        if (setting && setting.enabled) {
            window.soundManager.testSound(eventType, setting.type);
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
