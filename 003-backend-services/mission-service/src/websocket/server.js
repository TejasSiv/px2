const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class WebSocketServer {
    constructor(httpServer, missionManager) {
        this.httpServer = httpServer;
        this.missionManager = missionManager;
        this.wss = null;
        this.clients = new Map();
        this.messageHandlers = new Map();
        this.heartbeatInterval = null;
    }

    async initialize() {
        try {
            // Create WebSocket server
            this.wss = new WebSocket.Server({
                server: this.httpServer,
                path: '/ws',
                perMessageDeflate: false
            });

            // Setup connection handling
            this.wss.on('connection', (ws, req) => {
                this.handleConnection(ws, req);
            });

            // Setup message handlers
            this.setupMessageHandlers();

            // Start heartbeat
            this.startHeartbeat();

            // Connect to mission manager
            if (this.missionManager) {
                this.missionManager.setWebSocketServer(this);
            }

            logger.info('WebSocket server initialized');
        } catch (error) {
            logger.error('Failed to initialize WebSocket server:', error);
            throw error;
        }
    }

    handleConnection(ws, req) {
        const clientId = uuidv4();
        const clientInfo = {
            id: clientId,
            ws,
            ip: req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            connectedAt: new Date().toISOString(),
            lastPing: Date.now(),
            subscriptions: new Set()
        };

        this.clients.set(clientId, clientInfo);

        logger.info(`WebSocket client connected: ${clientId}`, {
            ip: clientInfo.ip,
            userAgent: clientInfo.userAgent,
            totalClients: this.clients.size
        });

        // Setup client message handling
        ws.on('message', (message) => {
            this.handleMessage(clientId, message);
        });

        ws.on('pong', () => {
            if (this.clients.has(clientId)) {
                this.clients.get(clientId).lastPing = Date.now();
            }
        });

        ws.on('close', (code, reason) => {
            this.handleDisconnection(clientId, code, reason);
        });

        ws.on('error', (error) => {
            logger.error(`WebSocket client error ${clientId}:`, error);
            this.handleDisconnection(clientId, 1011, 'Server error');
        });

        // Send initial connection confirmation
        this.sendToClient(clientId, {
            type: 'connection_established',
            data: {
                clientId,
                timestamp: new Date().toISOString(),
                server: 'mission-service-ws'
            }
        });

        // Send current mission stats
        if (this.missionManager) {
            this.sendToClient(clientId, {
                type: 'mission_stats',
                data: {
                    activeMissions: this.missionManager.getActiveMissionCount(),
                    activeMissionIds: this.missionManager.getActiveMissionIds(),
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    handleDisconnection(clientId, code, reason) {
        if (this.clients.has(clientId)) {
            const clientInfo = this.clients.get(clientId);
            logger.info(`WebSocket client disconnected: ${clientId}`, {
                code,
                reason: reason?.toString(),
                duration: Date.now() - new Date(clientInfo.connectedAt).getTime(),
                totalClients: this.clients.size - 1
            });
            
            this.clients.delete(clientId);
        }
    }

    handleMessage(clientId, message) {
        try {
            const parsedMessage = JSON.parse(message);
            const { type, data, requestId } = parsedMessage;

            logger.debug(`WebSocket message from ${clientId}:`, { type, requestId });

            if (this.messageHandlers.has(type)) {
                const handler = this.messageHandlers.get(type);
                handler(clientId, data, requestId);
            } else {
                this.sendToClient(clientId, {
                    type: 'error',
                    data: {
                        message: `Unknown message type: ${type}`,
                        originalType: type
                    },
                    requestId
                });
            }
        } catch (error) {
            logger.error(`Error parsing WebSocket message from ${clientId}:`, error);
            this.sendToClient(clientId, {
                type: 'error',
                data: {
                    message: 'Invalid JSON message format'
                }
            });
        }
    }

    setupMessageHandlers() {
        // Subscribe to mission updates
        this.messageHandlers.set('subscribe_missions', (clientId, data, requestId) => {
            const client = this.clients.get(clientId);
            if (client) {
                client.subscriptions.add('missions');
                this.sendToClient(clientId, {
                    type: 'subscription_confirmed',
                    data: { subscription: 'missions' },
                    requestId
                });
            }
        });

        // Unsubscribe from mission updates
        this.messageHandlers.set('unsubscribe_missions', (clientId, data, requestId) => {
            const client = this.clients.get(clientId);
            if (client) {
                client.subscriptions.delete('missions');
                this.sendToClient(clientId, {
                    type: 'unsubscription_confirmed',
                    data: { subscription: 'missions' },
                    requestId
                });
            }
        });

        // Get mission status
        this.messageHandlers.set('get_mission_status', async (clientId, data, requestId) => {
            try {
                const { missionId } = data;
                if (!missionId) {
                    return this.sendToClient(clientId, {
                        type: 'error',
                        data: { message: 'Mission ID is required' },
                        requestId
                    });
                }

                const status = await this.missionManager.getMissionStatus(missionId);
                this.sendToClient(clientId, {
                    type: 'mission_status',
                    data: status,
                    requestId
                });
            } catch (error) {
                this.sendToClient(clientId, {
                    type: 'error',
                    data: { message: error.message },
                    requestId
                });
            }
        });

        // Get active missions
        this.messageHandlers.set('get_active_missions', (clientId, data, requestId) => {
            try {
                const activeMissions = this.missionManager.getActiveMissionsData();
                this.sendToClient(clientId, {
                    type: 'active_missions',
                    data: activeMissions,
                    requestId
                });
            } catch (error) {
                this.sendToClient(clientId, {
                    type: 'error',
                    data: { message: error.message },
                    requestId
                });
            }
        });

        // Ping handler
        this.messageHandlers.set('ping', (clientId, data, requestId) => {
            this.sendToClient(clientId, {
                type: 'pong',
                data: { timestamp: new Date().toISOString() },
                requestId
            });
        });

        // Client info request
        this.messageHandlers.set('get_client_info', (clientId, data, requestId) => {
            const client = this.clients.get(clientId);
            if (client) {
                this.sendToClient(clientId, {
                    type: 'client_info',
                    data: {
                        id: client.id,
                        connectedAt: client.connectedAt,
                        subscriptions: Array.from(client.subscriptions),
                        totalClients: this.clients.size
                    },
                    requestId
                });
            }
        });
    }

    sendToClient(clientId, message) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            try {
                client.ws.send(JSON.stringify(message));
                return true;
            } catch (error) {
                logger.error(`Error sending message to client ${clientId}:`, error);
                this.handleDisconnection(clientId, 1011, 'Send error');
                return false;
            }
        }
        return false;
    }

    broadcast(type, data, subscription = 'missions') {
        const message = {
            type,
            data,
            timestamp: new Date().toISOString()
        };

        let sentCount = 0;
        for (const [clientId, client] of this.clients) {
            if (client.subscriptions.has(subscription) || subscription === null) {
                if (this.sendToClient(clientId, message)) {
                    sentCount++;
                }
            }
        }

        logger.debug(`Broadcast message ${type} sent to ${sentCount} clients`);
        return sentCount;
    }

    broadcastToAll(type, data) {
        return this.broadcast(type, data, null);
    }

    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            const now = Date.now();
            const timeout = 30000; // 30 seconds

            for (const [clientId, client] of this.clients) {
                if (now - client.lastPing > timeout) {
                    logger.warn(`Client ${clientId} heartbeat timeout, closing connection`);
                    client.ws.terminate();
                    this.clients.delete(clientId);
                } else if (client.ws.readyState === WebSocket.OPEN) {
                    client.ws.ping();
                }
            }
        }, 15000); // Check every 15 seconds
    }

    getConnectedClientsCount() {
        return this.clients.size;
    }

    getClientInfo() {
        const info = [];
        for (const [clientId, client] of this.clients) {
            info.push({
                id: clientId,
                ip: client.ip,
                connectedAt: client.connectedAt,
                subscriptions: Array.from(client.subscriptions),
                lastPing: client.lastPing
            });
        }
        return info;
    }

    async close() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        // Close all client connections
        for (const [clientId, client] of this.clients) {
            client.ws.terminate();
        }
        this.clients.clear();

        // Close WebSocket server
        if (this.wss) {
            return new Promise((resolve) => {
                this.wss.close(() => {
                    logger.info('WebSocket server closed');
                    resolve();
                });
            });
        }
    }
}

module.exports = WebSocketServer;