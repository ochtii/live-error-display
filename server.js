const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

// Track server start time
const SERVER_START_TIME = new Date();

// Ses// Middleware für JSON body parsing
app.use(express.json());

// === SESSION API ROUTES ===

// Get new session token (POST with optional name and password)
app.post('/api/token', (req, res) => {
    try {
        const { name, password } = req.body || {};
        const session = SessionManager.createSession(name, password);
        res.json({
            success: true,
            token: session.token,
            session: {
                name: session.name,
                createdAt: session.createdAt,
                lastModified: session.lastModified,
                modifiedBy: session.modifiedBy,
                errorCount: session.errors.length,
                hasPassword: session.hasPassword
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to create session'
        });
    }
});

// Get new session token (GET for backwards compatibility)
app.get('/api/token', (req, res) => {
    try {
        const session = SessionManager.createSession();
        res.json({
            success: true,
            token: session.token,
            session: {
                name: session.name,
                createdAt: session.createdAt,
                lastModified: session.lastModified,
                modifiedBy: session.modifiedBy,
                errorCount: session.errors.length,
                hasPassword: session.hasPassword
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to create session'
        });
    }
});

// Restore session with token (POST with optional password)
app.post('/api/session/:token', (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body || {};
        
        const session = SessionManager.getSession(token);
        
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }
        
        // Verify password if session is protected
        if (session.hasPassword && !SessionManager.verifyPassword(token, password)) {
            return res.status(401).json({
                success: false,
                error: 'Incorrect password',
                requiresPassword: true
            });
        }
        
        res.json({
            success: true,
            session: {
                token: session.token,
                name: session.name,
                createdAt: session.createdAt,
                lastModified: session.lastModified,
                modifiedBy: session.modifiedBy,
                errorCount: session.errors.length,
                hasPassword: session.hasPassword
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to restore session'
        });
    }
});

// Get server information
app.get('/api/server-info', (req, res) => {
    res.json({
        success: true,
        startTime: SERVER_START_TIME.toISOString(),
        uptime: Date.now() - SERVER_START_TIME.getTime(),
        version: '2.1'
    });
});

// Get session expiry information
app.get('/api/session/:token/expiry', (req, res) => {
    try {
        const { token } = req.params;
        const expiryInfo = SessionManager.getSessionExpiryInfo(token);
        
        if (!expiryInfo) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }
        
        res.json({
            success: true,
            expiry: expiryInfo
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get session expiry info'
        });
    }
});

// Validate session exists (without loading it)
app.get('/api/session/:token/validate', (req, res) => {
    try {
        const { token } = req.params;
        
        // Check if session exists in memory
        const session = sessions.get(token);
        if (session) {
            return res.json({
                exists: true,
                name: session.name,
                lastAccessed: session.lastAccessed
            });
        }
        
        // Check if session file exists on disk
        const sessionFile = path.join(SESSIONS_DIR, `${token}.json`);
        const fileExists = fs.existsSync(sessionFile);
        
        if (fileExists) {
            // Try to decrypt to ensure it's valid
            try {
                const encryptedData = fs.readFileSync(sessionFile, 'utf8');
                const sessionData = decryptData(encryptedData);
                if (sessionData) {
                    return res.json({
                        exists: true,
                        name: sessionData.name || 'Unknown Session',
                        lastAccessed: sessionData.lastAccessed
                    });
                }
            } catch (error) {
                // File exists but is corrupted
                return res.json({ exists: false });
            }
        }
        
        res.json({ exists: false });
    } catch (error) {
        res.status(500).json({
            exists: false,
            error: 'Failed to validate session'
        });
    }
});

// Restore session with token (GET for backwards compatibility, no password support)
app.get('/api/session/:token', (req, res) => {
    try {
        const { token } = req.params;
        const session = SessionManager.getSession(token);
        
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }
        
        // For GET requests, only allow access to non-password protected sessions
        if (session.hasPassword) {
            return res.status(401).json({
                success: false,
                error: 'Password required',
                requiresPassword: true,
                hasPassword: true
            });
        }
        
        res.json({
            success: true,
            session: {
                token: session.token,
                name: session.name,
                createdAt: session.createdAt,
                lastModified: session.lastModified,
                modifiedBy: session.modifiedBy,
                errorCount: session.errors.length,
                hasPassword: session.hasPassword
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to restore session'
        });
    }
});

// Delete session
app.delete('/api/session/:token', (req, res) => {
    try {
        const { token } = req.params;
        SessionManager.deleteSession(token);
        
        res.json({
            success: true,
            message: 'Session deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to delete session'
        });
    }
});

