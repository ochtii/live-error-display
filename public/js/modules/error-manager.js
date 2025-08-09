// Error Manager Module
export class ErrorManager {
    constructor(errorDisplay) {
        this.errorDisplay = errorDisplay;
        this.errors = [];
        this.bufferedErrors = [];
    }

    addError(error) {
        console.log('📥 Adding new error:', error);
        
        if (this.errorDisplay.currentMode === 'live') {
            this.errors.unshift(error);
            this.renderError(error, 'errorList');
            
            // Apply max errors limit
            if (this.errors.length > this.errorDisplay.settingsManager.settings.maxErrors) {
                this.errors = this.errors.slice(0, this.errorDisplay.settingsManager.settings.maxErrors);
                this.renderAllErrors();
            }
            
            this.errorDisplay.uiManager.updateStats();
            this.playErrorSound(error.type);
            
            if (this.errorDisplay.settingsManager.settings.autoScroll) {
                this.scrollToTop('errorList');
            }
        } else {
            // Buffer errors when not in live mode
            this.bufferedErrors.unshift(error);
            console.log(`📦 Buffered error (${this.bufferedErrors.length} buffered)`);
        }
        
        this.trackUnsavedChanges();
    }

    renderError(error, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const errorElement = this.createErrorElement(error);
        container.insertBefore(errorElement, container.firstChild);
    }

    createErrorElement(error) {
        const errorDiv = document.createElement('div');
        errorDiv.className = `error-item ${error.type}`;
        errorDiv.setAttribute('data-error-id', error.id);

        const timestamp = this.errorDisplay.settingsManager.settings.showTimestamps 
            ? `<span class="timestamp">${new Date(error.timestamp).toLocaleString()}</span>`
            : '';

        const sessionInfo = error.session 
            ? `<span class="session-info">Session: ${error.session}</span>`
            : '';

        const stackTrace = error.stack 
            ? `<div class="stack-trace ${this.errorDisplay.settingsManager.settings.stackTraceCollapsed ? 'collapsed' : ''}">
                 <button class="stack-toggle" onclick="this.parentElement.classList.toggle('collapsed')">
                   ${this.errorDisplay.settingsManager.settings.stackTraceCollapsed ? '▶' : '▼'} Stack Trace
                 </button>
                 <pre class="stack-content">${error.stack}</pre>
               </div>`
            : '';

        errorDiv.innerHTML = `
            <div class="error-header">
                <span class="error-type">${error.type.toUpperCase()}</span>
                ${timestamp}
                ${sessionInfo}
                <div class="error-actions">
                    <button class="btn btn-sm" onclick="window.errorDisplay.errorManager.copyError('${error.id}')" title="Kopieren">📋</button>
                    <button class="btn btn-sm" onclick="window.errorDisplay.errorManager.archiveError('${error.id}')" title="Archivieren">📁</button>
                    <button class="btn btn-sm btn-danger" onclick="window.errorDisplay.errorManager.deleteError('${error.id}')" title="Löschen">🗑️</button>
                </div>
            </div>
            <div class="error-message">${error.message}</div>
            <div class="error-details">
                <div><strong>Datei:</strong> ${error.file || 'Unbekannt'}</div>
                <div><strong>Zeile:</strong> ${error.line || 'Unbekannt'}</div>
                <div><strong>Spalte:</strong> ${error.column || 'Unbekannt'}</div>
                <div><strong>User Agent:</strong> ${error.userAgent || 'Unbekannt'}</div>
                <div><strong>URL:</strong> ${error.url || 'Unbekannt'}</div>
            </div>
            ${stackTrace}
        `;

        return errorDiv;
    }

    renderAllErrors() {
        const container = document.getElementById('errorList');
        if (!container) return;

        container.innerHTML = '';
        this.errors.forEach(error => {
            this.renderError(error, 'errorList');
        });
    }

    deleteError(errorId) {
        this.errors = this.errors.filter(error => error.id !== errorId);
        const errorElement = document.querySelector(`[data-error-id="${errorId}"]`);
        if (errorElement) {
            errorElement.remove();
        }
        this.errorDisplay.uiManager.updateStats();
        this.trackUnsavedChanges();
    }

    copyError(errorId) {
        const error = this.errors.find(e => e.id === errorId);
        if (error) {
            const errorText = `[${error.type.toUpperCase()}] ${error.message}\nDatei: ${error.file}\nZeile: ${error.line}\nZeit: ${new Date(error.timestamp).toLocaleString()}`;
            
            if (navigator.clipboard) {
                navigator.clipboard.writeText(errorText).then(() => {
                    this.errorDisplay.showNotification('Fehler kopiert!', 'success');
                });
            }
        }
    }

    archiveError(errorId) {
        const error = this.errors.find(e => e.id === errorId);
        if (error) {
            this.errorDisplay.archiveManager.addToArchive(error);
            this.deleteError(errorId);
            this.errorDisplay.showNotification('Fehler archiviert!', 'info');
        }
    }

    clearAllErrors() {
        this.errors = [];
        this.bufferedErrors = [];
        const container = document.getElementById('errorList');
        if (container) container.innerHTML = '';
        this.errorDisplay.uiManager.updateStats();
        this.trackUnsavedChanges();
    }

    switchToBufferedErrors() {
        if (this.bufferedErrors.length > 0) {
            console.log(`📦 Loading ${this.bufferedErrors.length} buffered errors`);
            this.errors = [...this.bufferedErrors];
            this.bufferedErrors = [];
            this.renderAllErrors();
            this.errorDisplay.uiManager.updateStats();
        }
    }

    playErrorSound(errorType) {
        if (!this.errorDisplay.settingsManager.settings.soundEnabled) return;
        
        // Check if sounds module is available
        if (window.errorSounds && typeof window.errorSounds.play === 'function') {
            window.errorSounds.play(errorType);
        }
    }

    scrollToTop(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.scrollTop = 0;
        }
    }

    trackUnsavedChanges() {
        if (this.errorDisplay.sessionManager.currentSession && !this.errorDisplay.sessionManager.isSessionSaved()) {
            this.errorDisplay.hasUnsavedChanges = true;
            this.errorDisplay.uiManager.updateUnsavedChangesIndicator();
        }
    }

    sendTestError() {
        if (!this.errorDisplay.sessionManager.currentSession) {
            this.errorDisplay.showNotification('Keine aktive Session - Error kann nicht gesendet werden', 'error');
            return;
        }

        const testError = {
            message: 'Dies ist ein Test-Fehler',
            type: 'error',
            file: 'test.js',
            line: 42,
            column: 10,
            timestamp: new Date().toISOString(),
            session: this.errorDisplay.sessionManager.currentSession.token,
            userAgent: navigator.userAgent,
            url: window.location.href,
            stack: 'Error: Dies ist ein Test-Fehler\n    at testFunction (test.js:42:10)\n    at Object.onclick (test.html:1:1)'
        };

        fetch(`${this.errorDisplay.serverUrl}/api/error`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testError)
        }).then(response => {
            if (response.ok) {
                this.errorDisplay.showNotification('Test-Fehler gesendet!', 'success');
            } else {
                throw new Error('Fehler beim Senden');
            }
        }).catch(error => {
            console.error('Error sending test error:', error);
            this.errorDisplay.showNotification('Fehler beim Senden des Test-Fehlers', 'error');
        });
    }
}
