const WebSocket = require('ws');
const logger = require('../utils/logger');

class WebSocketServer {
    constructor(httpServer) {
        this.httpServer = httpServer;
        this.wss = null;
        this.clients = new Map(); // Store client subscriptions
        this.telemetryProcessor = null;
    }

    async initialize() {
        try {
            this.wss = new WebSocket.Server({ 
                server: this.httpServer,
                path: '/ws/telemetry'
            });

            this.wss.on('connection', (ws, request) => {
                this.handleConnection(ws, request);
            });

            this.wss.on('error', (error) => {
                logger.error('WebSocket server error:', error);
            });

            logger.info('WebSocket server initialized on /ws/telemetry');
        } catch (error) {
            logger.error('Failed to initialize WebSocket server:', error);
            throw error;
        }
    }

    handleConnection(ws, request) {
        const clientId = this.generateClientId();
        const clientInfo = {
            id: clientId,
            ws: ws,
            subscriptions: new Set(),
            lastPing: Date.now(),
            connected: true
        };

        this.clients.set(clientId, clientInfo);
        
        logger.info(`WebSocket client connected: ${clientId}`, {
            ip: request.socket.remoteAddress,
            userAgent: request.headers['user-agent']
        });

        // Send welcome message
        this.sendToClient(ws, {
            type: 'connection',
            message: 'Connected to telemetry stream',
            clientId: clientId,
            timestamp: new Date().toISOString()
        });

        // Handle messages from client
        ws.on('message', (data) => {
            this.handleClientMessage(clientId, data);
        });

        // Handle client disconnect
        ws.on('close', (code, reason) => {
            this.handleDisconnect(clientId, code, reason);
        });

        // Handle errors
        ws.on('error', (error) => {
            logger.error(`WebSocket client error (${clientId}):`, error);
            this.handleDisconnect(clientId);
        });

        // Setup ping/pong for connection health
        ws.on('pong', () => {
            const client = this.clients.get(clientId);
            if (client) {
                client.lastPing = Date.now();
            }
        });

        // Start ping interval for this client
        const pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            } else {
                clearInterval(pingInterval);
            }
        }, 30000); // 30 seconds
    }

    handleClientMessage(clientId, data) {
        try {
            const client = this.clients.get(clientId);
            if (!client) return;

            const message = JSON.parse(data.toString());
            
            switch (message.type) {
                case 'subscribe':
                    this.handleSubscription(clientId, message);
                    break;
                    
                case 'unsubscribe':
                    this.handleUnsubscription(clientId, message);
                    break;
                    
                case 'ping':
                    this.sendToClient(client.ws, {
                        type: 'pong',
                        timestamp: new Date().toISOString()
                    });
                    break;
                    
                default:
                    logger.warn(`Unknown message type from client ${clientId}:`, message.type);
            }
        } catch (error) {
            logger.error(`Error handling message from client ${clientId}:`, error);
        }
    }

    handleSubscription(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const { target } = message;
        
        if (target) {
            client.subscriptions.add(target);
            logger.debug(`Client ${clientId} subscribed to: ${target}`);
            
            this.sendToClient(client.ws, {
                type: 'subscription_confirmed',
                target: target,
                timestamp: new Date().toISOString()
            });
        }
    }

    handleUnsubscription(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const { target } = message;
        
        if (target) {
            client.subscriptions.delete(target);
            logger.debug(`Client ${clientId} unsubscribed from: ${target}`);
            
            this.sendToClient(client.ws, {
                type: 'unsubscription_confirmed',
                target: target,
                timestamp: new Date().toISOString()
            });
        }
    }

    handleDisconnect(clientId, code, reason) {
        const client = this.clients.get(clientId);
        if (client) {
            client.connected = false;
            this.clients.delete(clientId);
            
            logger.info(`WebSocket client disconnected: ${clientId}`, {
                code: code,
                reason: reason ? reason.toString() : 'Unknown'
            });
        }
    }

    // Broadcast telemetry data to subscribed clients
    broadcastTelemetry(telemetryData) {
        if (!telemetryData || this.clients.size === 0) return;

        const message = {
            type: 'telemetry',
            data: telemetryData,
            timestamp: new Date().toISOString()
        };

        // Determine subscription targets
        const droneTarget = `drone:${telemetryData.drone_id}`;
        const fleetTarget = 'fleet:all';

        let sentCount = 0;

        for (const [clientId, client] of this.clients) {
            if (!client.connected || client.ws.readyState !== WebSocket.OPEN) {
                continue;
            }

            // Check if client is subscribed to this data
            if (client.subscriptions.has(droneTarget) || 
                client.subscriptions.has(fleetTarget)) {
                
                this.sendToClient(client.ws, message);
                sentCount++;
            }
        }

        if (sentCount > 0) {
            logger.debug(`Broadcasted telemetry for ${telemetryData.drone_id} to ${sentCount} clients`);
        }
    }

    // Broadcast fleet status updates
    broadcastFleetStatus(fleetData) {
        if (!fleetData || this.clients.size === 0) return;

        const message = {
            type: 'fleet_status',
            data: fleetData,
            timestamp: new Date().toISOString()
        };

        let sentCount = 0;

        for (const [clientId, client] of this.clients) {
            if (!client.connected || client.ws.readyState !== WebSocket.OPEN) {
                continue;
            }

            if (client.subscriptions.has('fleet:all') || 
                client.subscriptions.has('fleet:status')) {
                
                this.sendToClient(client.ws, message);
                sentCount++;
            }
        }

        if (sentCount > 0) {
            logger.debug(`Broadcasted fleet status to ${sentCount} clients`);
        }
    }

    // Broadcast alerts
    broadcastAlert(alertData) {
        if (!alertData || this.clients.size === 0) return;

        const message = {
            type: 'alert',
            data: alertData,
            timestamp: new Date().toISOString()
        };

        let sentCount = 0;

        for (const [clientId, client] of this.clients) {
            if (!client.connected || client.ws.readyState !== WebSocket.OPEN) {
                continue;
            }

            if (client.subscriptions.has('alerts:all') || 
                client.subscriptions.has(`drone:${alertData.drone_id}`)) {
                
                this.sendToClient(client.ws, message);
                sentCount++;
            }
        }

        if (sentCount > 0) {
            logger.debug(`Broadcasted alert to ${sentCount} clients`);
        }
    }

    sendToClient(ws, message) {
        try {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            }
        } catch (error) {
            logger.error('Error sending message to WebSocket client:', error);
        }
    }

    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Health monitoring
    startHealthMonitoring() {
        setInterval(() => {
            this.cleanupDeadConnections();
            this.logConnectionStats();
        }, 60000); // Every minute
    }

    cleanupDeadConnections() {
        const now = Date.now();
        const deadConnections = [];

        for (const [clientId, client] of this.clients) {
            if (!client.connected || 
                client.ws.readyState !== WebSocket.OPEN ||
                (now - client.lastPing) > 90000) { // 90 seconds timeout
                
                deadConnections.push(clientId);
            }
        }

        deadConnections.forEach(clientId => {
            const client = this.clients.get(clientId);
            if (client) {
                try {
                    client.ws.terminate();
                } catch (error) {
                    // Ignore termination errors
                }
                this.clients.delete(clientId);
                logger.debug(`Cleaned up dead connection: ${clientId}`);
            }
        });
    }

    logConnectionStats() {
        const stats = {
            total_connections: this.clients.size,
            active_connections: 0,
            subscriptions_by_target: {}
        };

        for (const client of this.clients.values()) {
            if (client.connected && client.ws.readyState === WebSocket.OPEN) {
                stats.active_connections++;
                
                client.subscriptions.forEach(target => {
                    stats.subscriptions_by_target[target] = 
                        (stats.subscriptions_by_target[target] || 0) + 1;
                });
            }
        }

        logger.debug('WebSocket connection stats:', stats);
    }

    // Set telemetry processor reference for event handling
    setTelemetryProcessor(processor) {
        this.telemetryProcessor = processor;
        
        // Listen for telemetry events
        processor.on('telemetry', (data) => {
            this.broadcastTelemetry(data);
        });
        
        // Listen for alert events (if implemented)
        processor.on('alert', (data) => {
            this.broadcastAlert(data);
        });
    }

    async close() {
        if (this.wss) {
            // Close all client connections
            for (const client of this.clients.values()) {
                if (client.ws.readyState === WebSocket.OPEN) {
                    client.ws.close(1000, 'Server shutting down');
                }
            }
            
            this.clients.clear();
            
            // Close the WebSocket server
            this.wss.close(() => {
                logger.info('WebSocket server closed');
            });
        }
    }

    getStats() {
        return {
            connected_clients: this.clients.size,
            active_clients: Array.from(this.clients.values())
                .filter(c => c.connected && c.ws.readyState === WebSocket.OPEN).length
        };
    }
}

module.exports = WebSocketServer;