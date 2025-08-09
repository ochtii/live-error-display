// Archive Manager Module
export class ArchiveManager {
    constructor(errorDisplay) {
        this.errorDisplay = errorDisplay;
        this.archiveData = this.loadArchive();
    }

    loadArchive() {
        try {
            const archive = localStorage.getItem('errorArchive');
            return archive ? JSON.parse(archive) : [];
        } catch (error) {
            console.error('Failed to load archive:', error);
            return [];
        }
    }

    saveArchive() {
        try {
            localStorage.setItem('errorArchive', JSON.stringify(this.archiveData));
        } catch (error) {
            console.error('Failed to save archive:', error);
        }
    }

    addToArchive(error) {
        const archivedError = {
            ...error,
            archivedAt: new Date().toISOString()
        };
        
        this.archiveData.unshift(archivedError);
        this.saveArchive();
        this.renderArchive();
    }

    renderArchive() {
        const container = document.getElementById('archiveList');
        if (!container) return;

        container.innerHTML = '';
        
        if (this.archiveData.length === 0) {
            container.innerHTML = '<div class="no-data">Keine archivierten Fehler</div>';
            return;
        }

        this.archiveData.forEach(error => {
            const errorElement = this.createArchiveErrorElement(error);
            container.appendChild(errorElement);
        });
    }

    createArchiveErrorElement(error) {
        const errorDiv = document.createElement('div');
        errorDiv.className = `error-item ${error.type}`;
        errorDiv.setAttribute('data-error-id', error.id);

        const archivedDate = new Date(error.archivedAt).toLocaleString();
        const originalDate = new Date(error.timestamp).toLocaleString();

        errorDiv.innerHTML = `
            <div class="error-header">
                <span class="error-type">${error.type.toUpperCase()}</span>
                <span class="timestamp">Archiviert: ${archivedDate}</span>
                <span class="timestamp">Original: ${originalDate}</span>
                <div class="error-actions">
                    <button class="btn btn-sm" onclick="window.errorDisplay.archiveManager.restoreFromArchive('${error.id}')" title="Wiederherstellen">↩️</button>
                    <button class="btn btn-sm" onclick="window.errorDisplay.errorManager.copyError('${error.id}')" title="Kopieren">📋</button>
                    <button class="btn btn-sm btn-danger" onclick="window.errorDisplay.archiveManager.deleteFromArchive('${error.id}')" title="Endgültig löschen">🗑️</button>
                </div>
            </div>
            <div class="error-message">${error.message}</div>
            <div class="error-details">
                <div><strong>Datei:</strong> ${error.file || 'Unbekannt'}</div>
                <div><strong>Zeile:</strong> ${error.line || 'Unbekannt'}</div>
                <div><strong>Spalte:</strong> ${error.column || 'Unbekannt'}</div>
                <div><strong>Session:</strong> ${error.session || 'Unbekannt'}</div>
            </div>
        `;

        return errorDiv;
    }

    restoreFromArchive(errorId) {
        const errorIndex = this.archiveData.findIndex(e => e.id === errorId);
        if (errorIndex !== -1) {
            const error = this.archiveData[errorIndex];
            // Remove archived timestamp and add back to active errors
            delete error.archivedAt;
            
            this.errorDisplay.errorManager.errors.unshift(error);
            this.archiveData.splice(errorIndex, 1);
            
            this.saveArchive();
            this.renderArchive();
            
            // Re-render errors if in live mode
            if (this.errorDisplay.currentMode === 'live') {
                this.errorDisplay.errorManager.renderAllErrors();
            }
            
            this.errorDisplay.uiManager.updateStats();
            this.errorDisplay.showNotification('Fehler wiederhergestellt!', 'success');
        }
    }

    deleteFromArchive(errorId) {
        this.archiveData = this.archiveData.filter(error => error.id !== errorId);
        this.saveArchive();
        this.renderArchive();
        this.errorDisplay.showNotification('Fehler endgültig gelöscht!', 'info');
    }

    clearArchive() {
        if (confirm('Möchten Sie wirklich alle archivierten Fehler löschen?')) {
            this.archiveData = [];
            this.saveArchive();
            this.renderArchive();
            this.errorDisplay.showNotification('Archiv geleert!', 'info');
        }
    }

    exportArchive() {
        const dataStr = JSON.stringify(this.archiveData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `error-archive-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        this.errorDisplay.showNotification('Archiv exportiert!', 'success');
    }

    importArchive(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (Array.isArray(imported)) {
                    this.archiveData = [...this.archiveData, ...imported];
                    this.saveArchive();
                    this.renderArchive();
                    this.errorDisplay.showNotification(`${imported.length} Fehler importiert!`, 'success');
                } else {
                    throw new Error('Invalid format');
                }
            } catch (error) {
                this.errorDisplay.showNotification('Fehler beim Importieren des Archivs', 'error');
            }
        };
        reader.readAsText(file);
    }
}
