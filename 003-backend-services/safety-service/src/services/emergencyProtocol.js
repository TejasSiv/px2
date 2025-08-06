const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { SafetyCache } = require('../cache/redis');
const { query } = require('../database/connection');

class EmergencyProtocol {
  constructor() {
    this.activeEmergencies = new Map();
    this.emergencyTimeouts = new Map();
    this.isRunning = false;
    
    // Configuration from environment
    this.config = {
      emergencyLandingEnabled: process.env.ENABLE_EMERGENCY_LANDING === 'true',
      emergencyTimeout: parseInt(process.env.EMERGENCY_LANDING_TIMEOUT) || 180000, // 3 minutes
      batteryEmergencyThreshold: parseInt(process.env.EMERGENCY_LANDING_THRESHOLD) || 10,
      coordinationServiceUrl: process.env.COORDINATION_SERVICE_URL || 'http://localhost:3003',
      missionServiceUrl: process.env.MISSION_SERVICE_URL || 'http://localhost:3002'
    };
    
    logger.info('Emergency Protocol initialized', { config: this.config });
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Emergency Protocol is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Emergency Protocol started');
  }

  async stop() {
    if (!this.isRunning) {
      logger.warn('Emergency Protocol is not running');
      return;
    }

    this.isRunning = false;
    
    // Clear all emergency timeouts
    this.emergencyTimeouts.forEach((timeout) => {
      clearTimeout(timeout);
    });
    this.emergencyTimeouts.clear();
    
    logger.info('Emergency Protocol stopped');
  }

  async triggerBatteryEmergency(droneId, alert) {
    if (!this.config.emergencyLandingEnabled) {
      logger.warn(`Battery emergency for drone ${droneId} detected but emergency landing is disabled`);
      return;
    }

    // Check if emergency is already active for this drone
    if (this.activeEmergencies.has(droneId)) {
      logger.warn(`Emergency already active for drone ${droneId}`);
      return;
    }

    const emergency = {
      id: uuidv4(),
      droneId,
      type: 'battery_critical',
      severity: 'critical',
      status: 'active',
      initiatedAt: Date.now(),
      alert,
      actions: [],
      resolution: null
    };

    try {
      // Register emergency
      this.activeEmergencies.set(droneId, emergency);
      await SafetyCache.storeAlert({
        ...alert,
        id: emergency.id,
        type: 'emergency',
        category: 'emergency_protocol'
      });

      logger.emergency(`Battery emergency initiated for drone ${droneId}`, {
        emergencyId: emergency.id,
        batteryLevel: alert.data.batteryLevel
      });

      // Execute emergency response sequence
      await this.executeBatteryEmergencyResponse(emergency);

      // Set emergency timeout
      const timeout = setTimeout(async () => {
        await this.handleEmergencyTimeout(droneId);
      }, this.config.emergencyTimeout);
      
      this.emergencyTimeouts.set(droneId, timeout);

      // Broadcast emergency alert
      if (global.wsServer) {
        global.wsServer.broadcastEmergencyAlert({
          type: 'battery_emergency',
          emergency,
          timestamp: Date.now()
        });
      }

      return emergency;

    } catch (error) {
      logger.error(`Failed to trigger battery emergency for drone ${droneId}:`, error);
      this.activeEmergencies.delete(droneId);
      throw error;
    }
  }