// Get session errors
app.get('/api/session/:token/errors', (req, res) => {
    try {
        const { token } = req.params;
        const session = SessionManager.getSession(token);
        
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }
        
        res.json({
            success: true,
            errors: session.errors,
            errorCount: session.errors.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get session errors'
        });
    }
});

// Get session archive
app.get('/api/session/:token/archive', (req, res) => {
    try {
        const { token } = req.params;
        const session = SessionManager.getSession(token);
        
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }
        
        res.json({
            success: true,
            archive: session.archive || [],
            archiveCount: (session.archive || []).length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get session archive'
        });
    }
});

// === MAIN ROUTES ===

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Return all errors as JSON (session-aware)
app.get('/errors', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const sessionToken = req.headers['x-session-token'] || req.query.session;
    
    console.log(`🔍 Request for all errors from ${ip}${sessionToken ? ` (session: ${sessionToken})` : ''}`);
    
    let errors = globalErrors;
    if (sessionToken) {
        const session = SessionManager.getSession(sessionToken);
        if (session) {
            errors = session.errors;
            console.log(`📊 Returning ${errors.length} errors for session: ${session.name}`);
        } else {
            console.log(`❌ Invalid session token in errors request: ${sessionToken}`);
            return res.status(401).json({ error: 'Invalid session token' });
        }
    }
    
    const response = {
        errors: errors,
        offlineBuffer: offlineBuffer,
        totalErrors: errors.length,
        bufferedErrors: offlineBuffer.length,
        clientCount: clients.size,
        sessionActive: !!sessionToken
    };
    
    res.json(response);
});

const SESSIONS_DIR = path.join(__dirname, 'sessions');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Create sessions directory if it doesn't exist
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Clean up corrupted session files on startup
function cleanupCorruptedSessions() {
    try {
        const sessionFiles = fs.readdirSync(SESSIONS_DIR);
        let corruptedCount = 0;
        
        for (const file of sessionFiles) {
            if (file.endsWith('.json')) {
                const filePath = path.join(SESSIONS_DIR, file);
                try {
                    const encryptedData = fs.readFileSync(filePath, 'utf8');
                    const decrypted = decryptData(encryptedData);
                    if (!decrypted) {
                        fs.unlinkSync(filePath);
                        corruptedCount++;
                    }
                } catch (error) {
                    fs.unlinkSync(filePath);
                    corruptedCount++;
                }
            }
        }
        
        if (corruptedCount > 0) {
            console.log(`🧹 Cleaned up ${corruptedCount} corrupted session files on startup`);
        }
    } catch (error) {
        console.error('❌ Error during session cleanup:', error.message);
    }
}

// Run cleanup on startup
cleanupCorruptedSessions();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// In-Memory Error Storage (now per session)
let globalErrors = []; // Fallback for sessionless mode
let clients = new Map(); // Use Map for better client management with unique IDs
let offlineBuffer = []; // Buffer for errors when no clients connected
let clientIdCounter = 0;
let sessions = new Map(); // Active sessions in memory

// Session encryption/decryption
function encryptData(data, secret = SESSION_SECRET) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(secret, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
}

