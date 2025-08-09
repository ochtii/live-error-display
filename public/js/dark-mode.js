/**
 * Dark Mode Toggle Script
 * Fügt Dark Mode Funktionalität zur Live Error Display App hinzu
 */

// DOM geladen Event
document.addEventListener('DOMContentLoaded', function() {
    initDarkMode();
});

/**
 * Initialisiert den Dark Mode
 */
function initDarkMode() {
    // Dark Mode Toggle Button erstellen und hinzufügen
    createDarkModeToggle();
    
    // Gespeicherte Einstellung wiederherstellen
    restoreUserPreference();
    
    // Systemeinstellung prüfen
    checkSystemPreference();
}

/**
 * Erstellt den Dark Mode Toggle Button
 */
function createDarkModeToggle() {
    const button = document.createElement('button');
    button.className = 'dark-mode-toggle';
    button.id = 'darkModeToggle';
    button.title = 'Dark Mode umschalten';
    button.innerHTML = '🌓';
    button.setAttribute('aria-label', 'Dark Mode umschalten');
    
    button.addEventListener('click', toggleDarkMode);
    
    document.body.appendChild(button);
}

/**
 * Schaltet den Dark Mode ein oder aus
 */
function toggleDarkMode() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    
    // Update Button-Text
    const toggleButton = document.getElementById('darkModeToggle');
    if (toggleButton) {
        toggleButton.innerHTML = isDarkMode ? '🌞' : '🌓';
        toggleButton.title = isDarkMode ? 'Light Mode aktivieren' : 'Dark Mode aktivieren';
    }
    
    // Einstellung speichern
    localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');
    
    // Event auslösen für andere Komponenten
    const event = new CustomEvent('darkModeChanged', { detail: { darkMode: isDarkMode } });
    document.dispatchEvent(event);
}

/**
 * Stellt die vom Benutzer gespeicherte Einstellung wieder her
 */
function restoreUserPreference() {
    const savedMode = localStorage.getItem('darkMode');
    
    if (savedMode === 'enabled') {
        document.body.classList.add('dark-mode');
        
        const toggleButton = document.getElementById('darkModeToggle');
        if (toggleButton) {
            toggleButton.innerHTML = '🌞';
            toggleButton.title = 'Light Mode aktivieren';
        }
    }
}

/**
 * Prüft die Systemeinstellung für Dark Mode
 */
function checkSystemPreference() {
    // Nur prüfen, wenn keine gespeicherte Einstellung vorhanden ist
    if (localStorage.getItem('darkMode') === null) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (prefersDark) {
            document.body.classList.add('dark-mode');
            
            const toggleButton = document.getElementById('darkModeToggle');
            if (toggleButton) {
                toggleButton.innerHTML = '🌞';
                toggleButton.title = 'Light Mode aktivieren';
            }
        }
    }
    
    // Auf Änderungen der Systemeinstellung reagieren
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // Nur ändern, wenn keine gespeicherte Einstellung vorhanden ist
        if (localStorage.getItem('darkMode') === null) {
            if (e.matches) {
                document.body.classList.add('dark-mode');
                
                const toggleButton = document.getElementById('darkModeToggle');
                if (toggleButton) {
                    toggleButton.innerHTML = '🌞';
                    toggleButton.title = 'Light Mode aktivieren';
                }
            } else {
                document.body.classList.remove('dark-mode');
                
                const toggleButton = document.getElementById('darkModeToggle');
                if (toggleButton) {
                    toggleButton.innerHTML = '🌓';
                    toggleButton.title = 'Dark Mode aktivieren';
                }
            }
        }
    });
}
