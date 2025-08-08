// Clean SSE implementation
app.get('/live', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const clientId = ++clientIdCounter;
    
    // Simple rate limiting
    const tracker = connectionTracker.get(ip) || { count: 0, lastReset: Date.now() };
    const now = Date.now();
    
    // Reset counter every minute
    if (now - tracker.lastReset > 60000) {
        tracker.count = 0;
        tracker.lastReset = now;
    }
    
    tracker.count++;
    connectionTracker.set(ip, tracker);
    
    if (tracker.count > MAX_CONNECTIONS_PER_MINUTE) {
        console.log(`🚫 Rate limited connection from ${ip}`);
        res.status(429).json({ error: 'Too many connection attempts. Please wait.' });
        return;
    }
    
    // Check for existing connections - only close if more than 3
    let existingCount = 0;
    for (const [id, client] of clients.entries()) {
        if (client._clientIp === ip) {
            existingCount++;
            if (existingCount > 3) {
                console.log(`🔄 Closing excessive connection ${id} from ${ip}`);
                try {
                    client.end();
                } catch (e) {
                    // Connection already closed
                }
                clients.delete(id);
            }
        }
    }
    
    console.log(`📡 New SSE connection from ${ip} with ID ${clientId} (${existingCount + 1} total)`);
    
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

    // Handle connection errors
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
