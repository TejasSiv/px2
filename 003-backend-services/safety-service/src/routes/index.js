const express = require('express');
const Joi = require('joi');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const alertSchema = Joi.object({
  droneId: Joi.string().optional(),
  severity: Joi.string().valid('info', 'warning', 'critical').required(),
  type: Joi.string().required(),
  message: Joi.string().min(1).max(500).required(),
  category: Joi.string().optional(),
  data: Joi.object().optional()
});

const resolveAlertSchema = Joi.object({
  resolution: Joi.string().min(1).max(1000).required(),
  resolvedBy: Joi.string().required()
});

const acknowledgeAlertSchema = Joi.object({
  acknowledgedBy: Joi.string().required()
});

// Middleware for service access
const getServices = (req, res, next) => {
  req.safetyMonitor = req.app.locals.safetyMonitor;
  req.batteryMonitor = req.app.locals.batteryMonitor;
  req.emergencyProtocol = req.app.locals.emergencyProtocol;
  next();
};

// Apply middleware
router.use(getServices);

// === GENERAL SAFETY ROUTES ===

// Get overall safety status
router.get('/status', async (req, res) => {
  try {
    const status = req.safetyMonitor.getSystemSafetyStatus();
    const health = await req.safetyMonitor.getSystemHealth();
    
    res.json({
      success: true,
      data: {
        safety: status,
        health,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    logger.error('Failed to get safety status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get safety status',
      message: error.message
    });
  }
});

// Get system statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = req.safetyMonitor.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get safety stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get safety stats',
      message: error.message
    });
  }
});

// === ALERT MANAGEMENT ROUTES ===

// Get all alerts
router.get('/alerts', async (req, res) => {
  try {
    const includeResolved = req.query.resolved === 'true';
    const alerts = await req.safetyMonitor.getAllAlerts(includeResolved);
    
    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        includeResolved
      }
    });
  } catch (error) {
    logger.error('Failed to get alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get alerts',
      message: error.message
    });
  }
});

// Get alerts for specific drone
router.get('/alerts/drone/:droneId', async (req, res) => {
  try {
    const { droneId } = req.params;
    const alerts = await req.safetyMonitor.getAlertsByDrone(droneId);
    
    res.json({
      success: true,
      data: {
        droneId,
        alerts,
        count: alerts.length
      }
    });
  } catch (error) {
    logger.error(`Failed to get alerts for drone ${req.params.droneId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get drone alerts',
      message: error.message
    });
  }
});

// Create custom alert
router.post('/alerts', async (req, res) => {
  try {
    const { error, value } = alertSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details
      });
    }
    
    const alert = await req.safetyMonitor.createCustomAlert(value);
    
    res.status(201).json({
      success: true,
      data: alert,
      message: 'Alert created successfully'
    });
  } catch (error) {
    logger.error('Failed to create alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create alert',
      message: error.message
    });
  }
});

// Acknowledge alert
router.post('/alerts/:alertId/acknowledge', async (req, res) => {
  try {
    const { error, value } = acknowledgeAlertSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details
      });
    }
    
    const { alertId } = req.params;
    const { acknowledgedBy } = value;
    
    await req.safetyMonitor.acknowledgeAlert(alertId, acknowledgedBy);
    
    res.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });
  } catch (error) {
    logger.error(`Failed to acknowledge alert ${req.params.alertId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert',
      message: error.message
    });
  }
});

