import { DroneData, MissionData, FleetAlert, EmergencyState } from '@/types/fleet';
import { coordinationService, CoordinationAlert } from './coordinationService';
import { chargingService } from './chargingService';

// Flight pattern types for realistic drone movement simulation
interface BasePattern {
  type: string;
  speed: number;
}

interface CircularPattern extends BasePattern {
  type: 'circular';
  center: { lat: number; lng: number };
  radius: number;
  currentAngle: number;
}

interface LinearPattern extends BasePattern {
  type: 'linear';
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  progress: number;
  direction: number;
}

interface WaypointPattern extends BasePattern {
  type: 'waypoint';
  waypoints: Array<{ lat: number; lng: number }>;
  currentWaypoint: number;
  progress: number;
}

interface StationaryPattern extends BasePattern {
  type: 'stationary';
  center: { lat: number; lng: number };
  radius: number;
  currentAngle: number;
}

type FlightPattern = CircularPattern | LinearPattern | WaypointPattern | StationaryPattern;

// Mock data for development and testing - 5 realistic drones
export const mockDrones: DroneData[] = [
  {
    id: 'drone-001',
    name: 'Alpha-1',
    status: 'in_flight',
    position: { lat: 37.7749, lng: -122.4194, alt: 120.5 },
    batteryLevel: 87,
    batteryVoltage: 22.4,
    speed: 12.3,
    heading: 245,
    signalStrength: -45,
    connectionQuality: 'excellent',
    lastUpdate: new Date().toISOString(),
    currentMission: {
      id: 'mission-001',
      name: 'Downtown Delivery Route',
      progress: 65,
      eta: '14:30',
      status: 'active'
    },
    alerts: [
      {
        id: 'alert-001',
        severity: 'warning',
        message: 'Approaching restricted airspace',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        category: 'navigation'
      }
    ],
    temperature: 28.5,
    humidity: 65,
    firmware: 'v1.12.3',
    hardware: 'Pixhawk 4 Mini',
    uptime: '2h 34m',
    totalFlightTime: 847,
    totalMissions: 23,
    lastMaintenance: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'drone-002',
    name: 'Beta-2',
    status: 'charging',
    position: { lat: 37.7849, lng: -122.4094, alt: 2.1 },
    batteryLevel: 23,
    batteryVoltage: 18.2,
    speed: 0,
    heading: 0,
    signalStrength: -52,
    connectionQuality: 'good',
    lastUpdate: new Date().toISOString(),
    alerts: [
      {
        id: 'alert-002',
        severity: 'info',
        message: 'Charging in progress - 47 minutes remaining',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        category: 'system'
      }
    ],
    temperature: 32.1,
    humidity: 68,
    firmware: 'v1.12.3',
    hardware: 'Pixhawk 4 Pro',
    uptime: '5h 12m',
    totalFlightTime: 1203,
    totalMissions: 31,
    lastMaintenance: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'drone-003',
    name: 'Charlie-3',
    status: 'in_flight',
    position: { lat: 37.7649, lng: -122.4294, alt: 89.2 },
    batteryLevel: 18, // Low battery to trigger alerts
    batteryVoltage: 18.5,
    speed: 8.7,
    heading: 180,
    signalStrength: -67,
    connectionQuality: 'good',
    lastUpdate: new Date().toISOString(),
    currentMission: {
      id: 'mission-002',
      name: 'Harbor Security Patrol',
      progress: 38,
      eta: '15:45',
      status: 'active'
    },
    alerts: [
      {
        id: 'alert-battery-drone-003-low',
        severity: 'critical',
        message: 'Battery level 18.0% - Return to base immediately',
        timestamp: new Date(Date.now() - 180000).toISOString(),
        category: 'battery'
      }
    ],
    temperature: 30.8,
    humidity: 72,
    firmware: 'v1.12.3',
    hardware: 'Pixhawk 4 Mini',
    uptime: '1h 58m',
    totalFlightTime: 592,
    totalMissions: 18,
    lastMaintenance: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'drone-004',
    name: 'Delta-4',
    status: 'active',
    position: { lat: 37.7549, lng: -122.4394, alt: 45.8 },
    batteryLevel: 92,
    batteryVoltage: 23.1,
    speed: 6.2,
    heading: 90,
    signalStrength: -38,
    connectionQuality: 'excellent',
    lastUpdate: new Date().toISOString(),
    currentMission: {
      id: 'mission-003',
      name: 'Medical Supply Delivery',
      progress: 15,
      eta: '16:20',
      status: 'active'
    },
    temperature: 26.3,
    humidity: 58,
    firmware: 'v1.12.3',
    hardware: 'Pixhawk 4 Pro',
    uptime: '8h 45m',
    totalFlightTime: 1847,
    totalMissions: 45,
    lastMaintenance: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'drone-005',
    name: 'Echo-5',
    status: 'maintenance',
    position: { lat: 37.7449, lng: -122.4494, alt: 0 },
    batteryLevel: 78,
    batteryVoltage: 21.8,
    speed: 0,
    heading: 0,
    signalStrength: -88,
    connectionQuality: 'poor',
    lastUpdate: new Date(Date.now() - 900000).toISOString(),
    alerts: [
      {
        id: 'alert-003',
        severity: 'critical',
        message: 'Motor #3 temperature exceeds safe limits',
        timestamp: new Date(Date.now() - 1200000).toISOString(),
        category: 'hardware'
      },
      {
        id: 'alert-004',
        severity: 'warning',
        message: 'GPS signal degraded - position accuracy reduced',
        timestamp: new Date(Date.now() - 800000).toISOString(),
        category: 'navigation'
      },
      {
        id: 'alert-005',
        severity: 'info',
        message: 'Scheduled maintenance required',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        category: 'maintenance'
      }
    ],
    temperature: 52.1, // High temperature to trigger emergency
    humidity: 55,
    firmware: 'v1.12.2',
    hardware: 'Pixhawk 4 Mini',
    uptime: '12h 22m',
    totalFlightTime: 2341,
    totalMissions: 67,
    lastMaintenance: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString()
  }
];

