import { DroneData, MissionData, FleetAlert } from '@/types/fleet';

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
    batteryLevel: 45,
    batteryVoltage: 20.1,
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
    temperature: 45.2,
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

  constructor() {
    // Initialize flight patterns for each drone
    this.initializeFlightPatterns();
  }

  private initializeFlightPatterns() {
    // Alpha-1 - Circular patrol pattern
    this.droneFlightPatterns.set('drone-001', {
      type: 'circular',
      center: { lat: 37.7749, lng: -122.4194 },
      radius: 0.002, // ~200m
      currentAngle: 0,
      speed: 0.0001 // degrees per update
    });

    // Beta-2 - Stationary (charging)
    this.droneFlightPatterns.set('drone-002', {
      type: 'stationary',
      center: { lat: 37.7849, lng: -122.4094 },
      radius: 0,
      currentAngle: 0,
      speed: 0
    });

    // Charlie-3 - Linear patrol
    this.droneFlightPatterns.set('drone-003', {
      type: 'linear',
      start: { lat: 37.7649, lng: -122.4294 },
      end: { lat: 37.7549, lng: -122.4094 },
      progress: 0.3,
      direction: 1,
      speed: 0.01
    });

    // Delta-4 - Waypoint mission
    this.droneFlightPatterns.set('drone-004', {
      type: 'waypoint',
      waypoints: [
        { lat: 37.7549, lng: -122.4394 },
        { lat: 37.7649, lng: -122.4294 },
        { lat: 37.7749, lng: -122.4094 },
      ],
      currentWaypoint: 0,
      progress: 0.15,
      speed: 0.005
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
        }, index * 200); // 200ms between drone updates
      });
    }, 1500); // Update every 1.5 seconds
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

    // Simulate occasional alerts
    this.simulateAlerts(drone);

    // Always update timestamp
    drone.lastUpdate = new Date().toISOString();
  }

  private updatePosition(drone: DroneData, pattern: FlightPattern) {
    switch (pattern.type) {
      case 'circular':
        pattern.currentAngle += pattern.speed;
        drone.position.lat = pattern.center.lat + Math.cos(pattern.currentAngle) * pattern.radius;
        drone.position.lng = pattern.center.lng + Math.sin(pattern.currentAngle) * pattern.radius;
        drone.position.alt = 80 + Math.sin(pattern.currentAngle * 2) * 20; // Varying altitude
        drone.heading = (pattern.currentAngle * 180 / Math.PI + 90) % 360;
        drone.speed = 8 + Math.random() * 4; // 8-12 m/s
        break;

      case 'linear':
        const linear = pattern as LinearPattern;
        linear.progress += linear.direction * linear.speed;
        
        if (linear.progress >= 1 || linear.progress <= 0) {
          linear.direction *= -1; // Reverse direction
          linear.progress = Math.max(0, Math.min(1, linear.progress));
        }
        
        drone.position.lat = linear.start.lat + (linear.end.lat - linear.start.lat) * linear.progress;
        drone.position.lng = linear.start.lng + (linear.end.lng - linear.start.lng) * linear.progress;
        drone.position.alt = 60 + Math.sin(linear.progress * Math.PI) * 30;
        
        const deltaLat = linear.end.lat - linear.start.lat;
        const deltaLng = linear.end.lng - linear.start.lng;
        drone.heading = (Math.atan2(deltaLng, deltaLat) * 180 / Math.PI * linear.direction) % 360;
        drone.speed = 6 + Math.random() * 3;
        break;

      case 'waypoint':
        const waypoint = pattern as WaypointPattern;
        waypoint.progress += waypoint.speed;
        
        if (waypoint.progress >= 1) {
          waypoint.currentWaypoint = (waypoint.currentWaypoint + 1) % waypoint.waypoints.length;
          waypoint.progress = 0;
        }
        
        const currentWP = waypoint.waypoints[waypoint.currentWaypoint];
        const nextWP = waypoint.waypoints[(waypoint.currentWaypoint + 1) % waypoint.waypoints.length];
        
        drone.position.lat = currentWP.lat + (nextWP.lat - currentWP.lat) * waypoint.progress;
        drone.position.lng = currentWP.lng + (nextWP.lng - currentWP.lng) * waypoint.progress;
        drone.position.alt = 45 + Math.random() * 10;
        
        const wpDeltaLat = nextWP.lat - currentWP.lat;
        const wpDeltaLng = nextWP.lng - currentWP.lng;
        drone.heading = Math.atan2(wpDeltaLng, wpDeltaLat) * 180 / Math.PI;
        drone.speed = 5 + Math.random() * 3;
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
    // Battery drain simulation
    if (drone.status === 'active' || drone.status === 'in_flight') {
      drone.batteryLevel = Math.max(5, drone.batteryLevel - 0.08 - Math.random() * 0.05);
      drone.batteryVoltage = 18.0 + (drone.batteryLevel / 100) * 5.5;
    } else if (drone.status === 'charging') {
      drone.batteryLevel = Math.min(100, drone.batteryLevel + 0.3 + Math.random() * 0.2);
      drone.batteryVoltage = 18.0 + (drone.batteryLevel / 100) * 5.5;
    }

    // Signal strength variation
    const baseSignal = drone.signalStrength;
    drone.signalStrength = baseSignal + (Math.random() - 0.5) * 10;
    
    // Update connection quality based on signal
    if (drone.signalStrength > -50) drone.connectionQuality = 'excellent';
    else if (drone.signalStrength > -70) drone.connectionQuality = 'good';
    else if (drone.signalStrength > -90) drone.connectionQuality = 'poor';
    else drone.connectionQuality = 'very_poor';

    // Temperature simulation
    const baseTempVariation = (Math.random() - 0.5) * 2;
    drone.temperature = (drone.temperature || 28) + baseTempVariation;
    
    // Add heat from motors during flight
    if (drone.status === 'active' || drone.status === 'in_flight') {
      drone.temperature = Math.min(50, (drone.temperature || 28) + 0.1);
    }

    // Humidity variation
    drone.humidity = Math.max(40, Math.min(85, (drone.humidity || 60) + (Math.random() - 0.5) * 5));
  }

  private updateMissionProgress(drone: DroneData) {
    if (drone.currentMission && (drone.status === 'active' || drone.status === 'in_flight')) {
      drone.currentMission.progress = Math.min(99, drone.currentMission.progress + 0.2 + Math.random() * 0.3);
      
      // Update ETA based on progress
      const remainingPercent = 100 - drone.currentMission.progress;
      const estimatedMinutes = Math.round(remainingPercent * 2); // 2 minutes per percent roughly
      const etaTime = new Date(Date.now() + estimatedMinutes * 60000);
      drone.currentMission.eta = etaTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  private simulateAlerts(drone: DroneData) {
    // Low battery alert
    if (drone.batteryLevel < 20 && !drone.alerts?.some(a => a.category === 'battery')) {
      drone.alerts = drone.alerts || [];
      drone.alerts.unshift({
        id: `alert-battery-${Date.now()}`,
        severity: drone.batteryLevel < 15 ? 'critical' : 'warning',
        message: `Battery level ${drone.batteryLevel.toFixed(1)}% - ${drone.batteryLevel < 15 ? 'Return to base immediately' : 'Consider returning to base'}`,
        timestamp: new Date().toISOString(),
        category: 'battery'
      });
    }

    // High temperature alert
    if ((drone.temperature || 0) > 40 && !drone.alerts?.some(a => a.message.includes('temperature'))) {
      drone.alerts = drone.alerts || [];
      drone.alerts.unshift({
        id: `alert-temp-${Date.now()}`,
        severity: 'warning',
        message: `Temperature elevated: ${drone.temperature?.toFixed(1)}°C`,
        timestamp: new Date().toISOString(),
        category: 'system'
      });
    }

    // Remove old alerts (keep last 3)
    if (drone.alerts && drone.alerts.length > 3) {
      drone.alerts = drone.alerts.slice(0, 3);
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
}

export const mockTelemetryService = new MockTelemetryService();