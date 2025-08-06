const axios = require('axios');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { SafetyCache } = require('../cache/redis');
const { query } = require('../database/connection');

class BatteryMonitor {
  constructor() {
    this.isRunning = false;
    this.monitoringInterval = null;
    this.trendAnalysisInterval = null;
    
    // Configuration from environment
    this.config = {
      criticalThreshold: parseInt(process.env.BATTERY_CRITICAL_THRESHOLD) || 15,
      warningThreshold: parseInt(process.env.BATTERY_WARNING_THRESHOLD) || 25,
      lowThreshold: parseInt(process.env.BATTERY_LOW_THRESHOLD) || 35,
      emergencyThreshold: parseInt(process.env.EMERGENCY_LANDING_THRESHOLD) || 10,
      checkInterval: parseInt(process.env.SAFETY_CHECK_INTERVAL) || 5000,
      trendInterval: parseInt(process.env.BATTERY_TREND_ANALYSIS_INTERVAL) || 30000,
      notificationCooldown: parseInt(process.env.NOTIFICATION_COOLDOWN) || 60000
    };
    
    // Track recent notifications to prevent spam
    this.recentNotifications = new Map();
    
    // Battery trend analysis
    this.batteryTrends = new Map();
    
    logger.info('Battery Monitor initialized', { config: this.config });
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Battery Monitor is already running');
      return;
    }

    try {
      this.isRunning = true;
      
      // Start continuous battery monitoring
      this.monitoringInterval = setInterval(
        () => this.performBatteryCheck(), 
        this.config.checkInterval
      );
      
      // Start battery trend analysis
      this.trendAnalysisInterval = setInterval(
        () => this.analyzeBatteryTrends(), 
        this.config.trendInterval
      );
      
      logger.info('Battery Monitor started successfully');
      
      // Perform initial check
      await this.performBatteryCheck();
      
    } catch (error) {
      logger.error('Failed to start Battery Monitor:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      logger.warn('Battery Monitor is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.trendAnalysisInterval) {
      clearInterval(this.trendAnalysisInterval);
      this.trendAnalysisInterval = null;
    }
    
    logger.info('Battery Monitor stopped');
  }

  async performBatteryCheck() {
    try {
      // Fetch current drone data from telemetry service
      const dronesData = await this.fetchDroneData();
      
      if (!dronesData || dronesData.length === 0) {
        logger.warn('No drone data received for battery monitoring');
        return;
      }

      // Process each drone's battery data
      for (const drone of dronesData) {
        await this.processDroneBattery(drone);
      }
      
      logger.debug(`Battery check completed for ${dronesData.length} drones`);
      
    } catch (error) {
      logger.error('Error during battery check:', error);
    }
  }

