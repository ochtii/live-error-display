// Settings Manager Module
export class SettingsManager {
    constructor(errorDisplay) {
        this.errorDisplay = errorDisplay;
        this.settings = this.loadSettings();
    }

    loadSettings() {
        try {
            const settings = localStorage.getItem('errorDisplaySettings');
            return settings ? JSON.parse(settings) : this.getDefaultSettings();
        } catch (error) {
            console.error('Failed to load settings:', error);
            return this.getDefaultSettings();
        }
    }

    getDefaultSettings() {
        return {
            theme: 'dark',
            maxErrors: 100,
            showTimestamps: true,
            autoScroll: true,
            soundEnabled: true,
            notificationsEnabled: false,
            stackTraceCollapsed: true,
            errorGrouping: false,
            debugMode: false
        };
    }

    saveSettings() {
        try {
            localStorage.setItem('errorDisplaySettings', JSON.stringify(this.settings));
            console.log('Settings saved:', this.settings);
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }

    loadAndApplySettings() {
        this.applyTheme();
        this.applySettingsToUI();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.settings.theme);
    }

    applySettingsToUI() {
        // Apply settings to form elements
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) themeSelect.value = this.settings.theme;

        const maxErrorsInput = document.getElementById('maxErrorsInput');
        if (maxErrorsInput) maxErrorsInput.value = this.settings.maxErrors;

        const showTimestampsCheckbox = document.getElementById('showTimestampsCheckbox');
        if (showTimestampsCheckbox) showTimestampsCheckbox.checked = this.settings.showTimestamps;

        const autoScrollCheckbox = document.getElementById('autoScrollCheckbox');
        if (autoScrollCheckbox) autoScrollCheckbox.checked = this.settings.autoScroll;

        const soundEnabledCheckbox = document.getElementById('soundEnabledCheckbox');
        if (soundEnabledCheckbox) soundEnabledCheckbox.checked = this.settings.soundEnabled;

        const notificationsEnabledCheckbox = document.getElementById('notificationsEnabledCheckbox');
        if (notificationsEnabledCheckbox) notificationsEnabledCheckbox.checked = this.settings.notificationsEnabled;

        const stackTraceCollapsedCheckbox = document.getElementById('stackTraceCollapsedCheckbox');
        if (stackTraceCollapsedCheckbox) stackTraceCollapsedCheckbox.checked = this.settings.stackTraceCollapsed;

        const errorGroupingCheckbox = document.getElementById('errorGroupingCheckbox');
        if (errorGroupingCheckbox) errorGroupingCheckbox.checked = this.settings.errorGrouping;

        const debugModeCheckbox = document.getElementById('debugModeCheckbox');
        if (debugModeCheckbox) debugModeCheckbox.checked = this.settings.debugMode;
    }

    updateSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();
        
        // Apply specific setting changes immediately
        if (key === 'theme') {
            this.applyTheme();
        }
    }

    setupSettingsEventListeners() {
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                this.updateSetting('theme', e.target.value);
            });
        }

        const maxErrorsInput = document.getElementById('maxErrorsInput');
        if (maxErrorsInput) {
            maxErrorsInput.addEventListener('change', (e) => {
                this.updateSetting('maxErrors', parseInt(e.target.value) || 100);
            });
        }

        const checkboxSettings = [
            'showTimestamps', 'autoScroll', 'soundEnabled', 'notificationsEnabled',
            'stackTraceCollapsed', 'errorGrouping', 'debugMode'
        ];

        checkboxSettings.forEach(setting => {
            const checkbox = document.getElementById(setting + 'Checkbox');
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this.updateSetting(setting, e.target.checked);
                });
            }
        });
    }

    exportSettings() {
        const dataStr = JSON.stringify(this.settings, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'error-display-settings.json';
        link.click();
        URL.revokeObjectURL(url);
        this.errorDisplay.showNotification('Einstellungen exportiert', 'success');
    }

    importSettings(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                this.settings = { ...this.getDefaultSettings(), ...imported };
                this.saveSettings();
                this.loadAndApplySettings();
                this.errorDisplay.showNotification('Einstellungen importiert', 'success');
            } catch (error) {
                this.errorDisplay.showNotification('Fehler beim Importieren der Einstellungen', 'error');
            }
        };
        reader.readAsText(file);
    }

    resetSettings() {
        this.settings = this.getDefaultSettings();
        this.saveSettings();
        this.loadAndApplySettings();
        this.errorDisplay.showNotification('Einstellungen zurückgesetzt', 'info');
    }
}
