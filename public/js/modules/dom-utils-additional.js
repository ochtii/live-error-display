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
