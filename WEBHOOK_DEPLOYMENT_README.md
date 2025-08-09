# 🚀 GitHub Webhook Auto-Deployment System

Ein umfassendes automatisches Deployment-System für Live Error Display mit GitHub Webhooks, detailliertem Logging und PM2-Integration.

## 📋 Übersicht

Dieses System ersetzt das `deploy-opt.sh` Script durch einen robusten Python Webhook-Listener, der automatisch auf Änderungen im `live` Branch reagiert und das System aktualisiert.

### ✨ Features

- 🔐 **Sichere Webhook-Authentifizierung** mit GitHub Secrets
- 🌈 **Farbiges detailliertes Logging** mit Dateiänderungs-Tracking
- 🔄 **Automatische PM2-Prozessverwaltung**
- 🏥 **API und Database Health Checks**
- 📊 **Ausführliche Deployment-Zusammenfassungen**
- 🛡️ **Robuste Fehlerbehandlung und Recovery**
- 📝 **Umfassende Dokumentation und Setup-Guides**

## 🗂️ Dateistruktur

```
errordisplay/
├── webhook_listener.py              # Haupt-Webhook-Listener
├── webhook_requirements.txt         # Python Dependencies
├── setup_webhook.sh                 # Automatisches Setup-Script
├── test_webhook_deployment.sh       # Test- und Monitoring-Script
├── WEBHOOK_GITHUB_SETUP.md         # GitHub Setup-Anleitung
├── WEBHOOK_DEPLOYMENT_README.md     # Diese Datei
└── ecosystem.config.js              # Aktualisierte PM2-Konfiguration
```

## ⚙️ Konfiguration

### Aktualisierte PM2 Konfiguration

Die `ecosystem.config.js` wurde aktualisiert mit:

- **Port 8080** für die Hauptanwendung
- **Branch 'live'** statt 'main' für Deployment
- **Webhook-Listener auf Port 9090** als zweiter PM2-Prozess (`live-error-display-webhook`)
- **Health Check URLs** auf Port 8080 angepasst

### Umgebungsvariablen

```bash
GITHUB_WEBHOOK_SECRET=your_github_secret_here
WEBHOOK_PORT=9090
WEBHOOK_HOST=0.0.0.0
TARGET_BRANCH=live
```

## 🚀 Installation

### Schnellinstallation

```bash
# 1. Repository aktualisieren
cd /opt/live-error-display
git pull origin main

# 2. Setup-Script ausführen
sudo chmod +x setup_webhook.sh
sudo ./setup_webhook.sh

# 3. GitHub Secret konfigurieren
nano ecosystem.config.js
# Ändern Sie: GITHUB_WEBHOOK_SECRET: 'IHR_SECRET'

# 4. PM2 Services starten
pm2 start ecosystem.config.js --env production
pm2 save
```

### Manuelle Installation

```bash
# Python Dependencies installieren
pip3 install -r webhook_requirements.txt

# Webhook-Listener executable machen
chmod +x webhook_listener.py

# PM2 mit neuer Konfiguration starten
pm2 start ecosystem.config.js --env production
```

## 🔧 GitHub Setup

Folgen Sie der detaillierten Anleitung in `WEBHOOK_GITHUB_SETUP.md`:

1. **Secret generieren**: `openssl rand -hex 32`
2. **GitHub Webhook konfigurieren**:
   - URL: `http://18.197.100.102:9000/webhook`
   - Content-Type: `application/json`
   - Secret: Ihr generierter Secret
   - Events: Push events
3. **Server konfigurieren** mit Ihrem Secret

## 📊 Deployment-Prozess

Bei einem Push zum `live` Branch:

```
🚀 Webhook empfangen
📝 Commit-Details loggen (+++/~~~/--- Dateien)
🛑 PM2 Prozess stoppen (live-error-display)
📥 Git pull origin live (force overwrite)
📦 npm install (Dependencies aktualisieren)
🧹 PM2 logs flush (alte Logs löschen)
▶️ PM2 start live-error-display
🏥 API Health Check (http://localhost:8080/api/health)
🗄️ Database Health Check (http://localhost:8080/api/db/health)
📋 Deployment Summary ausgeben
✅ Erfolgreich abgeschlossen
```

## 🖥️ Monitoring und Logs

### Service Status

```bash
# PM2 Status aller Services
pm2 status

# Webhook-Listener Logs
pm2 logs live-error-display-webhook
pm2 logs live-error-display-webhook

# Hauptanwendung Logs
pm2 logs live-error-display

# Alle Logs zusammen
pm2 logs

# Umfassender Test
./test_webhook_deployment.sh
```

