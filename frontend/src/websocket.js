class WebSocketManager {
    constructor() {
        this.socket = null;
        this.sessionId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.messageHandlers = new Map();
    }

    connect(sessionId) {
        this.sessionId = sessionId;
        const wsUrl = `ws://localhost:8000/ws/${sessionId}`;
        
        console.log(`Connecting to WebSocket: ${wsUrl}`);
        
        try {
            this.socket = new WebSocket(wsUrl);
            this.setupEventHandlers();
        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.onConnectionStatusChange(false, `Connection failed: ${error.message}`);
            this.handleReconnect();
        }
    }

    setupEventHandlers() {
        this.socket.onopen = (event) => {
            console.log('WebSocket connected:', event);
            this.reconnectAttempts = 0;
            this.onConnectionStatusChange(true);
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        this.socket.onclose = (event) => {
            console.log('WebSocket closed:', event);
            this.onConnectionStatusChange(false);
            if (!event.wasClean) {
                this.handleReconnect();
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.onConnectionStatusChange(false);
        };
    }

    handleMessage(data) {
        const { type } = data;
        const handlers = this.messageHandlers.get(type) || [];
        handlers.forEach(handler => handler(data));
    }

    sendMessage(type, content) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const message = {
                type,
                content,
                timestamp: new Date().toISOString()
            };
            this.socket.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket not connected. Message not sent:', { type, content });
        }
    }

    addMessageHandler(type, handler) {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, []);
        }
        this.messageHandlers.get(type).push(handler);
    }

    removeMessageHandler(type, handler) {
        const handlers = this.messageHandlers.get(type);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
            
            setTimeout(() => {
                if (this.sessionId) {
                    this.connect(this.sessionId);
                }
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
            this.onConnectionStatusChange(false, 'Max reconnection attempts reached');
        }
    }

    onConnectionStatusChange(connected, error = null) {
        // Override this method to handle connection status changes
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = connected ? 'Connected' : (error || 'Disconnected');
            statusElement.className = connected ? 'status-connected' : 'status-disconnected';
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.sessionId = null;
        this.reconnectAttempts = 0;
    }

    isConnected() {
        return this.socket && this.socket.readyState === WebSocket.OPEN;
    }
}

// Audio processing for future audio streaming support
class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.workletNode = null;
    }

    async initialize() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Load audio worklet for real-time processing
            await this.audioContext.audioWorklet.addModule('/audio-worklet.js');
            
            this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
            this.workletNode.connect(this.audioContext.destination);
            
            console.log('Audio processor initialized');
        } catch (error) {
            console.error('Audio processor initialization failed:', error);
        }
    }

    processAudioData(base64Data) {
        if (!this.audioContext || !this.workletNode) {
            console.warn('Audio processor not initialized');
            return;
        }

        try {
            // Decode base64 audio data
            const binaryData = atob(base64Data);
            const arrayBuffer = new ArrayBuffer(binaryData.length);
            const uint8Array = new Uint8Array(arrayBuffer);
            
            for (let i = 0; i < binaryData.length; i++) {
                uint8Array[i] = binaryData.charCodeAt(i);
            }

            // Process audio buffer
            this.audioContext.decodeAudioData(arrayBuffer)
                .then(audioBuffer => {
                    const source = this.audioContext.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(this.audioContext.destination);
                    source.start();
                })
                .catch(error => {
                    console.error('Audio decoding error:', error);
                });
        } catch (error) {
            console.error('Audio processing error:', error);
        }
    }
}

export { WebSocketManager, AudioProcessor };