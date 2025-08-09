#!/bin/bash
# Manual Git Fix - Falls automatischer Fix nicht funktioniert

echo "=== Manual Git Reset und Pull ==="

cd /opt/live-error-display

echo "1. Backup aktuelle Änderungen (falls vorhanden):"
git stash

echo "2. Hard Reset zum letzten Remote Commit:"
git reset --hard origin/live

echo "3. Force Pull:"
git pull origin live --force

echo "4. Alternative: Clone fresh (als letzter Ausweg):"
echo "   cd /opt"
echo "   sudo mv live-error-display live-error-display-backup"
echo "   sudo git clone -b live https://github.com/ochtii/live-error-display.git"
echo "   sudo chown -R ochtii:ochtii live-error-display"

echo "=== Manual Fix Optionen gezeigt ==="
