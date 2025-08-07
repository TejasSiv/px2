const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { SafetyCache } = require('../cache/redis');
const { query } = require('../database/connection');

class GeofenceMonitor {
  constructor() {
    this.isRunning = false;
    this.monitoringInterval = null;
    
    // Geofence validation stats
    this.validationStats = {
      totalChecks: 0,
      violations: 0,
      activeGeofences: 0,
      lastValidation: null,
      avgValidationTime: 0
    };
    
    // Configuration
    this.config = {
      validationInterval: parseInt(process.env.GEOFENCE_CHECK_INTERVAL) || 10000, // 10 seconds for reasonable safety monitoring
      violationCooldown: parseInt(process.env.GEOFENCE_VIOLATION_COOLDOWN) || 30000, // 30 seconds between duplicate alerts
      emergencyBufferDistance: parseInt(process.env.EMERGENCY_BUFFER_DISTANCE) || 50, // 50 meters emergency buffer
      warningBufferDistance: parseInt(process.env.WARNING_BUFFER_DISTANCE) || 100 // 100 meters warning buffer
    };
    
    // Active geofences cache
    this.activeGeofences = new Map();
    this.violationCooldowns = new Map();
    
    logger.info('Geofence Monitor initialized', this.config);
  }

  async start() {
    if (this.isRunning) {
      logger.warn('Geofence Monitor is already running');
      return;
    }

    try {
      this.isRunning = true;
      
      // Load active geofences from database
      await this.loadActiveGeofences();
      
      // Start monitoring loop
      this.monitoringInterval = setInterval(
        () => this.performGeofenceValidation(),
        this.config.validationInterval
      );
      
      logger.info('Geofence Monitor started successfully');
      
      // Perform initial validation
      await this.performGeofenceValidation();
      
    } catch (error) {
      logger.error('Failed to start Geofence Monitor:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      logger.warn('Geofence Monitor is not running');
      return;
    }

    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    logger.info('Geofence Monitor stopped');
  }

  async loadActiveGeofences() {
    try {
      const result = await query(`
        SELECT id, name, type, coordinates, altitude_min, altitude_max, 
               restriction_type, severity, active, created_at, updated_at
        FROM geofences 
        WHERE active = true
        ORDER BY severity DESC, created_at ASC
      `);
      
      this.activeGeofences.clear();
      
      result.rows.forEach(geofence => {
        // Parse coordinates JSON
        const coordinates = JSON.parse(geofence.coordinates);
        
        this.activeGeofences.set(geofence.id, {
          id: geofence.id,
          name: geofence.name,
          type: geofence.type, // 'inclusion', 'exclusion', 'emergency'
          coordinates, // Array of lat/lng points for polygon
          altitudeMin: geofence.altitude_min,
          altitudeMax: geofence.altitude_max,
          restrictionType: geofence.restriction_type, // 'no_fly', 'restricted', 'emergency_only'
          severity: geofence.severity, // 'critical', 'warning', 'info'
          active: geofence.active,
          createdAt: geofence.created_at,
          updatedAt: geofence.updated_at
        });
      });
      
      this.validationStats.activeGeofences = this.activeGeofences.size;
      logger.info(`Loaded ${this.activeGeofences.size} active geofences`);
      
    } catch (error) {
      logger.error('Failed to load active geofences:', error);
      throw error;
    }
  }

  async performGeofenceValidation() {
    try {
      const startTime = Date.now();
      
      // Get current drone positions from telemetry cache
      const dronePositions = await this.getCurrentDronePositions();
      
      if (dronePositions.length === 0) {
        return; // No drones to validate
      }
      
      // Check each drone against all active geofences
      const violations = [];
      
      for (const dronePosition of dronePositions) {
        const droneViolations = await this.validateDronePosition(dronePosition);
        violations.push(...droneViolations);
      }
      
      // Process any violations found
      if (violations.length > 0) {
        await this.processGeofenceViolations(violations);
      }
      
      // Update validation statistics
      const validationTime = Date.now() - startTime;
      this.validationStats.totalChecks++;
      this.validationStats.violations += violations.length;
      this.validationStats.lastValidation = Date.now();
      this.validationStats.avgValidationTime = 
        (this.validationStats.avgValidationTime + validationTime) / 2;
      
      logger.debug('Geofence validation completed', {
        drones: dronePositions.length,
        geofences: this.activeGeofences.size,
        violations: violations.length,
        duration: validationTime
      });
      
    } catch (error) {
      logger.error('Error during geofence validation:', error);
    }
  }

  async getCurrentDronePositions() {
    try {
      const positions = [];
      
      // Get all active drone IDs
      for (let i = 0; i < 5; i++) { // Assuming 5 drones as per architecture
        const droneId = `drone_${i}`;
        const telemetryKey = `telemetry:${droneId}`;
        
        const telemetry = await SafetyCache.getClient().hgetall(telemetryKey);
        
        if (telemetry && telemetry.latitude && telemetry.longitude) {
          positions.push({
            droneId,
            latitude: parseFloat(telemetry.latitude),
            longitude: parseFloat(telemetry.longitude),
            altitude: parseFloat(telemetry.altitude || 0),
            armed: telemetry.armed === 'true',
            missionStatus: telemetry.mission_status || 'unknown',
            timestamp: parseInt(telemetry.timestamp || Date.now())
          });
        }
      }
      
      return positions;
    } catch (error) {
      logger.error('Failed to get current drone positions:', error);
      return [];
    }
  }

  async validateDronePosition(dronePosition) {
    const violations = [];
    
    for (const [geofenceId, geofence] of this.activeGeofences) {
      const violation = this.checkGeofenceViolation(dronePosition, geofence);
      
      if (violation) {
        // Check cooldown to prevent spam
        const cooldownKey = `${dronePosition.droneId}:${geofenceId}`;
        const lastViolation = this.violationCooldowns.get(cooldownKey);
        
        if (!lastViolation || (Date.now() - lastViolation) > this.config.violationCooldown) {
          violations.push(violation);
          this.violationCooldowns.set(cooldownKey, Date.now());
        }
      }
    }
    
    return violations;
  }

  checkGeofenceViolation(dronePosition, geofence) {
    try {
      // Check altitude bounds first
      if (geofence.altitudeMin !== null && dronePosition.altitude < geofence.altitudeMin) {
        return this.createViolation(dronePosition, geofence, 'altitude_below', 
          `Drone altitude ${dronePosition.altitude}m below minimum ${geofence.altitudeMin}m`);
      }
      
      if (geofence.altitudeMax !== null && dronePosition.altitude > geofence.altitudeMax) {
        return this.createViolation(dronePosition, geofence, 'altitude_above',
          `Drone altitude ${dronePosition.altitude}m above maximum ${geofence.altitudeMax}m`);
      }
      
      // Check geographical boundaries
      const isInside = this.isPointInPolygon(
        { lat: dronePosition.latitude, lng: dronePosition.longitude },
        geofence.coordinates
      );
      
      // Determine violation based on geofence type
      let violationType = null;
      let message = null;
      
      if (geofence.type === 'exclusion' && isInside) {
        // Drone is inside an exclusion zone (not allowed)
        const distance = this.getDistanceToPolygonEdge(
          { lat: dronePosition.latitude, lng: dronePosition.longitude },
          geofence.coordinates
        );
        
        violationType = 'exclusion_violation';
        message = `Drone inside ${geofence.restrictionType} zone: ${geofence.name}`;
        
        // Determine severity based on distance to edge
        if (distance < this.config.emergencyBufferDistance) {
          return this.createViolation(dronePosition, geofence, violationType, message, 'critical');
        } else if (distance < this.config.warningBufferDistance) {
          return this.createViolation(dronePosition, geofence, violationType, message, 'warning');
        }
        
      } else if (geofence.type === 'inclusion' && !isInside) {
        // Drone is outside an inclusion zone (should stay inside)
        const distance = this.getDistanceToPolygonEdge(
          { lat: dronePosition.latitude, lng: dronePosition.longitude },
          geofence.coordinates
        );
        
        violationType = 'inclusion_violation';
        message = `Drone outside authorized zone: ${geofence.name}`;
        
        // Determine severity based on distance from zone
        if (distance > this.config.emergencyBufferDistance) {
          return this.createViolation(dronePosition, geofence, violationType, message, 'critical');
        } else if (distance > this.config.warningBufferDistance) {
          return this.createViolation(dronePosition, geofence, violationType, message, 'warning');
        }
      }
      
      return null; // No violation
      
    } catch (error) {
      logger.error('Error checking geofence violation:', error);
      return null;
    }
  }

  createViolation(dronePosition, geofence, violationType, message, severityOverride = null) {
    return {
      id: uuidv4(),
      droneId: dronePosition.droneId,
      geofenceId: geofence.id,
      geofenceName: geofence.name,
      violationType,
      severity: severityOverride || geofence.severity,
      message,
      position: {
        latitude: dronePosition.latitude,
        longitude: dronePosition.longitude,
        altitude: dronePosition.altitude
      },
      droneStatus: {
        armed: dronePosition.armed,
        missionStatus: dronePosition.missionStatus
      },
      timestamp: Date.now(),
      restrictionType: geofence.restrictionType
    };
  }

  isPointInPolygon(point, polygon) {
    // Ray casting algorithm for point-in-polygon test
    let isInside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lat;
      const yi = polygon[i].lng;
      const xj = polygon[j].lat;
      const yj = polygon[j].lng;
      
      if (((yi > point.lng) !== (yj > point.lng)) &&
          (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi)) {
        isInside = !isInside;
      }
    }
    
    return isInside;
  }

