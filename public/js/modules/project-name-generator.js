/**
 * Project Name Generator Module
 * Handles random project name generation with magical animations
 */

let projectNames = [];

/**
 * Initialize the project name generator
 */
export async function initProjectNameGenerator() {
    try {
        // Load project names from JSON file
        const response = await fetch('/sample_names.json');
        const data = await response.json();
        projectNames = data.projectNames;
        
        // Set initial random placeholder
        setRandomPlaceholder();
        
        // Set up dice button event listener
        const diceButton = document.getElementById('diceButton');
        if (diceButton) {
            diceButton.addEventListener('click', rollForNewName);
        }
        
        console.log('🎲 Project name generator initialized with', projectNames.length, 'names');
    } catch (error) {
        console.error('Failed to load project names:', error);
        // Fallback names if JSON loading fails
        projectNames = ['CodeNinja', 'PixelForge', 'DataStream', 'CloudBurst', 'ByteWave'];
        setRandomPlaceholder();
    }
}

/**
 * Set a random placeholder in the name input field
 */
function setRandomPlaceholder() {
    const nameInput = document.getElementById('newSessionName');
    if (nameInput && projectNames.length > 0) {
        const randomName = getRandomProjectName();
        nameInput.placeholder = randomName;
    }
}

/**
 * Get a random project name from the list
 * @returns {string} Random project name
 */
function getRandomProjectName() {
    if (projectNames.length === 0) return 'MeinProjekt';
    return projectNames[Math.floor(Math.random() * projectNames.length)];
}

/**
 * Roll for a new name with magical animation
 */
function rollForNewName() {
    const nameInput = document.getElementById('newSessionName');
    const diceButton = document.getElementById('diceButton');
    
    if (!nameInput || !diceButton) return;
    
    // Start dice rolling animation
    diceButton.classList.add('dice-rolling');
    diceButton.disabled = true;
    
    // Create sparkle effects
    createSparkleEffect(nameInput);
    
    // Cycle through random names quickly to create anticipation
    let cycleCount = 0;
    const maxCycles = 15;
    const cycleInterval = setInterval(() => {
        const tempName = getRandomProjectName();
        nameInput.value = tempName;
        nameInput.classList.add('name-cycling');
        
        setTimeout(() => {
            nameInput.classList.remove('name-cycling');
        }, 100);
        
        cycleCount++;
        
        if (cycleCount >= maxCycles) {
            clearInterval(cycleInterval);
            finalizeName();
        }
    }, 80);
    
    function finalizeName() {
        // Final magical animation
        nameInput.classList.add('magical-input');
        
        // Set final random name
        const finalName = getRandomProjectName();
        nameInput.value = finalName;
        
        // Clean up animations
        setTimeout(() => {
            nameInput.classList.remove('magical-input');
            diceButton.classList.remove('dice-rolling');
            diceButton.disabled = false;
        }, 2000);
        
        // Focus the input for user to see the result
        nameInput.focus();
        nameInput.select();
    }
}

/**
 * Create sparkle effect around the input field
 * @param {HTMLElement} element - The element to sparkle around
 */
function createSparkleEffect(element) {
    const container = element.parentElement;
    const rect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Create multiple sparkles
    for (let i = 0; i < 8; i++) {
        setTimeout(() => {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            
            // Random position around the input field
            const x = Math.random() * (rect.width + 40) - 20;
            const y = Math.random() * (rect.height + 40) - 20;
            
            sparkle.style.left = x + 'px';
            sparkle.style.top = y + 'px';
            
            container.style.position = 'relative';
            container.appendChild(sparkle);
            
            // Remove sparkle after animation
            setTimeout(() => {
                if (sparkle.parentNode) {
                    sparkle.parentNode.removeChild(sparkle);
                }
            }, 1000);
        }, i * 100);
    }
}

/**
 * Get all available project names
 * @returns {string[]} Array of project names
 */
export function getProjectNames() {
    return [...projectNames];
}

/**
 * Add custom project names
 * @param {string[]} names - Array of names to add
 */
export function addProjectNames(names) {
    projectNames.push(...names);
}