function decryptData(encryptedData, secret = SESSION_SECRET) {
    try {
        const algorithm = 'aes-256-cbc';
        const key = crypto.scryptSync(secret, 'salt', 32);
        
        const parts = encryptedData.split(':');
        if (parts.length !== 2) {
            throw new Error('Invalid encrypted data format');
        }
        
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (error) {
        // Only log detailed errors occasionally to avoid spam
        if (Math.random() < 0.1) { // 10% chance to log
            console.error('❌ Session decryption failed (sample):', error.message);
            console.error('💡 This usually means old/incompatible session files exist');
        }
        return null;
    }
}

// Generate secure session token
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Session management
class SessionManager {
    static createSession(name = '', password = '') {
        const token = generateSessionToken();
        const session = {
            token,
            name: name || `Session ${new Date().toLocaleString('de-DE')}`,
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            modifiedBy: 'System',
            errors: [],
            archive: [], // Session-specific archive
            lastAccessed: new Date().toISOString(),
            hasPassword: !!password,
            passwordHash: password ? crypto.createHash('sha256').update(password).digest('hex') : null
        };
        
        sessions.set(token, session);
        this.saveSessionToDisk(session);
        
        console.log(`✅ Created new session: ${session.name} (${token})`);
        return session;
    }
    
    static getSession(token) {
        if (sessions.has(token)) {
            const session = sessions.get(token);
            session.lastAccessed = new Date().toISOString();
            console.log(`✅ Found session in memory: ${session.name} (${token.substring(0, 8)}...)`);
            return session;
        }
        
        // Try to load from disk
        console.log(`🔍 Session not in memory, trying to load from disk: ${token.substring(0, 8)}...`);
        return this.loadSessionFromDisk(token);
    }
    
    static saveSessionToDisk(session) {
        try {
            console.log(`💾 Saving session to disk: ${session.name} (${session.token.substring(0, 8)}...)`);
            const sessionFile = path.join(SESSIONS_DIR, `${session.token}.json`);
            const encryptedSession = encryptData(session);
            fs.writeFileSync(sessionFile, encryptedSession);
            console.log(`✅ Session saved to: ${sessionFile}`);
        } catch (error) {
            console.error('❌ Failed to save session to disk:', error.message);
        }
    }
    
    static loadSessionFromDisk(token) {
        try {
            const sessionFile = path.join(SESSIONS_DIR, `${token}.json`);
            console.log(`📁 Checking session file: ${sessionFile}`);
            
            if (fs.existsSync(sessionFile)) {
                const encryptedData = fs.readFileSync(sessionFile, 'utf8');
                const session = decryptData(encryptedData);
                if (session) {
                    // Ensure session has required fields
                    if (!session.archive) session.archive = [];
                    if (!session.errors) session.errors = [];
                    
                    session.lastAccessed = new Date().toISOString();
                    sessions.set(token, session);
                    console.log(`📂 Loaded session from disk: ${session.name} (${token.substring(0, 8)}...)`);
                    return session;
                } else {
                    console.log(`❌ Failed to decrypt session file, removing corrupted file: ${sessionFile}`);
                    // Remove corrupted session file
                    try {
                        fs.unlinkSync(sessionFile);
                        console.log(`🗑️ Removed corrupted session file: ${sessionFile}`);
                    } catch (deleteError) {
                        console.error(`❌ Failed to remove corrupted session file: ${deleteError.message}`);
                    }
                }
            } else {
                console.log(`❌ Session file not found: ${sessionFile}`);
            }
        } catch (error) {
            console.error('❌ Failed to load session from disk:', error.message);
        }
        console.log(`❌ Session not found: ${token.substring(0, 8)}...`);
        return null;
    }
    
    // Load all existing sessions on server startup
    static loadAllSessionsFromDisk() {
        try {
            if (fs.existsSync(SESSIONS_DIR)) {
                const sessionFiles = fs.readdirSync(SESSIONS_DIR);
                let loadedCount = 0;
                
                sessionFiles.forEach(file => {
                    if (file.endsWith('.json')) {
                        const token = file.replace('.json', '');
                        try {
                            const session = this.loadSessionFromDisk(token);
                            if (session) {
                                loadedCount++;
                            }
                        } catch (error) {
                            console.error(`❌ Failed to load session file ${file}:`, error.message);
                        }
                    }
                });
                
                console.log(`📚 Loaded ${loadedCount} existing sessions from disk`);
            } else {
                console.log(`📁 Sessions directory doesn't exist, creating: ${SESSIONS_DIR}`);
                fs.mkdirSync(SESSIONS_DIR, { recursive: true });
            }
        } catch (error) {
            console.error('❌ Failed to load sessions on startup:', error.message);
        }
    }
    
    static updateSession(token, updates) {
        const session = this.getSession(token);
        if (session) {
            // Update lastModified when session is modified
            Object.assign(session, updates, {
                lastModified: new Date().toISOString(),
                modifiedBy: updates.modifiedBy || 'System'
            });
            session.lastAccessed = new Date().toISOString();
            this.saveSessionToDisk(session);
            return session;
        }
        return null;
    }
    
    static verifyPassword(token, password) {
        const session = this.getSession(token);
        if (!session) return false;
        if (!session.hasPassword) return true; // No password required
        
        const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
        return session.passwordHash === passwordHash;
    }
    
    static deleteSession(token) {
        sessions.delete(token);
        try {
            const sessionFile = path.join(SESSIONS_DIR, `${token}.json`);
            if (fs.existsSync(sessionFile)) {
                fs.unlinkSync(sessionFile);
                console.log(`🗑️ Deleted session: ${token}`);
            }
        } catch (error) {
            console.error('❌ Failed to delete session file:', error.message);
        }
    }
    
    static cleanupExpiredSessions() {
        const now = new Date();
        const expiryDays = 31;
        const expiredSessions = [];
        
        console.log(`🧹 Starting cleanup of sessions older than ${expiryDays} days...`);
        
        sessions.forEach((session, token) => {
            const lastAccessed = new Date(session.lastAccessed);
            const daysSinceAccess = Math.floor((now - lastAccessed) / (1000 * 60 * 60 * 24));
            
            if (daysSinceAccess >= expiryDays) {
                expiredSessions.push({
                    token,
                    name: session.name,
                    daysSinceAccess,
                    lastAccessed: session.lastAccessed
                });
            }
        });
        
        // Delete expired sessions
        expiredSessions.forEach(({ token, name, daysSinceAccess }) => {
            this.deleteSession(token);
            console.log(`🗑️ Expired session deleted: ${name} (${daysSinceAccess} days old)`);
        });
        
        if (expiredSessions.length > 0) {
            console.log(`✅ Cleanup completed: ${expiredSessions.length} expired sessions removed`);
        } else {
            console.log('✅ Cleanup completed: No expired sessions found');
        }
        
        return expiredSessions.length;
    }
    
    static getSessionExpiryInfo(token) {
        const session = this.getSession(token);
        if (!session) return null;
        
        const now = new Date();
        const lastAccessed = new Date(session.lastAccessed);
        const daysSinceAccess = Math.floor((now - lastAccessed) / (1000 * 60 * 60 * 24));
        const daysUntilExpiry = 31 - daysSinceAccess;
        const expiryDate = new Date(lastAccessed);
        expiryDate.setDate(expiryDate.getDate() + 31);
        
        return {
            daysSinceAccess,
            daysUntilExpiry,
            expiryDate: expiryDate.toISOString(),
            isExpiringSoon: daysUntilExpiry <= 7,
            isExpired: daysUntilExpiry <= 0
        };
    }
    
    static getSavedSessions() {
        const savedSessions = [];
        
        sessions.forEach((session, token) => {
            if (session.isSaved) {
                savedSessions.push({
                    token: session.token,
                    name: session.name,
                    createdAt: session.createdAt,
                    savedAt: session.savedAt,
                    lastModified: session.lastModified,
                    modifiedBy: session.modifiedBy,
                    hasPassword: session.hasPassword,
                    errorCount: session.errors ? session.errors.length : 0
                });
            }
        });
        
        return savedSessions;
    }

    static loadAllSavedSessions() {
        // Load all saved sessions from disk on server startup
        try {
            console.log('🔍 Starting session loading process...');
            console.log('📁 Sessions directory path:', SESSIONS_DIR);
            console.log('📁 Directory exists:', fs.existsSync(SESSIONS_DIR));
            
            if (!fs.existsSync(SESSIONS_DIR)) {
                console.log('📁 Sessions directory does not exist, creating...');
                fs.mkdirSync(SESSIONS_DIR, { recursive: true });
                return;
            }

            const allFiles = fs.readdirSync(SESSIONS_DIR);
            console.log('📂 All files in sessions directory:', allFiles);
            
            const sessionFiles = allFiles.filter(file => file.endsWith('.json'));
            console.log(`📂 Found ${sessionFiles.length} JSON session files:`, sessionFiles);

            if (sessionFiles.length === 0) {
                console.log('📂 No session files found to load');
                return;
            }

            let loadedCount = 0;
            for (const file of sessionFiles) {
                try {
                    const token = file.replace('.json', '');
                    console.log(`🔄 Loading session from file: ${file}, token: ${token.substring(0, 8)}...`);
                    
                    const session = this.loadSessionFromDisk(token);
                    
                    if (session && session.isSaved) {
                        sessions.set(token, session);
                        loadedCount++;
                        console.log(`✅ Loaded saved session: ${session.name} (${token.substring(0, 8)}...) - isSaved: ${session.isSaved}`);
                    } else {
                        console.log(`⚠️ Session not loaded - either failed to decrypt or not saved: ${file}`);
                        if (session) {
                            console.log(`   Session data: name=${session.name}, isSaved=${session.isSaved}`);
                        }
                    }
                } catch (error) {
                    console.error(`❌ Failed to load session from ${file}:`, error.message);
                }
            }

            console.log(`🎯 Successfully loaded ${loadedCount}/${sessionFiles.length} saved sessions`);
            console.log(`📊 Total sessions in memory: ${sessions.size}`);
        } catch (error) {
            console.error('❌ Error loading saved sessions:', error.message);
        }
    }
}

// Clean up stale connections
function cleanupStaleConnections() {
    const activeClients = new Map();
    
    clients.forEach((client, id) => {
        try {
            // Test if connection is still alive
            client.write(`data: ${JSON.stringify({type: 'ping'})}\n\n`);
            activeClients.set(id, client);
        } catch (e) {
            console.log(`🧹 Removed stale connection ${id}`);
        }
    });
    
    clients = activeClients;
    console.log(`🔍 Cleanup complete. Active clients: ${clients.size}`);
}

// Add error to storage (keep last 100)
function addError(error, sessionToken = null) {
    const errorData = {
        message: error.message || error,
        timestamp: new Date().toLocaleString('de-DE'),
        ip: error.ip || 'unknown',
        id: crypto.randomUUID()
    };
    
    // Add to session if provided
    if (sessionToken) {
        const session = SessionManager.getSession(sessionToken);
        if (session) {
            session.errors.unshift(errorData);
            if (session.errors.length > 100) session.errors.pop();
            SessionManager.saveSessionToDisk(session);
        }
    } else {
        // Fallback to global errors
        globalErrors.unshift(errorData);
        if (globalErrors.length > 100) globalErrors.pop();
    }
    
    // If no clients connected, buffer the error
    if (clients.size === 0) {
        offlineBuffer.unshift({...errorData, bufferedAt: new Date().toISOString()});
        if (offlineBuffer.length > 50) offlineBuffer.pop(); // Limit buffer size
        console.log(`📦 No clients connected - buffered error from ${errorData.ip}. Buffer size: ${offlineBuffer.length}`);
        return errorData;
    }
    
    // Send to SSE clients (session-aware)
    let successCount = 0;
    let failCount = 0;
    const activeClients = new Map();
    
    clients.forEach((client, id) => {
        try {
            // Only send to clients with matching session token
            if (sessionToken && client._sessionToken === sessionToken) {
                client.write(`data: ${JSON.stringify({type: 'error', error: errorData})}\n\n`);
                successCount++;
                activeClients.set(id, client);
                console.log(`📨 Sent error to client ${id} (session: ${client._sessionName})`);
            } else if (!sessionToken && !client._sessionToken) {
                // Send to sessionless clients only if error is also sessionless
                client.write(`data: ${JSON.stringify({type: 'error', error: errorData})}\n\n`);
                successCount++;
                activeClients.set(id, client);
                console.log(`📨 Sent error to sessionless client ${id}`);
            } else {
                // Keep active but don't send to different session
                activeClients.set(id, client);
            }
        } catch (e) {
            console.log(`Client ${id} disconnected during error broadcast`);
            failCount++;
        }
    });
    
    // Update clients with only active connections
    clients = activeClients;
    
    // Log the request result
    console.log(`📨 Received request from ${errorData.ip}: sent to ${clients.size} browser(s) (✅ ${successCount} erfolg, ❌ ${failCount} fehlgeschlagen)`);
    
    return errorData;
}

// Broadcast client count to all connected clients
function broadcastClientCount() {
    const message = {
        type: 'clients',
        count: clients.size
    };
    
    const activeClients = new Map();
    
    clients.forEach((client, id) => {
        try {
            client.write(`data: ${JSON.stringify(message)}\n\n`);
            activeClients.set(id, client);
        } catch (e) {
            console.log(`❌ Failed to send client count to client ${id}`);
        }
    });
    
    // Update clients with only active connections
    clients = activeClients;
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Return all errors as JSON
app.get('/errors', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    console.log(`🔍 Request for all errors from ${ip}`);
    
    const response = {
        errors: errors,
        offlineBuffer: offlineBuffer,
        totalErrors: errors.length,
        bufferedErrors: offlineBuffer.length,
        clientCount: clients.size
    };
    
    res.json(response);
});

// Connection tracking for rate limiting
const connectionAttempts = new Map(); // IP -> { count, lastAttempt, blocked }
const CONNECTION_LIMIT = 20; // Max connections per minute (increased from 5)
const BLOCK_DURATION = 30000; // 30 seconds block (reduced from 1 minute)
const CLEANUP_INTERVAL = 300000; // 5 minutes

// Cleanup old connection attempts
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of connectionAttempts.entries()) {
        if (now - data.lastAttempt > CLEANUP_INTERVAL) {
            connectionAttempts.delete(ip);
        }
    }
}, CLEANUP_INTERVAL);

