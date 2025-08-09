/**
 * Sound Pack API Integration
 * Provides access to free notification sounds
 */

// Base URL for NotificationSounds.com free sounds API
const SOUND_API_BASE = 'https://notificationsounds.com/sound-files/';

// Map of sound identifiers to their API URLs
const SOUND_PACK = {
    ERROR: {
        url: `${SOUND_API_BASE}alarm-frenzy.mp3`,
        name: 'Alarm Frenzy',
        volume: 0.7
    },
    WARNING: {
        url: `${SOUND_API_BASE}alert-tone.mp3`,
        name: 'Alert Tone',
        volume: 0.5
    },
    INFO: {
        url: `${SOUND_API_BASE}pristine.mp3`,
        name: 'Pristine',
        volume: 0.3
    },
    NOTIFICATION: {
        url: `${SOUND_API_BASE}appointed.mp3`,
        name: 'Appointed',
        volume: 0.4
    },
    SUCCESS: {
        url: `${SOUND_API_BASE}juntos.mp3`,
        name: 'Juntos',
        volume: 0.5
    }
};

// Fallback sounds using HTML5 audio tones (if API is unavailable)
const FALLBACK_GENERATOR = {
    // Generate a basic tone
    generateTone(frequency = 440, duration = 500, volume = 0.5, type = 'sine') {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.type = type;
            oscillator.frequency.value = frequency;
            gainNode.gain.value = volume;
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start();
            
            setTimeout(() => {
                oscillator.stop();
                // Optional: Close the audio context to free resources
                setTimeout(() => audioContext.close(), 100);
            }, duration);
            
            return true;
        } catch (e) {
            console.warn('Failed to generate audio tone', e);
            return false;
        }
    },
    
    // Generate different tones for different error levels
    ERROR() {
        return this.generateTone(880, 400, 0.7, 'square');
    },
    
    WARNING() {
        return this.generateTone(587.33, 350, 0.5, 'triangle');
    },
    
    INFO() {
        return this.generateTone(523.25, 250, 0.3, 'sine');
    },
    
    NOTIFICATION() {
        return this.generateTone(659.25, 300, 0.4, 'sine');
    },
    
    SUCCESS() {
        return this.generateTone(783.99, 350, 0.5, 'sine');
    }
};

export { SOUND_PACK, FALLBACK_GENERATOR };
