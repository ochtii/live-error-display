// Live Error Display - Modular Main JavaScript

// Import all modules
import { SessionManager } from './modules/session-manager.js';
import { SSEManager } from './modules/sse-manager.js';
import { UIManager } from './modules/ui-manager.js';
import { SettingsManager } from './modules/settings-manager.js';
import { ErrorManager } from './modules/error-manager.js';
import { ArchiveManager } from './modules/archive-manager.js';
import { NotificationManager } from './modules/notification-manager.js';

class ErrorDisplay {
    constructor() {
        // Server läuft auf demselben Host und Port wie das Frontend
        this.serverUrl = `${window.location.protocol}//${window.location.host}`;
        
        console.log(`🔗 Server URL: ${this.serverUrl}`);
        
        this.clients = 0;
        this.currentMode = 'live';
        this.autoSaveEnabled = false; // Auto-save is disabled by default
        this.hasUnsavedChanges = false; // Track unsaved changes
        
        // Initialize all managers
        this.notificationManager = new NotificationManager();
        this.settingsManager = new SettingsManager(this);
        this.sessionManager = new SessionManager(this);
        this.sseManager = new SSEManager(this);
        this.uiManager = new UIManager(this);
        this.errorManager = new ErrorManager(this);
        this.archiveManager = new ArchiveManager(this);
        
        // Load current session from localStorage
        this.sessionManager.loadCurrentSession();
        
        this.init();
    }