  getDistanceToPolygonEdge(point, polygon) {
    // Calculate minimum distance from point to polygon edge
    let minDistance = Infinity;
    
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      const distance = this.getDistanceToLineSegment(
        point,
        polygon[i],
        polygon[j]
      );
      minDistance = Math.min(minDistance, distance);
    }
    
    return minDistance;
  }

  getDistanceToLineSegment(point, lineStart, lineEnd) {
    // Calculate distance from point to line segment using Haversine formula
    const R = 6371e3; // Earth's radius in meters
    
    // Convert to radians
    const φ1 = point.lat * Math.PI / 180;
    const φ2 = lineStart.lat * Math.PI / 180;
    const φ3 = lineEnd.lat * Math.PI / 180;
    const λ1 = point.lng * Math.PI / 180;
    const λ2 = lineStart.lng * Math.PI / 180;
    const λ3 = lineEnd.lng * Math.PI / 180;
    
    // Simple distance to start point (could be improved with perpendicular distance)
    const Δφ = φ2 - φ1;
    const Δλ = λ2 - λ1;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c; // Distance in meters
  }

  async processGeofenceViolations(violations) {
    try {
      for (const violation of violations) {
        // Create safety alert
        const alert = {
          id: violation.id,
          droneId: violation.droneId,
          severity: violation.severity,
          type: 'geofence_violation',
          category: 'geofence',
          message: violation.message,
          data: {
            geofenceId: violation.geofenceId,
            geofenceName: violation.geofenceName,
            violationType: violation.violationType,
            position: violation.position,
            droneStatus: violation.droneStatus,
            restrictionType: violation.restrictionType
          },
          timestamp: new Date().toISOString(),
          resolved: false,
          acknowledged: false,
          source: 'geofence_monitor'
        };
        
        // Store alert in cache and database
        await SafetyCache.storeAlert(alert);
        await this.storeViolationInDatabase(violation);
        
        // Broadcast alert via WebSocket
        if (global.wsServer) {
          global.wsServer.broadcastSafetyAlert(alert);
        }
        
        // Trigger emergency protocols for critical violations
        if (violation.severity === 'critical') {
          await this.triggerEmergencyResponse(violation);
        }
        
        logger.warn('Geofence violation detected', {
          droneId: violation.droneId,
          geofence: violation.geofenceName,
          type: violation.violationType,
          severity: violation.severity
        });
      }
      
    } catch (error) {
      logger.error('Error processing geofence violations:', error);
    }
  }

  async triggerEmergencyResponse(violation) {
    try {
      // Determine emergency response based on violation type and restriction
      let emergencyType = 'geofence_violation';
      let emergencyAction = 'return_to_base';
      
      if (violation.restrictionType === 'no_fly') {
        emergencyType = 'no_fly_zone_violation';
        emergencyAction = 'emergency_land';
      } else if (violation.restrictionType === 'emergency_only') {
        emergencyType = 'restricted_airspace_violation';
        emergencyAction = 'return_to_base';
      }
      
      // Create emergency protocol entry
      const emergency = {
        id: uuidv4(),
        type: emergencyType,
        droneId: violation.droneId,
        severity: 'critical',
        action: emergencyAction,
        reason: `Geofence violation: ${violation.message}`,
        geofenceInfo: {
          id: violation.geofenceId,
          name: violation.geofenceName,
          restrictionType: violation.restrictionType
        },
        position: violation.position,
        timestamp: Date.now(),
        status: 'active'
      };
      
      // Store emergency in cache
      await SafetyCache.getClient().setex(
        `emergency:${emergency.id}`,
        3600, // 1 hour expiry
        JSON.stringify(emergency)
      );
      
      // Store in database
      await this.storeEmergencyInDatabase(emergency);
      
      // Broadcast emergency alert
      if (global.wsServer) {
        global.wsServer.broadcast('emergency_alert', {
          type: 'geofence_emergency',
          emergency: emergency,
          timestamp: Date.now()
        });
      }
      
      logger.error('Emergency response triggered for geofence violation', {
        emergencyId: emergency.id,
        droneId: violation.droneId,
        action: emergencyAction
      });
      
    } catch (error) {
      logger.error('Error triggering emergency response:', error);
    }
  }

  async storeViolationInDatabase(violation) {
    try {
      const insertQuery = `
        INSERT INTO geofence_violations (
          id, drone_id, geofence_id, violation_type, severity,
          message, position, drone_status, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `;
      
      await query(insertQuery, [
        violation.id,
        violation.droneId,
        violation.geofenceId,
        violation.violationType,
        violation.severity,
        violation.message,
        JSON.stringify(violation.position),
        JSON.stringify(violation.droneStatus),
        new Date(violation.timestamp)
      ]);
      
    } catch (error) {
      logger.error('Failed to store violation in database:', error);
    }
  }

  async storeEmergencyInDatabase(emergency) {
    try {
      const insertQuery = `
        INSERT INTO emergency_protocols (
          id, type, drone_id, severity, action, reason,
          additional_data, position, timestamp, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;
      
      await query(insertQuery, [
        emergency.id,
        emergency.type,
        emergency.droneId,
        emergency.severity,
        emergency.action,
        emergency.reason,
        JSON.stringify({ geofenceInfo: emergency.geofenceInfo }),
        JSON.stringify(emergency.position),
        new Date(emergency.timestamp),
        emergency.status
      ]);
      
    } catch (error) {
      logger.error('Failed to store emergency in database:', error);
    }
  }

  // Geofence management methods
  async createGeofence(geofenceData) {
    try {
      const geofence = {
        id: uuidv4(),
        name: geofenceData.name,
        type: geofenceData.type, // 'inclusion', 'exclusion'
        coordinates: JSON.stringify(geofenceData.coordinates),
        altitudeMin: geofenceData.altitudeMin || null,
        altitudeMax: geofenceData.altitudeMax || null,
        restrictionType: geofenceData.restrictionType, // 'no_fly', 'restricted', 'emergency_only'
        severity: geofenceData.severity || 'warning',
        active: geofenceData.active !== false,
        createdBy: geofenceData.createdBy || 'system',
        description: geofenceData.description || null
      };
      
      const insertQuery = `
        INSERT INTO geofences (
          id, name, type, coordinates, altitude_min, altitude_max,
          restriction_type, severity, active, created_by, description, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING *
      `;
      
      const result = await query(insertQuery, [
        geofence.id,
        geofence.name,
        geofence.type,
        geofence.coordinates,
        geofence.altitudeMin,
        geofence.altitudeMax,
        geofence.restrictionType,
        geofence.severity,
        geofence.active,
        geofence.createdBy,
        geofence.description
      ]);
      
      // Reload active geofences to include new one
      await this.loadActiveGeofences();
      
      logger.info('Geofence created successfully', { 
        id: geofence.id, 
        name: geofence.name,
        type: geofence.type
      });
      
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create geofence:', error);
      throw error;
    }
  }

  async updateGeofence(geofenceId, updates) {
    try {
      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;
      
      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramCount++}`);
        updateValues.push(updates.name);
      }
      if (updates.coordinates !== undefined) {
        updateFields.push(`coordinates = $${paramCount++}`);
        updateValues.push(JSON.stringify(updates.coordinates));
      }
      if (updates.altitudeMin !== undefined) {
        updateFields.push(`altitude_min = $${paramCount++}`);
        updateValues.push(updates.altitudeMin);
      }
      if (updates.altitudeMax !== undefined) {
        updateFields.push(`altitude_max = $${paramCount++}`);
        updateValues.push(updates.altitudeMax);
      }
      if (updates.restrictionType !== undefined) {
        updateFields.push(`restriction_type = $${paramCount++}`);
        updateValues.push(updates.restrictionType);
      }
      if (updates.severity !== undefined) {
        updateFields.push(`severity = $${paramCount++}`);
        updateValues.push(updates.severity);
      }
      if (updates.active !== undefined) {
        updateFields.push(`active = $${paramCount++}`);
        updateValues.push(updates.active);
      }
      
      updateFields.push(`updated_at = NOW()`);
      updateValues.push(geofenceId);
      
      const updateQuery = `
        UPDATE geofences 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;
      
      const result = await query(updateQuery, updateValues);
      
      if (result.rows.length === 0) {
        throw new Error('Geofence not found');
      }
      
      // Reload active geofences to reflect changes
      await this.loadActiveGeofences();
      
      logger.info('Geofence updated successfully', { id: geofenceId });
      
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update geofence:', error);
      throw error;
    }
  }

  async deleteGeofence(geofenceId) {
    try {
      const deleteQuery = 'DELETE FROM geofences WHERE id = $1 RETURNING *';
      const result = await query(deleteQuery, [geofenceId]);
      
      if (result.rows.length === 0) {
        throw new Error('Geofence not found');
      }
      
      // Remove from active geofences
      this.activeGeofences.delete(geofenceId);
      this.validationStats.activeGeofences = this.activeGeofences.size;
      
      logger.info('Geofence deleted successfully', { id: geofenceId });
      
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to delete geofence:', error);
      throw error;
    }
  }

  async getAllGeofences() {
    try {
      const result = await query(`
        SELECT id, name, type, coordinates, altitude_min, altitude_max,
               restriction_type, severity, active, created_by, description,
               created_at, updated_at
        FROM geofences
        ORDER BY created_at DESC
      `);
      
      return result.rows.map(row => ({
        ...row,
        coordinates: JSON.parse(row.coordinates)
      }));
    } catch (error) {
      logger.error('Failed to get all geofences:', error);
      throw error;
    }
  }

  async getGeofenceViolations(droneId = null, limit = 100) {
    try {
      let query_text = `
        SELECT gv.*, g.name as geofence_name
        FROM geofence_violations gv
        LEFT JOIN geofences g ON gv.geofence_id = g.id
        WHERE 1=1
      `;
      const params = [];
      
      if (droneId) {
        params.push(droneId);
        query_text += ` AND gv.drone_id = $${params.length}`;
      }
      
      params.push(limit);
      query_text += ` ORDER BY gv.timestamp DESC LIMIT $${params.length}`;
      
      const result = await query(query_text, params);
      
      return result.rows.map(row => ({
        ...row,
        position: JSON.parse(row.position),
        drone_status: JSON.parse(row.drone_status)
      }));
    } catch (error) {
      logger.error('Failed to get geofence violations:', error);
      throw error;
    }
  }

  getMonitoringStats() {
    return {
      isRunning: this.isRunning,
      activeGeofences: this.validationStats.activeGeofences,
      validationStats: this.validationStats,
      config: this.config,
      violationCooldowns: this.violationCooldowns.size
    };
  }
}

module.exports = GeofenceMonitor;