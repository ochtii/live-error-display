/**
 * Status Manager Module
 * Handles updating the status indicator and text
 */

import { getElement } from './dom-utils.js';

// Status types
export const STATUS = {
    NONE: 'none',
    OK: 'ok',
    ERROR: 'error'
};

/**
 * Update the status indicator and text
 * @param {string} state - Status state (STATUS.NONE, STATUS.OK, STATUS.ERROR)
 * @param {string} message - Status message text
 */
export function setStatus(state, message) {
    const statusIndicator = getElement('statusIndicator');
    const statusText = getElement('statusText');
    
    if (!statusIndicator || !statusText) {
        console.warn('Status elements not found');
        return;
    }
    
    // Update status text
    statusText.textContent = message;
    
    // Reset classes
    statusIndicator.className = 'status-indicator';
    
    // Apply appropriate class based on state
    if (state === STATUS.OK) {
        statusIndicator.classList.add('ok');
    } else if (state === STATUS.ERROR) {
        statusIndicator.classList.add('error');
    }
}

/**
 * Show a connecting status
 */
export function showConnecting() {
    setStatus(STATUS.NONE, 'Verbinde...');
}

/**
 * Show a connected status
 */
export function showConnected() {
    setStatus(STATUS.OK, 'Live verbunden');
}

/**
 * Show a connection error status
 * @param {string} [message='Verbindung unterbrochen'] - Error message
 */
export function showConnectionError(message = 'Verbindung unterbrochen') {
    setStatus(STATUS.ERROR, message);
}

/**
 * Show server ready status
 */
export function showReady() {
    setStatus(STATUS.NONE, 'Bereit');
}

/**
 * Show a server error status
 * @param {string} [message='Server-Fehler'] - Error message
 */
export function showServerError(message = 'Server-Fehler') {
    setStatus(STATUS.ERROR, message);
}

/**
 * Show a session status
 * @param {boolean} active - Whether session is active
 * @param {string} [message] - Optional status message
 */
export function showSessionStatus(active, message) {
    if (active) {
        setStatus(STATUS.OK, message || 'Session aktiv');
    } else {
        setStatus(STATUS.NONE, message || 'Keine Session');
    }
}
