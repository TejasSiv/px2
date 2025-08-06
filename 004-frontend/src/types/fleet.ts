// Core data types for the drone fleet management system

export interface Position {
  lat: number;
  lng: number;
  alt: number;
}

export interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  category?: string;
  acknowledged?: boolean;
  resolved?: boolean;
}

export interface FleetAlert extends Alert {
  droneId?: string;
  droneName?: string;
  type: 'system' | 'battery' | 'communication' | 'mission' | 'safety' | 'weather';
  priority: number;
  details?: {
    [key: string]: any;
  };
}

export interface Mission {
  id: string;
  name: string;
  progress: number;
  eta?: string;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled' | 'paused';
}

export interface Waypoint {
  id: string;
  position: Position;
  action: 'pickup' | 'delivery' | 'hover' | 'survey' | 'navigation';
  hoverTime?: number;
  completed?: boolean;
  notes?: string;
}

export interface MissionData extends Mission {
  waypoints: Waypoint[];
  currentWaypoint?: number;
  assignedDrone?: string;
  estimatedDuration?: number;
  actualDuration?: number;
  priority: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  description?: string;
}

export interface DroneData {
  id: string;
  name: string;
  status: 'idle' | 'active' | 'in_flight' | 'charging' | 'maintenance' | 'emergency';
  position: Position;
  batteryLevel: number;
  batteryVoltage?: number;
  speed: number;
  heading: number;
  signalStrength: number;
  connectionQuality?: 'excellent' | 'good' | 'poor' | 'very_poor';
  lastUpdate: string;
  currentMission?: Mission;
  alerts?: Alert[];
  
  // Additional telemetry data
  temperature?: number;
  humidity?: number;
  pressure?: number;
  flightMode?: string;
  armed?: boolean;
  autopilotEnabled?: boolean;
  
  // System info
  firmware?: string;
  hardware?: string;
  uptime?: string;
  
  // Performance metrics
  totalFlightTime?: number;
  totalMissions?: number;
  lastMaintenance?: string;
}

export interface FleetStats {
  totalDrones: number;
  activeDrones: number;
  chargingDrones: number;
  maintenanceDrones: number;
  idleDrones: number;
  averageBattery: number;
  totalAlerts: number;
  activeMissions: number;
  completedMissionsToday: number;
  fleetUtilization: number;
  systemStatus: 'operational' | 'degraded' | 'critical';
}

export interface TelemetryData {
  droneId: string;
  timestamp: string;
  position: Position;
  battery: {
    level: number;
    voltage: number;
    current: number;
    temperature: number;
  };
  sensors: {
    temperature: number;
    humidity: number;
    pressure: number;
    windSpeed?: number;
    windDirection?: number;
  };
  flight: {
    speed: number;
    heading: number;
    verticalSpeed: number;
    flightMode: string;
    armed: boolean;
    autopilotEnabled: boolean;
  };
  communication: {
    signalStrength: number;
    quality: 'excellent' | 'good' | 'poor' | 'very_poor';
    latency: number;
  };
  system: {
    cpuUsage?: number;
    memoryUsage?: number;
    diskUsage?: number;
    uptime: number;
  };
}

export interface ChargingStation {
  id: string;
  name: string;
  position: Position;
  status: 'available' | 'occupied' | 'maintenance' | 'offline';
  currentDrone?: string;
  queueLength: number;
  chargingPower: number;
  estimatedWaitTime?: number;
}

export interface WeatherConditions {
  timestamp: string;
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  visibility: number;
  conditions: 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog';
  flightSafety: 'safe' | 'caution' | 'unsafe';
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  services: {
    [serviceName: string]: {
      status: 'healthy' | 'degraded' | 'critical' | 'offline';
      responseTime?: number;
      uptime?: number;
      lastCheck: string;
    };
  };
  infrastructure: {
    database: 'healthy' | 'degraded' | 'critical';
    cache: 'healthy' | 'degraded' | 'critical';
    network: 'healthy' | 'degraded' | 'critical';
  };
  performance: {
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
    cpuUsage: number;
    memoryUsage: number;
  };
}