const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class SafetyWebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/safety-ws',
      clientTracking: true
    });
    
    this.clients = new Map();
    this.heartbeatInterval = null;
    
    this.setupEventHandlers();
    this.startHeartbeat();
    
    logger.info('Safety WebSocket Server initialized');
  }

  setupEventHandlers() {
    this.wss.on('connection', (ws, req) => {
      const clientId = uuidv4();
      const clientInfo = {
        id: clientId,
        ws,
        connectedAt: Date.now(),
        lastPong: Date.now(),
        subscriptions: new Set(),
        metadata: {
          ip: req.socket.remoteAddress,
          userAgent: req.headers['user-agent']
        }
      };

      this.clients.set(clientId, clientInfo);
      
      logger.info(`Safety WebSocket client connected: ${clientId}`, {
        clientCount: this.clients.size,
        ip: clientInfo.metadata.ip
      });

      // Send welcome message
      this.sendToClient(clientId, 'connection', {
        clientId,
        timestamp: Date.now(),
        message: 'Connected to Safety Service WebSocket'
      });

      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (error) {
          logger.error(`Invalid message from client ${clientId}:`, error);
          this.sendError(clientId, 'Invalid JSON message');
        }
      });

      // Handle client disconnect
      ws.on('close', (code, reason) => {
        this.clients.delete(clientId);
        logger.info(`Safety WebSocket client disconnected: ${clientId}`, {
          code,
          reason: reason.toString(),
          clientCount: this.clients.size
        });
      });

      // Handle client errors
      ws.on('error', (error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });

      // Handle pong responses for heartbeat
      ws.on('pong', () => {
        if (this.clients.has(clientId)) {
          this.clients.get(clientId).lastPong = Date.now();
        }
      });
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket Server error:', error);
    });
  }

  handleClientMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    logger.debug(`Message from client ${clientId}:`, message);

    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(clientId, message);
        break;
        
      case 'unsubscribe':
        this.handleUnsubscribe(clientId, message);
        break;
        
      case 'ping':
        this.sendToClient(clientId, 'pong', { timestamp: Date.now() });
        break;
        
      case 'get_alerts':
        this.handleGetAlerts(clientId, message);
        break;
        
      case 'acknowledge_alert':
        this.handleAcknowledgeAlert(clientId, message);
        break;
        
      case 'resolve_alert':
        this.handleResolveAlert(clientId, message);
        break;
        
      default:
        this.sendError(clientId, `Unknown message type: ${message.type}`);
    }
  }

  handleSubscribe(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channels } = message;
    if (!Array.isArray(channels)) {
      return this.sendError(clientId, 'Channels must be an array');
    }

    const validChannels = [
      'battery_alerts',
      'safety_alerts', 
      'emergency_alerts',
      'system_alerts',
      'drone_status',
      'all_alerts'
    ];

    const subscribed = [];
    for (const channel of channels) {
      if (validChannels.includes(channel)) {
        client.subscriptions.add(channel);
        subscribed.push(channel);
      }
    }

    this.sendToClient(clientId, 'subscribed', {
      channels: subscribed,
      timestamp: Date.now()
    });

    logger.info(`Client ${clientId} subscribed to channels:`, subscribed);
  }

  handleUnsubscribe(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { channels } = message;
    if (!Array.isArray(channels)) {
      return this.sendError(clientId, 'Channels must be an array');
    }

    const unsubscribed = [];
    for (const channel of channels) {
      if (client.subscriptions.has(channel)) {
        client.subscriptions.delete(channel);
        unsubscribed.push(channel);
      }
    }

    this.sendToClient(clientId, 'unsubscribed', {
      channels: unsubscribed,
      timestamp: Date.now()
    });

    logger.info(`Client ${clientId} unsubscribed from channels:`, unsubscribed);
  }

  async handleGetAlerts(clientId, message) {
    try {
      const { SafetyCache } = require('../cache/redis');
      const alerts = await SafetyCache.getActiveAlerts();
      
      this.sendToClient(clientId, 'alerts_data', {
        alerts,
        timestamp: Date.now(),
        count: alerts.length
      });
    } catch (error) {
      logger.error(`Failed to get alerts for client ${clientId}:`, error);
      this.sendError(clientId, 'Failed to retrieve alerts');
    }
  }

  async handleAcknowledgeAlert(clientId, message) {
    try {
      const { alertId } = message;
      if (!alertId) {
        return this.sendError(clientId, 'Alert ID is required');
      }

      // This would typically update the alert in the database
      // For now, just broadcast the acknowledgment
      this.broadcast('alert_acknowledged', {
        alertId,
        acknowledgedBy: clientId,
        timestamp: Date.now()
      });

      logger.info(`Alert ${alertId} acknowledged by client ${clientId}`);
    } catch (error) {
      logger.error(`Failed to acknowledge alert for client ${clientId}:`, error);
      this.sendError(clientId, 'Failed to acknowledge alert');
    }
  }

  async handleResolveAlert(clientId, message) {
    try {
      const { alertId } = message;
      if (!alertId) {
        return this.sendError(clientId, 'Alert ID is required');
      }

      const { SafetyCache } = require('../cache/redis');
      await SafetyCache.resolveAlert(alertId);

      this.broadcast('alert_resolved', {
        alertId,
        resolvedBy: clientId,
        timestamp: Date.now()
      });

      logger.info(`Alert ${alertId} resolved by client ${clientId}`);
    } catch (error) {
      logger.error(`Failed to resolve alert for client ${clientId}:`, error);
      this.sendError(clientId, 'Failed to resolve alert');
    }
  }

  startHeartbeat() {
    const heartbeatInterval = parseInt(process.env.WS_HEARTBEAT_INTERVAL) || 30000;
    
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = heartbeatInterval * 2;

      this.clients.forEach((client, clientId) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          if (now - client.lastPong > timeout) {
            logger.warn(`Client ${clientId} failed heartbeat check, terminating`);
            client.ws.terminate();
            this.clients.delete(clientId);
          } else {
            client.ws.ping();
          }
        } else {
          this.clients.delete(clientId);
        }
      });
    }, heartbeatInterval);

    logger.info(`WebSocket heartbeat started with ${heartbeatInterval}ms interval`);
  }

  sendToClient(clientId, type, data) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const message = JSON.stringify({
        type,
        data,
        timestamp: Date.now()
      });
      
      client.ws.send(message);
      return true;
    } catch (error) {
      logger.error(`Failed to send message to client ${clientId}:`, error);
      return false;
    }
  }

  sendError(clientId, errorMessage) {
    this.sendToClient(clientId, 'error', {
      message: errorMessage,
      timestamp: Date.now()
    });
  }

  broadcast(type, data, channel = null) {
    let sentCount = 0;
    
    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        // If channel is specified, only send to subscribed clients
        if (channel && !client.subscriptions.has(channel) && !client.subscriptions.has('all_alerts')) {
          return;
        }
        
        if (this.sendToClient(clientId, type, data)) {
          sentCount++;
        }
      }
    });

    logger.debug(`Broadcast message sent to ${sentCount} clients`, { type, channel });
    return sentCount;
  }

  // Safety-specific broadcast methods
  broadcastBatteryAlert(alert) {
    return this.broadcast('battery_alert', alert, 'battery_alerts');
  }

  broadcastSafetyAlert(alert) {
    return this.broadcast('safety_alert', alert, 'safety_alerts');
  }

  broadcastEmergencyAlert(alert) {
    return this.broadcast('emergency_alert', alert, 'emergency_alerts');
  }

  broadcastDroneStatusUpdate(droneId, status) {
    return this.broadcast('drone_status_update', {
      droneId,
      status,
      timestamp: Date.now()
    }, 'drone_status');
  }

  getStats() {
    const clientStats = {
      total: this.clients.size,
      bySubscription: {}
    };

    this.clients.forEach(client => {
      client.subscriptions.forEach(channel => {
        clientStats.bySubscription[channel] = (clientStats.bySubscription[channel] || 0) + 1;
      });
    });

    return clientStats;
  }

  close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.clients.forEach((client) => {
      client.ws.close(1000, 'Server shutting down');
    });

    this.wss.close(() => {
      logger.info('Safety WebSocket Server closed');
    });
  }
}

// Global WebSocket server instance
let wsServer = null;

function initializeWebSocket(server) {
  if (wsServer) {
    logger.warn('WebSocket server already initialized');
    return wsServer;
  }

  wsServer = new SafetyWebSocketServer(server);
  
  // Make it globally accessible
  global.wsServer = wsServer;
  
  return wsServer;
}

module.exports = {
  initializeWebSocket,
  SafetyWebSocketServer
};