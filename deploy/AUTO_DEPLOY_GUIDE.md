# Auto-Deployment-Anleitung für Live Error Display

Diese Anleitung erklärt, wie das Auto-Deployment-System für die Live Error Display-Anwendung eingerichtet wird.

## Überblick

Das Auto-Deployment-System überwacht das Git-Repository auf Änderungen und aktualisiert die Anwendung automatisch, wenn neue Commits gefunden werden. Es verwendet einen kontinuierlichen Polling-Ansatz ohne Webhooks.

## Einrichtung

### 1. Deployment-Skript

Das Hauptskript `deploy.sh` befindet sich im `deploy`-Verzeichnis. Es führt folgende Aufgaben aus:

- Überwacht das Git-Repository auf Änderungen
- Zieht neue Änderungen, wenn vorhanden
- Installiert oder aktualisiert Abhängigkeiten
- Startet die Anwendung neu

### 2. Systemd-Service (für Linux-Server)

Erstellen Sie eine Systemd-Service-Datei für automatischen Start und Neustarts:

```bash
sudo nano /etc/systemd/system/errordisplay-deploy.service
```

Fügen Sie folgenden Inhalt ein:

```ini
[Unit]
Description=Auto-Deployment Service for Live Error Display
After=network.target

[Service]
Type=simple
User=yourusername
WorkingDirectory=/var/www/live-error-display
ExecStart=/bin/bash /var/www/live-error-display/deploy/deploy.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 3. Aktivieren und Starten des Services

```bash
sudo systemctl enable errordisplay-deploy
sudo systemctl start errordisplay-deploy
```

### 4. Überprüfen des Status

```bash
sudo systemctl status errordisplay-deploy
```

### 5. Logs anzeigen

```bash
tail -f /var/www/live-error-display/deploy/deploy.log
```

## Konfiguration

Sie können die folgenden Parameter in `deploy.sh` anpassen:

- `REPO_URL`: URL des Git-Repositories
- `APP_DIR`: Verzeichnis, in dem die Anwendung installiert ist
- `BRANCH`: Git-Branch, der überwacht werden soll
- `CHECK_INTERVAL`: Zeitintervall zwischen den Prüfungen (in Sekunden)

## Fehlerbehebung

Wenn das Deployment-System nicht wie erwartet funktioniert:

1. Überprüfen Sie die Logs: `tail -f /var/www/live-error-display/deploy/deploy.log`
2. Stellen Sie sicher, dass der Benutzer die notwendigen Berechtigungen hat
3. Prüfen Sie, ob Git korrekt installiert und konfiguriert ist
4. Stellen Sie sicher, dass die Anwendung manuell gestartet werden kann
