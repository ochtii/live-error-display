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
    addSafeEventListener('createSessionButton', 'click', SessionManager.createSession);
    addSafeEventListener('restoreSessionButton', 'click', SessionManager.restoreSession);
    addSafeEventListener('endSessionButton', 'click', SessionManager.endSession);
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

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
