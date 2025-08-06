const { createClient } = require('redis');
const logger = require('../utils/logger');

let redisClient = null;

class RedisCache {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
            
            this.client = createClient({
                url: redisUrl,
                socket: {
                    reconnectStrategy: (retries) => {
                        if (retries > 10) {
                            logger.error('Redis connection failed after 10 retries');
                            return false;
                        }
                        return Math.min(retries * 100, 3000);
                    }
                }
            });

            this.client.on('error', (err) => {
                logger.error('Redis client error:', err);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                logger.info('Redis client connected');
                this.isConnected = true;
            });

            this.client.on('ready', () => {
                logger.info('Redis client ready');
                this.isConnected = true;
            });

            this.client.on('end', () => {
                logger.info('Redis client disconnected');
                this.isConnected = false;
            });

            await this.client.connect();
            
            // Test connection
            await this.client.ping();
            logger.info('Redis connection established successfully');
            
            return this.client;
        } catch (error) {
            logger.error('Failed to connect to Redis:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.quit();
            this.isConnected = false;
            logger.info('Redis client disconnected');
        }
    }

    getClient() {
        return this.client;
    }

    isHealthy() {
        return this.isConnected && this.client?.isReady;
    }

    // Telemetry-specific cache methods
    async cacheLatestTelemetry(droneId, telemetryData) {
        try {
            const key = `telemetry:latest:${droneId}`;
            const value = JSON.stringify(telemetryData);
            await this.client.setEx(key, 300, value); // 5 minutes TTL
            return true;
        } catch (error) {
            logger.error(`Error caching latest telemetry for ${droneId}:`, error);
            return false;
        }
    }

    async getLatestTelemetry(droneId) {
        try {
            const key = `telemetry:latest:${droneId}`;
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error(`Error getting latest telemetry for ${droneId}:`, error);
            return null;
        }
    }

    async addToTelemetryStream(droneId, telemetryData) {
        try {
            const streamKey = `telemetry:stream:${droneId}`;
            const result = await this.client.xAdd(streamKey, '*', {
                data: JSON.stringify(telemetryData),
                timestamp: Date.now().toString()
            }, {
                TRIM: {
                    strategy: 'MAXLEN',
                    strategyModifier: '~',
                    threshold: 1000
                }
            });
            return result;
        } catch (error) {
            logger.error(`Error adding to telemetry stream for ${droneId}:`, error);
            return null;
        }
    }

    async getTelemetryStream(droneId, count = 10) {
        try {
            const streamKey = `telemetry:stream:${droneId}`;
            const messages = await this.client.xRevRange(streamKey, '+', '-', {
                COUNT: count
            });
            
            return messages.map(msg => ({
                id: msg.id,
                timestamp: msg.id.split('-')[0],
                data: JSON.parse(msg.message.data)
            }));
        } catch (error) {
            logger.error(`Error getting telemetry stream for ${droneId}:`, error);
            return [];
        }
    }

    // Fleet-wide cache methods
    async cacheFleetStatus(fleetData) {
        try {
            const key = 'fleet:status';
            const value = JSON.stringify(fleetData);
            await this.client.setEx(key, 60, value); // 1 minute TTL
            return true;
        } catch (error) {
            logger.error('Error caching fleet status:', error);
            return false;
        }
    }

    async getFleetStatus() {
        try {
            const key = 'fleet:status';
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error('Error getting fleet status:', error);
            return null;
        }
    }

    // Alert caching
    async cacheActiveAlerts(alerts) {
        try {
            const key = 'alerts:active';
            const value = JSON.stringify(alerts);
            await this.client.setEx(key, 30, value); // 30 seconds TTL
            return true;
        } catch (error) {
            logger.error('Error caching active alerts:', error);
            return false;
        }
    }

    async getActiveAlerts() {
        try {
            const key = 'alerts:active';
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            logger.error('Error getting active alerts:', error);
            return [];
        }
    }

    // Performance metrics
    async incrementTelemetryCounter(droneId) {
        try {
            const key = `metrics:telemetry:${droneId}`;
            const result = await this.client.incr(key);
            await this.client.expire(key, 3600); // 1 hour TTL
            return result;
        } catch (error) {
            logger.error(`Error incrementing telemetry counter for ${droneId}:`, error);
            return 0;
        }
    }

    async getTelemetryCounters() {
        try {
            const pattern = 'metrics:telemetry:*';
            const keys = await this.client.keys(pattern);
            
            const counters = {};
            for (const key of keys) {
                const droneId = key.split(':')[2];
                const count = await this.client.get(key);
                counters[droneId] = parseInt(count) || 0;
            }
            
            return counters;
        } catch (error) {
            logger.error('Error getting telemetry counters:', error);
            return {};
        }
    }

    // Utility methods
    async flushTelemetryData() {
        try {
            const patterns = [
                'telemetry:latest:*',
                'telemetry:stream:*',
                'fleet:status',
                'alerts:active',
                'metrics:telemetry:*'
            ];

            for (const pattern of patterns) {
                const keys = await this.client.keys(pattern);
                if (keys.length > 0) {
                    await this.client.del(keys);
                }
            }

            logger.info('Telemetry cache data flushed');
            return true;
        } catch (error) {
            logger.error('Error flushing telemetry cache data:', error);
            return false;
        }
    }

    async getHealthMetrics() {
        try {
            const info = await this.client.info();
            const lines = info.split('\r\n');
            const metrics = {};

            for (const line of lines) {
                if (line.includes(':')) {
                    const [key, value] = line.split(':');
                    if (key && value) {
                        metrics[key] = isNaN(value) ? value : parseFloat(value);
                    }
                }
            }

            return {
                connected: this.isConnected,
                ready: this.client?.isReady,
                memory_usage: metrics.used_memory_human,
                connected_clients: metrics.connected_clients,
                total_commands_processed: metrics.total_commands_processed,
                keyspace_hits: metrics.keyspace_hits,
                keyspace_misses: metrics.keyspace_misses
            };
        } catch (error) {
            logger.error('Error getting Redis health metrics:', error);
            return {
                connected: false,
                error: error.message
            };
        }
    }
}

// Singleton instance
const redisCache = new RedisCache();

async function initRedis() {
    redisClient = await redisCache.connect();
    return redisClient;
}

function getRedisClient() {
    return redisClient;
}

function getRedisCache() {
    return redisCache;
}

module.exports = {
    initRedis,
    getRedisClient,
    getRedisCache,
    RedisCache
};