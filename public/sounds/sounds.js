/**
 * Sound Player Module
 * Handles playing notification sounds for the application
 */

import { SOUND_PACK, MODERN_AUDIO_GENERATOR } from './soundpack.js';

// Sound configuration - now uses modern sound pack
const SOUNDS = SOUND_PACK;

// Keep track of loaded audio elements
const audioElements = {};

// Settings
let soundEnabled = true;
let volume = 1.0;

/**
 * Initialize sound player
 */
function init() {
    // Preload audio files
    for (const [key, config] of Object.entries(SOUNDS)) {
        preloadSound(key, config.file);
    }
    
    // Load settings from local storage
    loadSettings();
    
    console.log('🔊 Sound player initialized');
}

/**
 * Preload a sound file
 * @param {string} id - Sound identifier
 * @param {string} url - Sound URL
 */
function preloadSound(id, config) {
    try {
        const audio = new Audio(config.url);
        audio.preload = 'auto';
        audioElements[id] = audio;
    } catch (e) {
        console.warn(`Failed to preload sound: ${id}`, e);
    }
}

/**
 * Play a sound by its identifier
 * @param {string} id - Sound identifier (ERROR, WARNING, INFO, etc.)
 * @returns {boolean} - Whether the sound was played
 */
function play(id) {
    if (!soundEnabled) {
        return false;
    }

    // First try modern audio generator for better quality
    if (MODERN_AUDIO_GENERATOR && typeof MODERN_AUDIO_GENERATOR[id] === 'function') {
        return MODERN_AUDIO_GENERATOR[id]();
    }

    // Fallback to audio files if available
    const audio = audioElements[id];
    const config = SOUNDS[id];

    if (!audio || !config) {
        console.warn(`Sound not found: ${id}`);
        return false;
    }

    try {
        // Set volume
        audio.volume = config.volume * volume;
        
        // Reset and play
        audio.currentTime = 0;
        audio.play();
        
        return true;
    } catch (e) {
        console.warn(`Failed to play sound: ${id}`, e);
        return false;
    }
}

/**
 * Enable or disable sounds
 * @param {boolean} enabled - Whether sounds should be enabled
 */
function setEnabled(enabled) {
    soundEnabled = !!enabled;
    saveSettings();
}

/**
 * Set global volume
 * @param {number} value - Volume level (0.0 to 1.0)
 */
function setVolume(value) {
    volume = Math.min(1.0, Math.max(0.0, value));
    saveSettings();
}

/**
 * Play a sound for an error level
 * @param {string} level - Error level (ERROR, WARNING, INFO)
 */
function playForErrorLevel(level) {
    if (level === 'ERROR') {
        play('ERROR');
    } else if (level === 'WARNING') {
        play('WARNING');
    } else if (level === 'INFO') {
        play('INFO');
    } else {
        play('NOTIFICATION');
    }
}

/**
 * Save settings to local storage
 */
function saveSettings() {
    try {
        localStorage.setItem('sound_enabled', soundEnabled);
        localStorage.setItem('sound_volume', volume);
    } catch (e) {
        console.warn('Failed to save sound settings', e);
    }
}

/**
 * Load settings from local storage
 */
function loadSettings() {
    try {
        const storedEnabled = localStorage.getItem('sound_enabled');
        const storedVolume = localStorage.getItem('sound_volume');
        
        if (storedEnabled !== null) {
            soundEnabled = storedEnabled === 'true';
        }
        
        if (storedVolume !== null) {
            volume = parseFloat(storedVolume);
        }
    } catch (e) {
        console.warn('Failed to load sound settings', e);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

// Export methods
export {
    play,
    playForErrorLevel,
    setEnabled,
    setVolume
};