  async fetchDroneData() {
    try {
      const telemetryServiceUrl = process.env.TELEMETRY_SERVICE_URL || 'http://localhost:3001';
      const response = await axios.get(`${telemetryServiceUrl}/api/v1/telemetry/current`, {
        timeout: 5000
      });
      
      return response.data.drones || [];
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        logger.warn('Telemetry service is not available');
      } else {
        logger.error('Failed to fetch drone data:', error.message);
      }
      return [];
    }
  }

  async processDroneBattery(drone) {
    try {
      const batteryData = {
        droneId: drone.id,
        level: drone.batteryLevel || 0,
        voltage: drone.batteryVoltage || 0,
        timestamp: Date.now(),
        status: drone.status,
        position: drone.position,
        inFlight: ['active', 'in_flight'].includes(drone.status)
      };

      // Store battery data in cache for trending
      await SafetyCache.storeBatteryData(drone.id, batteryData);

      // Analyze battery level and generate alerts
      await this.analyzeBatteryLevel(batteryData);

      // Update drone safety status
      const safetyStatus = this.calculateSafetyStatus(batteryData);
      await SafetyCache.storeDroneSafetyStatus(drone.id, safetyStatus);

    } catch (error) {
      logger.error(`Error processing battery data for drone ${drone.id}:`, error);
    }
  }

  async analyzeBatteryLevel(batteryData) {
    const { droneId, level, inFlight } = batteryData;
    
    // Determine alert severity based on battery level and flight status
    let alertSeverity = null;
    let alertMessage = '';
    let actionRequired = false;

    if (level <= this.config.emergencyThreshold) {
      alertSeverity = 'critical';
      alertMessage = `EMERGENCY: Battery critically low at ${level}%. Immediate landing required.`;
      actionRequired = true;
    } else if (level <= this.config.criticalThreshold) {
      alertSeverity = 'critical';
      alertMessage = `CRITICAL: Battery at ${level}%. ${inFlight ? 'Return to base immediately.' : 'Do not launch mission.'}`;
      actionRequired = inFlight;
    } else if (level <= this.config.warningThreshold) {
      alertSeverity = 'warning';
      alertMessage = `WARNING: Battery low at ${level}%. ${inFlight ? 'Consider returning to base.' : 'Charge before next mission.'}`;
    } else if (level <= this.config.lowThreshold) {
      alertSeverity = 'info';
      alertMessage = `INFO: Battery at ${level}%. Monitor closely.`;
    }

    if (alertSeverity) {
      await this.createBatteryAlert(droneId, alertSeverity, alertMessage, batteryData, actionRequired);
    }
  }

  async createBatteryAlert(droneId, severity, message, batteryData, actionRequired = false) {
    // Check notification cooldown to prevent spam
    const cooldownKey = `${droneId}-${severity}`;
    const lastNotification = this.recentNotifications.get(cooldownKey);
    const now = Date.now();

    if (lastNotification && (now - lastNotification) < this.config.notificationCooldown) {
      return; // Skip notification due to cooldown
    }

    const alert = {
      id: uuidv4(),
      droneId,
      severity,
      type: 'battery',
      message,
      category: 'safety',
      timestamp: new Date().toISOString(),
      data: {
        batteryLevel: batteryData.level,
        batteryVoltage: batteryData.voltage,
        droneStatus: batteryData.status,
        position: batteryData.position,
        inFlight: batteryData.inFlight,
        actionRequired,
        thresholds: {
          emergency: this.config.emergencyThreshold,
          critical: this.config.criticalThreshold,
          warning: this.config.warningThreshold,
          low: this.config.lowThreshold
        }
      },
      resolved: false,
      acknowledged: false
    };

    try {
      // Store alert in cache
      await SafetyCache.storeAlert(alert);

      // Store alert in database for persistence
      await this.storeAlertInDatabase(alert);

      // Log the alert
      logger.alert(severity, `Battery Alert: ${message}`, {
        droneId,
        batteryLevel: batteryData.level,
        actionRequired
      });

      // Update notification cooldown
      this.recentNotifications.set(cooldownKey, now);

      // Trigger emergency protocol if needed
      if (actionRequired && batteryData.inFlight) {
        await this.triggerEmergencyProtocol(droneId, alert);
      }

      return alert;
    } catch (error) {
      logger.error('Failed to create battery alert:', error);
    }
  }

  async storeAlertInDatabase(alert) {
    try {
      const insertQuery = `
        INSERT INTO safety_alerts (
          id, drone_id, severity, type, message, category, 
          alert_data, resolved, acknowledged, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING
      `;

      await query(insertQuery, [
        alert.id,
        alert.droneId,
        alert.severity,
        alert.type,
        alert.message,
        alert.category,
        JSON.stringify(alert.data),
        alert.resolved,
        alert.acknowledged,
        alert.timestamp
      ]);

    } catch (error) {
      logger.error('Failed to store alert in database:', error);
    }
  }

  async triggerEmergencyProtocol(droneId, alert) {
    try {
      logger.emergency(`Triggering emergency protocol for drone ${droneId}`, {
        alertId: alert.id,
        batteryLevel: alert.data.batteryLevel
      });

      // This will be handled by EmergencyProtocol service
      // For now, just broadcast the emergency
      if (global.wsServer) {
        global.wsServer.broadcast('emergency_alert', {
          type: 'battery_emergency',
          droneId,
          alert,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      logger.error(`Failed to trigger emergency protocol for drone ${droneId}:`, error);
    }
  }

  calculateSafetyStatus(batteryData) {
    const { level, inFlight } = batteryData;
    
    let safetyLevel = 'safe';
    let recommendations = [];

    if (level <= this.config.emergencyThreshold) {
      safetyLevel = 'critical';
      recommendations.push('IMMEDIATE LANDING REQUIRED');
    } else if (level <= this.config.criticalThreshold) {
      safetyLevel = 'critical';
      recommendations.push(inFlight ? 'Return to base immediately' : 'Do not launch');
    } else if (level <= this.config.warningThreshold) {
      safetyLevel = 'warning';
      recommendations.push('Monitor battery closely');
    } else if (level <= this.config.lowThreshold) {
      safetyLevel = 'caution';
      recommendations.push('Consider charging soon');
    }

    return {
      batteryLevel: level,
      safetyLevel,
      recommendations,
      lastCheck: Date.now(),
      inFlight
    };
  }

  async analyzeBatteryTrends() {
    try {
      // Get all drone safety statuses
      const droneStatuses = await SafetyCache.getAllDroneSafetyStatuses();
      
      for (const [droneId, status] of Object.entries(droneStatuses)) {
        // Get battery history for trend analysis
        const history = await SafetyCache.getBatteryHistory(droneId, 30); // Last 30 minutes
        
        if (history.length < 5) continue; // Need at least 5 data points
        
        const trend = this.calculateBatteryTrend(history);
        
        if (trend.declining && trend.rate > 2) { // Declining faster than 2% per minute
          await this.createTrendAlert(droneId, trend);
        }
        
        // Store trend data
        this.batteryTrends.set(droneId, trend);
      }
      
    } catch (error) {
      logger.error('Error during battery trend analysis:', error);
    }
  }

  calculateBatteryTrend(history) {
    if (history.length < 2) {
      return { declining: false, rate: 0, prediction: null };
    }

    // Sort by timestamp
    history.sort((a, b) => a.timestamp - b.timestamp);
    
    const recent = history.slice(-10); // Last 10 readings
    let totalChange = 0;
    let timeSpan = 0;

    for (let i = 1; i < recent.length; i++) {
      const change = recent[i].level - recent[i - 1].level;
      const timeDiff = (recent[i].timestamp - recent[i - 1].timestamp) / (1000 * 60); // minutes
      totalChange += change;
      timeSpan += timeDiff;
    }

    const rate = timeSpan > 0 ? Math.abs(totalChange / timeSpan) : 0;
    const declining = totalChange < 0;
    
    // Predict when battery will hit critical level
    let prediction = null;
    if (declining && rate > 0) {
      const currentLevel = recent[recent.length - 1].level;
      const minutesToCritical = (currentLevel - this.config.criticalThreshold) / rate;
      if (minutesToCritical > 0) {
        prediction = {
          level: this.config.criticalThreshold,
          estimatedMinutes: Math.round(minutesToCritical)
        };
      }
    }

    return {
      declining,
      rate: Math.round(rate * 100) / 100,
      prediction,
      dataPoints: recent.length
    };
  }

  async createTrendAlert(droneId, trend) {
    const message = `Battery declining rapidly at ${trend.rate}%/min. ${
      trend.prediction ? `Estimated ${trend.prediction.estimatedMinutes} minutes to critical level.` : ''
    }`;

    await this.createBatteryAlert(droneId, 'warning', message, {
      droneId,
      level: 0, // Will be filled by current data
      voltage: 0,
      timestamp: Date.now(),
      status: 'unknown',
      position: null,
      inFlight: false
    }, false);
  }

  // Public methods for API endpoints
  async getBatteryStatus(droneId) {
    try {
      const status = await SafetyCache.getDroneSafetyStatus(droneId);
      const history = await SafetyCache.getBatteryHistory(droneId, 60);
      const trend = this.batteryTrends.get(droneId) || null;

      return {
        droneId,
        currentStatus: status,
        history: history.slice(-20), // Last 20 readings
        trend,
        thresholds: {
          emergency: this.config.emergencyThreshold,
          critical: this.config.criticalThreshold,
          warning: this.config.warningThreshold,
          low: this.config.lowThreshold
        }
      };
    } catch (error) {
      logger.error(`Failed to get battery status for drone ${droneId}:`, error);
      throw error;
    }
  }

  async getAllBatteryStatuses() {
    try {
      const statuses = await SafetyCache.getAllDroneSafetyStatuses();
      const result = {};

      for (const droneId of Object.keys(statuses)) {
        result[droneId] = await this.getBatteryStatus(droneId);
      }

      return result;
    } catch (error) {
      logger.error('Failed to get all battery statuses:', error);
      throw error;
    }
  }

  getMonitoringStats() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      recentNotifications: this.recentNotifications.size,
      trackedTrends: this.batteryTrends.size
    };
  }
}

module.exports = BatteryMonitor;