export const mockMissions: MissionData[] = [
  {
    id: 'mission-001',
    name: 'Downtown Delivery',
    progress: 65,
    eta: '14:30',
    status: 'active',
    waypoints: [
      {
        id: 'wp-001',
        position: { lat: 37.7749, lng: -122.4194, alt: 120 },
        action: 'pickup',
        completed: true
      },
      {
        id: 'wp-002',
        position: { lat: 37.7849, lng: -122.4094, alt: 100 },
        action: 'delivery',
        completed: false
      }
    ],
    assignedDrone: 'drone-001',
    priority: 1,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    startedAt: new Date(Date.now() - 1800000).toISOString()
  },
  {
    id: 'mission-002',
    name: 'Harbor Patrol',
    progress: 38,
    eta: '15:45',
    status: 'active',
    waypoints: [
      {
        id: 'wp-003',
        position: { lat: 37.7649, lng: -122.4294, alt: 80 },
        action: 'survey',
        completed: false
      }
    ],
    assignedDrone: 'drone-003',
    priority: 2,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    startedAt: new Date(Date.now() - 2700000).toISOString()
  }
];

export const mockAlerts: FleetAlert[] = [
  {
    id: 'fleet-alert-001',
    severity: 'critical',
    message: 'Drone Echo-5 motor temperature critical',
    timestamp: new Date(Date.now() - 1200000).toISOString(),
    droneId: 'drone-005',
    droneName: 'Echo-5',
    type: 'system',
    priority: 1,
    details: {
      temperature: 45.2,
      threshold: 40.0
    }
  },
  {
    id: 'fleet-alert-002',
    severity: 'warning',
    message: 'Drone Alpha-1 approaching restricted airspace',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    droneId: 'drone-001',
    droneName: 'Alpha-1',
    type: 'safety',
    priority: 2,
    details: {
      zone: 'SFO_RESTRICTED',
      distance: 150
    }
  }
];

// Simulate real-time data updates for development
export class MockTelemetryService {
  private updateInterval: number | null = null;
  private onDroneUpdate?: (drone: DroneData) => void;
  private droneFlightPatterns: Map<string, FlightPattern> = new Map();
  private emergencyStates: Map<string, EmergencyState> = new Map();
  private coordinationAlerts: CoordinationAlert[] = [];

  constructor() {
    // Initialize flight patterns for each drone
    this.initializeFlightPatterns();
  }

  private initializeFlightPatterns() {
    // Alpha-1 - 4-waypoint patrol pattern (smaller area for collision potential)
    this.droneFlightPatterns.set('drone-001', {
      type: 'waypoint',
      waypoints: [
        { lat: 37.7749, lng: -122.4194 },
        { lat: 37.7754, lng: -122.4189 },
        { lat: 37.7759, lng: -122.4194 },
        { lat: 37.7754, lng: -122.4199 }
      ],
      currentWaypoint: 0,
      progress: 0,
      speed: 0.015
    });

    // Beta-2 - Stationary (charging)
    this.droneFlightPatterns.set('drone-002', {
      type: 'stationary',
      center: { lat: 37.7849, lng: -122.4094 },
      radius: 0,
      currentAngle: 0,
      speed: 0
    });

    // Charlie-3 - 4-waypoint harbor patrol
    this.droneFlightPatterns.set('drone-003', {
      type: 'waypoint',
      waypoints: [
        { lat: 37.7649, lng: -122.4294 },
        { lat: 37.7669, lng: -122.4274 },
        { lat: 37.7649, lng: -122.4254 },
        { lat: 37.7629, lng: -122.4274 }
      ],
      currentWaypoint: 0,
      progress: 0.3,
      speed: 0.012
    });

    // Delta-4 - 4-waypoint delivery mission (overlapping with Alpha-1 area)
    this.droneFlightPatterns.set('drone-004', {
      type: 'waypoint',
      waypoints: [
        { lat: 37.7744, lng: -122.4199 },
        { lat: 37.7754, lng: -122.4189 },
        { lat: 37.7764, lng: -122.4199 },
        { lat: 37.7754, lng: -122.4209 }
      ],
      currentWaypoint: 0,
      progress: 0.15,
      speed: 0.018
    });

    // Echo-5 - Stationary (maintenance)
    this.droneFlightPatterns.set('drone-005', {
      type: 'stationary',
      center: { lat: 37.7449, lng: -122.4494 },
      radius: 0,
      currentAngle: 0,
      speed: 0
    });
  }