// SSE endpoint for live error streaming (session-aware)
app.get('/live', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const sessionToken = req.query.session; // Get session token from query parameter
    const clientId = ++clientIdCounter;
    const now = Date.now();
    
    // Rate limiting check
    const connectionData = connectionAttempts.get(ip) || { count: 0, lastAttempt: 0, blocked: false };
    
    // Reset count if last attempt was more than 1 minute ago
    if (now - connectionData.lastAttempt > 60000) {
        connectionData.count = 0;
        connectionData.blocked = false;
    }
    
    // Check if IP is blocked
    if (connectionData.blocked && now - connectionData.lastAttempt < BLOCK_DURATION) {
        console.log(`🚫 Rate limited connection from ${ip}`);
        res.status(429).json({ error: 'Too many connection attempts. Please wait.' });
        return;
    }
    
    connectionData.count++;
    connectionData.lastAttempt = now;
    
    // Block if too many attempts
    if (connectionData.count > CONNECTION_LIMIT) {
        connectionData.blocked = true;
        connectionAttempts.set(ip, connectionData);
        console.log(`🚫 Blocking excessive connections from ${ip} (${connectionData.count} attempts)`);
        res.status(429).json({ error: 'Too many connection attempts. Please wait.' });
        return;
    }
    
    connectionAttempts.set(ip, connectionData);
    
    // Check for existing connections from same IP (but be less aggressive)
    let existingConnections = 0;
    const existingClients = [];
    
    for (const [id, client] of clients.entries()) {
        if (client._clientIp === ip) {
            existingClients.push({ id, client });
            existingConnections++;
        }
    }
    
    // Only close existing connections if there are more than 2
    if (existingConnections > 2) {
        console.log(`🔄 Too many connections from ${ip}, closing ${existingConnections} existing connections`);
        existingClients.forEach(({ id, client }) => {
            try {
                client.end();
            } catch (e) {
                // Connection already closed
            }
            clients.delete(id);
        });
    } else if (existingConnections > 0) {
        console.log(`ℹ️ Allowing parallel connection from ${ip} (${existingConnections + 1} total)`);
    }
    
    console.log(`📡 New SSE connection from ${ip} with ID ${clientId}${sessionToken ? ` (session: ${sessionToken})` : ' (no session)'}`);
    
    // Validate session if provided
    let session = null;
    if (sessionToken) {
        session = SessionManager.getSession(sessionToken);
        if (!session) {
            console.log(`❌ Invalid session token: ${sessionToken}`);
            res.status(401).json({ error: 'Invalid session token' });
            return;
        }
        console.log(`✅ Valid session: ${session.name}`);
    }
    
    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Store client IP and session info for duplicate detection
    res._clientIp = ip;
    res._clientId = clientId;
    res._sessionToken = sessionToken;
    res._sessionName = session?.name;

    // Add client to Map
    clients.set(clientId, res);
    console.log(`👥 Total connected clients: ${clients.size}`);

    // Send buffered errors if any exist
    if (offlineBuffer.length > 0) {
        console.log(`📤 Sending ${offlineBuffer.length} buffered errors to new client ${clientId}`);
        offlineBuffer.forEach(bufferedError => {
            try {
                res.write(`data: ${JSON.stringify({type: 'error', error: bufferedError})}\n\n`);
            } catch (e) {
                console.log(`❌ Failed to send buffered error to client ${clientId}`);
            }
        });
        // Clear offline buffer after sending
        offlineBuffer = [];
        console.log(`🧹 Cleared offline buffer`);
    }

    // Send initial client count
    broadcastClientCount();

    // Keep connection alive with periodic pings
    const pingInterval = setInterval(() => {
        try {
            res.write(`data: ${JSON.stringify({type: 'ping'})}\n\n`);
        } catch (e) {
            console.log(`🏓 Ping failed for client ${clientId}, removing`);
            clearInterval(pingInterval);
            clients.delete(clientId);
            broadcastClientCount();
        }
    }, 30000); // Ping every 30 seconds

    // Handle client disconnect
    req.on('close', () => {
        clearInterval(pingInterval);
        if (clients.has(clientId)) {
            clients.delete(clientId);
            console.log(`👋 Client ${clientId} (${ip}) disconnected. Remaining clients: ${clients.size}`);
            broadcastClientCount();
        }
    });

    req.on('error', (err) => {
        console.log(`❌ SSE connection error for client ${clientId}:`, err.message);
        clearInterval(pingInterval);
        if (clients.has(clientId)) {
            clients.delete(clientId);
            broadcastClientCount();
        }
    });

    // Handle response errors
    res.on('error', (err) => {
        console.log(`❌ SSE response error for client ${clientId}:`, err.message);
        clearInterval(pingInterval);
        if (clients.has(clientId)) {
            clients.delete(clientId);
            broadcastClientCount();
        }
    });
});

