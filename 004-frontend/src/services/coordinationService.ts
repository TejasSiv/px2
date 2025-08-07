import { DroneData, Position } from '@/types/fleet';

export interface CoordinationAlert {
  id: string;
  type: 'collision_warning' | 'separation_violation' | 'coordination_conflict';
  severity: 'warning' | 'critical';
  droneIds: string[];
  distance: number;
  message: string;
  timestamp: string;
  resolved: boolean;
  avoidanceAction?: {
    droneId: string;
    action: 'climb' | 'descend' | 'turn_left' | 'turn_right' | 'hover' | 'slow_down';
    magnitude: number;
  };
}

export interface CoordinationStatus {
  isActive: boolean;
  separationDistance: number; // meters
  activeWarnings: CoordinationAlert[];
  totalConflicts: number;
  resolvedConflicts: number;
  lastUpdate: string;
}

export class CoordinationService {
  private separationDistance = 50; // 50 meters minimum separation
  private warningDistance = 75; // 75 meters warning zone
  private activeAlerts: Map<string, CoordinationAlert> = new Map();
  private avoidanceManeuvers: Map<string, { action: string; endTime: number; originalHeading?: number }> = new Map();

  constructor() {
    console.log('🤝 Coordination Service initialized with 50m separation');
  }

  /**
   * Calculate distance between two positions in meters using Haversine formula
   */
  private calculateDistance(pos1: Position, pos2: Position): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = pos1.lat * Math.PI / 180;
    const φ2 = pos2.lat * Math.PI / 180;
    const Δφ = (pos2.lat - pos1.lat) * Math.PI / 180;
    const Δλ = (pos2.lng - pos1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const horizontalDistance = R * c;
    
    // Include altitude difference for 3D distance
    const altitudeDiff = Math.abs(pos1.alt - pos2.alt);
    const distance3D = Math.sqrt(horizontalDistance * horizontalDistance + altitudeDiff * altitudeDiff);

    return distance3D;
  }

  /**
   * Calculate bearing from one position to another
   */
  private calculateBearing(from: Position, to: Position): number {
    const φ1 = from.lat * Math.PI / 180;
    const φ2 = to.lat * Math.PI / 180;
    const Δλ = (to.lng - from.lng) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360; // Normalize to 0-360
  }

  /**
   * Predict future position based on current position, heading, and speed
   */
  private predictPosition(drone: DroneData, secondsAhead: number): Position {
    const metersPerSecond = drone.speed;
    const distanceAhead = metersPerSecond * secondsAhead;
    
    // Convert heading to radians
    const headingRad = drone.heading * Math.PI / 180;
    
    // Calculate new position (simplified for small distances)
    const earthRadius = 6371000;
    const latOffset = (distanceAhead * Math.cos(headingRad)) / earthRadius * (180 / Math.PI);
    const lngOffset = (distanceAhead * Math.sin(headingRad)) / earthRadius * (180 / Math.PI) / Math.cos(drone.position.lat * Math.PI / 180);
    
    return {
      lat: drone.position.lat + latOffset,
      lng: drone.position.lng + lngOffset,
      alt: drone.position.alt // Assume constant altitude for prediction
    };
  }

  /**
   * Check for collision risks between all active drones
   */
  checkCollisionRisks(drones: DroneData[]): CoordinationAlert[] {
    const activeDrones = drones.filter(drone => 
      drone.status === 'active' || drone.status === 'in_flight'
    );

    const alerts: CoordinationAlert[] = [];
    const now = Date.now();

    // Clear expired avoidance maneuvers
    this.avoidanceManeuvers.forEach((maneuver, droneId) => {
      if (now > maneuver.endTime) {
        this.avoidanceManeuvers.delete(droneId);
      }
    });

    // Check all drone pairs
    for (let i = 0; i < activeDrones.length; i++) {
      for (let j = i + 1; j < activeDrones.length; j++) {
        const drone1 = activeDrones[i];
        const drone2 = activeDrones[j];

        const currentDistance = this.calculateDistance(drone1.position, drone2.position);
        
        // Predict positions 10 seconds ahead
        const future1 = this.predictPosition(drone1, 10);
        const future2 = this.predictPosition(drone2, 10);
        const futureDistance = this.calculateDistance(future1, future2);

        const minDistance = Math.min(currentDistance, futureDistance);
        const alertId = `${drone1.id}-${drone2.id}`;

        // Critical separation violation
        if (minDistance < this.separationDistance) {
          const alert: CoordinationAlert = {
            id: alertId,
            type: 'separation_violation',
            severity: 'critical',
            droneIds: [drone1.id, drone2.id],
            distance: minDistance,
            message: `CRITICAL: Drones ${drone1.name} and ${drone2.name} within ${minDistance.toFixed(1)}m (minimum ${this.separationDistance}m)`,
            timestamp: new Date().toISOString(),
            resolved: false,
            avoidanceAction: this.calculateAvoidanceAction(drone1, drone2, minDistance)
          };

          alerts.push(alert);
          this.activeAlerts.set(alertId, alert);
        }
        // Warning zone
        else if (minDistance < this.warningDistance) {
          const existingAlert = this.activeAlerts.get(alertId);
          if (!existingAlert || existingAlert.type !== 'collision_warning') {
            const alert: CoordinationAlert = {
              id: alertId,
              type: 'collision_warning',
              severity: 'warning',
              droneIds: [drone1.id, drone2.id],
              distance: minDistance,
              message: `Warning: Drones ${drone1.name} and ${drone2.name} approaching ${minDistance.toFixed(1)}m separation`,
              timestamp: new Date().toISOString(),
              resolved: false
            };

            alerts.push(alert);
            this.activeAlerts.set(alertId, alert);
          }
        }
        // Clear resolved alerts
        else {
          const existingAlert = this.activeAlerts.get(alertId);
          if (existingAlert && !existingAlert.resolved) {
            existingAlert.resolved = true;
            this.activeAlerts.delete(alertId);
          }
        }
      }
    }

    return alerts;
  }

