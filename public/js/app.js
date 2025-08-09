/**
 * Main Application Entry Point
 * Initializes the Live Error Display system and wires up event handlers
 */

import { addSafeEventListener } from './modules/dom-utils.js';
import * as StatusManager from './modules/status-manager.js';
import * as ErrorManager from './modules/error-manager.js';
import * as SessionManager from './modules/session-manager.js';
import * as SSEClient from './modules/sse-client.js';

/**
 * Initialize the application
 */
async function initApp() {
    console.log('🚀 Live Error Display v5.0 starting...');
    
    // Initialize managers
    ErrorManager.initErrorManager();
    SessionManager.initSessionManager();
    
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
    addSafeEventListener('connectButton', 'click', SSEClient.connect);
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
    } else {
        // No active session
        if (connectButton) {
            connectButton.querySelector('span').textContent = 'Demo-Modus starten';
        }
    }
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