    // === INITIALIZATION === 
    async init() {
        // Always start with clean UI state
        this.uiManager.forceCleanUIState();
        
        // Check for server restart and clear old data if needed
        await this.checkServerRestartAndClearData();
        
        this.setupEventListeners();
        this.uiManager.updateStats();
        this.setupModal();
        this.settingsManager.loadAndApplySettings();
        this.initPushNotifications();
        this.uiManager.updateSessionDisplay();
        
        // Always show start page first
        this.uiManager.showStartPage();
        
        // Validate session state after UI is clean
        await this.validateAndUpdateUIState();
        
        // Start auto-cleanup timer for deleted sessions
        this.startAutoCleanupTimer();
    }

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
        const keys = ['currentSession', 'errorDisplaySettings', 'errorArchive', 'lastSessions'];
        return keys.some(key => localStorage.getItem(key) !== null);
    }

    async clearAllBrowserDataWithNotification() {
        console.log('🧹 Server restart detected or first visit - clearing old browser data');
        
        // Get existing sessions before clearing to validate them
        const existingSessions = this.getStoredSessions();
        
        if (existingSessions.length > 0) {
            console.log('🔍 Found existing sessions, validating with server...');
            await this.validateAndPreserveSessions(existingSessions);
        } else {
            // No existing sessions, just clear everything
            this.clearBrowserData();
            this.showNotification('Browser-Daten wurden bei Server-Neustart bereinigt', 'info');
        }
    }

    getStoredSessions() {
        const sessions = [];
        
        // Check current session
        const currentSession = localStorage.getItem('currentSession');
        if (currentSession) {
            try {
                const session = JSON.parse(currentSession);
                if (session.token) {
                    sessions.push({...session, source: 'current'});
                }
            } catch (error) {
                console.warn('Invalid current session data:', error);
            }
        }
        
        // Check last sessions
        const lastSessions = localStorage.getItem('lastSessions');
        if (lastSessions) {
            try {
                const lastSessionsList = JSON.parse(lastSessions);
                if (Array.isArray(lastSessionsList)) {
                    lastSessionsList.forEach(session => {
                        if (session.token) {
                            sessions.push({...session, source: 'last'});
                        }
                    });
                }
            } catch (error) {
                console.warn('Invalid last sessions data:', error);
            }
        }
        
        return sessions;
    }

    async validateAndPreserveSessions(sessions) {
        const validSessions = [];
        
        for (const session of sessions) {
            try {
                const response = await fetch(`${this.serverUrl}/api/session/${session.token}/validate`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.exists) {
                        validSessions.push(session);
                        console.log(`✅ Session "${session.name}" is still valid on server`);
                    } else {
                        console.log(`❌ Session "${session.name}" no longer exists on server`);
                    }
                } else {
                    console.log(`❓ Could not validate session "${session.name}"`);
                }
            } catch (error) {
                console.warn(`Error validating session "${session.name}":`, error);
            }
        }
        
        // Clear all browser data first
        this.clearBrowserData();
        
        if (validSessions.length > 0) {
            // Restore valid sessions
            const validLastSessions = validSessions.filter(s => s.source === 'last');
            if (validLastSessions.length > 0) {
                localStorage.setItem('lastSessions', JSON.stringify(validLastSessions));
            }
            
            // Restore current session if it was valid
            const validCurrentSession = validSessions.find(s => s.source === 'current');
            if (validCurrentSession) {
                localStorage.setItem('currentSession', JSON.stringify(validCurrentSession));
                this.sessionManager.currentSession = validCurrentSession;
            }
            
            this.showNotification(`Browser-Daten bereinigt - ${validSessions.length} gültige Session(s) erhalten`, 'success');
        } else {
            this.showNotification('Browser-Daten wurden bereinigt - keine gültigen Sessions gefunden', 'info');
        }
    }

    clearBrowserData() {
        const keysToRemove = ['currentSession', 'errorDisplaySettings', 'errorArchive', 'lastSessions'];
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Reset managers to default state
        this.sessionManager.currentSession = null;
        this.settingsManager.settings = this.settingsManager.getDefaultSettings();
        this.archiveManager.archiveData = [];
        this.errorManager.errors = [];
        this.errorManager.bufferedErrors = [];
        
        console.log('🧹 Browser data cleared');
    }

    async validateAndUpdateUIState() {
        if (this.sessionManager.currentSession) {
            console.log('🔍 Validating existing session with server...');
            
            try {
                const response = await fetch(`${this.serverUrl}/api/session/${this.sessionManager.currentSession.token}/validate`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.exists) {
                        console.log('✅ Session is valid, switching to live mode');
                        this.uiManager.switchMode('live');
                        return;
                    } else {
                        console.log('❌ Session no longer exists on server, clearing local session');
                        this.sessionManager.clearSession();
                    }
                } else {
                    console.log('❓ Could not validate session, keeping local session');
                    this.uiManager.switchMode('live');
                    return;
                }
            } catch (error) {
                console.warn('Error validating session:', error);
                // Keep session on validation error
                this.uiManager.switchMode('live');
                return;
            }
        }
        
        // No session or invalid session - stay on start page
        console.log('📝 No valid session found, staying on start page');
        this.enforceStartPageState();
    }

    enforceStartPageState() {
        console.log('🏠 Enforcing start page state');
        this.uiManager.switchMode('session-manager');
        this.uiManager.updateTabVisibility();
    }

    startAutoCleanupTimer() {
        // Run cleanup every 30 minutes
        setInterval(() => {
            this.cleanupDeletedSessions();
        }, 30 * 60 * 1000);
        
        // Run initial cleanup after 30 seconds
        setTimeout(() => {
            this.cleanupDeletedSessions();
        }, 30000);
    }

    async cleanupDeletedSessions() {
        const lastSessions = localStorage.getItem('lastSessions');
        if (!lastSessions) return;
        
        try {
            const sessions = JSON.parse(lastSessions);
            if (!Array.isArray(sessions)) return;
            
            const validSessions = [];
            
            for (const session of sessions) {
                try {
                    const response = await fetch(`${this.serverUrl}/api/session/${session.token}/validate`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.exists) {
                            validSessions.push(session);
                        }
                    }
                } catch (error) {
                    // Keep session on error (server might be down)
                    validSessions.push(session);
                }
            }
            
            if (validSessions.length !== sessions.length) {
                localStorage.setItem('lastSessions', JSON.stringify(validSessions));
                console.log(`🧹 Cleaned up ${sessions.length - validSessions.length} deleted sessions`);
            }
        } catch (error) {
            console.warn('Error during session cleanup:', error);
        }
    }

    setupEventListeners() {
        // Session Management
        const createSessionBtn = document.getElementById('createSessionBtn');
        const restoreSessionBtn = document.getElementById('restoreSessionBtn');
        const saveSessionBtn = document.getElementById('saveSessionBtn');
        const endSession = document.getElementById('endSession');
        const sessionBtn = document.getElementById('sessionBtn');
        const sessionEndLink = document.getElementById('sessionEndLink');
        
        // Tab buttons
        const tabButtons = ['liveBtn', 'debugBtn', 'testBtn', 'archiveBtn', 'settingsBtn', 'session-managerBtn'];
        
        if (createSessionBtn) createSessionBtn.addEventListener('click', () => this.handleCreateSession());
        if (restoreSessionBtn) restoreSessionBtn.addEventListener('click', () => this.handleRestoreSession());
        if (saveSessionBtn) saveSessionBtn.addEventListener('click', () => this.handleSaveSession());
        if (endSession) endSession.addEventListener('click', () => this.sessionManager.clearSession());
        if (sessionBtn) sessionBtn.addEventListener('click', () => this.uiManager.switchMode('session-manager'));
        if (sessionEndLink) sessionEndLink.addEventListener('click', () => this.sessionManager.endCurrentSession());
        
        tabButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                const mode = btnId.replace('Btn', '');
                btn.addEventListener('click', () => this.uiManager.switchMode(mode));
            }
        });
        
        // Settings event listeners
        this.settingsManager.setupSettingsEventListeners();
        
        // Clear buttons
        const clearErrorsBtn = document.getElementById('clearErrorsBtn');
        const clearArchiveBtn = document.getElementById('clearArchiveBtn');
        
        if (clearErrorsBtn) clearErrorsBtn.addEventListener('click', () => this.errorManager.clearAllErrors());
        if (clearArchiveBtn) clearArchiveBtn.addEventListener('click', () => this.archiveManager.clearArchive());
        
        // Test error button
        const testErrorBtn = document.getElementById('testErrorBtn');
        if (testErrorBtn) testErrorBtn.addEventListener('click', () => this.errorManager.sendTestError());
    }

    setupModal() {
        // Modal functionality if needed
        const modal = document.getElementById('modal');
        const closeModal = document.getElementById('closeModal');
        
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                if (modal) modal.style.display = 'none';
            });
        }
        
        // Close modal when clicking outside
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
    }

    initPushNotifications() {
        // Initialize push notifications if supported
        if ('Notification' in window && this.settingsManager.settings.notificationsEnabled) {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }
    }

    // Session handling methods
    async handleCreateSession() {
        const nameInput = document.getElementById('sessionNameInput');
        const passwordInput = document.getElementById('sessionPasswordInput');
        const randomNameBtn = document.getElementById('randomNameBtn');
        
        if (!nameInput || !passwordInput) return;
        
        const name = nameInput.value.trim();
        const password = passwordInput.value;
        
        if (!name) {
            this.showNotification('Bitte geben Sie einen Session-Namen ein', 'error');
            return;
        }
        
        if (!password) {
            this.showNotification('Bitte geben Sie ein Passwort ein', 'error');
            return;
        }
        
        const success = await this.sessionManager.createSession(name, password);
        if (success) {
            nameInput.value = '';
            passwordInput.value = '';
        }
    }

    async handleRestoreSession() {
        const tokenInput = document.getElementById('restoreTokenInput');
        const passwordInput = document.getElementById('restorePasswordInput');
        
        if (!tokenInput || !passwordInput) return;
        
        const token = tokenInput.value.trim();
        const password = passwordInput.value;
        
        if (!token) {
            this.showNotification('Bitte geben Sie einen Session-Token ein', 'error');
            return;
        }
        
        if (!password) {
            this.showNotification('Bitte geben Sie ein Passwort ein', 'error');
            return;
        }
        
        const success = await this.sessionManager.restoreSession(token, password);
        if (success) {
            tokenInput.value = '';
            passwordInput.value = '';
            this.uiManager.switchMode('live');
        }
    }

    async handleSaveSession() {
        const passwordInput = document.getElementById('savePasswordInput');
        
        if (!passwordInput) return;
        
        const password = passwordInput.value;
        
        if (!password) {
            this.showNotification('Bitte geben Sie ein Passwort ein', 'error');
            return;
        }
        
        const success = await this.sessionManager.saveSession(password);
        if (success) {
            passwordInput.value = '';
        }
    }

    // Delegate methods to managers
    showNotification(message, type = 'info', duration = 3000) {
        this.notificationManager.showNotification(message, type, duration);
    }

    updateSessionDisplay() {
        this.uiManager.updateSessionDisplay();
    }

    updateStats() {
        this.uiManager.updateStats();
    }

    updateConnectionStatus(isConnected) {
        this.uiManager.updateConnectionStatus(isConnected);
    }

    switchMode(mode) {
        this.uiManager.switchMode(mode);
        
        // Handle mode-specific logic
        if (mode === 'live') {
            this.errorManager.switchToBufferedErrors();
        } else if (mode === 'archive') {
            this.archiveManager.renderArchive();
        }
    }

    connectSSE() {
        this.sseManager.connectSSE();
    }

    disconnectSSE() {
        this.sseManager.disconnectSSE();
    }

    addError(error) {
        this.errorManager.addError(error);
    }

    forceCleanUIState() {
        this.uiManager.forceCleanUIState();
    }

    showStartPage() {
        this.uiManager.showStartPage();
    }

    copySessionToken() {
        this.sessionManager.copySessionToken();
    }

    openSessionManager() {
        this.uiManager.switchMode('session-manager');
    }

    restoreSession(sessionData) {
        this.sessionManager.restoreSessionData(sessionData);
    }

    clearSession() {
        this.sessionManager.clearSession();
    }

    endCurrentSession() {
        this.sessionManager.endCurrentSession();
    }
}

// Initialize the application
window.errorDisplay = new ErrorDisplay();

// Global event listeners
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