  /**
   * Calculate appropriate avoidance action for a drone pair
   */
  private calculateAvoidanceAction(drone1: DroneData, drone2: DroneData, distance: number): {
    droneId: string;
    action: 'climb' | 'descend' | 'turn_left' | 'turn_right' | 'hover' | 'slow_down';
    magnitude: number;
  } {
    // Determine which drone should take evasive action
    // Priority: lower altitude drone climbs, or drone with lower ID turns
    const altitudeDiff = drone1.position.alt - drone2.position.alt;
    let actionDrone: DroneData;
    let action: 'climb' | 'descend' | 'turn_left' | 'turn_right' | 'hover' | 'slow_down';
    let magnitude: number;

    if (Math.abs(altitudeDiff) < 10) {
      // Similar altitudes - use turning maneuver
      actionDrone = drone1.id < drone2.id ? drone1 : drone2;
      
      // Calculate relative bearing to determine turn direction
      const bearing = this.calculateBearing(drone1.position, drone2.position);
      const relativeAngle = (bearing - drone1.heading + 360) % 360;
      
      action = relativeAngle < 180 ? 'turn_right' : 'turn_left';
      magnitude = Math.max(30, 60 - distance); // Turn more sharply the closer they are
    } else {
      // Different altitudes - use vertical separation
      actionDrone = altitudeDiff < 0 ? drone1 : drone2;
      action = altitudeDiff < 0 ? 'climb' : 'descend';
      magnitude = Math.max(20, this.separationDistance - distance + 10); // Altitude change in meters
    }

    return {
      droneId: actionDrone.id,
      action,
      magnitude
    };
  }

  /**
   * Apply avoidance maneuver to a drone
   */
  applyAvoidanceManeuver(drone: DroneData, action: CoordinationAlert['avoidanceAction']): boolean {
    if (!action) return false;

    const now = Date.now();
    const maneuverDuration = 15000; // 15 seconds

    // Store original state for restoration
    const originalHeading = drone.heading;

    let applied = false;

    switch (action.action) {
      case 'turn_left':
        drone.heading = (drone.heading - action.magnitude + 360) % 360;
        applied = true;
        break;
      
      case 'turn_right':
        drone.heading = (drone.heading + action.magnitude) % 360;
        applied = true;
        break;
      
      case 'climb':
        drone.position.alt = Math.min(drone.position.alt + action.magnitude, 200); // Max altitude limit
        applied = true;
        break;
      
      case 'descend':
        drone.position.alt = Math.max(drone.position.alt - action.magnitude, 10); // Min altitude limit
        applied = true;
        break;
      
      case 'slow_down':
        drone.speed = Math.max(drone.speed * 0.5, 2); // Reduce speed by half, minimum 2 m/s
        applied = true;
        break;
      
      case 'hover':
        drone.speed = 0;
        applied = true;
        break;
    }

    if (applied) {
      // Track the maneuver
      this.avoidanceManeuvers.set(action.droneId, {
        action: action.action,
        endTime: now + maneuverDuration,
        originalHeading: originalHeading
      });

      console.log(`🚁 Avoidance maneuver applied to ${drone.name}: ${action.action} (${action.magnitude})`);
    }

    return applied;
  }

  /**
   * Get current coordination status
   */
  getCoordinationStatus(): CoordinationStatus {
    const activeWarnings = Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
    const resolvedConflicts = Array.from(this.activeAlerts.values()).filter(alert => alert.resolved).length;

    return {
      isActive: true,
      separationDistance: this.separationDistance,
      activeWarnings,
      totalConflicts: this.activeAlerts.size,
      resolvedConflicts,
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * Update separation distance (for testing/configuration)
   */
  setSeparationDistance(distance: number): void {
    this.separationDistance = Math.max(20, Math.min(distance, 200)); // 20-200m range
    this.warningDistance = this.separationDistance * 1.5;
    console.log(`🤝 Coordination separation updated to ${this.separationDistance}m`);
  }

  /**
   * Force resolve a coordination alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      this.activeAlerts.delete(alertId);
      return true;
    }
    return false;
  }

  /**
   * Get active maneuvers for display
   */
  getActiveManeuvers(): Map<string, { action: string; endTime: number; originalHeading?: number }> {
    return new Map(this.avoidanceManeuvers);
  }
}

export const coordinationService = new CoordinationService();