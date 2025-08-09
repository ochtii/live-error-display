/**
 * SSE Client Module
 * Handles Server-Sent Events connection and message processing
 */

import { STATUS, setStatus, showConnecting, showConnected, showConnectionError } from './status-manager.js';
import { addError } from './error-manager.js';
import { hasActiveSession } from './session-manager.js';

// SSE connection
let eventSource = null;
let isDemoMode = false;

/**
 * Connect to the SSE endpoint
 */
export function connect() {
    try {
        // Check if we have an active session
        if (!hasActiveSession()) {
            startDemoMode();
            return true;
        }
        
        // Close existing connection if any
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
        
        // Exit demo mode if active
        if (isDemoMode) {
            isDemoMode = false;
        }
        
        // Show connecting status
        showConnecting();
        
        // Create new EventSource
        eventSource = new EventSource('/events');
        
        // Set up event handlers
        eventSource.onopen = handleOpen;
        eventSource.onmessage = handleMessage;
        eventSource.onerror = handleError;
        
        return true;
    } catch (error) {
        console.error('SSE connection error:', error);
        showConnectionError('Verbindungsfehler: ' + error.message);
        return false;
    }
}

/**
 * Disconnect from SSE
 */
export function disconnect() {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
    
    // Also exit demo mode if active
    if (isDemoMode) {
        isDemoMode = false;
    }
}

/**
 * Start demo mode with sample errors
 */
export function startDemoMode() {
    // Set demo mode flag
    isDemoMode = true;
    
    // Show demo mode status
    setStatus(STATUS.OK, 'Demo-Modus aktiv');
    
    // Add some sample errors
    setTimeout(() => {
        if (isDemoMode) {
            addError({
                id: 'demo-1',
                timestamp: new Date().toISOString(),
                type: 'TypeError',
                message: 'Cannot read property "length" of undefined',
                source: 'main.js:42',
                severity: 'error'
            });
        }
    }, 1000);
    
    setTimeout(() => {
        if (isDemoMode) {
            addError({
                id: 'demo-2',
                timestamp: new Date().toISOString(),
                type: 'SyntaxError',
                message: 'Unexpected token ")"',
                source: 'utils.js:87',
                severity: 'error'
            });
        }
    }, 3000);
    
    setTimeout(() => {
        if (isDemoMode) {
            addError({
                id: 'demo-3',
                timestamp: new Date().toISOString(),
                type: 'Warning',
                message: 'Resource not found: /images/logo.png',
                source: 'index.html',
                severity: 'warning'
            });
        }
    }, 5000);
}

/**
 * Check if connected to SSE
 * @returns {boolean} - Whether currently connected
 */
export function isConnected() {
    return eventSource !== null && eventSource.readyState === EventSource.OPEN;
}

/**
 * Handle SSE open event
 */
function handleOpen() {
    showConnected();
    console.log('SSE connection established');
}

/**
 * Handle SSE message event
 * @param {MessageEvent} event - The message event
 */
function handleMessage(event) {
    try {
        // Try to parse as JSON
        const errorData = JSON.parse(event.data);
        addError(errorData);
    } catch (e) {
        // Handle plain text messages
        addError({
            level: 'INFO',
            message: event.data,
            timestamp: Date.now()
        });
    }
}

/**
 * Handle SSE error event
 * @param {Event} event - The error event
 */
function handleError(event) {
    showConnectionError();
    console.error('SSE connection error', event);
}
