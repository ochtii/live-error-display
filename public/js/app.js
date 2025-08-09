/**
 * Main Application Entry Point
 * Initializes the Live Error Display system and wires up event handlers
 */

import { addSafeEventListener } from './modules/dom-utils.js';
import * as StatusManager from './modules/status-manager.js';
import * as ErrorManager from './modules/error-manager.js';
import * as SessionManager from './modules/session-manager.js';
import * as SSEClient from './modules/sse-client.js';
import * as SoundManager from './modules/sound-manager.js';

/**
 * Initialize the application
 */
async function initApp() {
    console.log('🚀 Live Error Display v5.0 starting...');
    
    // Initialize managers
    ErrorManager.initErrorManager();
    SessionManager.initSessionManager();
    SoundManager.initSoundManager();
    
    // Set up event listeners
    setupEventHandlers();
    
    // Update UI based on session state
    updateUIBasedOnSession();
    
    // Check server health
    await checkServerHealth();
}

/**
 * Set up event handlers for UI interactions
 */
function setupEventHandlers() {
    // Live errors buttons
    addSafeEventListener('connectButton', 'click', () => {
        SSEClient.connect();
        updateDemoModeUI(SSEClient.isDemoMode());
    });
    addSafeEventListener('stopDemoButton', 'click', () => {
        SSEClient.disconnect();
        updateDemoModeUI(false);
    });
    addSafeEventListener('clearButton', 'click', ErrorManager.clearErrors);
    
    // Session management buttons
    addSafeEventListener('createSessionButton', 'click', () => {
        SessionManager.createSession().then(success => {
            if (success) {
                updateUIBasedOnSession();
            }
        });
    });
    addSafeEventListener('restoreSessionButton', 'click', () => {
        const success = SessionManager.restoreSession();
        if (success) {
            updateUIBasedOnSession();
        }
    });
    addSafeEventListener('endSessionButton', 'click', () => {
        SessionManager.endSession();
        updateUIBasedOnSession();
    });
}

/**
 * Check the server health status
 */
async function checkServerHealth() {
    try {
        const response = await fetch('/api/health');
        if (response.ok) {
            StatusManager.setStatus(StatusManager.STATUS.OK, 'Server verbunden');
        } else {
            StatusManager.setStatus(StatusManager.STATUS.ERROR, 'Server-Fehler');
        }
    } catch (error) {
        StatusManager.setStatus(StatusManager.STATUS.ERROR, 'Server nicht erreichbar');
        console.error('Server health check failed:', error);
    }
}

/**
 * Update UI elements based on session state
 */
function updateUIBasedOnSession() {
    const connectButton = document.getElementById('connectButton');
    const demoModeInfo = document.getElementById('demoModeInfo');
    
    if (SessionManager.hasActiveSession()) {
        // Active session
        if (connectButton) {
            connectButton.querySelector('span').textContent = 'Live-Überwachung starten';
        }
        
        // Hide demo mode info if visible
        if (demoModeInfo && !demoModeInfo.classList.contains('hidden')) {
            demoModeInfo.classList.add('hidden');
        }
        
        // Update demo mode UI
        updateDemoModeUI(false);
    } else {
        // No active session
        if (connectButton) {
            connectButton.querySelector('span').textContent = 'Demo-Modus starten';
        }
    }
}

/**
 * Update UI for demo mode state
 * @param {boolean} isDemoActive - Whether demo mode is active
 */
function updateDemoModeUI(isDemoActive) {
    const connectButton = document.getElementById('connectButton');
    const stopDemoButton = document.getElementById('stopDemoButton');
    
    if (isDemoActive) {
        // Demo mode active
        if (connectButton) {
            connectButton.classList.add('hidden');
        }
        if (stopDemoButton) {
            stopDemoButton.classList.remove('hidden');
        }
    } else {
        // Demo mode inactive
        if (connectButton) {
            connectButton.classList.remove('hidden');
        }
        if (stopDemoButton) {
            stopDemoButton.classList.add('hidden');
        }
    }
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