// Save session with password (PUT /api/session/:token)
app.put('/api/session/:token', (req, res) => {
    try {
        const { token } = req.params;
        const { name, password, archiveData } = req.body;
        
        const session = SessionManager.getSession(token);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }
        
        // Update session with save information
        const updatedSession = SessionManager.updateSession(token, {
            name: name || session.name,
            hasPassword: !!password,
            passwordHash: password ? crypto.createHash('sha256').update(password).digest('hex') : session.passwordHash,
            isSaved: true,
            savedAt: new Date().toISOString(),
            archive: archiveData || session.archive || []
        });
        
        // Save session to disk
        SessionManager.saveSessionToDisk(updatedSession);
        
        console.log('✅ Session saved to disk:', {
            token: token.substring(0, 16) + '...',
            name: updatedSession.name,
            hasPassword: updatedSession.hasPassword
        });
        
        res.json({
            success: true,
            message: 'Session saved successfully'
        });
    } catch (error) {
        console.error('❌ Error saving session:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save session'
        });
    }
});

// Get all saved sessions (GET /api/sessions/saved)
app.get('/api/sessions/saved', (req, res) => {
    try {
        const savedSessions = SessionManager.getSavedSessions();
        res.json({
            success: true,
            sessions: savedSessions
        });
    } catch (error) {
        console.error('❌ Error loading saved sessions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load saved sessions'
        });
    }
});

