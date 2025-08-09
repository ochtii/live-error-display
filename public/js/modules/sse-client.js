/**
 * SSE Client Module
 * Handles Server-Sent Events connection and message processing
 */

import { STATUS, setStatus, showConnecting, showConnected, showConnectionError } from './status-manager.js';
import { addError } from './error-manager.js';

// SSE connection
let eventSource = null;

/**
 * Connect to the SSE endpoint
 */
export function connect() {
    try {
        // Close existing connection if any
        if (eventSource) {
            eventSource.close();
            eventSource = null;
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