  async executeBatteryEmergencyResponse(emergency) {
    const { droneId, id: emergencyId } = emergency;
    const actions = [];

    try {
      logger.emergency(`Executing battery emergency response for drone ${droneId}`, {
        emergencyId
      });

      // Step 1: Abort current mission
      const missionAborted = await this.abortCurrentMission(droneId);
      actions.push({
        action: 'abort_mission',
        status: missionAborted ? 'success' : 'failed',
        timestamp: Date.now(),
        details: missionAborted ? 'Mission aborted successfully' : 'Failed to abort mission'
      });

      // Step 2: Request immediate return to base or emergency landing
      const landingRequested = await this.requestEmergencyLanding(droneId);
      actions.push({
        action: 'request_emergency_landing',
        status: landingRequested ? 'success' : 'failed',
        timestamp: Date.now(),
        details: landingRequested ? 'Emergency landing requested' : 'Failed to request emergency landing'
      });

      // Step 3: Alert nearby drones to avoid the area
      const avoidanceAlerted = await this.alertNearbyDrones(droneId);
      actions.push({
        action: 'alert_nearby_drones',
        status: avoidanceAlerted ? 'success' : 'failed',
        timestamp: Date.now(),
        details: `Alerted ${avoidanceAlerted || 0} nearby drones`
      });

      // Step 4: Notify operators
      const operatorsNotified = await this.notifyOperators(emergency);
      actions.push({
        action: 'notify_operators',
        status: operatorsNotified ? 'success' : 'failed',
        timestamp: Date.now(),
        details: operatorsNotified ? 'Operators notified' : 'Failed to notify operators'
      });

      // Update emergency with actions taken
      emergency.actions = actions;
      this.activeEmergencies.set(droneId, emergency);

      // Store emergency in database
      await this.storeEmergencyInDatabase(emergency);

      logger.emergency(`Battery emergency response completed for drone ${droneId}`, {
        emergencyId,
        actionsCount: actions.length,
        successfulActions: actions.filter(a => a.status === 'success').length
      });

    } catch (error) {
      logger.error(`Error executing battery emergency response for drone ${droneId}:`, error);
      
      actions.push({
        action: 'emergency_response',
        status: 'error',
        timestamp: Date.now(),
        details: `Response failed: ${error.message}`
      });
      
      emergency.actions = actions;
      this.activeEmergencies.set(droneId, emergency);
    }
  }

  async abortCurrentMission(droneId) {
    try {
      const response = await axios.post(
        `${this.config.missionServiceUrl}/api/v1/missions/abort/${droneId}`,
        { reason: 'battery_emergency', emergency: true },
        { timeout: 5000 }
      );
      
      logger.info(`Mission aborted for drone ${droneId}`, { response: response.data });
      return true;
    } catch (error) {
      logger.error(`Failed to abort mission for drone ${droneId}:`, error.message);
      return false;
    }
  }

  async requestEmergencyLanding(droneId) {
    try {
      const response = await axios.post(
        `${this.config.coordinationServiceUrl}/api/v1/coordination/emergency-landing`,
        { 
          droneId, 
          reason: 'battery_critical',
          priority: 'emergency'
        },
        { timeout: 5000 }
      );
      
      logger.info(`Emergency landing requested for drone ${droneId}`, { response: response.data });
      return true;
    } catch (error) {
      logger.error(`Failed to request emergency landing for drone ${droneId}:`, error.message);
      return false;
    }
  }

  async alertNearbyDrones(emergencyDroneId) {
    try {
      const response = await axios.post(
        `${this.config.coordinationServiceUrl}/api/v1/coordination/alert-nearby`,
        {
          droneId: emergencyDroneId,
          alertType: 'emergency_landing',
          radius: 1000, // 1km radius
          message: 'Nearby drone in emergency landing - avoid area'
        },
        { timeout: 5000 }
      );
      
      const alertedCount = response.data?.alertedDrones?.length || 0;
      logger.info(`Alerted ${alertedCount} nearby drones about emergency`, {
        emergencyDrone: emergencyDroneId
      });
      
      return alertedCount;
    } catch (error) {
      logger.error(`Failed to alert nearby drones about emergency:`, error.message);
      return 0;
    }
  }

