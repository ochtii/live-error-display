#!/bin/bash
# Git Pull Fix Script - Auf dem Ubuntu Server ausführen

echo "=== Git Pull Diagnose und Fix ==="

cd /opt/live-error-display

echo "1. Aktueller Branch:"
git branch

echo -e "\n2. Remote Branches:"
git branch -r

echo -e "\n3. Git Status:"
git status

echo -e "\n4. Remote URL prüfen:"
git remote -v

echo -e "\n5. Fetch alle Remote Branches:"
git fetch --all

echo -e "\n6. Prüfe ob auf live Branch:"
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "live" ]; then
    echo "   PROBLEM: Aktueller Branch ist '$CURRENT_BRANCH', sollte 'live' sein!"
    echo "   Wechsle zu live Branch..."
    git checkout live
else
    echo "   ✓ Bereits auf live Branch"
fi

echo -e "\n7. Git Pull vom live Branch:"
git pull origin live

echo -e "\n8. Letzte Commits:"
git log --oneline -5

echo -e "\n9. Webhook Prozess neu starten:"
pm2 restart live-error-display-webhook

echo -e "\n10. App Prozess neu starten:"
pm2 restart live-error-display

echo -e "\n11. Status prüfen:"
pm2 status

echo "=== Fix abgeschlossen! ==="
