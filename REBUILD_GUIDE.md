# Live Error Display v5.0 - Rebuild Guide

This compact guide explains how to rebuild the Live Error Display application from scratch.

## Project Overview

Live Error Display is a web application that shows real-time errors from a server via Server-Sent Events (SSE). Key features:

- Real-time error monitoring via SSE
- Session management (create/restore/end)
- Error filtering and display
- Clean, modular architecture

## Project Structure

```
live-error-display/
├── public/                # Client-side code
│   ├── index.html         # Main HTML
│   ├── session-manager.html # Session management interface
│   ├── css/               # Styles
│   │   ├── variables.css  # CSS variables
│   │   ├── base.css       # Base styles
│   │   ├── layout.css     # Layout styles
│   │   └── components/    # Component-specific styles
│   │       ├── buttons.css
│   │       ├── cards.css
│   │       ├── errors.css
│   │       ├── forms.css
│   │       └── status.css
│   ├── js/                # JavaScript code
│   │   ├── app.js         # Main application entry point
│   │   └── modules/       # JavaScript modules
│   │       ├── dom-utils.js      # DOM helper functions
│   │       ├── error-manager.js  # Error handling
│   │       ├── session-manager.js # Session management
│   │       ├── sse-client.js     # SSE connection handling
│   │       └── status-manager.js # Status indicators
│   └── sounds/            # Sound effects
│       └── sounds.js      # Sound player
├── server.js              # Node.js server
└── sessions/              # Session storage directory
```

## Step 1: Basic Setup

1. Create project directory structure
2. Initialize with package.json
3. Install dependencies

```bash
mkdir -p live-error-display/public/{css,js/modules,sounds}
mkdir -p live-error-display/public/css/components
mkdir -p live-error-display/sessions
cd live-error-display
npm init -y
npm install express express-sse cors
```

## Step 2: Server Implementation

Create `server.js`:

```javascript
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SSE = require('express-sse');

// Initialize express and SSE
const app = express();
const sse = new SSE();
const PORT = process.env.PORT || 3000;

// Sessions directory
const SESSIONS_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// SSE endpoint
app.get('/events', (req, res) => {
    sse.init(req, res);
});

// Create session token
app.post('/api/token', (req, res) => {
    const { name, password } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }
    
    // Generate a token
    const token = crypto.randomBytes(6).toString('hex');
    
    // Create session file
    const sessionData = {
        name,
        token,
        password: password || null,
        created: Date.now()
    };
    
    fs.writeFileSync(
        path.join(SESSIONS_DIR, `${token}.json`),
        JSON.stringify(sessionData, null, 2)
    );
    
    res.json({ token });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Function to send a test error every 10 seconds
function sendTestError() {
    const errorTypes = ['ERROR', 'WARNING', 'INFO'];
    const errorMessages = [
        'Database connection failed',
        'API request timeout',
        'User authentication failed',
        'Invalid input data',
        'Resource not found',
        'Permission denied'
    ];
    
    const randomError = {
        level: errorTypes[Math.floor(Math.random() * errorTypes.length)],
        message: errorMessages[Math.floor(Math.random() * errorMessages.length)],
        timestamp: Date.now(),
        source: Math.random() > 0.5 ? 'System' : 'Application'
    };
    
    sse.send(randomError);
    
    // Schedule next error
    setTimeout(sendTestError, 10000);
}

// Start sending test errors
setTimeout(sendTestError, 5000);
```

## Step 3: HTML Structure

Create `public/index.html`:

