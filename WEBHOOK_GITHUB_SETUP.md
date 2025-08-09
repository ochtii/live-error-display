# GitHub Webhook Setup Guide

## 🎯 Übersicht

Dieser Guide erklärt, wie Sie GitHub Webhooks für automatisches Deployment einrichten.

## 🔐 1. GitHub Secret generieren

Zuerst benötigen Sie einen sicheren Secret-Key:

```bash
# Generieren Sie einen starken Secret (Linux/Mac)
openssl rand -hex 32

# Oder verwenden Sie einen Online-Generator
# https://generate-secret.vercel.app/32
```

**Beispiel Secret:** `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`

## 🏗️ 2. GitHub Repository konfigurieren

### Schritt 1: Repository Settings öffnen
1. Gehen Sie zu Ihrem GitHub Repository: `https://github.com/ochtii/live-error-display`
2. Klicken Sie auf **Settings** (oben rechts)
3. Wählen Sie **Webhooks** im linken Menü

### Schritt 2: Neuen Webhook hinzufügen
1. Klicken Sie auf **Add webhook**
2. Füllen Sie folgende Felder aus:

**Payload URL:**
```
http://18.197.100.102:9090/webhook
```

**Content type:**
```
application/json
```

**Secret:**
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```
*(Verwenden Sie Ihren generierten Secret)*

**Which events would you like to trigger this webhook?**
- Wählen Sie: "Just the push event"

**Active:**
- ✅ Aktiviert lassen

3. Klicken Sie **Add webhook**

## ⚙️ 3. Server konfigurieren

### Schritt 1: Umgebungsvariable setzen

Bearbeiten Sie die ecosystem.config.js Datei:
```bash
nano /opt/live-error-display/ecosystem.config.js
```

Ändern Sie diese Zeile im live-error-display-webhook Abschnitt:
```javascript
GITHUB_WEBHOOK_SECRET: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456'
```

### Schritt 2: PM2 Services starten

```bash
cd /opt/live-error-display
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### Schritt 3: Status überprüfen
```bash
pm2 status
pm2 logs webhook-listener
pm2 logs live-error-display
```

## 🧪 4. Webhook testen

### Manueller Test über GitHub
1. Gehen Sie zu Ihren Repository **Settings → Webhooks**
2. Klicken Sie auf Ihren Webhook
3. Scrollen Sie nach unten zu **Recent Deliveries**
4. Klicken Sie **Redeliver** für einen Test

### Test Push
Machen Sie eine kleine Änderung im `live` Branch:
```bash
# Auf Ihrem lokalen Rechner
git checkout live
echo "# Test $(date)" >> TEST.md
git add TEST.md
git commit -m "Test webhook deployment"
git push origin live
```

## 📊 5. Monitoring und Logs

### Service Status
```bash
# PM2 Status
pm2 status

# Webhook Logs
pm2 logs live-error-display-webhook

# Main App Logs
pm2 logs live-error-display

# All PM2 Logs
pm2 logs
```

### Webhook Endpoints
- **Health Check:** `http://18.197.100.102:9090/health`
- **Status:** `http://18.197.100.102:9090/status`
- **Webhook:** `http://18.197.100.102:9090/webhook` (POST)
- **App Health:** `http://18.197.100.102:8080/api/health`

## 🔧 6. Troubleshooting

### Webhook wird nicht ausgelöst
1. Überprüfen Sie die GitHub Webhook Logs:
   - Repository → Settings → Webhooks → Ihr Webhook → Recent Deliveries
2. Prüfen Sie den PM2 Status:
   ```bash
   pm2 status
   pm2 logs live-error-display-webhook
   curl http://localhost:9090/health
   ```

### Deployment schlägt fehl
1. Überprüfen Sie PM2 Status:
   ```bash
   pm2 status
   pm2 logs live-error-display --lines 50
   ```

2. Manuelle Deployment-Tests:
   ```bash
   cd /opt/live-error-display
   git status
   git pull origin live
   npm install
   pm2 restart live-error-display
   ```

### Logs überprüfen
```bash
# Webhook Listener Logs
pm2 logs live-error-display-webhook

# Application Logs
pm2 logs live-error-display

# All PM2 Logs
pm2 logs

# System Logs (if needed)
tail -f /var/log/live-error-display-webhook-*.log
```

## 🛡️ 7. Sicherheit

### Firewall
Stellen Sie sicher, dass Port 9090 geöffnet ist:
```bash
sudo ufw allow 9090/tcp
sudo ufw status
```

### Secret Rotation
Wechseln Sie regelmäßig Ihren Webhook Secret:
1. Generieren Sie einen neuen Secret
2. Aktualisieren Sie GitHub Webhook Settings
3. Aktualisieren Sie Server Environment Variable
4. Service neu starten

## 📋 8. Konfigurationsdatei Beispiel

Vollständige Service-Konfiguration (`/etc/systemd/system/webhook-listener.service`):

```ini
[Unit]
Description=GitHub Webhook Listener for Live Error Display
After=network.target
Wants=network.target

[Service]
Type=simple
User=webhook
Group=webhook
WorkingDirectory=/opt/live-error-display
Environment=PYTHONPATH=/opt/live-error-display
Environment=GITHUB_WEBHOOK_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
Environment=WEBHOOK_PORT=9000
Environment=WEBHOOK_HOST=0.0.0.0
Environment=TARGET_BRANCH=live
ExecStart=/usr/bin/python3 /opt/live-error-display/webhook_listener.py
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=webhook-listener

[Install]
WantedBy=multi-user.target
```

## ✅ 9. Checkliste

- [ ] GitHub Secret generiert
- [ ] GitHub Webhook konfiguriert (Payload URL, Secret, Push events)
- [ ] Server Dependencies installiert (`pip install -r webhook_requirements.txt`)
- [ ] Service-Datei erstellt und konfiguriert
- [ ] Environment Variable gesetzt
- [ ] Service aktiviert und gestartet
- [ ] Firewall Port 9000 geöffnet
- [ ] Webhook getestet (GitHub → Recent Deliveries)
- [ ] Deployment getestet (Test Push zum live Branch)
- [ ] Logs überprüft und funktionsfähig

## 🚀 10. Fertig!

Ihr automatisches Deployment System ist jetzt aktiv! Bei jedem Push zum `live` Branch wird automatisch:

1. 🛑 PM2 Prozess gestoppt
2. 📥 Neueste Änderungen gepullt
3. 📦 Dependencies installiert
4. 🧹 Logs geleert
5. ▶️ Service neu gestartet
6. 🏥 Health Checks durchgeführt
7. 📊 Deployment Summary angezeigt

**Webhook URL:** `http://18.197.100.102:9090/webhook`
