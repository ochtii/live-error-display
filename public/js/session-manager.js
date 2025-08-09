// Session Manager - Extracted from app.js
class SessionManager {
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
                    this.errorDisplay.showNotification('Session abgelaufen (24h inaktiv) - neue Session erforderlich', 'warning');
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
                this.errorDisplay.showNotification('Fehlerhafte Session-Daten entfernt', 'warning');
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
                this.errorDisplay.showNotification(`${savedSessions.length} gespeicherte Session(s) verfügbar - Session Manager öffnen zum Wiederherstellen`, 'info');
            }, 2000);
        }
    }

    async validateSessionToken() {
        if (!this.currentSession?.token) return;
        
        try {
            const response = await fetch(`${this.errorDisplay.serverUrl}/api/session/${this.currentSession.token}`);
            if (!response.ok) {
                console.warn('❌ Session token validation failed, clearing session');
                this.errorDisplay.showNotification('Session ungültig - neue Session wird erstellt', 'warning');
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
            this.errorDisplay.showNotification('Verbindung zum Server nicht möglich - Session-Status unbekannt', 'warning');
        }
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
        
        // Force UI to clean state and redirect to start page
        this.errorDisplay.forceCleanUIState();
        this.errorDisplay.showStartPage();
        this.errorDisplay.showNotification('Session beendet', 'info');
    }

    updateSessionDisplay() {
        console.log('🔄 Updating session display');
        const sessionBar = document.getElementById('sessionBar');
        const sessionName = document.getElementById('sessionName');
        const sessionToken = document.getElementById('sessionToken');
        
        // Header session info elements
        const headerSession = document.getElementById('headerSession');
        const autoSaveToggle = document.getElementById('autoSaveToggle');
        
        if (this.currentSession) {
            console.log('✅ Session active - showing session UI');
            const sessionNameText = this.currentSession.name || 'Unbenannte Session';
            const tokenPreview = this.currentSession.token.substring(0, 16) + '...';
            
            // Show session bar
            if (sessionBar) {
                sessionBar.style.display = 'flex';
            }
            
            // Hide header session info (we use session bar instead)
            if (headerSession) headerSession.style.display = 'none';
            
            // Update session info
            if (sessionName) sessionName.textContent = sessionNameText;
            if (sessionToken) sessionToken.textContent = tokenPreview;
            
            // Show auto-save toggle if session is saved
            if (autoSaveToggle) {
                autoSaveToggle.style.display = this.isSessionSaved() ? 'flex' : 'none';
            }
            
            // Update navigation
            this.errorDisplay.updateNavigationState(true);
        } else {
            console.log('� No session - hiding session UI');
            
            // Hide session UI elements
            if (sessionBar) sessionBar.style.display = 'none';
            if (headerSession) headerSession.style.display = 'none';
            if (autoSaveToggle) autoSaveToggle.style.display = 'none';
            
            // Update navigation
            this.errorDisplay.updateNavigationState(false);
            
            // Show start page
            this.errorDisplay.showStartPage();
        }
        
        // Update unsaved changes indicator
        this.errorDisplay.updateUnsavedChangesIndicator();
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
        this.errorDisplay.showNotification('Session beendet', 'info');
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
        this.errorDisplay.switchMode('session-manager');
    }

    copySessionToken() {
        if (this.currentSession && this.currentSession.token) {
            // Check if clipboard API is available
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
            this.errorDisplay.showNotification('Session-Token kopiert!', 'success');
        } catch (err) {
            console.error('Fallback copy failed:', err);
            this.errorDisplay.showNotification('Kopieren fehlgeschlagen. Token: ' + text, 'error');
        }
        
        document.body.removeChild(textArea);
    }

    // Override error reporting to include session token
    async reportError(message, source = 'manual', level = 'error') {
        if (!this.currentSession) {
            this.errorDisplay.showNotification('Keine aktive Session - Error kann nicht gesendet werden', 'error');
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
            const response = await fetch(`${this.errorDisplay.serverUrl}/error`, {
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
                this.errorDisplay.showNotification(`Error: ${errorData.error}`, 'error');
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
            this.errorDisplay.showNotification('Keine aktive Session zum Speichern', 'warning');
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
                        <small class="input-hint">🔒 Passwort ist erforderlich (min. 4 Zeichen)</small>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Abbrechen</button>
                    <button class="btn btn-primary" onclick="window.errorDisplay.sessionManager.confirmSaveSession()">Speichern</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    confirmSaveSession() {
        const name = document.getElementById('saveSessionName').value.trim();
        const password = document.getElementById('saveSessionPassword').value.trim();
        
        if (!name) {
            this.errorDisplay.showNotification('Bitte Session Name eingeben', 'warning');
            return;
        }
        
        if (!password) {
            this.errorDisplay.showNotification('Passwort ist erforderlich für gespeicherte Sessions', 'warning');
            return;
        }
        
        if (password.length < 4) {
            this.errorDisplay.showNotification('Passwort muss mindestens 4 Zeichen lang sein', 'warning');
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
                
                this.errorDisplay.showNotification('Session serverseitig gespeichert! Browser-Daten wurden gelöscht.', 'success');
                this.updateSessionDisplay();
                this.errorDisplay.markAsSaved(); // Mark as saved and hide unsaved changes indicator
                
                // Refresh session manager if open
                if (this.errorDisplay.currentMode === 'session-manager') {
                    this.loadSavedSessionsInline();
                }
            }
        });
    }

    async saveSessionToServer(password) {
        try {
            const response = await fetch(`${this.errorDisplay.serverUrl}/api/session/${this.currentSession.token}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: this.currentSession.name,
                    password: password || null,
                    archiveData: this.errorDisplay.archiveData || []
                })
            });
            
            if (response.ok) {
                // Mark session as saved
                this.currentSession.isSaved = true;
                this.currentSession.hasPassword = !!password;
                return true;
            } else {
                this.errorDisplay.showNotification('Fehler beim Speichern der Session', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error saving session:', error);
            this.errorDisplay.showNotification('Verbindungsfehler beim Speichern', 'error');
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

    // Update session activity timestamp
    updateSessionActivity() {
        if (this.currentSession && !this.currentSession.isSaved) {
            this.currentSession.lastAccessed = new Date().toISOString();
            localStorage.setItem('currentSession', JSON.stringify(this.currentSession));
        }
    }

    async validateAndPreserveSessions() {
        try {
            // Get existing lastSessions from localStorage
            const lastSessionsData = localStorage.getItem('lastSessions');
            if (!lastSessionsData) {
                return 0; // No sessions to validate
            }
            
            const lastSessions = JSON.parse(lastSessionsData);
            if (!Array.isArray(lastSessions) || lastSessions.length === 0) {
                return 0; // No sessions to validate
            }
            
            console.log(`🔍 Validating ${lastSessions.length} stored sessions against server...`);
            
            const validSessions = [];
            
            // Check each session against server
            for (const sessionData of lastSessions) {
                if (!sessionData.token) continue;
                
                try {
                    // Try to validate session on server (without loading it)
                    const response = await fetch(`${this.errorDisplay.serverUrl}/api/session/${sessionData.token}/validate`, {
                        method: 'GET'
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        if (result.exists) {
                            validSessions.push(sessionData);
                            console.log(`✅ Session valid: ${sessionData.name} (${sessionData.token.substring(0, 8)}...)`);
                        }
                    }
                } catch (error) {
                    console.log(`❌ Failed to validate session: ${sessionData.token.substring(0, 8)}...`);
                }
            }
            
            // Update lastSessions with only valid sessions
            if (validSessions.length > 0) {
                localStorage.setItem('lastSessions', JSON.stringify(validSessions));
                console.log(`💾 Preserved ${validSessions.length} valid sessions in localStorage`);
            } else {
                localStorage.removeItem('lastSessions');
            }
            
            return validSessions.length;
            
        } catch (error) {
            console.error('Error validating sessions:', error);
            return 0; // On error, don't preserve any sessions
        }
    }

    async validateAndUpdateUIState() {
        // Validate current session if exists
        if (this.currentSession && this.currentSession.token) {
            try {
                const response = await fetch(`${this.errorDisplay.serverUrl}/api/session/${this.currentSession.token}`);
                if (!response.ok) {
                    console.warn('❌ Current session token validation failed, clearing session');
                    this.errorDisplay.showNotification('Session ungültig - neue Session wird erstellt', 'warning');
                    this.clearSession();
                    return;
                } else {
                    console.log('✅ Current session token validated successfully');
                    this.errorDisplay.updateNavigationState(true);
                    return;
                }
            } catch (error) {
                console.warn('⚠️ Could not validate current session token:', error);
                this.errorDisplay.showNotification('Verbindung zum Server nicht möglich - Session-Status unbekannt', 'warning');
            }
        }
        
        // No valid current session - check for recoverable sessions
        this.checkForRecoverableSessions();
        this.errorDisplay.updateNavigationState(false);
    }

    startAutoCleanupTimer() {
        // Clean up expired sessions every hour
        setInterval(() => {
            this.cleanupExpiredSessions();
        }, 60 * 60 * 1000); // 1 hour
        
        // Initial cleanup
        this.cleanupExpiredSessions();
    }

    cleanupExpiredSessions() {
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        const now = Date.now();
        
        // Clean up current session if expired
        if (this.currentSession && this.currentSession.lastAccessed) {
            const lastAccessed = new Date(this.currentSession.lastAccessed).getTime();
            if (now - lastAccessed > maxAge) {
                console.log('🧹 Cleaning up expired current session');
                this.clearSession();
            }
        }
        
        // Clean up saved sessions
        const savedSessions = JSON.parse(localStorage.getItem('savedSessions') || '[]');
        const activeSessions = savedSessions.filter(session => {
            if (!session.lastAccessed) return true; // Keep sessions without timestamp
            const lastAccessed = new Date(session.lastAccessed).getTime();
            return now - lastAccessed <= maxAge;
        });
        
        if (activeSessions.length !== savedSessions.length) {
            localStorage.setItem('savedSessions', JSON.stringify(activeSessions));
            console.log(`🧹 Cleaned up ${savedSessions.length - activeSessions.length} expired saved sessions`);
        }
    }

    setupEventListeners() {
        // Session Management Event Listeners
        const sessionBtn = document.getElementById('sessionBtn');
        const copyToken = document.getElementById('copyToken');
        const sessionManager = document.getElementById('sessionManager');
        const saveSession = document.getElementById('saveSession');
        const endSession = document.getElementById('endSession');
        const copyTokenHeader = document.getElementById('copyTokenHeader');
        const sessionEndLink = document.getElementById('sessionEndLink');
        const autoSaveCheckbox = document.getElementById('autoSaveCheckbox');
        
        if (sessionBtn) sessionBtn.addEventListener('click', () => this.showSessionManager());
        if (copyToken) copyToken.addEventListener('click', () => this.copySessionToken());
        if (sessionManager) sessionManager.addEventListener('click', () => this.showSessionManager());
        if (saveSession) saveSession.addEventListener('click', () => this.saveCurrentSession());
        if (endSession) endSession.addEventListener('click', () => this.clearSession());
        if (copyTokenHeader) copyTokenHeader.addEventListener('click', () => this.copySessionToken());
        if (sessionEndLink) sessionEndLink.addEventListener('click', () => this.endCurrentSession());
        if (autoSaveCheckbox) autoSaveCheckbox.addEventListener('change', (e) => this.toggleAutoSave(e.target.checked));
        
        // Session Manager inline controls
        const createNewSessionBtn = document.getElementById('createNewSessionBtn');
        const restoreSessionBtn = document.getElementById('restoreSessionBtn');
        const refreshLastSessionsBtn = document.getElementById('refreshLastSessionsBtn');
        
        if (createNewSessionBtn) createNewSessionBtn.addEventListener('click', () => this.createNewSession());
        if (restoreSessionBtn) restoreSessionBtn.addEventListener('click', () => this.restoreSessionFromToken());
        if (refreshLastSessionsBtn) refreshLastSessionsBtn.addEventListener('click', () => this.loadLastSessionsInline());
    }

    showSessionManager() {
        // Implementation für Session Manager UI
        this.errorDisplay.switchMode('session-manager');
    }

    toggleAutoSave(enabled) {
        this.errorDisplay.autoSaveEnabled = enabled;
        if (enabled) {
            this.errorDisplay.showNotification('Auto-Save aktiviert', 'success');
        } else {
            this.errorDisplay.showNotification('Auto-Save deaktiviert', 'info');
        }
    }

    restoreSessionFromToken() {
        // Implementation für Session-Wiederherstellung
        this.errorDisplay.showNotification('Session-Wiederherstellung noch nicht implementiert', 'info');
    }

    loadLastSessionsInline() {
        // Implementation für letzte Sessions laden
        console.log('Loading last sessions...');
    }

    async createNewSession() {
        try {
            const response = await fetch(`${this.errorDisplay.serverUrl}/api/token`);
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
                this.errorDisplay.disconnectSSE();
                this.errorDisplay.connectSSE();
                
                this.errorDisplay.showNotification(`Neue Session "${this.currentSession.name}" erstellt`, 'success');
                console.log('🆕 New session created:', {
                    name: this.currentSession.name,
                    tokenPreview: this.currentSession.token?.substring(0, 16) + '...'
                });
                
                // Switch to live mode automatically
                this.errorDisplay.switchMode('live');
            } else {
                throw new Error(`Server error: ${response.status}`);
            }
        } catch (error) {
            console.error('Error creating session:', error);
            this.errorDisplay.showNotification('Fehler beim Erstellen der Session', 'error');
        }
    }

    updateCurrentSessionCard() {
        // Implementation für Session Card Update
        console.log('Updating current session card...');
    }

    updateSessionManagerState() {
        // Implementation für Session Manager State Update
        console.log('Updating session manager state...');
    }

    setRandomPlaceholder() {
        // Implementation für Random Placeholder
        console.log('Setting random placeholder...');
    }

    markAsUnsaved() {
        if (this.currentSession && this.isSessionSaved()) {
            this.errorDisplay.hasUnsavedChanges = true;
            this.errorDisplay.updateUnsavedChangesIndicator();
        }
    }

    markAsSaved() {
        this.errorDisplay.hasUnsavedChanges = false;
        this.errorDisplay.updateUnsavedChangesIndicator();
    }

    updateUnsavedChangesIndicator() {
        const indicator = document.getElementById('unsavedChangesIndicator');
        if (!indicator) return;

        const shouldShow = !this.errorDisplay.autoSaveEnabled && 
                          this.errorDisplay.hasUnsavedChanges && 
                          this.currentSession && 
                          this.isSessionSaved();

        indicator.style.display = shouldShow ? 'flex' : 'none';
    }

    saveCurrentSessionDirect() {
        this.errorDisplay.showNotification('Direct session save noch nicht implementiert', 'info');
    }

    // Additional methods would continue here with the remaining session-related functions...
    // This includes all the inline session management functions from the original app.js
}