```html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Live Error Display v5.0</title>
    <!-- CSS -->
    <link rel="stylesheet" href="/css/variables.css">
    <link rel="stylesheet" href="/css/base.css">
    <link rel="stylesheet" href="/css/layout.css">
    <link rel="stylesheet" href="/css/components/cards.css">
    <link rel="stylesheet" href="/css/components/buttons.css">
    <link rel="stylesheet" href="/css/components/forms.css">
    <link rel="stylesheet" href="/css/components/status.css">
    <link rel="stylesheet" href="/css/components/errors.css">
</head>
<body>
    <div class="container">
        <header>
            <div class="logo-container">
                <div class="logo">🚨</div>
                <div>
                    <h1>Live Error Display</h1>
                    <div class="subtitle">v5.0 • Modern, modular, effizient</div>
                </div>
            </div>
            <div class="status-badge">
                <span id="statusIndicator" class="status-indicator"></span>
                <span id="statusText">Initialisiere...</span>
            </div>
        </header>

        <main>
            <!-- Live Errors Panel -->
            <section class="card">
                <h2>📡 Live Errors <span id="errorCount" class="count-badge">(0)</span></h2>
                <p class="hint">Echtzeit-Fehler erscheinen hier, sobald eine Verbindung hergestellt ist.</p>
                
                <div class="actions">
                    <button id="connectButton" class="btn-primary">
                        <span>Live-Überwachung starten</span>
                    </button>
                    <button id="clearButton" class="btn-secondary">
                        <span>Fehler löschen</span>
                    </button>
                </div>
                
                <div id="noErrors" class="no-errors">
                    Keine Fehler – System bereit.
                </div>
                
                <div id="errorsList" class="error-list">
                    <!-- Errors will be inserted here dynamically -->
                </div>
            </section>
            
            <!-- Session Management Panel -->
            <section class="card">
                <h2>🔑 Session</h2>
                
                <!-- Active Session Info -->
                <div id="activeSession" class="hidden">
                    <div class="active-session-info">
                        <h3>Aktive Session: <span id="sessionName">-</span></h3>
                        <div class="token-display">
                            <span>Token: </span>
                            <code id="sessionToken">-</code>
                            <button id="copyTokenButton" class="btn-icon" title="Token kopieren">
                                <span>📋</span>
                            </button>
                        </div>
                    </div>
                    
                    <div class="actions">
                        <button id="endSessionButton" class="btn-danger">
                            <span>Session beenden</span>
                        </button>
                    </div>
                </div>
                
                <!-- Session Creation/Restoration Forms -->
                <div id="sessionForms">
                    <div class="session-forms">
                        <div class="form-section">
                            <h3>Neue Session erstellen</h3>
                            <div class="form-group">
                                <label for="newSessionName">Name:</label>
                                <input type="text" id="newSessionName" placeholder="Session-Name">
                            </div>
                            <div class="form-group">
                                <label for="sessionPassword">Passwort (optional):</label>
                                <input type="password" id="sessionPassword" placeholder="Optional">
                            </div>
                            <button id="createSessionButton" class="btn-primary">
                                <span>Session erstellen</span>
                            </button>
                        </div>
                        
                        <div class="form-divider">oder</div>
                        
                        <div class="form-section">
                            <h3>Session wiederherstellen</h3>
                            <div class="form-group">
                                <label for="restoreToken">Token:</label>
                                <input type="text" id="restoreToken" placeholder="Session-Token eingeben">
                            </div>
                            <button id="restoreSessionButton" class="btn-primary">
                                <span>Session wiederherstellen</span>
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </main>
        
        <footer>
            <p>&copy; 2025 Live Error Display</p>
        </footer>
    </div>

    <!-- JS -->
    <script src="/js/modules/dom-utils.js" type="module"></script>
    <script src="/js/modules/status-manager.js" type="module"></script>
    <script src="/js/modules/error-manager.js" type="module"></script>
    <script src="/js/modules/session-manager.js" type="module"></script>
    <script src="/js/modules/sse-client.js" type="module"></script>
    <script src="/js/app.js" type="module"></script>
</body>
</html>
```

## Step 4: CSS Styles

Create CSS files:

### variables.css
```css
:root {
    /* Colors */
    --color-primary: #3498db;
    --color-primary-dark: #2980b9;
    --color-secondary: #2ecc71;
    --color-secondary-dark: #27ae60;
    --color-danger: #e74c3c;
    --color-danger-dark: #c0392b;
    --color-warning: #f39c12;
    --color-warning-dark: #d35400;
    --color-info: #3498db;
    --color-info-dark: #2980b9;
    --color-success: #2ecc71;
    --color-success-dark: #27ae60;
    
    --color-background: #f8f9fa;
    --color-card: #ffffff;
    --color-text: #333333;
    --color-text-light: #6c757d;
    --color-border: #e1e4e8;
    
    /* Spacing */
    --spacing-xs: 0.25rem;
    --spacing-sm: 0.5rem;
    --spacing-md: 1rem;
    --spacing-lg: 1.5rem;
    --spacing-xl: 2rem;
    
    /* Border Radius */
    --radius-sm: 0.25rem;
    --radius-md: 0.5rem;
    --radius-lg: 0.75rem;
    
    /* Shadows */
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
    --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
    
    /* Font */
    --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
    --font-size-xs: 0.75rem;
    --font-size-sm: 0.875rem;
    --font-size-md: 1rem;
    --font-size-lg: 1.25rem;
    --font-size-xl: 1.5rem;
    --font-size-xxl: 2rem;
}
```

