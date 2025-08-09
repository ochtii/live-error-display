// Notification Manager Module
export class NotificationManager {
    constructor() {
        this.notificationCount = 0;
    }

    showNotification(message, type = 'info', duration = 3000) {
        const container = this.getOrCreateNotificationContainer();
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.zIndex = 10000 + this.notificationCount++;
        
        const icon = this.getNotificationIcon(type);
        notification.innerHTML = `
            <span class="notification-icon">${icon}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        container.appendChild(notification);
        
        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, duration);
        }
        
        // Add click to remove
        notification.addEventListener('click', () => {
            notification.remove();
        });
    }

    getOrCreateNotificationContainer() {
        let container = document.getElementById('notificationContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notificationContainer';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        return container;
    }

    getNotificationIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }

    clearAllNotifications() {
        const container = document.getElementById('notificationContainer');
        if (container) {
            container.innerHTML = '';
        }
    }
}
