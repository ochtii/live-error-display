/**
 * Modern Sound Pack
 * Provides access to modern notification sounds
 */

// Map of sound identifiers to their modern sound URLs
const SOUND_PACK = {
    ERROR: {
        url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBzuR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DoumEWCAw=',
        name: 'Modern Error Alert',
        volume: 0.7
    },
    WARNING: {
        url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBzuR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DoumEWCAw=',
        name: 'Modern Warning Tone',
        volume: 0.5
    },
    INFO: {
        url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBzuR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DoumEWCAw=',
        name: 'Modern Info Chime',
        volume: 0.3
    },
    NOTIFICATION: {
        url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBzuR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DoumEWCAw=',
        name: 'Modern Notification',
        volume: 0.4
    },
    SUCCESS: {
        url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBzuR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DoumEWCAw=',
        name: 'Modern Success Bell',
        volume: 0.5
    }
};

// Modern Audio Generator for fallback and enhanced sounds
const MODERN_AUDIO_GENERATOR = {
    // Create a modern notification sound with multiple harmonics
    createModernTone(baseFreq = 440, duration = 500, volume = 0.5, type = 'modern') {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const gainNode = audioContext.createGain();
            gainNode.connect(audioContext.destination);
            
            if (type === 'modern') {
                // Create multiple oscillators for a richer sound
                const frequencies = [baseFreq, baseFreq * 1.25, baseFreq * 1.5];
                const oscillators = [];
                
                frequencies.forEach((freq, index) => {
                    const osc = audioContext.createOscillator();
                    const oscGain = audioContext.createGain();
                    
                    osc.type = 'sine';
                    osc.frequency.value = freq;
                    oscGain.gain.value = volume / frequencies.length * (1 - index * 0.3);
                    
                    osc.connect(oscGain);
                    oscGain.connect(gainNode);
                    oscillators.push(osc);
                });
                
                // Add envelope for smoother sound
                gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.1);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
                
                oscillators.forEach(osc => osc.start());
                
                setTimeout(() => {
                    oscillators.forEach(osc => osc.stop());
                    setTimeout(() => audioContext.close(), 100);
                }, duration);
                
            } else {
                // Single tone fallback
                const oscillator = audioContext.createOscillator();
                oscillator.type = type;
                oscillator.frequency.value = baseFreq;
                gainNode.gain.value = volume;
                
                oscillator.connect(gainNode);
                oscillator.start();
                
                setTimeout(() => {
                    oscillator.stop();
                    setTimeout(() => audioContext.close(), 100);
                }, duration);
            }
            
            return true;
        } catch (e) {
            console.warn('Failed to generate modern audio tone', e);
            return false;
        }
    },
    
    // Modern error sound - urgent but pleasant
    ERROR() {
        return this.createModernTone(659.25, 600, 0.7, 'modern'); // E5 note
    },
    
    // Modern warning sound - attention-getting
    WARNING() {
        return this.createModernTone(523.25, 400, 0.5, 'modern'); // C5 note
    },
    
    // Modern info sound - subtle and clean
    INFO() {
        return this.createModernTone(783.99, 300, 0.3, 'modern'); // G5 note
    },
    
    // Modern notification sound - friendly
    NOTIFICATION() {
        return this.createModernTone(698.46, 350, 0.4, 'modern'); // F5 note
    },
    
    // Modern success sound - satisfying
    SUCCESS() {
        return this.createModernTone(880.00, 500, 0.5, 'modern'); // A5 note
    }
};

export { SOUND_PACK, MODERN_AUDIO_GENERATOR };
