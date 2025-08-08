// Live Error Display - Main JavaScript

class ErrorDisplay {
    constructor() {
        this.errors = [];
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
    }

    setupEventListeners() {
        // Mode switching
        document.getElementById('liveBtn').addEventListener('click', () => this.switchMode('live'));
        document.getElementById('archiveBtn').addEventListener('click', () => this.switchMode('archive'));
        
        // Settings
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
        document.getElementById('closeModal').addEventListener('click', () => this.closeSettings());
        document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
        document.getElementById('clearStorage').addEventListener('click', () => this.clearArchive());
        
        // Close modal on outside click
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') this.closeSettings();
        });
    }

    // === SETTINGS MANAGEMENT ===
    loadSettings() {
        const defaults = {
            archiveRetentionDays: 7,
            maxArchiveItems: 1000,
            autoArchive: true
        };
        
        const saved = localStorage.getItem('errorDisplaySettings');
        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    }

    saveSettings() {
        const formData = new FormData(document.getElementById('settingsForm'));
        
        this.settings = {
            archiveRetentionDays: parseInt(formData.get('archiveRetentionDays')),
            maxArchiveItems: parseInt(formData.get('maxArchiveItems')),
            autoArchive: formData.get('autoArchive') === 'on'
        };
        
        localStorage.setItem('errorDisplaySettings', JSON.stringify(this.settings));
        this.closeSettings();
        this.cleanupArchive();
        this.showNotification('Einstellungen gespeichert', 'success');
    }

    openSettings() {
        // Populate form with current settings
        document.getElementById('archiveRetentionDays').value = this.settings.archiveRetentionDays;
        document.getElementById('maxArchiveItems').value = this.settings.maxArchiveItems;
        document.getElementById('autoArchive').checked = this.settings.autoArchive;
        
        this.updateStorageInfo();
        document.getElementById('settingsModal').classList.add('show');
    }

    closeSettings() {
        document.getElementById('settingsModal').classList.remove('show');
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

    saveToArchive(error) {
        if (!this.settings.autoArchive) return;
        
        const archiveError = {
            ...error,
            archivedAt: new Date().toISOString(),
            id: Date.now() + Math.random()
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
        
        this.displayMode(mode);
    }

    displayMode(mode) {
        if (mode === 'live') {
            this.connectSSE();
            this.updateStatus('online');
            this.displayErrors(this.errors);
        } else {
            this.disconnectSSE();
            this.updateStatus('archive');
            this.displayArchive();
        }
    }

    displayArchive() {
        this.displayErrors(this.archiveData, true);
        this.updateStats();
    }

    // === SSE CONNECTION ===
    connectSSE() {
        if (this.eventSource) return;
        
        this.eventSource = new EventSource('/events');
        
        this.eventSource.onopen = () => {
            console.log('SSE connected');
            this.updateStatus('online');
        };
        
        this.eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'error') {
                this.addError(data.error);
                this.saveToArchive(data.error);
            } else if (data.type === 'clients') {
                this.clients = data.count;
                this.updateStats();
            }
        };
        
        this.eventSource.onerror = () => {
            console.log('SSE connection error');
            this.updateStatus('offline');
            this.eventSource = null;
            
            // Reconnect after 5 seconds
            setTimeout(() => this.connectSSE(), 5000);
        };
    }

    disconnectSSE() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }

    // === ERROR HANDLING ===
    addError(error) {
        if (this.currentMode !== 'live') return;
        
        this.errors.unshift(error);
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
        
        card.innerHTML = `
            <div class="error-header" onclick="this.parentElement.querySelector('.error-content').classList.toggle('open'); this.querySelector('.toggle-icon').classList.toggle('open')">
                <div class="error-info">
                    <div class="error-preview">${this.escapeHtml(firstLine)}${error.message.length > 100 ? '...' : ''}</div>
                    <div class="error-meta">
                        <span>${timestamp}</span>
                        <span>🌐 ${this.cleanIP(error.ip)}</span>
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
        
        statusElement.className = `status ${status}`;
        
        const statusTexts = {
            online: 'Live',
            offline: 'Offline', 
            archive: 'Archiv'
        };
        
        statusText.textContent = statusTexts[status] || status;
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
