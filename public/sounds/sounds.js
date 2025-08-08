// Sound Manager für Live Error Display
// Verwendet Web Audio API für plattformunabhängige Sounds

class SoundManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.enabled = true;
        this.initialized = false;
        this.generateSounds();
        // AudioContext erst bei erster Interaktion initialisieren
        this.initOnUserGesture();
    }

    initOnUserGesture() {
        const initAudio = async () => {
            if (!this.initialized) {
                await this.initAudioContext();
                this.initialized = true;
                // Event-Listener entfernen nach erster Initialisierung
                document.removeEventListener('click', initAudio);
                document.removeEventListener('keydown', initAudio);
            }
        };
        
        document.addEventListener('click', initAudio);
        document.addEventListener('keydown', initAudio);
    }

    async initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            // Warten bis AudioContext läuft oder nach User-Geste resumed werden kann
            if (this.audioContext.state === 'suspended') {
                // Nicht automatisch resume - warten auf User-Geste
                return;
            }
        } catch (error) {
            // Stille Behandlung - AudioContext nicht verfügbar
            this.audioContext = null;
        }
    }

    // Generiert Sounds programmatisch (keine externen Dateien nötig)
    generateSounds() {
        this.sounds = {
            // Neue Fehlermeldung Sounds
            notification: () => this.createTone([800, 1000], [0.3, 0.1], 0.3),
            alert: () => this.createTone([400, 600, 400], [0.2, 0.2, 0.2], 0.4),
            chime: () => this.createTone([523, 659, 784], [0.3, 0.3, 0.4], 0.2),
            
            // Verbindung erfolgreich Sounds
            success: () => this.createTone([400, 800], [0.2, 0.3], 0.2),
            connect: () => this.createTone([300, 600, 900], [0.1, 0.1, 0.3], 0.15),
            
            // Verbindung getrennt Sounds
            disconnect: () => this.createTone([800, 400], [0.3, 0.5], 0.3),
            error: () => this.createTone([200, 150], [0.4, 0.6], 0.4),
            warning: () => this.createTone([600, 500, 400], [0.2, 0.2, 0.3], 0.3)
        };
    }

    async createTone(frequencies, durations, volume = 0.3) {
        if (!this.audioContext || !this.enabled) return;

        try {
            // Resume AudioContext falls suspended (User-Geste erforderlich)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            let currentTime = this.audioContext.currentTime;
            
            // Multi-Ton Sequenz
            for (let i = 0; i < frequencies.length; i++) {
                const freq = frequencies[i];
                const duration = durations[i] || 0.2;
                
                oscillator.frequency.setValueAtTime(freq, currentTime);
                gainNode.gain.setValueAtTime(volume, currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + duration);
                
                currentTime += duration;
            }

            oscillator.type = 'sine';
            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(currentTime);

        } catch (error) {
            // Komplett stille Behandlung - keine Ausgabe
        }
    }

    async playSound(soundName) {
        if (!this.enabled || !this.sounds[soundName]) return;
        
        // AudioContext bei Bedarf initialisieren (nach User-Geste)
        if (!this.initialized) {
            try {
                await this.initAudioContext();
                this.initialized = true;
            } catch (error) {
                // Stille Behandlung - Sound wird einfach nicht abgespielt
                return;
            }
        }
        
        try {
            await this.sounds[soundName]();
        } catch (error) {
            // Stille Fehlerbehandlung für AudioContext-Probleme
            // Keine Konsolen-Ausgabe um Spam zu vermeiden
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }

    isEnabled() {
        return this.enabled;
    }

    // Test-Methode für Einstellungen
    async testSound(eventType, soundType) {
        const soundMap = {
            newError: {
                notification: 'notification',
                alert: 'alert',
                chime: 'chime'
            },
            connectionSuccess: {
                success: 'success',
                connect: 'connect',
                chime: 'chime'
            },
            connectionClosed: {
                disconnect: 'disconnect',
                error: 'error',
                warning: 'warning'
            }
        };

        const soundName = soundMap[eventType]?.[soundType];
        if (soundName) {
            await this.playSound(soundName);
        }
    }
}

// Global verfügbare Instanz
window.soundManager = new SoundManager();