### base.css
```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: var(--font-family);
    font-size: var(--font-size-md);
    line-height: 1.5;
    color: var(--color-text);
    background-color: var(--color-background);
}

h1, h2, h3, h4, h5, h6 {
    margin-bottom: var(--spacing-md);
    font-weight: 600;
    line-height: 1.2;
}

h1 {
    font-size: var(--font-size-xxl);
}

h2 {
    font-size: var(--font-size-xl);
}

h3 {
    font-size: var(--font-size-lg);
}

p {
    margin-bottom: var(--spacing-md);
}

a {
    color: var(--color-primary);
    text-decoration: none;
}

a:hover {
    text-decoration: underline;
}

.hidden {
    display: none !important;
}

.hint {
    color: var(--color-text-light);
    font-size: var(--font-size-sm);
}

.count-badge {
    font-size: var(--font-size-sm);
    color: var(--color-text-light);
    font-weight: normal;
}
```

### layout.css
```css
.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--spacing-md);
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}

header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-xl);
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--color-border);
}

.logo-container {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
}

.logo {
    font-size: 2.5rem;
    line-height: 1;
}

.subtitle {
    color: var(--color-text-light);
    font-size: var(--font-size-sm);
}

main {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--spacing-xl);
}

@media (min-width: 768px) {
    main {
        grid-template-columns: 3fr 2fr;
    }
}

footer {
    margin-top: var(--spacing-xl);
    padding-top: var(--spacing-md);
    border-top: 1px solid var(--color-border);
    color: var(--color-text-light);
    font-size: var(--font-size-sm);
    text-align: center;
}

.actions {
    display: flex;
    gap: var(--spacing-md);
    margin: var(--spacing-md) 0;
}

.token-display {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
}

.form-section {
    margin-bottom: var(--spacing-lg);
}

.form-divider {
    text-align: center;
    color: var(--color-text-light);
    margin: var(--spacing-md) 0;
    position: relative;
}

.form-divider::before,
.form-divider::after {
    content: "";
    position: absolute;
    top: 50%;
    width: 40%;
    height: 1px;
    background-color: var(--color-border);
}

.form-divider::before {
    left: 0;
}

.form-divider::after {
    right: 0;
}
```

### components/cards.css
```css
.card {
    background-color: var(--color-card);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
}

.card h2 {
    margin-top: 0;
    margin-bottom: var(--spacing-md);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
}
```

### components/buttons.css
```css
.btn-primary,
.btn-secondary,
.btn-danger,
.btn-icon {
    border: none;
    border-radius: var(--radius-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    font-family: var(--font-family);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    transition: background-color 0.2s, transform 0.1s;
}

.btn-primary {
    background-color: var(--color-primary);
    color: white;
}

.btn-primary:hover {
    background-color: var(--color-primary-dark);
}

.btn-secondary {
    background-color: #f1f1f1;
    color: var(--color-text);
}

.btn-secondary:hover {
    background-color: #e5e5e5;
}

.btn-danger {
    background-color: var(--color-danger);
    color: white;
}

.btn-danger:hover {
    background-color: var(--color-danger-dark);
}

.btn-icon {
    background: transparent;
    padding: var(--spacing-xs);
    font-size: var(--font-size-md);
}

.btn-icon:hover {
    background-color: #f1f1f1;
}

button:active {
    transform: translateY(1px);
}

button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
```

### components/forms.css
```css
.form-group {
    margin-bottom: var(--spacing-md);
}

label {
    display: block;
    margin-bottom: var(--spacing-xs);
    font-weight: 500;
}

input[type="text"],
input[type="password"],
select,
textarea {
    width: 100%;
    padding: var(--spacing-sm);
    font-family: var(--font-family);
    font-size: var(--font-size-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background-color: white;
}

input[type="text"]:focus,
input[type="password"]:focus,
select:focus,
textarea:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.session-forms {
    margin-top: var(--spacing-md);
}

.active-session-info {
    background-color: #f8f9fa;
    border-radius: var(--radius-sm);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-md);
}

.active-session-info h3 {
    margin-top: 0;
    margin-bottom: var(--spacing-sm);
}

code {
    font-family: monospace;
    background-color: #f1f1f1;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
}
```

