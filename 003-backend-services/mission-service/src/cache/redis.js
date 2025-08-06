const redis = require('redis');
const logger = require('../utils/logger');

let client;

const initRedis = async () => {
    try {
        const config = {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || undefined,
            db: process.env.REDIS_DB || 0,
            // Connection settings
            retry_strategy: (options) => {
                if (options.error && options.error.code === 'ECONNREFUSED') {
                    logger.error('Redis server connection refused');
                    return new Error('Redis server connection refused');
                }
                if (options.total_retry_time > 1000 * 60 * 60) {
                    logger.error('Redis retry time exhausted');
                    return new Error('Redis retry time exhausted');
                }
                if (options.attempt > 10) {
                    logger.error('Redis max retry attempts reached');
                    return undefined;
                }
                // Exponential backoff: 2^attempt * 100ms
                return Math.min(options.attempt * 100, 3000);
            }
        };

        client = redis.createClient({
            socket: {
                host: config.host,
                port: config.port,
                reconnectStrategy: config.retry_strategy
            },
            password: config.password,
            database: config.db
        });

        // Handle Redis events
        client.on('error', (err) => {
            logger.error('Redis client error:', err);
        });

        client.on('connect', () => {
            logger.info('Redis client connected');
        });

        client.on('ready', () => {
            logger.info('Redis client ready');
        });

        client.on('end', () => {
            logger.info('Redis client connection ended');
        });

        client.on('reconnecting', () => {
            logger.info('Redis client reconnecting...');
        });

        // Connect to Redis
        await client.connect();

        // Test the connection
        await client.ping();
        logger.info('Redis connection established successfully', {
            host: config.host,
            port: config.port,
            database: config.db
        });

        return client;
    } catch (error) {
        logger.error('Failed to initialize Redis connection:', error);
        throw error;
    }
};

const getClient = () => {
    if (!client) {
        throw new Error('Redis not initialized. Call initRedis() first.');
    }
    return client;
};

// Mission-specific cache operations
const missionCache = {
    // Get mission from cache
    getMission: async (missionId) => {
        try {
            const cached = await client.get(`mission:${missionId}`);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            logger.error('Error getting mission from cache:', error);
            return null;
        }
    },

    // Set mission in cache with TTL (default 5 minutes)
    setMission: async (missionId, missionData, ttl = 300) => {
        try {
            await client.setEx(
                `mission:${missionId}`, 
                ttl, 
                JSON.stringify(missionData)
            );
            return true;
        } catch (error) {
            logger.error('Error setting mission in cache:', error);
            return false;
        }
    },

    // Delete mission from cache
    deleteMission: async (missionId) => {
        try {
            await client.del(`mission:${missionId}`);
            return true;
        } catch (error) {
            logger.error('Error deleting mission from cache:', error);
            return false;
        }
    },

    // Get active missions list
    getActiveMissions: async () => {
        try {
            const cached = await client.get('missions:active');
            return cached ? JSON.parse(cached) : [];
        } catch (error) {
            logger.error('Error getting active missions from cache:', error);
            return [];
        }
    },

    // Set active missions list
    setActiveMissions: async (missions, ttl = 60) => {
        try {
            await client.setEx(
                'missions:active', 
                ttl, 
                JSON.stringify(missions)
            );
            return true;
        } catch (error) {
            logger.error('Error setting active missions in cache:', error);
            return false;
        }
    },

    // Add mission to drone assignment cache
    assignMissionToDrone: async (droneId, missionId, ttl = 3600) => {
        try {
            await client.setEx(`drone:${droneId}:mission`, ttl, missionId);
            await client.setEx(`mission:${missionId}:drone`, ttl, droneId);
            return true;
        } catch (error) {
            logger.error('Error assigning mission to drone in cache:', error);
            return false;
        }
    },

    // Remove mission assignment
    unassignMission: async (droneId, missionId) => {
        try {
            await client.del(`drone:${droneId}:mission`);
            await client.del(`mission:${missionId}:drone`);
            return true;
        } catch (error) {
            logger.error('Error unassigning mission in cache:', error);
            return false;
        }
    },

    // Get mission statistics
    getMissionStats: async () => {
        try {
            const cached = await client.get('missions:stats');
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            logger.error('Error getting mission stats from cache:', error);
            return null;
        }
    },

    // Set mission statistics
    setMissionStats: async (stats, ttl = 30) => {
        try {
            await client.setEx('missions:stats', ttl, JSON.stringify(stats));
            return true;
        } catch (error) {
            logger.error('Error setting mission stats in cache:', error);
            return false;
        }
    },

    // Invalidate all mission caches
    invalidateAll: async () => {
        try {
            const pattern = 'mission:*';
            const keys = await client.keys(pattern);
            if (keys.length > 0) {
                await client.del(keys);
            }
            await client.del(['missions:active', 'missions:stats']);
            return true;
        } catch (error) {
            logger.error('Error invalidating mission caches:', error);
            return false;
        }
    }
};

const closeRedis = async () => {
    if (client) {
        await client.quit();
        logger.info('Redis connection closed');
    }
};

module.exports = {
    initRedis,
    getClient,
    missionCache,
    closeRedis
};