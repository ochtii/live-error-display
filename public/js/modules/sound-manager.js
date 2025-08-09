/**
 * Sound Manager Module
 * Handles sound preferences and playback
 */

// Default sound settings
let soundEnabled = true;

/**
 * Initialize sound manager
 */
export function initSoundManager() {
    // Load saved sound preference from localStorage
    const savedPreference = localStorage.getItem('sound_enabled');
    soundEnabled = savedPreference === null ? true : savedPreference === 'true';
    
    // Update UI to match current state
    updateSoundToggle();
    
    // Set up event listener for the sound toggle
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) {
        soundToggle.checked = soundEnabled;
        soundToggle.addEventListener('change', handleSoundToggleChange);
    }
}

/**
 * Handle sound toggle change
 * @param {Event} event - Change event
 */
function handleSoundToggleChange(event) {
    soundEnabled = event.target.checked;
    
    // Save preference
    localStorage.setItem('sound_enabled', soundEnabled);
    
    // Update UI
    updateSoundToggle();
}

/**
 * Update sound toggle UI
 */
function updateSoundToggle() {
    const soundToggle = document.getElementById('soundToggle');
    const soundLabel = document.querySelector('.sound-label');
    
    if (soundToggle) {
        soundToggle.checked = soundEnabled;
    }
    
    if (soundLabel) {
        soundLabel.textContent = soundEnabled ? '🔊' : '🔇';
    }
}

/**
 * Check if sound is enabled
 * @returns {boolean} - Whether sound is enabled
 */
export function isSoundEnabled() {
    return soundEnabled;
}

/**
 * Set sound enabled state
 * @param {boolean} enabled - Whether sound should be enabled
 */
export function setSoundEnabled(enabled) {
    soundEnabled = enabled;
    localStorage.setItem('sound_enabled', enabled);
    updateSoundToggle();
}
