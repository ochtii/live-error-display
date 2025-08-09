#!/usr/bin/env python3
"""
Testskript für den GitHub Webhook
Dieses Skript simuliert einen GitHub Webhook-Aufruf und überprüft die Antwort.
"""

import json
import requests
import hmac
import hashlib
import sys

# Konfiguration
WEBHOOK_URL = "http://localhost:9000/webhook"  # Lokale Webhook-URL
WEBHOOK_SECRET = "dein-geheimer-schlüssel"  # Muss mit dem Secret im webhook.py übereinstimmen
REPO_NAME = "ochtii/live-error-display"

def generate_signature(payload, secret):
    """Generiert eine GitHub-kompatible Signatur für den Webhook"""
    signature = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"sha256={signature}"

def simulate_github_push():
    """Simuliert einen GitHub Push-Event-Webhook"""
    # Erstelle einen Push-Event-Payload
    payload = {
        "ref": "refs/heads/main",
        "repository": {
            "full_name": REPO_NAME
        },
        "after": "1234567890abcdef1234567890abcdef12345678",
        "head_commit": {
            "message": "Test Commit für Auto-Deploy"
        }
    }
    
    # Konvertiere Payload zu JSON-String
    payload_json = json.dumps(payload)
    
    # Generiere Signatur
    signature = generate_signature(payload_json, WEBHOOK_SECRET)
    
    # Setze Headers
    headers = {
        "Content-Type": "application/json",
        "X-GitHub-Event": "push",
        "X-Hub-Signature-256": signature
    }
    
    print(f"Sende Test-Webhook an {WEBHOOK_URL}")
    print(f"Payload: {payload_json}")
    print(f"Signatur: {signature}")
    
    try:
        # Sende POST-Anfrage
        response = requests.post(
            WEBHOOK_URL,
            data=payload_json,
            headers=headers
        )
        
        # Zeige Antwort
        print(f"\nAntwort-Status: {response.status_code}")
        print(f"Antwort-Inhalt: {response.text}")
        
        if response.status_code == 200:
            print("\n✅ Webhook wurde erfolgreich empfangen und verarbeitet!")
            return True
        else:
            print("\n❌ Webhook-Anfrage fehlgeschlagen!")
            return False
    
    except Exception as e:
        print(f"\n❌ Fehler beim Senden des Webhooks: {str(e)}")
        return False

if __name__ == "__main__":
    print("=== GitHub Webhook Tester ===")
    simulate_github_push()