// Resolve alert
router.post('/alerts/:alertId/resolve', async (req, res) => {
  try {
    const { error, value } = resolveAlertSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details
      });
    }
    
    const { alertId } = req.params;
    const { resolution, resolvedBy } = value;
    
    await req.safetyMonitor.resolveAlert(alertId, resolvedBy, resolution);
    
    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });
  } catch (error) {
    logger.error(`Failed to resolve alert ${req.params.alertId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert',
      message: error.message
    });
  }
});

// === BATTERY MONITORING ROUTES ===

// Get battery status for all drones
router.get('/battery', async (req, res) => {
  try {
    const statuses = await req.batteryMonitor.getAllBatteryStatuses();
    
    res.json({
      success: true,
      data: {
        statuses,
        count: Object.keys(statuses).length,
        thresholds: {
          emergency: req.batteryMonitor.config.emergencyThreshold,
          critical: req.batteryMonitor.config.criticalThreshold,
          warning: req.batteryMonitor.config.warningThreshold,
          low: req.batteryMonitor.config.lowThreshold
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get battery statuses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get battery statuses',
      message: error.message
    });
  }
});

// Get battery status for specific drone
router.get('/battery/:droneId', async (req, res) => {
  try {
    const { droneId } = req.params;
    const status = await req.batteryMonitor.getBatteryStatus(droneId);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error(`Failed to get battery status for drone ${req.params.droneId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get battery status',
      message: error.message
    });
  }
});

// Get battery monitoring statistics
router.get('/battery/stats', async (req, res) => {
  try {
    const stats = req.batteryMonitor.getMonitoringStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get battery monitoring stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get battery monitoring stats',
      message: error.message
    });
  }
});

// === EMERGENCY PROTOCOL ROUTES ===

// Get active emergencies
router.get('/emergency', async (req, res) => {
  try {
    const emergencies = req.emergencyProtocol.getActiveEmergencies();
    
    res.json({
      success: true,
      data: {
        emergencies,
        count: emergencies.length
      }
    });
  } catch (error) {
    logger.error('Failed to get active emergencies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active emergencies',
      message: error.message
    });
  }
});

// Get emergency by drone ID
router.get('/emergency/drone/:droneId', async (req, res) => {
  try {
    const { droneId } = req.params;
    const emergency = req.emergencyProtocol.getEmergencyByDrone(droneId);
    
    if (!emergency) {
      return res.status(404).json({
        success: false,
        error: 'No active emergency found for this drone'
      });
    }
    
    res.json({
      success: true,
      data: emergency
    });
  } catch (error) {
    logger.error(`Failed to get emergency for drone ${req.params.droneId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get emergency',
      message: error.message
    });
  }
});

// Get emergency history
router.get('/emergency/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = await req.emergencyProtocol.getEmergencyHistory(limit);
    
    res.json({
      success: true,
      data: {
        history,
        count: history.length,
        limit
      }
    });
  } catch (error) {
    logger.error('Failed to get emergency history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get emergency history',
      message: error.message
    });
  }
});

// Resolve emergency
router.post('/emergency/:emergencyId/resolve', async (req, res) => {
  try {
    const { emergencyId } = req.params;
    const { type, description, resolvedBy } = req.body;
    
    if (!type || !resolvedBy) {
      return res.status(400).json({
        success: false,
        error: 'Resolution type and resolvedBy are required'
      });
    }
    
    // Find emergency by ID
    const activeEmergencies = req.emergencyProtocol.getActiveEmergencies();
    const emergency = activeEmergencies.find(e => e.id === emergencyId);
    
    if (!emergency) {
      return res.status(404).json({
        success: false,
        error: 'Emergency not found'
      });
    }
    
    const resolution = {
      type,
      description: description || 'Emergency resolved manually',
      resolvedBy
    };
    
    const resolvedEmergency = await req.emergencyProtocol.resolveEmergency(
      emergency.droneId, 
      resolution
    );
    
    res.json({
      success: true,
      data: resolvedEmergency,
      message: 'Emergency resolved successfully'
    });
  } catch (error) {
    logger.error(`Failed to resolve emergency ${req.params.emergencyId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve emergency',
      message: error.message
    });
  }
});

// Get emergency protocol statistics
router.get('/emergency/stats', async (req, res) => {
  try {
    const stats = req.emergencyProtocol.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get emergency protocol stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get emergency protocol stats',
      message: error.message
    });
  }
});

// === WEBSOCKET CLIENT STATS ===

// Get WebSocket connection statistics
router.get('/websocket/stats', async (req, res) => {
  try {
    const stats = global.wsServer ? global.wsServer.getStats() : { error: 'WebSocket server not available' };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get WebSocket stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get WebSocket stats',
      message: error.message
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  logger.error('API route error:', error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

module.exports = router;