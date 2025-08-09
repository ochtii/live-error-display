const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const SSE = require('express-sse');

// Initialize express and SSE
const app = express();
const sse = new SSE();
const PORT = process.env.PORT || 8080;

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
    const health = {
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version,
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        sessions: {
            directory: SESSIONS_DIR,
            count: fs.existsSync(SESSIONS_DIR) ? fs.readdirSync(SESSIONS_DIR).length : 0
        }
    };
    res.json(health);
});

// Enhanced status endpoint for monitoring
app.get('/api/status', (req, res) => {
    try {
        const stats = {
            server: {
                status: 'running',
                pid: process.pid,
                uptime: process.uptime(),
                timestamp: Date.now()
            },
            memory: {
                ...process.memoryUsage(),
                freemem: require('os').freemem(),
                totalmem: require('os').totalmem()
            },
            system: {
                platform: process.platform,
                arch: process.arch,
                loadavg: require('os').loadavg(),
                cpus: require('os').cpus().length
            },
            sessions: {
                active: fs.existsSync(SESSIONS_DIR) ? fs.readdirSync(SESSIONS_DIR).length : 0,
                directory: SESSIONS_DIR
            }
        };
        res.json(stats);
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: error.message,
            timestamp: Date.now()
        });
    }
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
