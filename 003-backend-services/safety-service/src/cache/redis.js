const redis = require('redis');
const logger = require('../utils/logger');

let client;

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  db: process.env.REDIS_DB || 2,
  password: process.env.REDIS_PASSWORD || undefined,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      logger.error('Redis connection refused');
      return new Error('Redis connection refused');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      logger.error('Redis retry time exhausted');
      return new Error('Redis retry time exhausted');
    }
    if (options.attempt > 10) {
      logger.error('Redis max retry attempts reached');
      return undefined;
    }
    // Reconnect after
    return Math.min(options.attempt * 100, 3000);
  }
};

const connectRedis = async () => {
  try {
    client = redis.createClient(redisConfig);
    
    client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });
    
    client.on('connect', () => {
      logger.info('Redis client connected');
    });
    
    client.on('reconnecting', () => {
      logger.warn('Redis client reconnecting');
    });
    
    client.on('end', () => {
      logger.info('Redis client connection ended');
    });
    
    await client.connect();
    logger.info('Redis connection established successfully');
    
    return client;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
};

const getClient = () => {
  if (!client) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return client;
};

// Safety-specific Redis operations
const SafetyCache = {
  // Battery monitoring cache keys
  BATTERY_HISTORY: 'safety:battery:history',
  BATTERY_TRENDS: 'safety:battery:trends',
  BATTERY_ALERTS: 'safety:battery:alerts',
  
  // Safety alerts cache
  ACTIVE_ALERTS: 'safety:alerts:active',
  ALERT_HISTORY: 'safety:alerts:history',
  
  // Emergency protocols cache
  EMERGENCY_STATES: 'safety:emergency:states',
  EMERGENCY_ACTIONS: 'safety:emergency:actions',
  
  // Monitoring cache
  SAFETY_STATUS: 'safety:status',
  DRONE_SAFETY: 'safety:drones',

  // Store battery data for a drone
  async storeBatteryData(droneId, batteryData) {
    const key = `${this.BATTERY_HISTORY}:${droneId}`;
    const timestamp = Date.now();
    
    try {
      await client.zAdd(key, {
        score: timestamp,
        value: JSON.stringify({
          ...batteryData,
          timestamp
        })
      });
      
      // Keep only last 1 hour of data (3600 seconds)
      const cutoff = timestamp - (3600 * 1000);
      await client.zRemRangeByScore(key, '-inf', cutoff);
      
      return true;
    } catch (error) {
      logger.error(`Failed to store battery data for drone ${droneId}:`, error);
      return false;
    }
  },

  // Get battery history for a drone
  async getBatteryHistory(droneId, minutes = 60) {
    const key = `${this.BATTERY_HISTORY}:${droneId}`;
    const cutoff = Date.now() - (minutes * 60 * 1000);
    
    try {
      const history = await client.zRangeByScore(key, cutoff, '+inf');
      return history.map(item => JSON.parse(item));
    } catch (error) {
      logger.error(`Failed to get battery history for drone ${droneId}:`, error);
      return [];
    }
  },

  // Store active safety alert
  async storeAlert(alert) {
    try {
      await client.hSet(this.ACTIVE_ALERTS, alert.id, JSON.stringify({
        ...alert,
        timestamp: Date.now()
      }));
      
      // Also add to history with expiration (30 days)
      await client.zAdd(this.ALERT_HISTORY, {
        score: Date.now(),
        value: JSON.stringify(alert)
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to store safety alert:', error);
      return false;
    }
  },

  // Get active alerts
  async getActiveAlerts() {
    try {
      const alerts = await client.hGetAll(this.ACTIVE_ALERTS);
      return Object.values(alerts).map(alert => JSON.parse(alert));
    } catch (error) {
      logger.error('Failed to get active alerts:', error);
      return [];
    }
  },

  // Resolve alert
  async resolveAlert(alertId) {
    try {
      await client.hDel(this.ACTIVE_ALERTS, alertId);
      return true;
    } catch (error) {
      logger.error(`Failed to resolve alert ${alertId}:`, error);
      return false;
    }
  },

  // Store drone safety status
  async storeDroneSafetyStatus(droneId, status) {
    try {
      await client.hSet(this.DRONE_SAFETY, droneId, JSON.stringify({
        ...status,
        lastUpdate: Date.now()
      }));
      return true;
    } catch (error) {
      logger.error(`Failed to store safety status for drone ${droneId}:`, error);
      return false;
    }
  },

  // Get drone safety status
  async getDroneSafetyStatus(droneId) {
    try {
      const status = await client.hGet(this.DRONE_SAFETY, droneId);
      return status ? JSON.parse(status) : null;
    } catch (error) {
      logger.error(`Failed to get safety status for drone ${droneId}:`, error);
      return null;
    }
  },

  // Get all drone safety statuses
  async getAllDroneSafetyStatuses() {
    try {
      const statuses = await client.hGetAll(this.DRONE_SAFETY);
      const result = {};
      for (const [droneId, status] of Object.entries(statuses)) {
        result[droneId] = JSON.parse(status);
      }
      return result;
    } catch (error) {
      logger.error('Failed to get all drone safety statuses:', error);
      return {};
    }
  }
};

module.exports = {
  connectRedis,
  getClient,
  SafetyCache
};