  start() {
    console.log('🔧 Starting enhanced mock telemetry service for 5 drones');
    console.log('📍 Flight patterns initialized: Circular patrol, Linear patrol, Waypoint mission');
    
    this.updateInterval = setInterval(() => {
      // Update each drone with realistic patterns
      mockDrones.forEach((drone, index) => {
        this.updateDroneRealistic(drone);
        
        // Stagger updates to simulate real network timing
        setTimeout(() => {
          if (this.onDroneUpdate) {
            this.onDroneUpdate({ ...drone });
          }
        }, index * 500); // 500ms between drone updates for smoother flow
      });

      // Check for collision risks and apply coordination after all drones updated
      setTimeout(() => {
        this.performCoordinationCheck();
        this.performChargingManagement();
      }, mockDrones.length * 500 + 1000); // Run coordination and charging after all drone updates
    }, 8000); // Update every 8 seconds for more reasonable refresh rate
  }

  private updateDroneRealistic(drone: DroneData) {
    const pattern = this.droneFlightPatterns.get(drone.id);
    if (!pattern) return;

    // Update position based on flight pattern
    this.updatePosition(drone, pattern);

    // Update telemetry data realistically
    this.updateTelemetry(drone);

    // Update mission progress for active drones
    this.updateMissionProgress(drone);

    // Emergency state detection and management
    this.detectEmergencyStates(drone);

    // Simulate occasional alerts
    this.simulateAlerts(drone);

    // Always update timestamp
    drone.lastUpdate = new Date().toISOString();
  }

  private updatePosition(drone: DroneData, pattern: FlightPattern) {
    switch (pattern.type) {
      case 'circular':
        pattern.currentAngle += pattern.speed * 0.4; // Faster movement
        drone.position.lat = pattern.center.lat + Math.cos(pattern.currentAngle) * pattern.radius;
        drone.position.lng = pattern.center.lng + Math.sin(pattern.currentAngle) * pattern.radius;
        drone.position.alt = 80 + Math.sin(pattern.currentAngle * 2) * 10; // Less altitude variation
        drone.heading = (pattern.currentAngle * 180 / Math.PI + 90) % 360;
        drone.speed = 12 + Math.random() * 4; // Increased speed
        break;

      case 'linear':
        const linear = pattern as LinearPattern;
        linear.progress += linear.direction * linear.speed * 0.3; // Faster movement
        
        if (linear.progress >= 1 || linear.progress <= 0) {
          linear.direction *= -1; // Reverse direction
          linear.progress = Math.max(0, Math.min(1, linear.progress));
        }
        
        drone.position.lat = linear.start.lat + (linear.end.lat - linear.start.lat) * linear.progress;
        drone.position.lng = linear.start.lng + (linear.end.lng - linear.start.lng) * linear.progress;
        drone.position.alt = 60 + Math.sin(linear.progress * Math.PI) * 15; // Less altitude variation
        
        const deltaLat = linear.end.lat - linear.start.lat;
        const deltaLng = linear.end.lng - linear.start.lng;
        drone.heading = (Math.atan2(deltaLng, deltaLat) * 180 / Math.PI * linear.direction) % 360;
        drone.speed = 9 + Math.random() * 3; // Increased speed
        break;

      case 'waypoint':
        const waypoint = pattern as WaypointPattern;
        waypoint.progress += waypoint.speed * 0.4; // Faster waypoint movement
        
        if (waypoint.progress >= 1) {
          waypoint.currentWaypoint = (waypoint.currentWaypoint + 1) % waypoint.waypoints.length;
          waypoint.progress = 0;
        }
        
        const currentWP = waypoint.waypoints[waypoint.currentWaypoint];
        const nextWP = waypoint.waypoints[(waypoint.currentWaypoint + 1) % waypoint.waypoints.length];
        
        drone.position.lat = currentWP.lat + (nextWP.lat - currentWP.lat) * waypoint.progress;
        drone.position.lng = currentWP.lng + (nextWP.lng - currentWP.lng) * waypoint.progress;
        drone.position.alt = 45 + Math.sin(waypoint.progress * Math.PI) * 10; // More altitude variation during waypoint transitions
        
        const wpDeltaLat = nextWP.lat - currentWP.lat;
        const wpDeltaLng = nextWP.lng - currentWP.lng;
        drone.heading = Math.atan2(wpDeltaLng, wpDeltaLat) * 180 / Math.PI;
        drone.speed = 10 + Math.random() * 3; // Increased speed
        break;

      case 'stationary':
        // Small random movement to simulate GPS drift
        drone.position.lat += (Math.random() - 0.5) * 0.000005;
        drone.position.lng += (Math.random() - 0.5) * 0.000005;
        drone.speed = 0;
        break;
    }
  }

