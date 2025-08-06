const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { SafetyCache } = require('../cache/redis');
const { query } = require('../database/connection');
const BatteryMonitor = require('./batteryMonitor');
const EmergencyProtocol = require('./emergencyProtocol');

class SafetyMonitor {
  constructor() {
    this.isRunning = false;
    this.monitoringInterval = null;
    
    // Initialize sub-monitors
    this.batteryMonitor = new BatteryMonitor();
    this.emergencyProtocol = new EmergencyProtocol();
    
    // Overall safety status
    this.systemSafetyStatus = {
      overall: 'unknown',
      lastCheck: null,
      criticalAlerts: 0,
      warningAlerts: 0,
      activeDrones: 0,
      dronesAtRisk: 0
    };
    
    this.config = {
      monitoringInterval: parseInt(process.env.SAFETY_CHECK_INTERVAL) || 10000,
      systemHealthCheckInterval: 30000
    };
    
    logger.info('Safety Monitor initialized');
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Safety Monitor is already running');
      return;
    }

    try {
      this.isRunning = true;
      
      // Start sub-monitors
      await this.batteryMonitor.start();
      await this.emergencyProtocol.start();
      
      // Start main monitoring loop
      this.monitoringInterval = setInterval(
        () => this.performSafetyCheck(), 
        this.config.monitoringInterval
      );
      
      // Start system health checks
      this.healthCheckInterval = setInterval(
        () => this.performSystemHealthCheck(),
        this.config.systemHealthCheckInterval
      );
      
      logger.info('Safety Monitor started successfully');
      
      // Perform initial checks
      await this.performSafetyCheck();
      await this.performSystemHealthCheck();
      
    } catch (error) {
      logger.error('Failed to start Safety Monitor:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      logger.warn('Safety Monitor is not running');
      return;
    }

    this.isRunning = false;
    
    // Stop monitoring intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    // Stop sub-monitors
    await this.batteryMonitor.stop();
    await this.emergencyProtocol.stop();
    
    logger.info('Safety Monitor stopped');
  }

  async performSafetyCheck() {
    try {
      const startTime = Date.now();
      
      // Get all active alerts
      const activeAlerts = await SafetyCache.getActiveAlerts();
      
      // Get all drone safety statuses
      const droneStatuses = await SafetyCache.getAllDroneSafetyStatuses();
      
      // Calculate overall system safety status
      const safetyStatus = this.calculateSystemSafetyStatus(activeAlerts, droneStatuses);
      
      // Update system safety status
      this.systemSafetyStatus = {
        ...safetyStatus,
        lastCheck: Date.now(),
        checkDuration: Date.now() - startTime
      };
      
      // Store system status in cache
      await SafetyCache.getClient().set(
        'safety:system:status',
        JSON.stringify(this.systemSafetyStatus),
        { EX: 60 } // Expire in 60 seconds
      );
      
      // Broadcast system status update
      if (global.wsServer) {
        global.wsServer.broadcast('system_safety_status', {
          status: this.systemSafetyStatus,
          timestamp: Date.now()
        });
      }
      
      logger.debug('Safety check completed', {
        duration: Date.now() - startTime,
        overall: safetyStatus.overall,
        criticalAlerts: safetyStatus.criticalAlerts,
        dronesMonitored: Object.keys(droneStatuses).length
      });
      
    } catch (error) {
      logger.error('Error during safety check:', error);
    }
  }

  calculateSystemSafetyStatus(alerts, droneStatuses) {
    let criticalAlerts = 0;
    let warningAlerts = 0;
    let dronesAtRisk = 0;
    
    // Count alerts by severity
    alerts.forEach(alert => {
      if (alert.severity === 'critical') {
        criticalAlerts++;
      } else if (alert.severity === 'warning') {
        warningAlerts++;
      }
    });
    
    // Count drones at risk
    Object.values(droneStatuses).forEach(status => {
      if (status.safetyLevel === 'critical' || status.safetyLevel === 'warning') {
        dronesAtRisk++;
      }
    });
    
    // Determine overall status
    let overall = 'safe';
    if (criticalAlerts > 0 || dronesAtRisk > 0) {
      overall = 'critical';
    } else if (warningAlerts > 2) {
      overall = 'warning';
    } else if (warningAlerts > 0) {
      overall = 'caution';
    }
    
    return {
      overall,
      criticalAlerts,
      warningAlerts,
      activeDrones: Object.keys(droneStatuses).length,
      dronesAtRisk,
      totalAlerts: alerts.length
    };
  }

  async performSystemHealthCheck() {
    try {
      const health = {
        timestamp: Date.now(),
        services: {},
        database: 'unknown',
        cache: 'unknown',
        overall: 'healthy'
      };
      
      // Check database health
      try {
        await query('SELECT 1');
        health.database = 'healthy';
      } catch (error) {
        health.database = 'critical';
        health.overall = 'critical';
        logger.error('Database health check failed:', error);
      }
      
      // Check Redis health
      try {
        await SafetyCache.getClient().ping();
        health.cache = 'healthy';
      } catch (error) {
        health.cache = 'critical';
        health.overall = 'critical';
        logger.error('Redis health check failed:', error);
      }
      
      // Check sub-service health
      health.services.batteryMonitor = this.batteryMonitor.isRunning ? 'healthy' : 'critical';
      health.services.emergencyProtocol = this.emergencyProtocol.isRunning ? 'healthy' : 'critical';
      
      if (!this.batteryMonitor.isRunning || !this.emergencyProtocol.isRunning) {
        health.overall = 'degraded';
      }
      
      // Store health status
      await SafetyCache.getClient().set(
        'safety:system:health',
        JSON.stringify(health),
        { EX: 120 } // Expire in 2 minutes
      );
      
      // Log health issues
      if (health.overall !== 'healthy') {
        logger.warn('System health check detected issues', health);
      }
      
    } catch (error) {
      logger.error('Error during system health check:', error);
    }
  }