### components/status.css
```css
.status-badge {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: var(--font-size-sm);
}

.status-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: #ccc;
}

.status-indicator.ok {
    background-color: var(--color-success);
}

.status-indicator.error {
    background-color: var(--color-danger);
}

.status-indicator.warning {
    background-color: var(--color-warning);
}
```

### components/errors.css
```css
.error-list {
    margin-top: var(--spacing-md);
    max-height: 500px;
    overflow-y: auto;
}

.error-item {
    padding: var(--spacing-md);
    border-radius: var(--radius-sm);
    background-color: #f8f9fa;
    margin-bottom: var(--spacing-sm);
    border-left: 3px solid #ccc;
}

.error-item:last-child {
    margin-bottom: 0;
}

.error-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--spacing-xs);
    font-size: var(--font-size-sm);
}

.error-level {
    font-weight: bold;
}

.error-timestamp {
    color: var(--color-text-light);
}

.error-source {
    margin-top: var(--spacing-xs);
    font-size: var(--font-size-xs);
    color: var(--color-text-light);
}

.error-item[data-level="ERROR"] {
    border-left-color: var(--color-danger);
}

.error-item[data-level="WARNING"] {
    border-left-color: var(--color-warning);
}

.error-item[data-level="INFO"] {
    border-left-color: var(--color-info);
}

.no-errors {
    text-align: center;
    padding: var(--spacing-xl) 0;
    color: var(--color-text-light);
}
```

## Step 5: JavaScript Modules

### app.js
```javascript
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
```

### dom-utils.js
```javascript
/**
 * DOM utility functions to simplify element access and manipulation
 */

// Cache DOM references to avoid repeated querySelector calls
const domCache = {};

/**
 * Get DOM element by ID with caching
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} - The DOM element or null if not found
 */
export function getElement(id) {
    if (!domCache[id]) {
        domCache[id] = document.getElementById(id);
    }
    return domCache[id];
}

/**
 * Set element visibility
 * @param {string|HTMLElement} element - Element ID or element reference
 * @param {boolean} visible - Whether the element should be visible
 */
export function setVisible(element, visible) {
    const el = typeof element === 'string' ? getElement(element) : element;
    if (el) {
        if (visible) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }
}

/**
 * Set text content of an element
 * @param {string|HTMLElement} element - Element ID or element reference
 * @param {string} text - The text to set
 */
export function setText(element, text) {
    const el = typeof element === 'string' ? getElement(element) : element;
    if (el) {
        el.textContent = text;
    }
}

/**
 * Add event listener with error handling
 * @param {string|HTMLElement} element - Element ID or element reference
 * @param {string} event - Event name (e.g. 'click')
 * @param {Function} callback - Event handler function
 */
export function addSafeEventListener(element, event, callback) {
    const el = typeof element === 'string' ? getElement(element) : element;
    if (el) {
        el.addEventListener(event, async (e) => {
            try {
                await callback(e);
            } catch (error) {
                console.error(`Error in ${event} handler:`, error);
            }
        });
    } else {
        console.warn(`Element not found for event listener: ${element}`);
    }
}

/**
 * Clear all children of an element
 * @param {string|HTMLElement} element - Element ID or element reference
 */
export function clearChildren(element) {
    const el = typeof element === 'string' ? getElement(element) : element;
    if (el) {
        el.innerHTML = '';
    }
}

/**
 * Get the value of an input element
 * @param {string|HTMLElement} element - Element ID or element reference
 * @returns {string} - Trimmed input value
 */
export function getInputValue(element) {
    const el = typeof element === 'string' ? getElement(element) : element;
    return el ? el.value.trim() : '';
}

/**
 * Set the value of an input element
 * @param {string|HTMLElement} element - Element ID or element reference
 * @param {string} value - Value to set
 */
export function setInputValue(element, value) {
    const el = typeof element === 'string' ? getElement(element) : element;
    if (el) {
        el.value = value;
    }
}

/**
 * Create an element with the given properties
 * @param {string} tag - HTML tag name
 * @param {Object} props - Properties to set (className, textContent, etc.)
 * @param {HTMLElement[]} children - Child elements to append
 * @returns {HTMLElement} - The created element
 */
export function createElement(tag, props = {}, children = []) {
    const element = document.createElement(tag);
    
    Object.entries(props).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'textContent') {
            element.textContent = value;
        } else {
            element.setAttribute(key, value);
        }
    });
    
    children.forEach(child => {
        element.appendChild(child);
    });
    
    return element;
}
```

