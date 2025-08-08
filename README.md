# Live Error Display 🚨

**Kompakte Live-Fehleranzeige mit automatischem Deployment für Ubuntu Server**

*🎉 Deploy Test #4 - 2025-08-08 06:20:00 - Testing with correct deploy-opt.sh script*

## 🚀 Quick Start (Ubuntu Server)

### 1. Repository klonen
```bash
cd /opt
sudo git clone https://github.com/ochtii/live-error-display.git
cd live-error-display
```

### 2. Automatisches Setup
```bash
sudo chmod +x setup.sh
sudo ./setup.sh
```

**Das war's!** 🎉 Die Anwendung läuft jetzt automatisch mit Live-Updates.

## 📱 Zugriff

- **Web-Interface:** `http://IHRE-SERVER-IP:8080`
- **Demo-Modus:** Generiert automatisch Test-Fehler (nur Development)
- **Live-Updates:** Automatische Aktualisierung bei Git-Änderungen

## 🔧 Features

### ✨ Frontend
- 🎨 **Modernes Design** mit Glasmorphism-Effekten
- 📱 **Responsive** für Desktop und Mobile
- 🔴 **Live-Updates** via Server-Sent Events (SSE)
- 📦 **Archiv-Modus** für gespeicherte Fehler
- 📋 **Ein-Klick Kopieren** mit verschiedenen Formaten
- 📊 **Statistiken** (Gesamt/Session Fehler)
- 🎯 **Collapsible Cards** für bessere Übersicht

### ⚙️ Backend
- 🚀 **Express.js** Server
- 💾 **In-Memory Storage** (letzte 100 Fehler)
- 🔗 **SSE-Support** für Live-Updates
- 🌐 **CORS-enabled** für Cross-Origin Requests
- 🎲 **Demo-Modus** mit automatischen Test-Fehlern

### 🔄 Auto-Deployment
- ⏱️ **Sekündliche Überwachung** des Git-Repositories
- 🔄 **Automatische Updates** bei Code-Änderungen
- 📦 **Dependency-Management** (erkennt package.json Änderungen)
- 🛡️ **Backup & Rollback** bei fehlgeschlagenen Deployments
- 📝 **Vollständiges Logging** aller Aktivitäten
- 🎯 **Systemd Integration** für Service-Management

## 📋 Systemanforderungen

- **Ubuntu 18.04+** (oder andere Debian-basierte Distributionen)
- **Node.js 16+** (wird automatisch installiert)
- **Git** (wird automatisch installiert)
- **Root-Zugriff** für Setup

## 🛠️ Manuelle Installation

Falls Sie das Setup manuell durchführen möchten:

```bash
# 1. Dependencies installieren
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo bash -
sudo apt install -y nodejs git

# 2. PM2 global installieren
sudo npm install -g pm2

# 3. Repository klonen
sudo git clone https://github.com/ochtii/live-error-display.git /opt/live-error-display
cd /opt/live-error-display

# 4. Dependencies installieren
sudo npm install --production

# 5. PM2 App starten
sudo -u www-data pm2 start ecosystem.config.json
sudo -u www-data pm2 save
sudo pm2 startup

# 6. Auto-Deploy starten
sudo chmod +x deploy.sh
sudo ./deploy.sh
```

## 📊 API Endpunkte

| Endpunkt | Methode | Beschreibung |
|----------|---------|--------------|
| `/` | GET | Web-Interface |
| `/events` | GET | SSE-Stream für Live-Updates |
| `/archive` | GET | JSON-Array aller Fehler |
| `/error` | POST | Neuen Fehler hinzufügen |

### Fehler per API hinzufügen
```bash
curl -X POST http://localhost:8080/error \
  -H "Content-Type: application/json" \
  -d '{"message": "Database connection failed"}'
```

## 🎛️ Konfiguration

### Umgebungsvariablen
```bash
export PORT=8080              # Server-Port (Standard: 8080)
export NODE_ENV=production    # Deaktiviert Demo-Modus
```

### Deploy-Skript anpassen
Editieren Sie `deploy.sh` für custom Konfiguration:
```bash
REPO_DIR="/opt/live-error-display"    # Repository-Pfad
CHECK_INTERVAL=1                       # Prüfintervall in Sekunden
SERVICE_NAME="live-error-display"     # Service-Name
```

## 📝 PM2 Process Management

### Live Error Display App
```bash
sudo -u www-data pm2 status live-error-display    # Status
sudo -u www-data pm2 restart live-error-display   # Neustart
sudo -u www-data pm2 stop live-error-display      # Stoppen
sudo -u www-data pm2 logs live-error-display      # Logs anzeigen
```

### PM2 Startup (System-Boot)
```bash
# PM2 beim Systemstart aktivieren
sudo pm2 startup
sudo -u www-data pm2 save

# PM2 Startup deaktivieren
sudo pm2 unstartup
```

## 📊 Monitoring & Logs

### Anwendungs-Logs
```bash
# Live App-Logs via PM2
sudo -u www-data pm2 logs live-error-display

# Deploy-Logs
tail -f /var/log/live-error-display-deploy.log

# PM2 Monitoring
sudo -u www-data pm2 monit
```

### Fehlerdiagnose
```bash
# PM2 Status prüfen
sudo -u www-data pm2 describe live-error-display

# Port-Verfügbarkeit prüfen
sudo netstat -tlnp | grep :8080

# PM2 Prozess neu starten
sudo -u www-data pm2 reload live-error-display

# Lock-Datei entfernen (falls Deploy hängt)
sudo rm -f /tmp/live-error-display-deploy.lock
```

## 🔒 Sicherheit

### Firewall-Konfiguration
```bash
sudo ufw enable
sudo ufw allow 22      # SSH
sudo ufw allow 8080    # Application
```

### Reverse Proxy (empfohlen)
Für Produktionsumgebungen verwenden Sie nginx:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🚀 Deployment-Workflow

1. **Lokale Änderungen** → `git push origin main`
2. **Auto-Deploy erkennt** Änderungen (binnen 1 Sekunde)
3. **Automatischer Download** der neuesten Version
4. **Dependency-Check** und Installation bei Bedarf
5. **Service-Neustart** mit Health-Check
6. **Rollback** bei Fehlern

## 🎯 Produktionsoptimierung

### Performance
- Erhöhen Sie den Check-Interval für weniger Last: `CHECK_INTERVAL=5`
- Verwenden Sie einen Reverse Proxy (nginx/Apache)
- Aktivieren Sie Gzip-Kompression

### Skalierung
- Verwenden Sie Redis für Error-Storage bei mehreren Instanzen
- Load Balancer für horizontale Skalierung
- Container-Deployment mit Docker

## 📞 Support & Troubleshooting

### Häufige Probleme

**Service startet nicht:**
```bash
sudo journalctl -u live-error-display --since "5 minutes ago"
```

**Auto-Deploy funktioniert nicht:**
```bash
sudo rm -f /tmp/live-error-display-deploy.lock
sudo systemctl restart live-error-display-deploy
```

**Port bereits in Verwendung:**
```bash
sudo lsof -i :8080
# Oder Port ändern:
sudo systemctl edit live-error-display
# Hinzufügen: Environment=PORT=3000
```

**Git-Probleme:**
```bash
cd /opt/live-error-display
sudo -u www-data git status
sudo -u www-data git reset --hard origin/main
```

---

**🎉 Viel Erfolg mit Ihrer Live Error Display!**

Bei Fragen oder Problemen erstellen Sie ein Issue im GitHub Repository.