  // Alert management methods
  async createCustomAlert(alertData) {
    const alert = {
      id: uuidv4(),
      ...alertData,
      timestamp: new Date().toISOString(),
      resolved: false,
      acknowledged: false,
      source: 'manual'
    };

    try {
      // Store in cache
      await SafetyCache.storeAlert(alert);
      
      // Store in database
      await this.storeAlertInDatabase(alert);
      
      // Broadcast alert
      if (global.wsServer) {
        global.wsServer.broadcastSafetyAlert(alert);
      }
      
      logger.info('Custom safety alert created', { alertId: alert.id, severity: alert.severity });
      
      return alert;
    } catch (error) {
      logger.error('Failed to create custom alert:', error);
      throw error;
    }
  }

  async acknowledgeAlert(alertId, acknowledgedBy) {
    try {
      // Update in database
      await query(
        'UPDATE safety_alerts SET acknowledged = true, acknowledged_by = $1, acknowledged_at = NOW() WHERE id = $2',
        [acknowledgedBy, alertId]
      );
      
      logger.info(`Alert ${alertId} acknowledged by ${acknowledgedBy}`);
      
      // Broadcast acknowledgment
      if (global.wsServer) {
        global.wsServer.broadcast('alert_acknowledged', {
          alertId,
          acknowledgedBy,
          timestamp: Date.now()
        });
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to acknowledge alert ${alertId}:`, error);
      throw error;
    }
  }

  async resolveAlert(alertId, resolvedBy, resolution) {
    try {
      // Remove from active alerts
      await SafetyCache.resolveAlert(alertId);
      
      // Update in database
      await query(
        'UPDATE safety_alerts SET resolved = true, resolved_by = $1, resolved_at = NOW(), resolution = $2 WHERE id = $3',
        [resolvedBy, resolution, alertId]
      );
      
      logger.info(`Alert ${alertId} resolved by ${resolvedBy}`, { resolution });
      
      // Broadcast resolution
      if (global.wsServer) {
        global.wsServer.broadcast('alert_resolved', {
          alertId,
          resolvedBy,
          resolution,
          timestamp: Date.now()
        });
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to resolve alert ${alertId}:`, error);
      throw error;
    }
  }

  async storeAlertInDatabase(alert) {
    try {
      const insertQuery = `
        INSERT INTO safety_alerts (
          id, drone_id, severity, type, message, category, 
          alert_data, resolved, acknowledged, source, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO NOTHING
      `;

      await query(insertQuery, [
        alert.id,
        alert.droneId || null,
        alert.severity,
        alert.type,
        alert.message,
        alert.category || 'general',
        JSON.stringify(alert.data || {}),
        alert.resolved || false,
        alert.acknowledged || false,
        alert.source || 'system',
        alert.timestamp
      ]);

    } catch (error) {
      logger.error('Failed to store alert in database:', error);
    }
  }

  // Public API methods
  async getAllAlerts(includeResolved = false) {
    try {
      let alerts = await SafetyCache.getActiveAlerts();
      
      if (includeResolved) {
        // Get resolved alerts from database
        const resolvedQuery = `
          SELECT * FROM safety_alerts 
          WHERE resolved = true 
          ORDER BY created_at DESC 
          LIMIT 100
        `;
        const result = await query(resolvedQuery);
        const resolvedAlerts = result.rows.map(row => ({
          ...row,
          alert_data: JSON.parse(row.alert_data || '{}')
        }));
        
        alerts = [...alerts, ...resolvedAlerts];
      }
      
      return alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      logger.error('Failed to get all alerts:', error);
      throw error;
    }
  }

  async getAlertsByDrone(droneId) {
    try {
      const activeAlerts = await SafetyCache.getActiveAlerts();
      const droneAlerts = activeAlerts.filter(alert => alert.droneId === droneId);
      
      return droneAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      logger.error(`Failed to get alerts for drone ${droneId}:`, error);
      throw error;
    }
  }

  getSystemSafetyStatus() {
    return this.systemSafetyStatus;
  }

  async getSystemHealth() {
    try {
      const healthStr = await SafetyCache.getClient().get('safety:system:health');
      return healthStr ? JSON.parse(healthStr) : null;
    } catch (error) {
      logger.error('Failed to get system health:', error);
      return null;
    }
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      systemSafetyStatus: this.systemSafetyStatus,
      batteryMonitor: this.batteryMonitor.getMonitoringStats(),
      emergencyProtocol: this.emergencyProtocol.getStats(),
      config: this.config
    };
  }

  // Direct access to sub-monitors
  getBatteryMonitor() {
    return this.batteryMonitor;
  }

  getEmergencyProtocol() {
    return this.emergencyProtocol;
  }
}

module.exports = SafetyMonitor;