  async notifyOperators(emergency) {
    try {
      // In a real system, this would send notifications via email, SMS, etc.
      // For this simulation, we'll just broadcast via WebSocket and log
      
      const notification = {
        type: 'operator_notification',
        severity: 'critical',
        title: 'DRONE EMERGENCY - BATTERY CRITICAL',
        message: `Drone ${emergency.droneId} has critically low battery (${emergency.alert.data.batteryLevel}%). Emergency landing protocol initiated.`,
        emergency,
        timestamp: Date.now(),
        requiresAcknowledgment: true
      };

      // Broadcast to all connected clients
      if (global.wsServer) {
        global.wsServer.broadcast('operator_notification', notification);
      }

      logger.emergency('Operators notified of drone emergency', {
        droneId: emergency.droneId,
        emergencyId: emergency.id
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to notify operators:', error);
      return false;
    }
  }

  async handleEmergencyTimeout(droneId) {
    const emergency = this.activeEmergencies.get(droneId);
    if (!emergency) return;

    logger.emergency(`Emergency timeout reached for drone ${droneId}`, {
      emergencyId: emergency.id,
      duration: Date.now() - emergency.initiatedAt
    });

    // Update emergency status
    emergency.status = 'timeout';
    emergency.resolution = {
      type: 'timeout',
      timestamp: Date.now(),
      message: 'Emergency protocol timed out - operator intervention required'
    };

    // Clear timeout
    this.emergencyTimeouts.delete(droneId);

    // Escalate to highest priority
    const escalationNotification = {
      type: 'emergency_escalation',
      severity: 'critical',
      title: 'EMERGENCY TIMEOUT - IMMEDIATE INTERVENTION REQUIRED',
      message: `Emergency protocol for drone ${droneId} has timed out. Immediate operator intervention required.`,
      emergency,
      timestamp: Date.now(),
      requiresImmediateAction: true
    };

    if (global.wsServer) {
      global.wsServer.broadcast('emergency_escalation', escalationNotification);
    }

    // Store updated emergency
    await this.storeEmergencyInDatabase(emergency);
  }

  async resolveEmergency(droneId, resolution) {
    const emergency = this.activeEmergencies.get(droneId);
    if (!emergency) {
      throw new Error(`No active emergency found for drone ${droneId}`);
    }

    try {
      // Clear timeout
      const timeout = this.emergencyTimeouts.get(droneId);
      if (timeout) {
        clearTimeout(timeout);
        this.emergencyTimeouts.delete(droneId);
      }

      // Update emergency
      emergency.status = 'resolved';
      emergency.resolution = {
        ...resolution,
        timestamp: Date.now()
      };

      // Remove from active emergencies
      this.activeEmergencies.delete(droneId);

      // Store updated emergency
      await this.storeEmergencyInDatabase(emergency);

      // Resolve related safety alert
      await SafetyCache.resolveAlert(emergency.id);

      logger.emergency(`Emergency resolved for drone ${droneId}`, {
        emergencyId: emergency.id,
        resolution: resolution.type,
        duration: Date.now() - emergency.initiatedAt
      });

      // Broadcast resolution
      if (global.wsServer) {
        global.wsServer.broadcast('emergency_resolved', {
          droneId,
          emergency,
          resolution,
          timestamp: Date.now()
        });
      }

      return emergency;
    } catch (error) {
      logger.error(`Failed to resolve emergency for drone ${droneId}:`, error);
      throw error;
    }
  }

  async storeEmergencyInDatabase(emergency) {
    try {
      const insertQuery = `
        INSERT INTO emergency_protocols (
          id, drone_id, type, severity, status, initiated_at,
          alert_data, actions, resolution, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          actions = EXCLUDED.actions,
          resolution = EXCLUDED.resolution,
          updated_at = EXCLUDED.updated_at
      `;

      await query(insertQuery, [
        emergency.id,
        emergency.droneId,
        emergency.type,
        emergency.severity,
        emergency.status,
        new Date(emergency.initiatedAt).toISOString(),
        JSON.stringify(emergency.alert),
        JSON.stringify(emergency.actions),
        JSON.stringify(emergency.resolution),
        new Date(emergency.initiatedAt).toISOString(),
        new Date().toISOString()
      ]);

    } catch (error) {
      logger.error('Failed to store emergency in database:', error);
    }
  }

  // Public API methods
  getActiveEmergencies() {
    return Array.from(this.activeEmergencies.values());
  }

  getEmergencyById(emergencyId) {
    return Array.from(this.activeEmergencies.values())
      .find(e => e.id === emergencyId);
  }

  getEmergencyByDrone(droneId) {
    return this.activeEmergencies.get(droneId);
  }

  async getEmergencyHistory(limit = 50) {
    try {
      const historyQuery = `
        SELECT * FROM emergency_protocols
        ORDER BY initiated_at DESC
        LIMIT $1
      `;

      const result = await query(historyQuery, [limit]);
      return result.rows.map(row => ({
        ...row,
        alert_data: JSON.parse(row.alert_data || '{}'),
        actions: JSON.parse(row.actions || '[]'),
        resolution: JSON.parse(row.resolution || 'null')
      }));
    } catch (error) {
      logger.error('Failed to get emergency history:', error);
      return [];
    }
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      activeEmergencies: this.activeEmergencies.size,
      activeTimeouts: this.emergencyTimeouts.size,
      config: this.config
    };
  }
}

module.exports = EmergencyProtocol;