// Receive new errors (session-aware with required token)
app.post('/error', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const sessionToken = req.headers['x-session-token'] || req.body.sessionToken;
    
    // Validate session token
    if (!sessionToken) {
        return res.status(400).json({
            success: false,
            error: 'Missing session token. Please provide a valid session token in x-session-token header or request body.'
        });
    }
    
    // Verify session exists and is active
    const session = SessionManager.getSession(sessionToken);
    if (!session) {
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired session token'
        });
    }
    
    // Check if session has active clients or was recently active (allow 5 minutes grace period)
    const now = Date.now();
    const lastAccessed = session.lastAccessed ? new Date(session.lastAccessed).getTime() : 0;
    const gracePeriod = 5 * 60 * 1000; // 5 minutes in milliseconds
    const hasActiveClients = session.clients && session.clients.size > 0;
    const withinGracePeriod = (now - lastAccessed) < gracePeriod;
    
    if (!hasActiveClients && !withinGracePeriod) {
        return res.status(423).json({
            success: false,
            error: 'Session is not active. Errors can only be sent to sessions with active connections or within 5 minutes of last activity.'
        });
    }
    
    // Update session lastAccessed timestamp
    SessionManager.updateSession(sessionToken, {
        lastAccessed: new Date().toISOString()
    });
    
    const errorData = addError({
        message: req.body.message || req.body.error || 'Unknown error',
        ip: ip
    }, sessionToken);
    
    res.json({ 
        success: true, 
        message: 'Error logged successfully', 
        error: errorData,
        clientCount: clients.size,
        sessionToken: sessionToken,
        sessionName: session.name
    });
});

