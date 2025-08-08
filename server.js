const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Error Storage
let errors = [];
let clients = [];

// Add error to storage (keep last 100)
function addError(error) {
    const errorData = {
        message: error.message || error,
        timestamp: new Date().toLocaleString('de-DE'),
        ip: error.ip || 'unknown'
    };
    errors.unshift(errorData);
    if (errors.length > 100) errors.pop();
    
    // Send to all SSE clients
    clients.forEach(client => {
        try {
            client.write(`data: ${JSON.stringify(errorData)}\n\n`);
        } catch (e) {
            console.log('Client disconnected');
        }
    });
    
    return errorData;
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SSE endpoint for live updates
app.get('/events', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    clients.push(res);
    console.log(`SSE Client connected. Total: ${clients.length}`);

    req.on('close', () => {
        clients = clients.filter(client => client !== res);
        console.log(`SSE Client disconnected. Total: ${clients.length}`);
    });
});

// Get archived errors
app.get('/archive', (req, res) => {
    res.json(errors);
});

// Add new error (for testing)
app.post('/error', (req, res) => {
    const errorData = addError({
        message: req.body.message || 'Test Error',
        ip: req.ip || req.connection.remoteAddress
    });
    res.json(errorData);
});

// Demo: Add random errors every 10 seconds
if (process.env.NODE_ENV !== 'production') {
    const demoErrors = [
        'Database connection timeout after 30 seconds',
        'Memory usage exceeded 90% threshold',
        'API rate limit exceeded for user 12345',
        'Failed to parse JSON in request body',
        'Authentication token expired',
        'File upload failed: insufficient disk space',
        'Redis connection lost, reconnecting...',
        'Invalid email format in user registration'
    ];

    setInterval(() => {
        const randomError = demoErrors[Math.floor(Math.random() * demoErrors.length)];
        addError({
            message: randomError,
            ip: `192.168.1.${Math.floor(Math.random() * 255)}`
        });
        console.log('Demo error added:', randomError);
    }, 10000);
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Live Error Display running on http://0.0.0.0:${PORT}`);
    console.log(`📊 Demo mode: ${process.env.NODE_ENV !== 'production' ? 'ON' : 'OFF'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down gracefully...');
    clients.forEach(client => {
        try {
            client.end();
        } catch (e) {}
    });
    process.exit(0);
});
