/**
 * Session Manager Module
 * Handles session creation, restoration, and management
 */

import { getElement, getInputValue, setInputValue, setVisible } from './dom-utils.js';
import { STATUS, setStatus, showSessionStatus } from './status-manager.js';
import { clearErrors } from './error-manager.js';
import { disconnect } from './sse-client.js';

// Current session state
let currentSession = null;

/**
 * Initialize session manager
 */
export function initSessionManager() {
    updateSessionUI();
}

/**
 * Create a new session
 * @returns {Promise<boolean>} - Whether session was created successfully
 */
export async function createSession() {
    const name = getInputValue('newSessionName');
    const password = getInputValue('sessionPassword');
    
    if (!name) {
        alert('Bitte einen Session-Namen eingeben');
        return false;
    }
    
    try {
        setStatus(STATUS.NONE, 'Erstelle Session...');
        
        const response = await fetch('/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                password: password || undefined
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Unbekannter Fehler');
        }
        
        // Set current session
        currentSession = {
            token: data.token,
            name
        };
        
        // Update UI
        updateSessionUI();
        showSessionStatus(true);
        
        // Clear form fields
        setInputValue('newSessionName', '');
        setInputValue('sessionPassword', '');
        
        return true;
    } catch (error) {
        console.error('Session creation error:', error);
        setStatus(STATUS.ERROR, `Fehler: ${error.message}`);
        return false;
    }
}

/**
 * Restore an existing session
 * @returns {boolean} - Whether session was restored successfully
 */
export function restoreSession() {
    const token = getInputValue('restoreToken');
    
    if (!token) {
        alert('Bitte einen Token eingeben');
        return false;
    }
    
    // Set current session
    currentSession = {
        token,
        name: 'Wiederhergestellte Session'
    };
    
    // Update UI
    updateSessionUI();
    showSessionStatus(true, 'Session wiederhergestellt');
    
    // Clear form field
    setInputValue('restoreToken', '');
    
    return true;
}

/**
 * End the current session
 */
export function endSession() {
    // Close SSE connection
    disconnect();
    
    // Clear session and errors
    currentSession = null;
    clearErrors();
    
    // Update UI
    updateSessionUI();
    showSessionStatus(false, 'Bereit');
}

/**
 * Update the session UI based on current state
 */
export function updateSessionUI() {
    const activeSession = getElement('activeSession');
    const sessionForms = getElement('sessionForms');
    const sessionName = getElement('sessionName');
    const sessionToken = getElement('sessionToken');
    
    if (!activeSession || !sessionForms) {
        console.warn('Session UI elements not found');
        return;
    }
    
    if (currentSession) {
        // Show active session
        if (sessionName) {
            sessionName.textContent = currentSession.name;
        }
        
        if (sessionToken) {
            sessionToken.textContent = currentSession.token;
        }
        
        setVisible(activeSession, true);
        setVisible(sessionForms, false);
    } else {
        // Show session forms
        setVisible(activeSession, false);
        setVisible(sessionForms, true);
    }
}

/**
 * Get the current session
 * @returns {Object|null} - The current session or null if none
 */
export function getCurrentSession() {
    return currentSession;
}

/**
 * Check if a session is active
 * @returns {boolean} - Whether a session is active
 */
export function hasActiveSession() {
    return currentSession !== null;
}
