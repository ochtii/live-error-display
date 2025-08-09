# Auto-Deploy-System für Live Error Display

Dieses Dokument beschreibt die Einrichtung und Verwendung des automatischen Deployment-Systems für das Live Error Display-Projekt.

## Überblick

Das Auto-Deploy-System nutzt ein Bash-Skript (`deploy.sh`), das kontinuierlich nach Updates im Git-Repository sucht und diese automatisch bereitstellt, ohne dass zusätzliche Webhooks oder externe Trigger erforderlich sind.

## Voraussetzungen

- Linux-Server (Ubuntu empfohlen)
- Node.js und npm
- PM2 (`npm install -g pm2`)
- Git

## Einrichtung des Auto-Deploy-Systems

### 1. Ersteinrichtung

1. Klone das Repository:
   ```bash
   git clone https://github.com/ochtii/live-error-display.git
   cd live-error-display
   ```

2. Mache das Deploy-Skript ausführbar:
   ```bash
   chmod +x deploy.sh test_deploy.sh
   ```

3. Führe das Test-Skript aus, um die Konfiguration zu überprüfen:
   ```bash
   ./test_deploy.sh
   ```

4. Starte das Auto-Deploy-Skript:
   ```bash
   sudo ./deploy.sh
   ```

## Funktionsweise des Auto-Deploy-Systems

Das Auto-Deploy-System arbeitet wie folgt:

1. **Kontinuierliche Überwachung**:
   - Das Skript prüft jede Sekunde (konfigurierbar durch `CHECK_INTERVAL`) auf Änderungen im Git-Repository.
   - Es verwendet `git fetch`, um Informationen vom Remote-Repository abzurufen, ohne lokale Änderungen vorzunehmen.

2. **Änderungserkennung**:
   - Es vergleicht den lokalen Commit mit dem Remote-Commit.
   - Es zählt, wie viele Commits der lokale Stand hinter dem Remote-Stand zurückliegt.

3. **Automatisches Deployment**:
   - Wenn Änderungen erkannt werden, aktualisiert es den Code mit `git reset --hard`.
   - Es prüft, ob `package.json` geändert wurde, und aktualisiert in diesem Fall die Dependencies.
   - Es startet den Service mit PM2 neu.

4. **Fehlerbehandlung**:
   - Vor jeder Änderung wird ein Backup des aktuellen Zustands erstellt.
   - Bei Fehlern während des Deployments wird ein Rollback zum vorherigen Zustand durchgeführt.
   - Umfangreiches Logging in `/var/log/live-error-display-deploy.log`.

## Systemd-Service für dauerhafte Ausführung

Für eine dauerhafte Ausführung des Auto-Deploy-Skripts empfehlen wir einen systemd-Service einzurichten:

```bash
sudo nano /etc/systemd/system/live-error-display-deploy.service
```

Inhalt:
```
[Unit]
Description=Live Error Display Auto Deploy
After=network.target

[Service]
Type=simple
User=root
ExecStart=/path/to/live-error-display/deploy.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Aktiviere und starte den Service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable live-error-display-deploy
sudo systemctl start live-error-display-deploy
```

## Überwachung und Fehlerbehebung

- Auto-Deploy-Log anzeigen:
  ```bash
  tail -f /var/log/live-error-display-deploy.log
  ```

- Service-Status prüfen:
  ```bash
  sudo systemctl status live-error-display-deploy
  ```

- Manuelles Deployment erzwingen:
  ```bash
  sudo ./deploy.sh test
  ```
## Häufige Probleme und Lösungen

1. **Änderungen werden nicht erkannt:**
   - Prüfe die Git-Konfiguration: `git config -l`
   - Stelle sicher, dass die Remote-URL korrekt ist: `git remote -v`
   - Versuche einen manuellen Fetch: `git fetch origin main`

2. **Auto-Deploy funktioniert nicht:**
   - Prüfe, ob das Deploy-Skript Ausführungsrechte hat: `ls -la deploy.sh`
   - Stelle sicher, dass der Benutzer sudo-Rechte hat
   - Überprüfe die Logs auf Fehler: `cat /var/log/live-error-display-deploy.log`

3. **Anwendung startet nach Deployment nicht:**
   - Prüfe die PM2-Logs: `pm2 logs live-error-display`
   - Stelle sicher, dass alle Abhängigkeiten installiert sind: `npm install`
   - Überprüfe die Server-Konfiguration und Port-Einstellungen (Port 8080)
