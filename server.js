const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// In-Memory Error Storage
let errors = [];
let clients = new Map(); // Use Map for better client management with unique IDs
let offlineBuffer = []; // Buffer for errors when no clients connected
let clientIdCounter = 0;

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
function addError(error) {
    const errorData = {
        message: error.message || error,
        timestamp: new Date().toLocaleString('de-DE'),
        ip: error.ip || 'unknown'
    };
    errors.unshift(errorData);
    if (errors.length > 100) errors.pop();
    
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

// SSE endpoint for live error streaming
app.get('/live', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const clientId = ++clientIdCounter;
    
    console.log(`📡 New SSE connection from ${ip} with ID ${clientId}`);
    
    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

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
        clients.delete(clientId);
        broadcastClientCount();
    });
});

// Receive new errors
app.post('/error', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    
    const errorData = addError({
        message: req.body.message || req.body.error || 'Unknown error',
        ip: ip
    });
    
    res.json({ 
        success: true, 
        message: 'Error logged successfully', 
        error: errorData,
        clientCount: clients.size
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
