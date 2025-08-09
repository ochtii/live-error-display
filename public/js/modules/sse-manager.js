// SSE Connection Manager Module
export class SSEManager {
    constructor(errorDisplay) {
        this.errorDisplay = errorDisplay;
        this.eventSource = null;
    }

    connectSSE() {
        if (this.eventSource) {
            console.log('🔄 Closing existing SSE connection');
            this.eventSource.close();
        }

        const sseUrl = `${this.errorDisplay.serverUrl}/events`;
        console.log(`🔗 Connecting to SSE: ${sseUrl}`);
        
        this.eventSource = new EventSource(sseUrl);
        
        this.eventSource.addEventListener('open', (event) => {
            console.log('✅ SSE Connection opened');
            this.errorDisplay.updateConnectionStatus(true);
        });

        this.eventSource.addEventListener('error', (event) => {
            console.error('❌ SSE Connection error:', event);
            this.errorDisplay.updateConnectionStatus(false);
            
            if (this.eventSource.readyState === EventSource.CLOSED) {
                console.log('🔌 SSE Connection closed by server');
            } else {
                console.log('🔄 SSE Connection failed, will retry automatically');
            }
        });

        this.eventSource.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'client-count') {
                    this.errorDisplay.clients = data.count;
                    this.errorDisplay.updateStats();
                } else if (data.type === 'error') {
                    this.errorDisplay.addError(data.error);
                } else if (data.type === 'ping') {
                    console.log('📡 Received SSE ping');
                }
            } catch (error) {
                console.error('❌ Error parsing SSE message:', error);
            }
        });

        this.eventSource.addEventListener('close', () => {
            console.log('🔌 SSE disconnected - manual reconnection required via Live tab');
            this.errorDisplay.updateConnectionStatus(false);
        });
    }

    disconnectSSE() {
        if (this.eventSource) {
            console.log('🔌 Manually disconnecting SSE');
            this.eventSource.close();
            this.eventSource = null;
            this.errorDisplay.updateConnectionStatus(false);
        }
    }

    isConnected() {
        return this.eventSource && this.eventSource.readyState === EventSource.OPEN;
    }
}
