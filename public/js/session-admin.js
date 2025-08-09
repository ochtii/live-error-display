/**
 * Session Admin Module
 * Handles the session management interface
 */

import { getElement, setText, setVisible, getInputValue, setInputValue, addSafeEventListener, createElement, clearChildren } from './modules/dom-utils.js';
import { STATUS, setStatus } from './modules/status-manager.js';
import * as SessionManager from './modules/session-manager.js';

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initSessionAdmin);

/**
 * Initialize the session admin interface
 */
function initSessionAdmin() {
    console.log('📝 Session Admin Interface initializing...');
    
    // Set up event handlers
    setupEventHandlers();
    
    // Check for active session
    checkActiveSession();
    
    // Fetch sessions list
    fetchSessionsList();
    
    // Set initial status
    setStatus(STATUS.OK, 'Bereit');
}

/**
 * Set up event handlers for the session admin interface
 */
function setupEventHandlers() {
    // Session management buttons
    addSafeEventListener('createSessionButton', 'click', createSessionHandler);
    addSafeEventListener('restoreSessionButton', 'click', restoreSessionHandler);
    addSafeEventListener('endSessionButton', 'click', endSessionHandler);
    addSafeEventListener('goToMonitorButton', 'click', () => window.location.href = 'index.html');
    addSafeEventListener('copyTokenButton', 'click', copyTokenHandler);
}

/**
 * Check for an active session and update UI accordingly
 */
function checkActiveSession() {
    const session = SessionManager.getCurrentSession();
    
    if (session) {
        displayActiveSession(session);
    }
}

/**
 * Create a new session
 */
async function createSessionHandler() {
    const success = await SessionManager.createSession();
    
    if (success) {
        const session = SessionManager.getCurrentSession();
        displayActiveSession(session);
        fetchSessionsList();
    }
}

/**
 * Restore an existing session
 */
function restoreSessionHandler() {
    const token = getInputValue('restoreToken');
    const password = getInputValue('restorePassword');
    
    if (!token) {
        alert('Bitte einen Token eingeben');
        return;
    }
    
    // In a real application, we would validate the token/password with the server
    SessionManager.restoreSession();
    
    const session = SessionManager.getCurrentSession();
    displayActiveSession(session);
    fetchSessionsList();
}

/**
 * End the current session
 */
function endSessionHandler() {
    SessionManager.endSession();
    setVisible('activeSession', false);
    setVisible('sessionForms', true);
    fetchSessionsList();
}

/**
 * Copy session token to clipboard
 */
function copyTokenHandler() {
    const tokenElement = getElement('sessionToken');
    
    if (tokenElement) {
        const token = tokenElement.textContent;
        navigator.clipboard.writeText(token)
            .then(() => {
                alert('Token in die Zwischenablage kopiert!');
            })
            .catch(err => {
                console.error('Fehler beim Kopieren: ', err);
                alert('Fehler beim Kopieren. Bitte manuell kopieren: ' + token);
            });
    }
}

/**
 * Display active session information
 * @param {Object} session - Session object with token and name
 */
function displayActiveSession(session) {
    setText('sessionName', session.name);
    setText('sessionToken', session.token);
    setText('sessionCreated', new Date().toLocaleString());
    
    setVisible('activeSession', true);
    setVisible('sessionForms', false);
}

/**
 * Fetch and display the list of active sessions
 */
async function fetchSessionsList() {
    // In a real app, this would fetch from the server
    const sessions = [];
    
    // For demo, add the current session if active
    const currentSession = SessionManager.getCurrentSession();
    if (currentSession) {
        sessions.push({
            ...currentSession,
            created: Date.now(),
            lastActivity: Date.now()
        });
    }
    
    // Update UI
    updateSessionsUI(sessions);
}

/**
 * Update the sessions list UI
 * @param {Array} sessions - Array of session objects
 */
function updateSessionsUI(sessions) {
    const sessionsList = getElement('sessionsList');
    const noSessions = getElement('noSessions');
    const sessionCount = getElement('sessionCount');
    
    if (!sessionsList || !noSessions || !sessionCount) {
        console.warn('Session UI elements not found');
        return;
    }
    
    // Update session count
    sessionCount.textContent = `(${sessions.length})`;
    
    // Show/hide no sessions message
    setVisible(noSessions, sessions.length === 0);
    
    // Clear the list
    clearChildren(sessionsList);
    
    // If there are no sessions, return
    if (sessions.length === 0) {
        return;
    }
    
    // Display all sessions
    sessions.forEach(session => {
        const created = new Date(session.created).toLocaleString();
        const lastActivity = new Date(session.lastActivity).toLocaleString();
        
        // Create session item
        const sessionElement = createElement('div', { className: 'error-item' }, [
            createElement('div', { className: 'error-header' }, [
                createElement('span', { textContent: session.name }),
                createElement('span', { className: 'error-timestamp', textContent: `Token: ${session.token}` })
            ]),
            createElement('div', { textContent: `Erstellt: ${created}` }),
            createElement('div', { className: 'error-source', textContent: `Letzte Aktivität: ${lastActivity}` })
        ]);
        
        sessionsList.appendChild(sessionElement);
    });
}
