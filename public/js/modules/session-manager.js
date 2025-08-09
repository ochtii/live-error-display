// Session Management Module
export class SessionManager {
    constructor(errorDisplay) {
        this.errorDisplay = errorDisplay;
        this.currentSession = null;
        
        // Random session names
        this.randomSessionNames = [
            'Aurora', 'Nebula', 'Phoenix', 'Cosmos', 'Thunder', 'Glacier', 'Summit', 'Horizon', 
            'Eclipse', 'Comet', 'Zenith', 'Vortex', 'Prism', 'Stellar', 'Quantum', 'Matrix',
            'Fusion', 'Titan', 'Nova', 'Omega', 'Alpha', 'Delta', 'Sigma', 'Lambda', 'Theta',
            'Crystal', 'Mystic', 'Spirit', 'Energy', 'Force', 'Power', 'Speed', 'Light', 'Shadow',
            'Storm', 'Wave', 'Flow', 'Stream', 'River', 'Ocean', 'Mountain', 'Valley', 'Peak',
            'Stone', 'Marble', 'Diamond', 'Silver', 'Golden', 'Bright', 'Clear'
        ];
    }

    getRandomSessionName() {
        const randomIndex = Math.floor(Math.random() * this.randomSessionNames.length);
        return this.randomSessionNames[randomIndex];
    }

    loadCurrentSession() {
        try {
            const sessionData = localStorage.getItem('currentSession');
            if (sessionData) {
                this.currentSession = JSON.parse(sessionData);
                console.log('🔄 Loaded session from localStorage:', this.currentSession?.name);
            }
        } catch (error) {
            console.error('❌ Failed to load session from localStorage:', error);
            localStorage.removeItem('currentSession');
        }
    }

    async createSession(name, password) {
        try {
            const response = await fetch(`${this.errorDisplay.serverUrl}/api/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password })
            });

            const data = await response.json();

            if (data.success) {
                this.currentSession = {
                    name: data.session.name,
                    token: data.session.token,
                    created: data.session.created,
                    isSaved: false
                };

                localStorage.setItem('currentSession', JSON.stringify(this.currentSession));
                this.errorDisplay.updateSessionDisplay();
                this.errorDisplay.showNotification(`Session "${name}" erstellt!`, 'success');
                this.errorDisplay.switchMode('live');
                return true;
            } else {
                this.errorDisplay.showNotification(data.error || 'Fehler beim Erstellen der Session', 'error');
                return false;
            }
        } catch (error) {
            console.error('Session creation failed:', error);
            this.errorDisplay.showNotification('Verbindungsfehler beim Erstellen der Session', 'error');
            return false;
        }
    }

    async restoreSession(token, password) {
        try {
            const response = await fetch(`${this.errorDisplay.serverUrl}/api/session/${token}/restore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (data.success) {
                this.currentSession = {
                    name: data.session.name,
                    token: data.session.token,
                    created: data.session.created,
                    isSaved: true
                };

                localStorage.removeItem('currentSession');
                this.errorDisplay.updateSessionDisplay();
                this.errorDisplay.showNotification(`Session "${data.session.name}" wiederhergestellt!`, 'success');
                return true;
            } else {
                this.errorDisplay.showNotification(data.error || 'Fehler beim Wiederherstellen der Session', 'error');
                return false;
            }
        } catch (error) {
            console.error('Session restoration failed:', error);
            this.errorDisplay.showNotification('Verbindungsfehler beim Wiederherstellen der Session', 'error');
            return false;
        }
    }

    async saveSession(password) {
        if (!this.currentSession || this.currentSession.isSaved) {
            this.errorDisplay.showNotification('Keine Session zu speichern oder bereits gespeichert', 'warning');
            return false;
        }

        try {
            const response = await fetch(`${this.errorDisplay.serverUrl}/api/session/${this.currentSession.token}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (data.success) {
                this.currentSession.isSaved = true;
                localStorage.removeItem('currentSession');
                this.errorDisplay.updateSessionDisplay();
                this.errorDisplay.showNotification(`Session "${this.currentSession.name}" gespeichert!`, 'success');
                return true;
            } else {
                this.errorDisplay.showNotification(data.error || 'Fehler beim Speichern der Session', 'error');
                return false;
            }
        } catch (error) {
            console.error('Session save failed:', error);
            this.errorDisplay.showNotification('Verbindungsfehler beim Speichern der Session', 'error');
            return false;
        }
    }

    restoreSessionData(sessionData) {
        this.currentSession = sessionData;
        localStorage.setItem('currentSession', JSON.stringify(this.currentSession));
        this.errorDisplay.updateSessionDisplay();
    }

    clearSession() {
        this.currentSession = null;
        localStorage.removeItem('currentSession');
        this.errorDisplay.updateSessionDisplay();
        
        // Force UI to clean state and redirect to start page
        this.errorDisplay.forceCleanUIState();
        this.errorDisplay.showStartPage();
        this.errorDisplay.showNotification('Session beendet', 'info');
    }

    endCurrentSession() {
        this.clearSession();
        this.errorDisplay.showNotification('Session beendet', 'info');
    }

    isSessionSaved() {
        if (!this.currentSession) return false;
        return this.currentSession.isSaved === true;
    }

    saveCurrentSessionToStorage() {
        if (!this.currentSession) return;
        
        if (!this.currentSession.isSaved) {
            this.currentSession.lastAccessed = new Date().toISOString();
            localStorage.setItem('currentSession', JSON.stringify(this.currentSession));
        }
    }

    copySessionToken() {
        if (this.currentSession && this.currentSession.token) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(this.currentSession.token).then(() => {
                    this.errorDisplay.showNotification('Session-Token kopiert!', 'success');
                }).catch(err => {
                    console.error('Failed to copy token:', err);
                    this.fallbackCopyToClipboard(this.currentSession.token);
                });
            } else {
                this.fallbackCopyToClipboard(this.currentSession.token);
            }
        } else {
            this.errorDisplay.showNotification('Kein Session-Token verfügbar', 'error');
        }
    }

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
            document.execCommand('copy');
            this.errorDisplay.showNotification('Session-Token kopiert!', 'success');
        } catch (err) {
            console.error('Fallback copy failed:', err);
            this.errorDisplay.showNotification('Kopieren fehlgeschlagen', 'error');
        } finally {
            document.body.removeChild(textArea);
        }
    }
}
