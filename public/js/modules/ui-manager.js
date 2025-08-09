// UI Manager Module
export class UIManager {
    constructor(errorDisplay) {
        this.errorDisplay = errorDisplay;
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
            hasSession: !!this.errorDisplay.sessionManager.currentSession,
            sessionName: this.errorDisplay.sessionManager.currentSession?.name,
            tokenPreview: this.errorDisplay.sessionManager.currentSession?.token?.substring(0, 16) + '...',
            isSessionSaved: this.errorDisplay.sessionManager.isSessionSaved(),
            sessionBarExists: !!sessionBar,
            headerSessionExists: !!headerSession
        });
        
        // Skip update if header is hidden (no session UI available)
        if (!sessionBar && !headerSession) {
            console.log('📝 Session display skipped - UI elements not available');
            return;
        }
        
        if (this.errorDisplay.sessionManager.currentSession) {
            const sessionNameText = this.errorDisplay.sessionManager.currentSession.name || 'Unbenannte Session';
            const tokenPreview = this.errorDisplay.sessionManager.currentSession.token.substring(0, 16) + '...';
            
            console.log('🔧 Session Display Decision:', {
                sessionExists: true,
                sessionName: sessionNameText,
                isSessionSaved: this.errorDisplay.sessionManager.isSessionSaved(),
                decision: 'Always show session bar when session exists'
            });
            
            // Always show session bar when session exists
            if (sessionBar) {
                sessionBar.style.display = 'flex';
                console.log('✅ Session bar should now be visible');
            }
            if (headerSession) headerSession.style.display = 'none';
            if (sessionName) sessionName.textContent = sessionNameText;
            if (sessionToken) sessionToken.textContent = tokenPreview;
            
            // Show auto-save toggle based on saved status
            if (autoSaveToggle) {
                autoSaveToggle.style.display = this.errorDisplay.sessionManager.isSessionSaved() ? 'flex' : 'none';
            }
            // Also update the header controls to show session status
            this.updateHeaderSessionStatus(true);
        } else {
            console.log('🔧 Session Display Decision: No session - hiding all session UI');
            if (sessionBar) sessionBar.style.display = 'none';
            if (headerSession) headerSession.style.display = 'none';
            if (autoSaveToggle) {
                autoSaveToggle.style.display = 'none';
            }
            this.updateHeaderSessionStatus(false);
        }
        
        // Update unsaved changes indicator
        this.updateUnsavedChangesIndicator();
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

    updateUnsavedChangesIndicator() {
        const indicator = document.getElementById('unsavedChangesIndicator');
        if (indicator) {
            if (this.errorDisplay.hasUnsavedChanges && this.errorDisplay.sessionManager.currentSession && !this.errorDisplay.sessionManager.isSessionSaved()) {
                indicator.style.display = 'inline';
                indicator.title = 'Es gibt ungespeicherte Änderungen in dieser Session';
            } else {
                indicator.style.display = 'none';
            }
        }
    }

    updateStats() {
        const errorCount = document.getElementById('errorCount');
        const clientCount = document.getElementById('clientCount');
        
        if (errorCount) {
            errorCount.textContent = this.errorDisplay.errors.length;
        }
        
        if (clientCount) {
            clientCount.textContent = this.errorDisplay.clients;
        }
    }

    updateConnectionStatus(isConnected) {
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) {
            if (isConnected) {
                connectionStatus.innerHTML = '🟢 Verbunden';
                connectionStatus.className = 'status connected';
            } else {
                connectionStatus.innerHTML = '🔴 Getrennt';
                connectionStatus.className = 'status disconnected';
            }
        }
    }

    showStartPage() {
        console.log('🏠 Forcing start page display');
        this.errorDisplay.currentMode = 'session-manager';
        this.switchToStartMode();
    }

    switchToStartMode() {
        const sections = ['liveSection', 'debugSection', 'testSection', 'archiveSection', 'settingsSection'];
        sections.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = 'none';
        });
        
        const sessionSection = document.getElementById('sessionManagerSection');
        if (sessionSection) {
            sessionSection.style.display = 'block';
        }
        
        this.updateModeDisplay('session-manager');
        this.updateTabVisibility();
    }

    switchMode(mode) {
        this.errorDisplay.currentMode = mode;
        
        // If switching to live mode, make sure we have connection
        if (mode === 'live') {
            this.errorDisplay.sseManager.connectSSE();
        } else if (mode !== 'live') {
            // Disconnect SSE when leaving live mode to save resources
            this.errorDisplay.sseManager.disconnectSSE();
        }
        
        // Hide all sections first
        const sections = ['liveSection', 'debugSection', 'testSection', 'archiveSection', 'settingsSection', 'sessionManagerSection'];
        sections.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = 'none';
        });
        
        // Show the appropriate section
        const targetSection = mode + 'Section';
        // Special case for session manager
        const sectionId = mode === 'session-manager' ? 'sessionManagerSection' : targetSection;
        const element = document.getElementById(sectionId);
        if (element) {
            element.style.display = 'block';
        }
        
        this.updateModeDisplay(mode);
        this.updateTabVisibility();
    }

    updateModeDisplay(mode) {
        // Update all tab buttons
        const tabs = ['live', 'debug', 'test', 'archive', 'settings', 'session-manager'];
        tabs.forEach(tab => {
            const btn = document.getElementById(tab + 'Btn');
            if (btn) {
                if (tab === mode) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });
        
        // Update body class for styling
        document.body.className = mode + '-mode';
    }

    updateTabVisibility() {
        const hasSession = !!this.errorDisplay.sessionManager.currentSession;
        const tabsToToggle = ['liveBtn', 'debugBtn', 'testBtn', 'archiveBtn', 'settingsBtn'];
        
        tabsToToggle.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                if (hasSession) {
                    btn.style.display = 'inline-block';
                    btn.classList.remove('disabled');
                } else {
                    btn.style.display = 'none';
                }
            }
        });
        
        // Session manager tab is always visible
        const sessionBtn = document.getElementById('session-managerBtn');
        if (sessionBtn) {
            sessionBtn.style.display = 'inline-block';
            sessionBtn.classList.remove('disabled');
        }
    }

    forceCleanUIState() {
        console.log('🧹 Forcing clean UI state');
        
        // Clear all error displays
        const errorList = document.getElementById('errorList');
        if (errorList) errorList.innerHTML = '';
        
        const debugErrorList = document.getElementById('debugErrorList');
        if (debugErrorList) debugErrorList.innerHTML = '';
        
        const archiveList = document.getElementById('archiveList');
        if (archiveList) archiveList.innerHTML = '';
        
        // Reset stats
        this.errorDisplay.errors = [];
        this.errorDisplay.bufferedErrors = [];
        this.updateStats();
        
        // Reset connection status
        this.updateConnectionStatus(false);
        
        // Hide all session-related UI initially
        const sessionBar = document.getElementById('sessionBar');
        if (sessionBar) sessionBar.style.display = 'none';
        
        const headerSession = document.getElementById('headerSession');
        if (headerSession) headerSession.style.display = 'none';
        
        // Clear any notifications
        const notificationContainer = document.getElementById('notificationContainer');
        if (notificationContainer) notificationContainer.innerHTML = '';
        
        console.log('✅ UI state cleaned');
    }
}