// Debug endpoint for server status
app.get('/status', (req, res) => {
    cleanupStaleConnections(); // Clean up before reporting
    
    // List all active sessions
    const activeSessions = [];
    for (const [token, session] of sessions.entries()) {
        activeSessions.push({
            token: token.substring(0, 8) + '...',
            name: session.name,
            createdAt: session.createdAt,
            lastAccessed: session.lastAccessed,
            errorCount: session.errors.length
        });
    }
    
    // Check sessions directory
    const sessionFiles = fs.existsSync(SESSIONS_DIR) ? fs.readdirSync(SESSIONS_DIR) : [];
    
    res.json({
        connectedClients: clients.size,
        totalErrors: globalErrors.length,
        bufferedErrors: offlineBuffer.length,
        serverUptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        activeSessions: activeSessions,
        sessionFilesOnDisk: sessionFiles.length,
        sessionsDirectory: SESSIONS_DIR
    });
});

// Delete single error by index
app.delete('/error/:index', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const index = parseInt(req.params.index);
    const sessionToken = req.headers['x-session-token'];
    
    if (isNaN(index) || index < 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid error index'
        });
    }
    
    let targetErrors = errors; // Default to global errors
    let deletedError;
    
    // Check if request is session-specific
    if (sessionToken) {
        const session = SessionManager.getSession(sessionToken);
        if (session) {
            targetErrors = session.errors;
            console.log(`🗑️ Deleting error ${index} from session ${sessionToken} by ${ip}`);
        } else {
            console.log(`❌ Invalid session token in delete request: ${sessionToken}`);
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }
    } else {
        console.log(`🗑️ Deleting error ${index} from global errors by ${ip}`);
    }
    
    if (index >= targetErrors.length) {
        return res.status(404).json({
            success: false,
            error: 'Error not found'
        });
    }
    
    deletedError = targetErrors[index];
    targetErrors.splice(index, 1);
    
    // Save session if it was session-specific
    if (sessionToken) {
        const session = SessionManager.getSession(sessionToken);
        if (session) {
            SessionManager.saveSession(session);
        }
    }
    
    // Notify all clients that an error was deleted
    const deleteMessage = {
        type: 'delete',
        index: index,
        sessionToken: sessionToken || null,
        message: 'Error deleted',
        timestamp: new Date().toLocaleString('de-DE')
    };
    
    const activeClients = new Map();
    clients.forEach((client, id) => {
        try {
            client.write(`data: ${JSON.stringify(deleteMessage)}\n\n`);
            activeClients.set(id, client);
        } catch (e) {
            console.log(`Failed to notify client ${id} about delete`);
        }
    });
    
    clients = activeClients;
    
    res.json({ 
        success: true, 
        message: 'Error deleted',
        deletedError: deletedError,
        remainingCount: targetErrors.length,
        sessionToken: sessionToken || null
    });
});

