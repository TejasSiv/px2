const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/connection');
const { getRedisCache } = require('../cache/redis');
const logger = require('../utils/logger');

// Get telemetry data for a specific drone
router.get('/drones/:droneId/telemetry', async (req, res) => {
    try {
        const { droneId } = req.params;
        const { limit = 10, source = 'database' } = req.query;
        
        let telemetryData;
        
        if (source === 'cache') {
            // Get from Redis cache
            const cache = getRedisCache();
            if (limit === '1' || limit === 1) {
                telemetryData = [await cache.getLatestTelemetry(droneId)];
            } else {
                telemetryData = await cache.getTelemetryStream(droneId, parseInt(limit));
            }
        } else {
            // Get from database
            const db = getDatabase();
            telemetryData = await db.getLatestTelemetry(droneId, parseInt(limit));
        }
        
        res.json({
            success: true,
            data: telemetryData,
            count: telemetryData ? telemetryData.length : 0,
            source,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error(`Error getting telemetry for drone ${req.params.droneId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve telemetry data',
            timestamp: new Date().toISOString()
        });
    }
});

// Get fleet-wide telemetry snapshot
router.get('/fleet/telemetry', async (req, res) => {
    try {
        const { source = 'cache' } = req.query;
        let fleetData;
        
        if (source === 'cache') {
            const cache = getRedisCache();
            fleetData = await cache.getFleetStatus();
            
            if (!fleetData) {
                // Fallback to database
                const db = getDatabase();
                fleetData = await db.getFleetTelemetrySnapshot();
            }
        } else {
            const db = getDatabase();
            fleetData = await db.getFleetTelemetrySnapshot();
        }
        
        res.json({
            success: true,
            data: fleetData,
            count: fleetData ? fleetData.length : 0,
            source,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error getting fleet telemetry:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve fleet telemetry',
            timestamp: new Date().toISOString()
        });
    }
});

// Get active alerts
router.get('/alerts', async (req, res) => {
    try {
        const cache = getRedisCache();
        const alerts = await cache.getActiveAlerts();
        
        res.json({
            success: true,
            data: alerts,
            count: alerts.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error getting active alerts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve alerts',
            timestamp: new Date().toISOString()
        });
    }
});

// Get telemetry statistics
router.get('/stats', async (req, res) => {
    try {
        const cache = getRedisCache();
        const db = getDatabase();
        
        const [counters, dbMetrics, cacheMetrics] = await Promise.all([
            cache.getTelemetryCounters(),
            db.getHealthMetrics(),
            cache.getHealthMetrics()
        ]);
        
        res.json({
            success: true,
            data: {
                telemetry_counters: counters,
                database: dbMetrics,
                cache: cacheMetrics,
                uptime_seconds: process.uptime(),
                memory_usage: process.memoryUsage()
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error getting telemetry statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve statistics',
            timestamp: new Date().toISOString()
        });
    }
});

// System health check
router.get('/health', async (req, res) => {
    try {
        const cache = getRedisCache();
        const db = getDatabase();
        
        const health = {
            status: 'healthy',
            services: {
                database: db.isHealthy(),
                cache: cache.isHealthy(),
                telemetry_processor: true // This would check if processor is running
            },
            timestamp: new Date().toISOString()
        };
        
        const allHealthy = Object.values(health.services).every(status => status === true);
        if (!allHealthy) {
            health.status = 'degraded';
            res.status(503);
        }
        
        res.json(health);
    } catch (error) {
        logger.error('Error checking health:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Clean up old telemetry data
router.post('/maintenance/cleanup', async (req, res) => {
    try {
        const { hours = 48 } = req.body;
        const db = getDatabase();
        
        const deletedCount = await db.cleanupOldTelemetry(hours);
        
        res.json({
            success: true,
            message: `Cleaned up ${deletedCount} old telemetry records`,
            deleted_count: deletedCount,
            hours_old: hours,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error during telemetry cleanup:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup telemetry data',
            timestamp: new Date().toISOString()
        });
    }
});

// Flush cache data
router.post('/maintenance/flush-cache', async (req, res) => {
    try {
        const cache = getRedisCache();
        const success = await cache.flushTelemetryData();
        
        res.json({
            success,
            message: success ? 'Cache flushed successfully' : 'Failed to flush cache',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error flushing cache:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to flush cache',
            timestamp: new Date().toISOString()
        });
    }
});

// Get drone connection status
router.get('/drones/status', async (req, res) => {
    try {
        // This would require access to the telemetry processor instance
        // For now, return mock data
        const droneStatus = [
            { id: 'DRN001', connected: true, lastSeen: new Date(), telemetryCount: 150 },
            { id: 'DRN002', connected: true, lastSeen: new Date(), telemetryCount: 142 },
            { id: 'DRN003', connected: true, lastSeen: new Date(), telemetryCount: 138 },
            { id: 'DRN004', connected: false, lastSeen: new Date(Date.now() - 60000), telemetryCount: 95 },
            { id: 'DRN005', connected: true, lastSeen: new Date(), telemetryCount: 167 }
        ];
        
        res.json({
            success: true,
            data: droneStatus,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error getting drone status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve drone status',
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;