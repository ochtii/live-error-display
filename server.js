const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

// Ses// === SESSION API ROUTES ===

// Get new session token
app.get('/api/token', (req, res) => {
    try {
        const session = SessionManager.createSession();
        res.json({
            success: true,
            token: session.token,
            session: {
                name: session.name,
                createdAt: session.createdAt,
                errorCount: session.errors.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to create session'
        });
    }
});

// Restore session with token
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
        
        res.json({
            success: true,
            session: {
                token: session.token,
                name: session.name,
                createdAt: session.createdAt,
                lastAccessed: session.lastAccessed,
                errorCount: session.errors.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to load session'
        });
    }
});

// Update session name
app.put('/api/session/:token', (req, res) => {
    try {
        const { token } = req.params;
        const { name } = req.body;
        
        const session = SessionManager.updateSession(token, { name });
        
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }
        
        res.json({
            success: true,
            session: {
                token: session.token,
                name: session.name,
                createdAt: session.createdAt,
                lastAccessed: session.lastAccessed,
                errorCount: session.errors.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to update session'
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

// === MAIN ROUTES ===

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Return all errors as JSON (session-aware)
app.get('/errors', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const sessionToken = req.headers['x-session-token'];
    
    console.log(`🔍 Request for all errors from ${ip}${sessionToken ? ` (session: ${sessionToken})` : ''}`);
    
    let errors = globalErrors;
    if (sessionToken) {
        const session = SessionManager.getSession(sessionToken);
        if (session) {
            errors = session.errors;
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
    const cipher = crypto.createCipher('aes-256-cbc', secret);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decryptData(encryptedData, secret = SESSION_SECRET) {
    try {
        const decipher = crypto.createDecipher('aes-256-cbc', secret);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } catch (error) {
        console.error('❌ Session decryption failed:', error.message);
        return null;
    }
}

// Generate secure session token
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Session management
class SessionManager {
    static createSession(name = '') {
        const token = generateSessionToken();
        const session = {
            token,
            name: name || `Session ${new Date().toLocaleString('de-DE')}`,
            createdAt: new Date().toISOString(),
            errors: [],
            lastAccessed: new Date().toISOString()
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
            return session;
        }
        
        // Try to load from disk
        return this.loadSessionFromDisk(token);
    }
    
    static saveSessionToDisk(session) {
        try {
            const sessionFile = path.join(SESSIONS_DIR, `${session.token}.json`);
            const encryptedSession = encryptData(session);
            fs.writeFileSync(sessionFile, encryptedSession);
        } catch (error) {
            console.error('❌ Failed to save session to disk:', error.message);
        }
    }
    
    static loadSessionFromDisk(token) {
        try {
            const sessionFile = path.join(SESSIONS_DIR, `${token}.json`);
            if (fs.existsSync(sessionFile)) {
                const encryptedData = fs.readFileSync(sessionFile, 'utf8');
                const session = decryptData(encryptedData);
                if (session) {
                    session.lastAccessed = new Date().toISOString();
                    sessions.set(token, session);
                    console.log(`📂 Loaded session from disk: ${session.name} (${token})`);
                    return session;
                }
            }
        } catch (error) {
            console.error('❌ Failed to load session from disk:', error.message);
        }
        return null;
    }
    
    static updateSession(token, updates) {
        const session = this.getSession(token);
        if (session) {
            Object.assign(session, updates);
            session.lastAccessed = new Date().toISOString();
            this.saveSessionToDisk(session);
            return session;
        }
        return null;
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
    
    // Send to all SSE clients
    let successCount = 0;
    let failCount = 0;
    const activeClients = new Map();
    
    clients.forEach((client, id) => {
        try {
            client.write(`data: ${JSON.stringify({type: 'error', error: errorData})}\n\n`);
            successCount++;
            activeClients.set(id, client);
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
const CONNECTION_LIMIT = 5; // Max connections per minute
const BLOCK_DURATION = 60000; // 1 minute block
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

// SSE endpoint for live error streaming
app.get('/live', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
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
    
    console.log(`📡 New SSE connection from ${ip} with ID ${clientId}`);
    
    // Check for existing connections from same IP and close them
    let existingConnections = 0;
    for (const [id, client] of clients.entries()) {
        if (client._clientIp === ip) {
            console.log(`� Closing existing SSE connection ${id} from ${ip}`);
            try {
                client.end();
            } catch (e) {
                // Connection already closed
            }
            clients.delete(id);
            existingConnections++;
        }
    }
    
    if (existingConnections > 0) {
        console.log(`🧹 Cleaned up ${existingConnections} existing connections from ${ip}`);
    }
    
    console.log(`�📡 New SSE connection from ${ip} with ID ${clientId}`);
    
    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Store client IP for duplicate detection
    res._clientIp = ip;
    res._clientId = clientId;

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

// Receive new errors (session-aware)
app.post('/error', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const sessionToken = req.headers['x-session-token'];
    
    const errorData = addError({
        message: req.body.message || req.body.error || 'Unknown error',
        ip: ip
    }, sessionToken);
    
    res.json({ 
        success: true, 
        message: 'Error logged successfully', 
        error: errorData,
        clientCount: clients.size,
        sessionActive: !!sessionToken
    });
});

// Debug endpoint for server status
app.get('/status', (req, res) => {
    cleanupStaleConnections(); // Clean up before reporting
    
    res.json({
        connectedClients: clients.size,
        totalErrors: errors.length,
        bufferedErrors: offlineBuffer.length,
        serverUptime: process.uptime(),
        memoryUsage: process.memoryUsage()
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

app.listen(PORT, () => {
    console.log(`🚀 Live Error Display Server running on port ${PORT}`);
    console.log(`📱 Access the display at: http://localhost:${PORT}`);
    console.log(`🔗 API endpoint: http://localhost:${PORT}/error`);
    console.log(`📊 Status endpoint: http://localhost:${PORT}/status`);
});