### Log-Locations

- **PM2 Webhook Logs**: `pm2 logs live-error-display-webhook`
- **PM2 App Logs**: `pm2 logs live-error-display`
- **File Logs**: `/var/log/live-error-display-webhook-*.log`
- **PM2 App File Logs**: `/var/log/live-error-display-*.log`

### Endpoints

- **Webhook**: `http://18.197.100.102:9090/webhook` (POST)
- **Health**: `http://18.197.100.102:9090/health` (GET)
- **Status**: `http://18.197.100.102:9090/status` (GET)
- **App Health**: `http://18.197.100.102:8080/api/health` (GET)

## 🧪 Testing

```bash
# Vollständiger Test
./test_webhook_deployment.sh

# Einzelne Tests
./test_webhook_deployment.sh webhook    # Nur Webhook testen
./test_webhook_deployment.sh app        # Nur App testen
./test_webhook_deployment.sh logs       # Logs anzeigen
./test_webhook_deployment.sh status     # Status anzeigen

# Deployment testen
git checkout live
echo "Test $(date)" >> TEST.md
git add TEST.md
git commit -m "Test webhook deployment"
git push origin live
```

## 🎨 Log-Beispiel

```
🚀 Webhook received for live branch
📝 Commits received: 1
  [abc123de] Update README.md by John Doe
    ++++ new_feature.js
    ~~~~ package.json
    ---- old_file.js

🔄 Starting deployment process...
1. ✓ PM2 process stopped
2. ✓ Git pull successful
   3 files changed, 45 insertions(+), 12 deletions(-)
3. ✓ Dependencies installed
4. ✓ PM2 logs flushed
5. ✓ PM2 process started
6. ✓ API health check passed
   ✓ Database health check passed

🎉 DEPLOYMENT SUMMARY
============================================================
📍 Current Branch: live
📍 Current Commit: abc123de
🔧 PM2 Status: online
🔧 Process ID: 12345
🌍 Environment: production
🚪 Port: 8080
📁 Path: /opt/live-error-display
⏰ Deployed: 2025-08-09 14:30:45
============================================================
```

## 🛠️ Troubleshooting

### Webhook wird nicht ausgelöst

```bash
# GitHub Webhook Status prüfen
# Repository → Settings → Webhooks → Recent Deliveries

# Server Status prüfen
curl http://localhost:9000/health
sudo systemctl status webhook-listener

# Firewall prüfen
sudo ufw status | grep 9000
```

### Deployment schlägt fehl

```bash
# PM2 Status prüfen
pm2 status
pm2 logs live-error-display --lines 50

# Manueller Test
cd /opt/live-error-display
git status
git pull origin live
npm install
pm2 restart live-error-display
```

### Port-Konflikte

```bash
# Verwendete Ports prüfen
netstat -tlnp | grep -E "(8080|9090)"

# Prozesse auf Ports finden
sudo lsof -i :8080
sudo lsof -i :9090
```

## 🔒 Sicherheit

- **Webhook Secret**: Starkes 32-Byte Secret verwenden
- **Firewall**: Nur notwendige Ports öffnen (8080, 9090)
- **User Permissions**: Webhook läuft als separater User
- **Log Rotation**: Automatische Log-Rotation konfiguriert
- **Process Isolation**: Systemd Security Settings aktiv

## 📈 Produktionsumgebung

### Server Spezifikationen
- **User**: ochtii
- **Host**: 18.197.100.102
- **Path**: /opt/live-error-display
- **Branch**: live
- **Ports**: 8080 (App), 9090 (Webhook)
- **Environment**: production

### Deployment Konfiguration
```javascript
deploy: {
  production: {
    user: 'ochtii',
    host: ['18.197.100.102'],
    ref: 'origin/live',
    repo: 'https://github.com/ochtii/live-error-display.git',
    path: '/opt/live-error-display',
    'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
  }
}
```

## 🎯 Nächste Schritte

1. **Installation durchführen** mit `setup_webhook.sh`
2. **GitHub Webhook konfigurieren** (siehe WEBHOOK_GITHUB_SETUP.md)
3. **Test-Deployment** durchführen
4. **Monitoring einrichten** und Logs überwachen
5. **Dokumentation an Team weiterleiten**

---

**🎉 Ihr automatisches Deployment-System ist bereit!**

Bei Fragen oder Problemen, prüfen Sie die Logs oder führen Sie `./test_webhook_deployment.sh` aus.
