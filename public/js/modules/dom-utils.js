/**
 * DOM utility functions to simplify element access and manipulation
 */

// Cache DOM references to avoid repeated querySelector calls
const domCache = {};

/**
 * Get DOM element by ID with caching
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} - The DOM element or null if not found
 */
export function getElement(id) {
    if (!domCache[id]) {
        domCache[id] = document.getElementById(id);
    }
    return domCache[id];
}

/**
 * Set element visibility
 * @param {string|HTMLElement} element - Element ID or element reference
 * @param {boolean} visible - Whether the element should be visible
 */
export function setVisible(element, visible) {
    const el = typeof element === 'string' ? getElement(element) : element;
    if (el) {
        if (visible) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }
}

/**
 * Set text content of an element
 * @param {string|HTMLElement} element - Element ID or element reference
 * @param {string} text - The text to set
 */
export function setText(element, text) {
    const el = typeof element === 'string' ? getElement(element) : element;
    if (el) {
        el.textContent = text;
    }
}

/**
 * Add event listener with error handling
 * @param {string|HTMLElement} element - Element ID or element reference
 * @param {string} event - Event name (e.g. 'click')
 * @param {Function} callback - Event handler function
 */
export function addSafeEventListener(element, event, callback) {
    const el = typeof element === 'string' ? getElement(element) : element;
    if (el) {
        el.addEventListener(event, async (e) => {
            try {
                await callback(e);
            } catch (error) {
                console.error(`Error in ${event} handler:`, error);
            }
        });
    } else {
        console.warn(`Element not found for event listener: ${element}`);
    }
}

/**
 * Clear all children of an element
 * @param {string|HTMLElement} element - Element ID or element reference
 */
export function clearChildren(element) {
    const el = typeof element === 'string' ? getElement(element) : element;
    if (el) {
        el.innerHTML = '';
    }
}

/**
 * Get the value of an input element
 * @param {string|HTMLElement} element - Element ID or element reference
 * @returns {string} - Trimmed input value
 */
export function getInputValue(element) {
    const el = typeof element === 'string' ? getElement(element) : element;
    return el ? el.value.trim() : '';
}

/**
 * Set the value of an input element
 * @param {string|HTMLElement} element - Element ID or element reference
 * @param {string} value - Value to set
 */
export function setInputValue(element, value) {
    const el = typeof element === 'string' ? getElement(element) : element;
    if (el) {
        el.value = value;
    }
}

/**
 * Create an element with the given properties
 * @param {string} tag - HTML tag name
 * @param {Object} props - Properties to set (className, textContent, etc.)
 * @param {HTMLElement[]} children - Child elements to append
 * @returns {HTMLElement} - The created element
 */
export function createElement(tag, props = {}, children = []) {
    const element = document.createElement(tag);
    
    Object.entries(props).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'textContent') {
            element.textContent = value;
        } else {
            element.setAttribute(key, value);
        }
    });
    
    children.forEach(child => {
        element.appendChild(child);
    });
    
    return element;
}

/**
 * Utility function to create an element with a class
 * @param {string} tag - HTML tag name
 * @param {string} className - CSS class name to add
 * @param {string} [text] - Optional text content
 * @returns {HTMLElement} - The created element
 */
export function createElementWithClass(tag, className, text) {
    const element = document.createElement(tag);
    if (className) {
        element.className = className;
    }
    if (text) {
        element.textContent = text;
    }
    return element;
}

/**
 * Append multiple children to a parent element
 * @param {HTMLElement} parent - The parent element
 * @param {HTMLElement[]} children - Array of child elements to append
 */
export function appendChildren(parent, children) {
    children.forEach(child => {
        parent.appendChild(child);
    });
}
