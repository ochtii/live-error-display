/**
 * Error Manager Module
 * Handles error list management and UI updates
 */

import { getElement, clearChildren, createElement, setVisible } from './dom-utils.js';

// Error list data
let errors = [];

/**
 * Initialize error manager
 */
export function initErrorManager() {
    updateErrorsUI();
}

/**
 * Add a new error to the list
 * @param {Object} error - Error object
 * @param {string} error.level - Error level (ERROR, WARNING, INFO, etc.)
 * @param {string} error.message - Error message
 * @param {number} error.timestamp - Timestamp of the error
 * @param {string} [error.source] - Source of the error
 */
export function addError(error) {
    // Add to beginning of array
    errors.unshift(error);
    
    // Keep the array at a reasonable size
    if (errors.length > 200) {
        errors.length = 200; // Keep only last 200 errors
    }
    
    // Update the UI
    updateErrorsUI();
}

/**
 * Clear all errors
 */
export function clearErrors() {
    errors = [];
    updateErrorsUI();
}

/**
 * Update the errors UI
 */
export function updateErrorsUI() {
    const errorsList = getElement('errorsList');
    const noErrors = getElement('noErrors');
    const errorCount = getElement('errorCount');
    
    if (!errorsList || !noErrors || !errorCount) {
        console.warn('Error UI elements not found');
        return;
    }
    
    // Update error count
    errorCount.textContent = `(${errors.length})`;
    
    // Show/hide no errors message
    setVisible(noErrors, errors.length === 0);
    
    // Clear the list
    clearChildren(errorsList);
    
    // If there are no errors, return
    if (errors.length === 0) {
        return;
    }
    
    // Display the most recent 50 errors
    errors.slice(0, 50).forEach(error => {
        const timestamp = new Date(error.timestamp).toLocaleString();
        const level = error.level || 'ERROR';
        const message = error.message || JSON.stringify(error);
        const source = error.source || '';
        
        // Create error header
        const headerEl = createElement('div', { className: 'error-header' }, [
            createElement('span', { textContent: level }),
            createElement('span', { className: 'error-timestamp', textContent: timestamp })
        ]);
        
        // Create message element
        const messageEl = createElement('div', { textContent: message });
        
        // Create children array
        const children = [headerEl, messageEl];
        
        // Add source if available
        if (source) {
            children.push(
                createElement('div', { 
                    className: 'error-source', 
                    textContent: `Quelle: ${source}` 
                })
            );
        }
        
        // Create error item and append to list
        const errorElement = createElement('div', { className: 'error-item' }, children);
        errorsList.appendChild(errorElement);
    });
}

/**
 * Get all errors
 * @returns {Array} - The errors array
 */
export function getErrors() {
    return [...errors]; // Return a copy
}