  private updateTelemetry(drone: DroneData) {
    // Battery drain simulation - much slower and smoother
    if (drone.status === 'active' || drone.status === 'in_flight') {
      drone.batteryLevel = Math.max(5, drone.batteryLevel - 0.02 - Math.random() * 0.01);
      drone.batteryVoltage = 18.0 + (drone.batteryLevel / 100) * 5.5;
    } else if (drone.status === 'charging') {
      drone.batteryLevel = Math.min(100, drone.batteryLevel + 0.1 + Math.random() * 0.05);
      drone.batteryVoltage = 18.0 + (drone.batteryLevel / 100) * 5.5;
    }

    // Signal strength variation - much less noisy
    const baseSignal = drone.signalStrength;
    drone.signalStrength = baseSignal + (Math.random() - 0.5) * 2;
    
    // Update connection quality based on signal
    if (drone.signalStrength > -50) drone.connectionQuality = 'excellent';
    else if (drone.signalStrength > -70) drone.connectionQuality = 'good';
    else if (drone.signalStrength > -90) drone.connectionQuality = 'poor';
    else drone.connectionQuality = 'very_poor';

    // Temperature simulation - much less variation
    const baseTempVariation = (Math.random() - 0.5) * 0.5;
    drone.temperature = (drone.temperature || 28) + baseTempVariation;
    
    // Add heat from motors during flight - slower heating
    if (drone.status === 'active' || drone.status === 'in_flight') {
      drone.temperature = Math.min(50, (drone.temperature || 28) + 0.02);
    }

    // Humidity variation - much less noisy
    drone.humidity = Math.max(40, Math.min(85, (drone.humidity || 60) + (Math.random() - 0.5) * 1));
  }