### error-manager.js
```javascript
/**
 * Error Manager Module
 * Handles error list management and UI updates
 */

import { getElement, clearChildren, createElement, setVisible } from './dom-utils.js';

// Error list data
let errors = [];

/**
 * Initialize error manager
 */
export function initErrorManager() {
    updateErrorsUI();
}

/**
 * Add a new error to the list
 * @param {Object} error - Error object
 * @param {string} error.level - Error level (ERROR, WARNING, INFO, etc.)
 * @param {string} error.message - Error message
 * @param {number} error.timestamp - Timestamp of the error
 * @param {string} [error.source] - Source of the error
 */
export function addError(error) {
    // Add to beginning of array
    errors.unshift(error);
    
    // Keep the array at a reasonable size
    if (errors.length > 200) {
        errors.length = 200; // Keep only last 200 errors
    }
    
    // Update the UI
    updateErrorsUI();
}

/**
 * Clear all errors
 */
export function clearErrors() {
    errors = [];
    updateErrorsUI();
}

/**
 * Update the errors UI
 */
export function updateErrorsUI() {
    const errorsList = getElement('errorsList');
    const noErrors = getElement('noErrors');
    const errorCount = getElement('errorCount');
    
    if (!errorsList || !noErrors || !errorCount) {
        console.warn('Error UI elements not found');
        return;
    }
    
    // Update error count
    errorCount.textContent = `(${errors.length})`;
    
    // Show/hide no errors message
    setVisible(noErrors, errors.length === 0);
    
    // Clear the list
    clearChildren(errorsList);
    
    // If there are no errors, return
    if (errors.length === 0) {
        return;
    }
    
    // Display the most recent 50 errors
    errors.slice(0, 50).forEach(error => {
        const timestamp = new Date(error.timestamp).toLocaleString();
        const level = error.level || 'ERROR';
        const message = error.message || JSON.stringify(error);
        const source = error.source || '';
        
        // Create error header
        const headerEl = createElement('div', { className: 'error-header' }, [
            createElement('span', { textContent: level }),
            createElement('span', { className: 'error-timestamp', textContent: timestamp })
        ]);
        
        // Create message element
        const messageEl = createElement('div', { textContent: message });
        
        // Create children array
        const children = [headerEl, messageEl];
        
        // Add source if available
        if (source) {
            children.push(
                createElement('div', { 
                    className: 'error-source', 
                    textContent: `Quelle: ${source}` 
                })
            );
        }
        
        // Create error item and append to list
        const errorElement = createElement('div', { className: 'error-item' }, children);
        errorsList.appendChild(errorElement);
    });
}

/**
 * Get all errors
 * @returns {Array} - The errors array
 */
export function getErrors() {
    return [...errors]; // Return a copy
}
```

### session-manager.js
```javascript
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
```

### status-manager.js
```javascript
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
```

### sse-client.js
```javascript
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
```

## Step 6: Running the Application

1. Run the server:
```bash
node server.js
```

2. Open a web browser and navigate to:
```
http://localhost:3000
```

## Features Overview

1. **Real-time Error Monitoring**
   - Connect to server using SSE protocol
   - Display errors in real-time
   - Show error level, timestamp, and source
   - Clear errors functionality

2. **Session Management**
   - Create new sessions with optional password
   - Restore sessions using token
   - End active sessions

3. **Status Indicators**
   - Connection status shown at all times
   - Visual indicators for connection state

4. **Modular Architecture**
   - Separated concerns (SSE, errors, sessions, DOM utilities)
   - Clean, maintainable code structure
   - Proper module imports/exports

5. **Responsive Design**
   - Works on desktop and mobile devices
   - Clean, modern UI

## Conclusion

This guide provides a complete walkthrough for rebuilding the Live Error Display application from scratch. The modular structure makes it easy to extend and maintain the codebase in the future.
