const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 8080;

app.use(express.json());

const archiveFile = path.join(__dirname, 'error_archive.json');
let clients = [];

function sendEventToClients(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => res.write(msg));
}

// Fehler-Archiv laden oder initial leer
let errorArchive = [];
try {
  if (fs.existsSync(archiveFile)) {
    const raw = fs.readFileSync(archiveFile);
    errorArchive = JSON.parse(raw);
  }
} catch (e) {
  console.error('Archiv laden fehlgeschlagen:', e);
  errorArchive = [];
}

// SSE Endpoint
app.get('/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  clients.push(res);
  console.log('Client verbunden, derzeitige Anzahl:', clients.length);

  // On close remove client
  req.on('close', () => {
    clients = clients.filter(c => c !== res);
    console.log('Client getrennt, derzeitige Anzahl:', clients.length);
  });
});

// API um Fehler zu senden
app.post('/api/error', (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Fehlermeldung als "message" (string) erforderlich' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const timestamp = new Date().toISOString();

  const errorObj = { message, timestamp, ip };
  errorArchive.push(errorObj);

  // Save Archiv
  fs.writeFile(archiveFile, JSON.stringify(errorArchive, null, 2), err => {
    if (err) console.error('Archiv speichern fehlgeschlagen:', err);
  });

  // Event an alle SSE-Clients senden
  sendEventToClients(errorObj);

  res.json({ status: 'ok' });
});

// Archiv laden
app.get('/archive', (req, res) => {
  res.json(errorArchive);
});

// Status Endpoint
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok' });
});

// Statische Dateien (index.html, css, js, ...)
// Einfach aus Projektordner ausliefern
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT} oder http://18.197.100.102:${PORT}`);
});