// Delete single archived error by index (session-specific)
app.delete('/archive/:index', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const index = parseInt(req.params.index);
    const sessionToken = req.headers['x-session-token'];
    
    if (isNaN(index) || index < 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid archive index'
        });
    }
    
    if (!sessionToken) {
        return res.status(400).json({
            success: false,
            error: 'Session token required for archive operations'
        });
    }
    
    const session = SessionManager.getSession(sessionToken);
    if (!session) {
        console.log(`❌ Invalid session token in archive delete request: ${sessionToken}`);
        return res.status(404).json({
            success: false,
            error: 'Session not found'
        });
    }
    
    if (!session.archive) {
        session.archive = [];
    }
    
    if (index >= session.archive.length) {
        return res.status(404).json({
            success: false,
            error: 'Archived error not found'
        });
    }
    
    const deletedError = session.archive[index];
    session.archive.splice(index, 1);
    
    // Save session
    SessionManager.saveSessionToDisk(session);
    
    console.log(`🗑️ Deleted archived error ${index} from session ${sessionToken} by ${ip}`);
    
    res.json({ 
        success: true, 
        message: 'Archived error deleted',
        deletedError: deletedError,
        remainingCount: session.archive.length,
        sessionToken: sessionToken
    });
});

// Clear all errors
app.delete('/errors', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    console.log(`🗑️ Clearing all errors requested by ${ip}`);
    
    errors = [];
    offlineBuffer = [];
    
    // Notify all clients that errors were cleared
    const clearMessage = {
        type: 'clear',
        message: 'All errors cleared',
        timestamp: new Date().toLocaleString('de-DE')
    };
    
    const activeClients = new Map();
    clients.forEach((client, id) => {
        try {
            client.write(`data: ${JSON.stringify(clearMessage)}\n\n`);
            activeClients.set(id, client);
        } catch (e) {
            console.log(`Failed to notify client ${id} about clear`);
        }
    });
    
    clients = activeClients;
    
    res.json({ 
        success: true, 
        message: 'All errors cleared',
        clientCount: clients.size
    });
});

// Clean up stale connections every 5 minutes
setInterval(cleanupStaleConnections, 5 * 60 * 1000);

// Clean up expired sessions daily at 3 AM
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 3 && now.getMinutes() === 0) {
        SessionManager.cleanupExpiredSessions();
    }
}, 60 * 1000); // Check every minute for 3 AM

// Initial cleanup on startup
SessionManager.cleanupExpiredSessions();

// Load existing sessions on startup
console.log('🔄 Starting session loading process...');
console.log('📁 Sessions directory:', SESSIONS_DIR);
SessionManager.loadAllSavedSessions();

app.listen(PORT, () => {
    console.log(`🚀 Live Error Display Server running on port ${PORT}`);
    console.log(`📱 Access the display at: http://localhost:${PORT}`);
    console.log(`🔗 API endpoint: http://localhost:${PORT}/error`);
    console.log(`📊 Status endpoint: http://localhost:${PORT}/status`);
});