  private updateMissionProgress(drone: DroneData) {
    if (drone.currentMission && (drone.status === 'active' || drone.status === 'in_flight')) {
      drone.currentMission.progress = Math.min(99, drone.currentMission.progress + 0.1 + Math.random() * 0.1);
      
      // Update ETA based on progress
      const remainingPercent = 100 - drone.currentMission.progress;
      const estimatedMinutes = Math.round(remainingPercent * 2); // 2 minutes per percent roughly
      const etaTime = new Date(Date.now() + estimatedMinutes * 60000);
      drone.currentMission.eta = etaTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  private simulateAlerts(drone: DroneData) {
    // Initialize alerts if not present
    drone.alerts = drone.alerts || [];

    // Only generate new alerts occasionally to prevent flashing (every 5-10 updates)
    const shouldCheckForNewAlerts = Math.random() < 0.1; // 10% chance per update cycle

    if (!shouldCheckForNewAlerts) {
      // Keep existing alerts stable - only remove very old ones (over 10 minutes old)
      drone.alerts = drone.alerts.filter(alert => {
        const alertAge = Date.now() - new Date(alert.timestamp).getTime();
        return alertAge < 600000; // Keep alerts for 10 minutes
      });
      return;
    }

    // Low battery alert - only if no existing battery alert
    if (drone.batteryLevel < 25 && !drone.alerts.some(a => a.category === 'battery')) {
      let severity: 'critical' | 'warning' | 'info';
      let message: string;
      
      if (drone.batteryLevel < 10) {
        severity = 'critical';
        message = `Critical battery level ${drone.batteryLevel.toFixed(1)}% - Land immediately!`;
      } else if (drone.batteryLevel < 15) {
        severity = 'critical';
        message = `Battery level ${drone.batteryLevel.toFixed(1)}% - Return to base immediately`;
      } else {
        severity = 'warning';
        message = `Battery level ${drone.batteryLevel.toFixed(1)}% - Consider returning to base`;
      }
      
      drone.alerts.unshift({
        id: `alert-battery-${drone.id}-${Date.now()}`,
        severity,
        message,
        timestamp: new Date().toISOString(),
        category: 'battery'
      });
    }

    // Remove battery alert if battery is good again
    if (drone.batteryLevel >= 30) {
      drone.alerts = drone.alerts.filter(a => a.category !== 'battery');
    }

    // High temperature alert - only if no existing temperature alert
    if ((drone.temperature || 0) > 40 && !drone.alerts.some(a => a.category === 'system' && a.message.includes('temperature'))) {
      drone.alerts.unshift({
        id: `alert-temp-${drone.id}-${Date.now()}`,
        severity: (drone.temperature || 0) > 45 ? 'critical' : 'warning',
        message: `Motor temperature elevated: ${drone.temperature?.toFixed(1)}°C`,
        timestamp: new Date().toISOString(),
        category: 'hardware'
      });
    }

    // Remove temperature alert if temperature is normal again
    if ((drone.temperature || 0) <= 38) {
      drone.alerts = drone.alerts.filter(a => !(a.category === 'hardware' && a.message.includes('temperature')));
    }

    // Keep alerts stable - limit to 5 total alerts
    if (drone.alerts.length > 5) {
      drone.alerts = drone.alerts.slice(0, 5);
    }
  }

  private detectEmergencyStates(drone: DroneData) {
    const now = new Date().toISOString();
    let emergencyTriggered = false;

    // Check for critical battery emergency (< 10%)
    if (drone.batteryLevel < 10 && !this.emergencyStates.has(`${drone.id}-critical_battery`)) {
      const emergency: EmergencyState = {
        id: `${drone.id}-critical_battery-${Date.now()}`,
        droneId: drone.id,
        type: 'critical_battery',
        severity: 'emergency',
        description: `Critical battery level ${drone.batteryLevel.toFixed(1)}% - Immediate emergency landing required`,
        triggeredAt: now,
        resolved: false,
        autoResponse: {
          action: 'emergency_landing',
          triggered: true,
          triggeredAt: now
        }
      };
      
      this.emergencyStates.set(`${drone.id}-critical_battery`, emergency);
      drone.emergencyState = emergency;
      drone.status = 'emergency';
      emergencyTriggered = true;
    }

    // Check for communication loss (very poor signal for extended period)
    if (drone.connectionQuality === 'very_poor' && drone.signalStrength < -95) {
      const existingComLoss = this.emergencyStates.get(`${drone.id}-communication_loss`);
      if (!existingComLoss) {
        const emergency: EmergencyState = {
          id: `${drone.id}-communication_loss-${Date.now()}`,
          droneId: drone.id,
          type: 'communication_loss',
          severity: 'critical',
          description: `Communication loss detected - Signal strength ${drone.signalStrength}dBm`,
          triggeredAt: now,
          resolved: false,
          autoResponse: {
            action: 'hover',
            triggered: true,
            triggeredAt: now
          }
        };
        
        this.emergencyStates.set(`${drone.id}-communication_loss`, emergency);
        drone.emergencyState = emergency;
        drone.status = 'emergency';
        emergencyTriggered = true;
      }
    }

    // Check for system failure (temperature too high)
    if ((drone.temperature || 0) > 50 && !this.emergencyStates.has(`${drone.id}-system_failure`)) {
      const emergency: EmergencyState = {
        id: `${drone.id}-system_failure-${Date.now()}`,
        droneId: drone.id,
        type: 'system_failure',
        severity: 'emergency',
        description: `System overheating detected - Temperature ${drone.temperature?.toFixed(1)}°C exceeds safe limits`,
        triggeredAt: now,
        resolved: false,
        autoResponse: {
          action: 'return_to_base',
          triggered: true,
          triggeredAt: now
        }
      };
      
      this.emergencyStates.set(`${drone.id}-system_failure`, emergency);
      drone.emergencyState = emergency;
      drone.status = 'emergency';
      emergencyTriggered = true;
    }

    // Check for collision risk (simulate randomly for demo)
    if (Math.random() < 0.001 && drone.status === 'in_flight') { // 0.1% chance per update
      const existingCollision = this.emergencyStates.get(`${drone.id}-collision_risk`);
      if (!existingCollision) {
        const emergency: EmergencyState = {
          id: `${drone.id}-collision_risk-${Date.now()}`,
          droneId: drone.id,
          type: 'collision_risk',
          severity: 'critical',
          description: `Collision risk detected - Another aircraft in proximity`,
          triggeredAt: now,
          resolved: false,
          autoResponse: {
            action: 'hover',
            triggered: true,
            triggeredAt: now
          }
        };
        
        this.emergencyStates.set(`${drone.id}-collision_risk`, emergency);
        drone.emergencyState = emergency;
        drone.status = 'emergency';
        emergencyTriggered = true;
      }
    }

    // Auto-resolve some emergency states when conditions improve
    this.checkEmergencyResolution(drone);

    // Generate emergency alerts when triggered
    if (emergencyTriggered && drone.emergencyState) {
      this.generateEmergencyAlert(drone, drone.emergencyState);
    }
  }

  private checkEmergencyResolution(drone: DroneData) {
    const emergenciesToResolve: string[] = [];

    this.emergencyStates.forEach((emergency, key) => {
      if (emergency.droneId !== drone.id || emergency.resolved) return;

      let shouldResolve = false;

      switch (emergency.type) {
        case 'critical_battery':
          // Battery emergency resolves when charging or battery improves significantly
          if (drone.status === 'charging' || drone.batteryLevel > 15) {
            shouldResolve = true;
          }
          break;
        
        case 'communication_loss':
          // Communication emergency resolves when signal improves
          if (drone.connectionQuality !== 'very_poor' && drone.signalStrength > -85) {
            shouldResolve = true;
          }
          break;
        
        case 'system_failure':
          // System failure resolves when temperature returns to normal
          if ((drone.temperature || 0) < 40) {
            shouldResolve = true;
          }
          break;
        
        case 'collision_risk':
          // Collision risk resolves after 30 seconds (simulated)
          const timeSinceTriggered = Date.now() - new Date(emergency.triggeredAt).getTime();
          if (timeSinceTriggered > 30000) { // 30 seconds
            shouldResolve = true;
          }
          break;
      }

      if (shouldResolve) {
        emergency.resolved = true;
        emergency.resolvedAt = new Date().toISOString();
        emergenciesToResolve.push(key);
        
        // Clear emergency state if this was the active emergency
        if (drone.emergencyState?.id === emergency.id) {
          drone.emergencyState = undefined;
          // Only change status back if not maintenance
          if (drone.status === 'emergency' && drone.id !== 'drone-005') {
            drone.status = drone.batteryLevel < 30 ? 'charging' : 'active';
          }
        }
      }
    });

    // Clean up resolved emergencies
    emergenciesToResolve.forEach(key => {
      this.emergencyStates.delete(key);
    });
  }

  private generateEmergencyAlert(drone: DroneData, emergency: EmergencyState) {
    drone.alerts = drone.alerts || [];
    
    // Check if we already have this emergency alert
    const existingAlert = drone.alerts.find(alert => 
      alert.category === 'emergency' && alert.message.includes(emergency.type.replace('_', ' '))
    );
    
    if (!existingAlert) {
      drone.alerts.unshift({
        id: `alert-emergency-${emergency.id}`,
        severity: emergency.severity === 'emergency' ? 'critical' : 'critical',
        message: `EMERGENCY: ${emergency.description}`,
        timestamp: emergency.triggeredAt,
        category: 'emergency'
      });
    }
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    console.log('🔧 Mock telemetry service stopped');
  }

  onDroneDataUpdate(callback: (drone: DroneData) => void) {
    this.onDroneUpdate = callback;
  }

  private performCoordinationCheck() {
    try {
      // Get collision alerts from coordination service
      const coordinationAlerts = coordinationService.checkCollisionRisks(mockDrones);
      
      // Apply avoidance maneuvers
      coordinationAlerts.forEach(alert => {
        if (alert.type === 'separation_violation' && alert.avoidanceAction) {
          const drone = mockDrones.find(d => d.id === alert.avoidanceAction!.droneId);
          if (drone) {
            // Apply the avoidance maneuver
            coordinationService.applyAvoidanceManeuver(drone, alert.avoidanceAction);
            
            // Add coordination alert to drone
            drone.alerts = drone.alerts || [];
            const existingCoordAlert = drone.alerts.find(a => a.category === 'coordination' && a.message.includes('avoidance'));
            
            if (!existingCoordAlert) {
              drone.alerts.unshift({
                id: `coord-${alert.id}-${Date.now()}`,
                severity: alert.severity === 'critical' ? 'critical' : 'warning',
                message: `Coordination: ${alert.avoidanceAction.action.replace('_', ' ')} maneuver (${alert.distance.toFixed(1)}m separation)`,
                timestamp: alert.timestamp,
                category: 'coordination'
              });
            }
          }
        } else if (alert.type === 'collision_warning') {
          // Add warning alerts to both drones
          alert.droneIds.forEach(droneId => {
            const drone = mockDrones.find(d => d.id === droneId);
            if (drone) {
              drone.alerts = drone.alerts || [];
              const existingWarning = drone.alerts.find(a => a.category === 'coordination' && a.message.includes('proximity'));
              
              if (!existingWarning) {
                drone.alerts.unshift({
                  id: `coord-warning-${droneId}-${Date.now()}`,
                  severity: 'warning',
                  message: `Coordination: Proximity warning - ${alert.distance.toFixed(1)}m to other drone`,
                  timestamp: alert.timestamp,
                  category: 'coordination'
                });
              }
            }
          });
        }
      });

      // Update coordination alerts
      this.coordinationAlerts = coordinationAlerts.filter(alert => !alert.resolved);

      // Log coordination status
      const status = coordinationService.getCoordinationStatus();
      if (status.activeWarnings.length > 0) {
        console.log(`🤝 Coordination: ${status.activeWarnings.length} active warnings, ${status.resolvedConflicts} resolved`);
      }

    } catch (error) {
      console.error('Error during coordination check:', error);
    }
  }

  private performChargingManagement() {
    try {
      // Update charging progress for occupied stations
      chargingService.updateChargingProgress();
      
      // Process automatic queue management
      chargingService.processAutoQueue(mockDrones);
      
      // Update drone statuses based on charging state
      this.updateDroneChargingStatuses();
      
      // Log charging status
      const stats = chargingService.getChargingStats();
      if (stats.totalInQueue > 0 || stats.occupiedStations > 0) {
        console.log(`🔋 Charging: ${stats.occupiedStations}/${stats.totalStations} stations occupied, ${stats.totalInQueue} in queue`);
      }
      
    } catch (error) {
      console.error('Error during charging management:', error);
    }
  }

  private updateDroneChargingStatuses() {
    mockDrones.forEach(drone => {
      // Check if drone is assigned to a charging station
      const chargingStations = chargingService.getChargingStations();
      const assignedStation = chargingStations.find(station => station.currentDrone === drone.id);
      
      if (assignedStation) {
        // Drone is charging
        if (drone.status !== 'charging') {
          drone.status = 'charging';
          
          // Add charging alert
          drone.alerts = drone.alerts || [];
          const existingChargingAlert = drone.alerts.find(a => a.category === 'charging');
          if (!existingChargingAlert) {
            drone.alerts.unshift({
              id: `charging-${drone.id}-${Date.now()}`,
              severity: 'info',
              message: `Charging at ${assignedStation.name} - ${assignedStation.estimatedTimeRemaining}min remaining`,
              timestamp: new Date().toISOString(),
              category: 'charging'
            });
          } else {
            // Update existing charging alert
            existingChargingAlert.message = `Charging at ${assignedStation.name} - ${assignedStation.estimatedTimeRemaining}min remaining`;
          }
        }
        
        // Simulate charging progress
        if (drone.batteryLevel < 90) {
          const chargingRate = assignedStation.chargingRate / 60; // Per second rate
          drone.batteryLevel = Math.min(90, drone.batteryLevel + (chargingRate * 8)); // 8 seconds per update
          drone.batteryVoltage = 18.0 + (drone.batteryLevel / 100) * 5.5;
        }
        
        // Update position to station location
        drone.position = assignedStation.position;
        drone.speed = 0;
        
      } else {
        // Check if drone is in charging queue
        const queueStatus = chargingService.getQueueStatus(drone.id);
        if (queueStatus) {
          // Add queue alert
          drone.alerts = drone.alerts || [];
          const existingQueueAlert = drone.alerts.find(a => a.category === 'charging' && a.message.includes('queue'));
          if (!existingQueueAlert) {
            drone.alerts.unshift({
              id: `queue-${drone.id}-${Date.now()}`,
              severity: queueStatus.priority >= 4 ? 'warning' : 'info',
              message: `Charging queue position ${queueStatus.queuePosition} (Priority: ${queueStatus.priority})`,
              timestamp: new Date().toISOString(),
              category: 'charging'
            });
          } else {
            // Update existing queue alert
            existingQueueAlert.message = `Charging queue position ${queueStatus.queuePosition} (Priority: ${queueStatus.priority})`;
          }
        } else {
          // Remove charging alerts if not charging or queued
          if (drone.alerts) {
            drone.alerts = drone.alerts.filter(a => a.category !== 'charging');
          }
          
          // If drone was charging and is now done, change status
          if (drone.status === 'charging' && drone.batteryLevel >= 85) {
            drone.status = drone.currentMission ? 'active' : 'idle';
            
            // Add charging complete alert
            drone.alerts = drone.alerts || [];
            drone.alerts.unshift({
              id: `charged-${drone.id}-${Date.now()}`,
              severity: 'info',
              message: `Charging complete - Battery: ${Math.round(drone.batteryLevel)}%`,
              timestamp: new Date().toISOString(),
              category: 'system'
            });
          }
        }
      }
    });
  }

  // Coordination Methods
  getCoordinationStatus() {
    return coordinationService.getCoordinationStatus();
  }

  getCoordinationAlerts(): CoordinationAlert[] {
    return this.coordinationAlerts;
  }

  // Charging Management Methods
  getChargingStats() {
    return chargingService.getChargingStats();
  }

  getChargingStations() {
    return chargingService.getChargingStations();
  }

  getChargingSchedules() {
    return chargingService.getChargingSchedules();
  }

  addDroneToChargingQueue(droneId: string, reason: 'low_battery' | 'scheduled' | 'pre_mission' | 'maintenance' | 'emergency' = 'scheduled') {
    const drone = mockDrones.find(d => d.id === droneId);
    if (!drone) return null;
    
    return chargingService.addToQueue(drone, reason);
  }

  removeDroneFromChargingQueue(droneId: string) {
    return chargingService.removeFromQueue(droneId);
  }

  // Emergency Response Methods
  triggerEmergencyResponse(droneId: string, responseType: 'return_to_base' | 'emergency_landing' | 'hover' | 'abort_mission') {
    const drone = mockDrones.find(d => d.id === droneId);
    if (!drone || !drone.emergencyState) {
      console.warn(`Cannot trigger emergency response for ${droneId}: drone not found or no emergency state`);
      return false;
    }

    // Update emergency state with operator override
    if (drone.emergencyState) {
      drone.emergencyState.operatorOverride = {
        action: responseType.replace('_', ' '),
        triggeredBy: 'operator',
        triggeredAt: new Date().toISOString()
      };

      // Add response alert
      drone.alerts = drone.alerts || [];
      drone.alerts.unshift({
        id: `alert-response-${droneId}-${Date.now()}`,
        severity: 'info',
        message: `Emergency response activated: ${responseType.replace('_', ' ')}`,
        timestamp: new Date().toISOString(),
        category: 'emergency'
      });

      console.log(`🚨 Emergency response triggered for ${droneId}: ${responseType}`);
      return true;
    }

    return false;
  }

  resolveEmergency(droneId: string, resolution: string) {
    const drone = mockDrones.find(d => d.id === droneId);
    if (!drone || !drone.emergencyState) {
      console.warn(`Cannot resolve emergency for ${droneId}: drone not found or no emergency state`);
      return false;
    }

    if (drone.emergencyState) {
      // Mark emergency as resolved
      drone.emergencyState.resolved = true;
      drone.emergencyState.resolvedAt = new Date().toISOString();

      // Update drone status back to normal
      if (drone.status === 'emergency') {
        drone.status = drone.batteryLevel < 30 ? 'charging' : 'active';
      }

      // Add resolution alert
      drone.alerts = drone.alerts || [];
      drone.alerts.unshift({
        id: `alert-resolved-${droneId}-${Date.now()}`,
        severity: 'info',
        message: `Emergency resolved: ${resolution}`,
        timestamp: new Date().toISOString(),
        category: 'emergency'
      });

      console.log(`✅ Emergency resolved for ${droneId}: ${resolution}`);
      return true;
    }

    return false;
  }

  getEmergencyStats() {
    const activeEmergencies = Array.from(this.emergencyStates.values())
      .filter(emergency => !emergency.resolved);
    
    const resolvedEmergencies = Array.from(this.emergencyStates.values())
      .filter(emergency => emergency.resolved);

    const emergencyTypes = activeEmergencies.reduce((acc, emergency) => {
      acc[emergency.type] = (acc[emergency.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      active: activeEmergencies.length,
      resolved: resolvedEmergencies.length,
      total: this.emergencyStates.size,
      byType: emergencyTypes,
      criticalCount: activeEmergencies.filter(e => e.severity === 'emergency').length
    };
  }
}

export const mockTelemetryService = new MockTelemetryService();

// Expose emergency response methods globally for testing
if (typeof window !== 'undefined') {
  (window as any).emergencyResponse = {
    trigger: (droneId: string, responseType: 'return_to_base' | 'emergency_landing' | 'hover' | 'abort_mission') => 
      mockTelemetryService.triggerEmergencyResponse(droneId, responseType),
    resolve: (droneId: string, resolution: string) => 
      mockTelemetryService.resolveEmergency(droneId, resolution),
    stats: () => mockTelemetryService.getEmergencyStats()
  };

  // Expose coordination methods for testing
  (window as any).coordination = {
    status: () => mockTelemetryService.getCoordinationStatus(),
    alerts: () => mockTelemetryService.getCoordinationAlerts(),
    setSeparation: (distance: number) => coordinationService.setSeparationDistance(distance),
    resolve: (alertId: string) => coordinationService.resolveAlert(alertId),
    maneuvers: () => Array.from(coordinationService.getActiveManeuvers().entries())
  };

  // Expose charging methods for testing
  (window as any).charging = {
    stats: () => mockTelemetryService.getChargingStats(),
    stations: () => mockTelemetryService.getChargingStations(),
    schedules: () => mockTelemetryService.getChargingSchedules(),
    addToQueue: (droneId: string, reason: 'emergency' | 'maintenance' | 'low_battery' | 'scheduled' | 'pre_mission' = 'scheduled') => mockTelemetryService.addDroneToChargingQueue(droneId, reason),
    removeFromQueue: (droneId: string) => mockTelemetryService.removeDroneFromChargingQueue(droneId),
    forceCharge: (droneId: string) => {
      // Force a drone to start charging immediately
      mockTelemetryService.addDroneToChargingQueue(droneId, 'emergency');
      console.log(`🔋 Force charging ${droneId} with emergency priority`);
    }
  };
}