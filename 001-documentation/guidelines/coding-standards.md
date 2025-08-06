# Multi-Drone Fleet Management: Coding Standards

## Document Information
- **Project**: Multi-Drone Delivery System
- **Version**: 1.0
- **Date**: July 2025
- **Purpose**: Comprehensive coding standards and best practices for all project components

---

## Table of Contents
1. [General Principles](#general-principles)
2. [TypeScript/JavaScript Standards](#typescriptjavascript-standards)
3. [Python/ROS2 Standards](#pythonros2-standards)
4. [Database Standards](#database-standards)
5. [API Design Standards](#api-design-standards)
6. [Docker and Infrastructure Standards](#docker-and-infrastructure-standards)
7. [Testing Standards](#testing-standards)
8. [Documentation Standards](#documentation-standards)
9. [Git Workflow Standards](#git-workflow-standards)
10. [Code Review Standards](#code-review-standards)

---

## General Principles

### Core Philosophy
- **Safety First**: All code must prioritize operational safety and data integrity
- **Readability Over Cleverness**: Code should be self-documenting and maintainable
- **Fail Fast**: Detect and report errors early rather than propagating bad state
- **Consistent Patterns**: Use established patterns throughout the codebase
- **Performance Awareness**: Consider performance implications in all decisions

### Universal Standards

#### Naming Conventions
- **Descriptive Names**: Use clear, descriptive names that explain purpose
- **Avoid Abbreviations**: Prefer `batteryPercentage` over `batPct`
- **Boolean Naming**: Use `is`, `has`, `can`, `should` prefixes (e.g., `isConnected`, `hasValidation`)
- **Constants**: Use SCREAMING_SNAKE_CASE for constants
- **Files/Modules**: Use kebab-case for file names (`drone-telemetry.service.ts`)

#### Error Handling
- **Never Ignore Errors**: All errors must be either handled or explicitly propagated
- **Meaningful Error Messages**: Include context about what was being attempted
- **Error Types**: Use specific error types rather than generic Error objects
- **Logging**: Always log errors with sufficient context for debugging

#### Comments and Documentation
- **Why, Not What**: Comments should explain reasoning, not restate code
- **Update with Changes**: Keep comments synchronized with code changes
- **Public API Documentation**: All public interfaces must have comprehensive documentation
- **TODO Comments**: Include ticket numbers and assignee (`// TODO(DRONE-123): @username`)

---

## TypeScript/JavaScript Standards

### File Organization

#### Frontend Structure
```
src/
├── components/
│   ├── fleet/
│   │   ├── FleetMap/
│   │   │   ├── FleetMap.tsx
│   │   │   ├── FleetMap.test.tsx
│   │   │   ├── FleetMap.styles.ts
│   │   │   └── index.ts
│   │   └── DroneCard/
│   └── shared/
├── hooks/
├── services/
├── store/
├── types/
└── utils/
```

#### Backend Structure
```
src/
├── controllers/
├── services/
├── models/
├── middleware/
├── routes/
├── types/
├── utils/
└── config/
```

### TypeScript Specific Standards

#### Type Definitions
```typescript
// ✅ Good: Comprehensive interface with documentation
interface DroneState {
  /** Unique identifier for the drone */
  droneId: string;
  /** Current battery percentage (0-100) */
  batteryPercentage: number;
  /** Current position coordinates */
  position: {
    latitude: number;
    longitude: number;
    altitude: number;
  };
  /** Connection status to ground control */
  connectionStatus: 'connected' | 'disconnected' | 'error';
  /** Current flight mode */
  flightMode: FlightMode;
  /** Whether drone is armed and ready for flight */
  isArmed: boolean;
  /** Current mission ID if assigned */
  missionId?: string;
  /** Last telemetry update timestamp */
  lastUpdate: Date;
}

// ❌ Bad: Vague, poorly documented interface
interface Drone {
  id: string;
  battery: number;
  pos: any;
  status: string;
}
```

#### Utility Types and Guards
```typescript
// Type guards for runtime validation
export function isDroneState(obj: unknown): obj is DroneState {
  return typeof obj === 'object' && 
         obj !== null &&
         typeof (obj as DroneState).droneId === 'string' &&
         typeof (obj as DroneState).batteryPercentage === 'number' &&
         (obj as DroneState).batteryPercentage >= 0 &&
         (obj as DroneState).batteryPercentage <= 100;
}

// Utility types for API responses
export type ApiResponse<T> = {
  success: true;
  data: T;
  timestamp: string;
} | {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
};
```

### React Component Standards

#### Component Structure
```typescript
// ✅ Good: Well-structured component with proper typing
interface FleetMapProps {
  /** Array of drones to display on map */
  drones: DroneState[];
  /** Selected drone ID for highlighting */
  selectedDroneId?: string;
  /** Callback when drone is selected */
  onDroneSelect: (droneId: string) => void;
  /** Map center coordinates */
  center?: {
    latitude: number;
    longitude: number;
  };
  /** Map zoom level (1-20) */
  zoom?: number;
}

export const FleetMap: React.FC<FleetMapProps> = ({
  drones,
  selectedDroneId,
  onDroneSelect,
  center = { latitude: 19.0760, longitude: 72.8777 },
  zoom = 12
}) => {
  // Custom hooks for component logic
  const { mapRef, isLoaded } = useMapSetup();
  const { droneMarkers } = useDroneMarkers(drones, selectedDroneId);
  
  // Early return for loading state
  if (!isLoaded) {
    return <FleetMapSkeleton />;
  }
  
  return (
    <div className="fleet-map-container">
      {/* Component JSX */}
    </div>
  );
};
```

#### Custom Hooks Pattern
```typescript
// ✅ Good: Reusable hook with proper error handling
export function useTelemetryStream(droneId: string) {
  const [telemetry, setTelemetry] = useState<DroneState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const websocket = new WebSocket(TELEMETRY_WS_URL);
    
    websocket.onopen = () => {
      setIsConnected(true);
      setError(null);
      websocket.send(JSON.stringify({
        type: 'subscribe',
        droneId
      }));
    };
    
    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'telemetry' && data.droneId === droneId) {
          setTelemetry(data.payload);
        }
      } catch (err) {
        setError('Failed to parse telemetry data');
      }
    };
    
    websocket.onerror = () => {
      setError('WebSocket connection failed');
      setIsConnected(false);
    };
    
    return () => {
      websocket.close();
    };
  }, [droneId]);
  
  return { telemetry, isConnected, error };
}
```

### Node.js Service Standards

#### Service Class Pattern
```typescript
// ✅ Good: Well-structured service with proper error handling
export class TelemetryService {
  private readonly logger = createLogger('TelemetryService');
  private readonly redis: Redis;
  private readonly db: Pool;
  
  constructor(
    private readonly config: TelemetryConfig,
    dependencies: {
      redis: Redis;
      database: Pool;
    }
  ) {
    this.redis = dependencies.redis;
    this.db = dependencies.database;
  }
  
  /**
   * Processes incoming telemetry data from ROS2 bridge
   * @param telemetryData Raw telemetry from drone
   * @returns Processed telemetry with validation status
   */
  async processTelemetry(telemetryData: RawTelemetryData): Promise<ProcessedTelemetry> {
    const startTime = Date.now();
    
    try {
      // Validate incoming data
      const validatedData = this.validateTelemetryData(telemetryData);
      
      // Store in hot cache (Redis)
      await this.storeInCache(validatedData);
      
      // Queue for database persistence
      await this.queueForPersistence(validatedData);
      
      // Emit real-time update
      this.emitTelemetryUpdate(validatedData);
      
      this.logger.info('Telemetry processed successfully', {
        droneId: telemetryData.droneId,
        processingTime: Date.now() - startTime
      });
      
      return validatedData;
      
    } catch (error) {
      this.logger.error('Failed to process telemetry', {
        droneId: telemetryData.droneId,
        error: error.message,
        processingTime: Date.now() - startTime
      });
      
      throw new TelemetryProcessingError(
        `Failed to process telemetry for drone ${telemetryData.droneId}`,
        { cause: error, droneId: telemetryData.droneId }
      );
    }
  }
  
  private validateTelemetryData(data: RawTelemetryData): ProcessedTelemetry {
    // Validation logic with specific error messages
    if (!data.droneId || typeof data.droneId !== 'string') {
      throw new ValidationError('Invalid or missing drone ID');
    }
    
    if (typeof data.batteryPercentage !== 'number' || 
        data.batteryPercentage < 0 || 
        data.batteryPercentage > 100) {
      throw new ValidationError('Battery percentage must be between 0 and 100');
    }
    
    // Additional validation...
    
    return {
      ...data,
      timestamp: new Date(),
      isValid: true
    };
  }
}
```

#### Error Classes
```typescript
// Custom error classes for better error handling
export class TelemetryProcessingError extends Error {
  constructor(
    message: string,
    public readonly context: {
      cause?: Error;
      droneId?: string;
      telemetryType?: string;
    }
  ) {
    super(message);
    this.name = 'TelemetryProcessingError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

---

## Python/ROS2 Standards

### File Organization
```
ros2_nodes/
├── fleet_coordinator/
│   ├── fleet_coordinator/
│   │   ├── __init__.py
│   │   ├── coordinator_node.py
│   │   ├── coordination_algorithms.py
│   │   └── safety_validator.py
│   ├── test/
│   ├── launch/
│   ├── config/
│   └── package.xml
```

### Python Coding Standards

#### Class Structure
```python
#!/usr/bin/env python3
"""
Fleet Coordinator Node for multi-drone coordination and safety management.

This module implements the central coordination system for managing multiple
autonomous drones, including collision avoidance, mission assignment, and
emergency response protocols.
"""

import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, DurabilityPolicy
from geometry_msgs.msg import PoseStamped
from std_msgs.msg import String
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import logging


class CoordinationEventType(Enum):
    """Types of coordination events that can occur in the fleet."""
    COLLISION_AVOIDANCE = "collision_avoidance"
    CHARGING_QUEUE = "charging_queue" 
    EMERGENCY_LANDING = "emergency_landing"
    AIRSPACE_CONFLICT = "airspace_conflict"


@dataclass
class DroneState:
    """Represents the current state of a drone in the fleet."""
    drone_id: str
    position: PoseStamped
    battery_percentage: float
    flight_mode: str
    is_armed: bool
    mission_id: Optional[str] = None
    last_update: float = 0.0
    
    def is_critical_battery(self) -> bool:
        """Check if drone has critically low battery."""
        return self.battery_percentage < 20.0
    
    def is_operational(self) -> bool:
        """Check if drone is in operational state."""
        return self.is_armed and self.battery_percentage > 15.0


class FleetCoordinator(Node):
    """
    Central coordination node for multi-drone fleet management.
    
    This node handles:
    - Real-time coordination between multiple drones
    - Collision avoidance algorithms
    - Emergency response coordination
    - Mission assignment optimization
    """
    
    def __init__(self) -> None:
        super().__init__('fleet_coordinator')
        
        # Configuration
        self.num_drones = 5
        self.safety_constraints = {
            'min_separation_distance_m': 50.0,
            'emergency_battery_threshold': 20.0,
            'collision_check_radius_m': 100.0
        }
        
        # State management
        self.drone_states: Dict[str, DroneState] = {}
        self.active_coordination_events: Dict[str, dict] = {}
        
        # Initialize logging
        self.logger = self.get_logger()
        
        # Initialize QoS profiles
        self.reliable_qos = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            durability=DurabilityPolicy.VOLATILE,
            depth=10
        )
        
        # Initialize ROS2 interfaces
        self._init_subscribers()
        self._init_publishers()
        self._init_timers()
        
        self.logger.info(f"Fleet Coordinator initialized for {self.num_drones} drones")
    
    def _init_subscribers(self) -> None:
        """Initialize all ROS2 subscribers for drone data."""
        for drone_id in range(self.num_drones):
            namespace = f"drone_{drone_id}"
            
            # Position subscriber
            self.create_subscription(
                PoseStamped,
                f"/{namespace}/mavros/local_position/pose",
                lambda msg, did=str(drone_id): self._update_drone_position(did, msg),
                self.reliable_qos
            )
            
            # Add other subscribers...
    
    def _update_drone_position(self, drone_id: str, position_msg: PoseStamped) -> None:
        """
        Update drone position and trigger coordination checks.
        
        Args:
            drone_id: Unique identifier for the drone
            position_msg: ROS2 position message from MAVROS
        """
        try:
            # Update drone state
            if drone_id not in self.drone_states:
                self.drone_states[drone_id] = DroneState(
                    drone_id=drone_id,
                    position=position_msg,
                    battery_percentage=100.0,  # Will be updated by battery callback
                    flight_mode="UNKNOWN",
                    is_armed=False
                )
            else:
                self.drone_states[drone_id].position = position_msg
                self.drone_states[drone_id].last_update = self.get_clock().now().nanoseconds / 1e9
            
            # Trigger coordination checks
            self._check_collision_risks(drone_id)
            
        except Exception as e:
            self.logger.error(f"Failed to update drone position for {drone_id}: {e}")
    
    def _check_collision_risks(self, updated_drone_id: str) -> None:
        """
        Check for potential collisions and initiate avoidance if needed.
        
        Args:
            updated_drone_id: ID of drone that just updated position
        """
        if updated_drone_id not in self.drone_states:
            return
        
        updated_drone = self.drone_states[updated_drone_id]
        
        for other_drone_id, other_drone in self.drone_states.items():
            if other_drone_id == updated_drone_id:
                continue
            
            # Calculate distance between drones
            distance = self._calculate_distance(
                updated_drone.position,
                other_drone.position
            )
            
            # Check if collision avoidance needed
            if distance < self.safety_constraints['min_separation_distance_m']:
                self._initiate_collision_avoidance(updated_drone, other_drone, distance)
    
    def _calculate_distance(self, pos1: PoseStamped, pos2: PoseStamped) -> float:
        """
        Calculate 3D distance between two positions.
        
        Args:
            pos1: First position
            pos2: Second position
            
        Returns:
            Distance in meters
        """
        dx = pos1.pose.position.x - pos2.pose.position.x
        dy = pos1.pose.position.y - pos2.pose.position.y
        dz = pos1.pose.position.z - pos2.pose.position.z
        
        return (dx**2 + dy**2 + dz**2)**0.5
    
    def _initiate_collision_avoidance(
        self, 
        drone1: DroneState, 
        drone2: DroneState, 
        current_distance: float
    ) -> None:
        """
        Initiate collision avoidance procedure for two drones.
        
        Args:
            drone1: First drone in potential collision
            drone2: Second drone in potential collision  
            current_distance: Current distance between drones
        """
        event_id = f"collision_{drone1.drone_id}_{drone2.drone_id}"
        
        # Check if event already exists
        if event_id in self.active_coordination_events:
            return
        
        # Create coordination event
        coordination_event = {
            'event_id': event_id,
            'event_type': CoordinationEventType.COLLISION_AVOIDANCE,
            'involved_drones': [drone1.drone_id, drone2.drone_id],
            'current_distance': current_distance,
            'min_safe_distance': self.safety_constraints['min_separation_distance_m'],
            'created_at': self.get_clock().now().nanoseconds / 1e9
        }
        
        self.active_coordination_events[event_id] = coordination_event
        
        # Determine avoidance strategy
        avoidance_action = self._calculate_avoidance_strategy(drone1, drone2, current_distance)
        
        # Execute avoidance maneuver
        self._execute_avoidance_maneuver(avoidance_action)
        
        self.logger.warn(
            f"Collision avoidance initiated between {drone1.drone_id} and {drone2.drone_id}. "
            f"Distance: {current_distance:.1f}m, Action: {avoidance_action['type']}"
        )
```

### ROS2 Specific Standards

#### Launch Files
```python
# ✅ Good: Well-documented launch file
from launch import LaunchDescription
from launch_ros.actions import Node
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration


def generate_launch_description():
    """
    Launch the complete fleet coordination system.
    
    This launch file starts all necessary nodes for multi-drone coordination
    including fleet coordinator, mission planner, and safety monitor.
    """
    
    # Declare launch arguments
    num_drones_arg = DeclareLaunchArgument(
        'num_drones',
        default_value='5',
        description='Number of drones in the fleet'
    )
    
    log_level_arg = DeclareLaunchArgument(
        'log_level',
        default_value='INFO',
        description='Logging level for all nodes'
    )
    
    # Node configurations
    fleet_coordinator_node = Node(
        package='fleet_coordinator',
        executable='coordinator_node',
        name='fleet_coordinator',
        parameters=[{
            'num_drones': LaunchConfiguration('num_drones'),
            'log_level': LaunchConfiguration('log_level'),
            'safety_constraints': {
                'min_separation_distance_m': 50.0,
                'emergency_battery_threshold': 20.0,
                'collision_check_radius_m': 100.0
            }
        }],
        output='screen'
    )
    
    return LaunchDescription([
        num_drones_arg,
        log_level_arg,
        fleet_coordinator_node,
    ])
```

---

## Database Standards

### PostgreSQL Schema Standards

#### Table Naming and Structure
```sql
-- ✅ Good: Well-documented table with proper constraints
CREATE TABLE drone_telemetry_current (
    -- Primary key using drone_id and timestamp for partitioning
    drone_id VARCHAR(50) NOT NULL REFERENCES drones(drone_id),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Position data with appropriate precision
    position_lat DECIMAL(10,8) NOT NULL CHECK (position_lat BETWEEN -90 AND 90),
    position_lng DECIMAL(11,8) NOT NULL CHECK (position_lng BETWEEN -180 AND 180),
    altitude_m DECIMAL(6,2) NOT NULL CHECK (altitude_m >= 0),
    
    -- System status with controlled values
    battery_percentage DECIMAL(5,2) NOT NULL CHECK (battery_percentage BETWEEN 0 AND 100),
    velocity_ms DECIMAL(5,2) NOT NULL CHECK (velocity_ms >= 0),
    heading_degrees DECIMAL(5,2) NOT NULL CHECK (heading_degrees BETWEEN 0 AND 360),
    flight_mode VARCHAR(50) NOT NULL,
    connection_status connection_status_enum NOT NULL,
    is_armed BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Optional mission reference
    mission_id UUID,
    
    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Composite primary key for partitioning strategy
    PRIMARY KEY (drone_id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create check constraint for data freshness
ALTER TABLE drone_telemetry_current 
ADD CONSTRAINT telemetry_not_future 
CHECK (timestamp <= CURRENT_TIMESTAMP + INTERVAL '1 minute');

-- Create indexes for common query patterns
CREATE INDEX idx_telemetry_current_drone_timestamp 
ON drone_telemetry_current (drone_id, timestamp DESC);

CREATE INDEX idx_telemetry_current_mission 
ON drone_telemetry_current (mission_id) 
WHERE mission_id IS NOT NULL;
```

#### Query Standards
```sql
-- ✅ Good: Optimized query with proper error handling
WITH recent_telemetry AS (
    SELECT 
        drone_id,
        position_lat,
        position_lng,
        altitude_m,
        battery_percentage,
        velocity_ms,
        flight_mode,
        connection_status,
        is_armed,
        mission_id,
        timestamp,
        -- Calculate time since last update
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - timestamp)) AS seconds_since_update,
        -- Rank by recency per drone
        ROW_NUMBER() OVER (PARTITION BY drone_id ORDER BY timestamp DESC) as rn
    FROM drone_telemetry_current
    WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '10 minutes'
),
current_positions AS (
    SELECT *
    FROM recent_telemetry
    WHERE rn = 1  -- Most recent telemetry per drone
)
SELECT 
    cp.drone_id,
    cp.position_lat,
    cp.position_lng,
    cp.altitude_m,
    cp.battery_percentage,
    cp.velocity_ms,
    cp.flight_mode,
    cp.connection_status,
    cp.is_armed,
    cp.mission_id,
    cp.timestamp,
    -- Data quality indicators
    CASE 
        WHEN cp.seconds_since_update > 30 THEN 'stale'
        WHEN cp.seconds_since_update > 60 THEN 'very_stale'
        ELSE 'fresh'
    END as data_quality,
    -- Mission information if available
    m.mission_type,
    m.status as mission_status,
    m.priority as mission_priority
FROM current_positions cp
LEFT JOIN missions m ON cp.mission_id = m.mission_id
ORDER BY cp.drone_id;
```

### Redis Standards

#### Key Naming Conventions
```javascript
// ✅ Good: Hierarchical key naming with TTL
const RedisKeys = {
  // Live telemetry data (30 second TTL)
  TELEMETRY_LIVE: (droneId: string) => `telemetry:live:${droneId}`,
  
  // Fleet aggregated status (10 second TTL)
  FLEET_STATUS: () => 'fleet:status:aggregate',
  
  // Mission progress tracking (no TTL - cleaned up on completion)
  MISSION_PROGRESS: (missionId: string) => `mission:progress:${missionId}`,
  
  // Coordination events (5 minute TTL)
  COORDINATION_EVENT: (eventId: string) => `coordination:event:${eventId}`,
  
  // Charging queue by station (no TTL - persistent)
  CHARGING_QUEUE: (stationId: string) => `charging:queue:${stationId}`,
  
  // Analytics cache (1 hour TTL)
  ANALYTICS_CACHE: (metricType: string, timeWindow: string) => 
    `analytics:${metricType}:${timeWindow}`,
};

// TTL constants
const REDIS_TTL = {
  TELEMETRY: 30,      // 30 seconds
  FLEET_STATUS: 10,   // 10 seconds
  COORDINATION: 300,  // 5 minutes
  ANALYTICS: 3600,    // 1 hour
} as const;
```

#### Data Structure Patterns
```javascript
// ✅ Good: Structured data with validation
class TelemetryCache {
  private redis: Redis;
  
  async storeDroneTelemetry(droneId: string, telemetry: DroneState): Promise<void> {
    const key = RedisKeys.TELEMETRY_LIVE(droneId);
    
    // Validate data before storage
    if (!this.isValidTelemetry(telemetry)) {
      throw new Error(`Invalid telemetry data for drone ${droneId}`);
    }
    
    // Store with structured format and TTL
    await this.redis.hset(key, {
      timestamp: telemetry.timestamp.toISOString(),
      position: JSON.stringify(telemetry.position),
      battery: telemetry.batteryPercentage.toString(),
      velocity: telemetry.velocity.toString(),
      heading: telemetry.heading.toString(),
      flightMode: telemetry.flightMode,
      isArmed: telemetry.isArmed.toString(),
      connectionStatus: telemetry.connectionStatus,
      missionId: telemetry.missionId || '',
    });
    
    // Set TTL
    await this.redis.expire(key, REDIS_TTL.TELEMETRY);
    
    // Update fleet-wide aggregates
    await this.updateFleetAggregates(droneId, telemetry);
  }
  
  private isValidTelemetry(telemetry: DroneState): boolean {
    return telemetry.droneId &&
           typeof telemetry.batteryPercentage === 'number' &&
           telemetry.batteryPercentage >= 0 &&
           telemetry.batteryPercentage <= 100 &&
           telemetry.position &&
           typeof telemetry.position.latitude === 'number' &&
           typeof telemetry.position.longitude === 'number';
  }
}
```

---

## API Design Standards

### RESTful API Conventions

#### URL Structure
```typescript
// ✅ Good: Consistent, hierarchical URL structure
const API_ROUTES = {
  // Resource collections
  DRONES: '/api/v1/drones',
  MISSIONS: '/api/v1/missions',
  ANALYTICS: '/api/v1/analytics',
  
  // Specific resources
  DRONE_DETAIL: (droneId: string) => `/api/v1/drones/${droneId}`,
  MISSION_DETAIL: (missionId: string) => `/api/v1/missions/${missionId}`,
  
  // Sub-resources
  DRONE_TELEMETRY: (droneId: string) => `/api/v1/drones/${droneId}/telemetry`,
  MISSION_WAYPOINTS: (missionId: string) => `/api/v1/missions/${missionId}/waypoints`,
  
  // Actions (prefer POST for non-idempotent operations)
  EMERGENCY_STOP: '/api/v1/emergency/stop',
  MISSION_START: (missionId: string) => `/api/v1/missions/${missionId}/start`,
  DRONE_RTL: (droneId: string) => `/api/v1/drones/${droneId}/return-to-launch`,
  
  // System endpoints
  HEALTH: '/api/health',
  METRICS: '/api/metrics',
  CONFIG: '/api/v1/config',
} as const;
```

#### Response Format Standards
```typescript
// ✅ Good: Consistent response format with proper typing
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    pagination?: PaginationMeta;
    timing?: {
      requestId: string;
      processingTimeMs: number;
    };
    version: string;
  };
  timestamp: string;
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    field?: string; // For validation errors
  };
  meta: {
    requestId: string;
    version: string;
  };
  timestamp: string;
}

// Example implementation
export class ApiResponseBuilder {
  static success<T>(data: T, meta?: Partial<ApiSuccessResponse<T>['meta']>): ApiSuccessResponse<T> {
    return {
      success: true,
      data,
      meta: {
        version: process.env.API_VERSION || '1.0.0',
        timing: {
          requestId: generateRequestId(),
          processingTimeMs: Date.now() - (meta?.timing?.startTime || Date.now()),
        },
        ...meta,
      },
      timestamp: new Date().toISOString(),
    };
  }
  
  static error(
    code: string,
    message: string,
    details?: Record<string, unknown>,
    field?: string
  ): ApiErrorResponse {
    return {
      success: false,
      error: {
        code,
        message,
        details,
        field,
      },
      meta: {
        requestId: generateRequestId(),
        version: process.env.API_VERSION || '1.0.0',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
```

#### Request Validation
```typescript
// ✅ Good: Comprehensive input validation with Zod
import { z } from 'zod';

// Validation schemas
const DroneIdSchema = z.string().regex(/^drone_[0-9]+$/, 'Invalid drone ID format');

const CreateMissionSchema = z.object({
  assignedDroneId: DroneIdSchema.optional(),
  missionType: z.enum(['pickup', 'delivery', 'patrol', 'maintenance', 'emergency']),
  priority: z.number().min(1).max(10),
  scheduledStart: z.string().datetime().optional(),
  payloadWeightKg: z.number().min(0).max(10),
  waypoints: z.array(z.object({
    sequenceOrder: z.number().positive(),
    coordinates: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      altitude: z.number().min(0).max(500),
    }),
    actionRequired: z.string().min(1).max(200),
    durationMinutes: z.number().min(1).max(60).default(5),
  })).min(1),
  specialInstructions: z.string().max(1000).optional(),
});

// Middleware for validation
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData; // Replace with validated data
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        return res.status(400).json(
          ApiResponseBuilder.error(
            'VALIDATION_ERROR',
            'Request validation failed',
            { validationErrors }
          )
        );
      }
      
      return res.status(500).json(
        ApiResponseBuilder.error(
          'INTERNAL_ERROR',
          'Internal server error during validation'
        )
      );
    }
  };
};
```

### WebSocket Standards

#### Message Format
```typescript
// ✅ Good: Structured WebSocket message format
interface WebSocketMessage<T = unknown> {
  /** Message type for routing */
  type: 'telemetry' | 'mission' | 'coordination' | 'analytics' | 'alert' | 'command';
  /** Target drone ID (null for fleet-wide messages) */
  droneId: string | null;
  /** Message timestamp in ISO format */
  timestamp: string;
  /** Message payload */
  data: T;
  /** Unique message ID for tracking */
  messageId: string;
  /** Message priority (1=low, 5=normal, 10=critical) */
  priority: number;
}

// Specific message types
interface TelemetryMessage extends WebSocketMessage<DroneState> {
  type: 'telemetry';
  droneId: string; // Always present for telemetry
}

interface AlertMessage extends WebSocketMessage<{
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'battery' | 'weather' | 'system' | 'coordination';
  message: string;
  actionRequired: boolean;
  autoResolved: boolean;
  affectedSystems?: string[];
}> {
  type: 'alert';
  priority: 8 | 9 | 10; // Alerts are always high priority
}

// WebSocket service implementation
export class FleetWebSocketService {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  
  broadcastToSubscribers(message: WebSocketMessage): void {
    const serializedMessage = JSON.stringify(message);
    
    this.clients.forEach((client, clientId) => {
      // Check if client is subscribed to this message type
      if (this.isClientSubscribed(client, message)) {
        try {
          client.socket.send(serializedMessage);
        } catch (error) {
          this.logger.error(`Failed to send message to client ${clientId}`, error);
          this.removeClient(clientId);
        }
      }
    });
  }
  
  private isClientSubscribed(client: ClientConnection, message: WebSocketMessage): boolean {
    // Priority messages always sent
    if (message.priority >= 8) {
      return true;
    }
    
    // Check subscriptions
    if (message.type === 'telemetry' && client.subscriptions.has(`telemetry:${message.droneId}`)) {
      return true;
    }
    
    if (client.subscriptions.has(`type:${message.type}`)) {
      return true;
    }
    
    return false;
  }
}
```

---

## Docker and Infrastructure Standards

### Dockerfile Standards

```dockerfile
# ✅ Good: Multi-stage Dockerfile with security best practices
# Build stage
FROM node:18-alpine AS builder

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci --only=production=false

# Copy source code
COPY src/ ./src/
COPY public/ ./public/

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Use non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]
```

### Docker Compose Standards

```yaml
# ✅ Good: Well-structured docker-compose with proper networking
version: '3.8'

services:
  # Database services
  postgres:
    image: postgres:15-alpine
    container_name: drone-fleet-postgres
    environment:
      POSTGRES_DB: drone_fleet
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-dev_password}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d:ro
    ports:
      - "5432:5432"
    networks:
      - drone-fleet-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: drone-fleet-redis
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - drone-fleet-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  # Simulation services
  gazebo:
    build:
      context: ./simulation/gazebo
      dockerfile: Dockerfile
    container_name: drone-fleet-gazebo
    environment:
      DISPLAY: ${DISPLAY:-:0}
      GAZEBO_MODEL_PATH: /opt/gazebo/models
    volumes:
      - /tmp/.X11-unix:/tmp/.X11-unix:rw
      - ./simulation/worlds:/opt/gazebo/worlds:ro
      - ./simulation/models:/opt/gazebo/models:ro
    networks:
      - drone-fleet-network
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  # Individual drone containers
  drone-0:
    build:
      context: ./simulation/px4
      dockerfile: Dockerfile
    container_name: drone-fleet-drone-0
    environment:
      PX4_SIM_MODEL: quadrotor
      PX4_ESTIMATOR: ekf2
      DRONE_ID: drone_0
      MAVLINK_PORT: 14550
      ROS_DOMAIN_ID: 0
    networks:
      - drone-fleet-network
    depends_on:
      gazebo:
        condition: service_started
    restart: unless-stopped

  # Backend services
  api-gateway:
    build:
      context: ./backend/api-gateway
      dockerfile: Dockerfile
    container_name: drone-fleet-api-gateway
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      PORT: 3000
      DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-dev_password}@postgres:5432/drone_fleet
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET:-dev_jwt_secret}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    ports:
      - "3000:3000"
    networks:
      - drone-fleet-network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  # Frontend service
  dashboard:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: drone-fleet-dashboard
    environment:
      REACT_APP_API_URL: ${REACT_APP_API_URL:-http://localhost:3000/api}
      REACT_APP_WS_URL: ${REACT_APP_WS_URL:-ws://localhost:3000}
    ports:
      - "3001:3000"
    networks:
      - drone-fleet-network
    depends_on:
      - api-gateway
    restart: unless-stopped

# Network configuration
networks:
  drone-fleet-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

# Volume configuration
volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
```

---

## Testing Standards

### Unit Testing Standards

#### Jest Configuration
```typescript
// ✅ Good: Comprehensive test configuration
// jest.config.ts
import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/*.interface.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testTimeout: 10000,
  verbose: true,
};

export default config;
```

#### Test Structure
```typescript
// ✅ Good: Well-structured test with proper setup/teardown
describe('TelemetryService', () => {
  let telemetryService: TelemetryService;
  let mockRedis: jest.Mocked<Redis>;
  let mockDatabase: jest.Mocked<Pool>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    // Create mocks
    mockRedis = createMockRedis();
    mockDatabase = createMockDatabase();
    mockLogger = createMockLogger();

    // Initialize service with mocks
    telemetryService = new TelemetryService(
      testConfig,
      {
        redis: mockRedis,
        database: mockDatabase,
        logger: mockLogger,
      }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processTelemetry', () => {
    it('should successfully process valid telemetry data', async () => {
      // Arrange
      const mockTelemetryData: RawTelemetryData = {
        droneId: 'drone_0',
        batteryPercentage: 75.5,
        position: {
          latitude: 19.0760,
          longitude: 72.8777,
          altitude: 120.5,
        },
        velocity: 12.8,
        heading: 145.2,
        flightMode: 'AUTO.MISSION',
        isArmed: true,
        timestamp: new Date(),
      };

      mockRedis.hset.mockResolvedValue(1);
      mockDatabase.query.mockResolvedValue({ rows: [], rowCount: 1 });

      // Act
      const result = await telemetryService.processTelemetry(mockTelemetryData);

      // Assert
      expect(result).toBeDefined();
      expect(result.droneId).toBe('drone_0');
      expect(result.isValid).toBe(true);
      
      // Verify Redis cache was updated
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'telemetry:live:drone_0',
        expect.objectContaining({
          battery: '75.5',
          position: JSON.stringify(mockTelemetryData.position),
        })
      );

      // Verify database write was queued
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO drone_telemetry_current'),
        expect.any(Array)
      );

      // Verify logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Telemetry processed successfully',
        expect.objectContaining({
          droneId: 'drone_0',
          processingTime: expect.any(Number),
        })
      );
    });

    it('should reject telemetry with invalid battery percentage', async () => {
      // Arrange
      const invalidTelemetryData: RawTelemetryData = {
        droneId: 'drone_0',
        batteryPercentage: 150, // Invalid: > 100
        position: {
          latitude: 19.0760,
          longitude: 72.8777,
          altitude: 120.5,
        },
        velocity: 12.8,
        heading: 145.2,
        flightMode: 'AUTO.MISSION',
        isArmed: true,
        timestamp: new Date(),
      };

      // Act & Assert
      await expect(
        telemetryService.processTelemetry(invalidTelemetryData)
      ).rejects.toThrow(ValidationError);

      // Verify no Redis or database operations occurred
      expect(mockRedis.hset).not.toHaveBeenCalled();
      expect(mockDatabase.query).not.toHaveBeenCalled();

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process telemetry',
        expect.objectContaining({
          droneId: 'drone_0',
          error: expect.stringContaining('Battery percentage must be between 0 and 100'),
        })
      );
    });

    it('should handle Redis connection failure gracefully', async () => {
      // Arrange
      const mockTelemetryData: RawTelemetryData = createValidTelemetryData();
      mockRedis.hset.mockRejectedValue(new Error('Redis connection failed'));

      // Act & Assert
      await expect(
        telemetryService.processTelemetry(mockTelemetryData)
      ).rejects.toThrow(TelemetryProcessingError);

      // Verify error handling
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to process telemetry',
        expect.objectContaining({
          droneId: mockTelemetryData.droneId,
          error: 'Redis connection failed',
        })
      );
    });
  });

  describe('getTelemetryHistory', () => {
    it('should return paginated telemetry history', async () => {
      // Arrange
      const mockHistoryData = [
        createMockTelemetryRecord('drone_0', new Date('2025-07-23T10:00:00Z')),
        createMockTelemetryRecord('drone_0', new Date('2025-07-23T10:01:00Z')),
      ];

      mockDatabase.query.mockResolvedValueOnce({
        rows: mockHistoryData,
        rowCount: 2,
      });

      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ total_count: '50' }],
        rowCount: 1,
      });

      // Act
      const result = await telemetryService.getTelemetryHistory('drone_0', {
        startTime: new Date('2025-07-23T09:00:00Z'),
        endTime: new Date('2025-07-23T11:00:00Z'),
        limit: 10,
        offset: 0,
      });

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.pagination.totalCount).toBe(50);
      expect(result.pagination.hasMore).toBe(true);
      
      // Verify query was called with correct parameters
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM drone_telemetry_current'),
        expect.arrayContaining(['drone_0'])
      );
    });
  });
});

// Test utilities
function createMockRedis(): jest.Mocked<Redis> {
  return {
    hset: jest.fn(),
    hget: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
    pipeline: jest.fn().mockReturnValue({
      hset: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    }),
  } as any;
}

function createValidTelemetryData(overrides: Partial<RawTelemetryData> = {}): RawTelemetryData {
  return {
    droneId: 'drone_0',
    batteryPercentage: 75.5,
    position: {
      latitude: 19.0760,
      longitude: 72.8777,
      altitude: 120.5,
    },
    velocity: 12.8,
    heading: 145.2,
    flightMode: 'AUTO.MISSION',
    isArmed: true,
    timestamp: new Date(),
    ...overrides,
  };
}
```

### Integration Testing Standards

```typescript
// ✅ Good: Integration test with real dependencies
describe('Fleet Coordination Integration', () => {
  let testApp: TestApplication;
  let testDatabase: TestDatabase;
  let testRedis: TestRedis;

  beforeAll(async () => {
    // Start test environment
    testApp = await createTestApplication();
    testDatabase = await createTestDatabase();
    testRedis = await createTestRedis();
    
    // Run migrations
    await testDatabase.migrate();
    
    // Seed test data
    await testDatabase.seed('basic-fleet-setup');
  });

  afterAll(async () => {
    await testDatabase.cleanup();
    await testRedis.cleanup();
    await testApp.shutdown();
  });

  describe('End-to-End Mission Flow', () => {
    it('should complete a full delivery mission successfully', async () => {
      // Arrange: Create test mission
      const missionData = {
        missionType: 'delivery',
        priority: 5,
        waypoints: [
          {
            sequenceOrder: 1,
            coordinates: { latitude: 19.0800, longitude: 72.8800, altitude: 100 },
            actionRequired: 'pickup_package',
            durationMinutes: 3,
          },
          {
            sequenceOrder: 2,
            coordinates: { latitude: 19.0900, longitude: 72.8900, altitude: 100 },
            actionRequired: 'deliver_package',
            durationMinutes: 2,
          },
        ],
      };

      // Act: Submit mission via API
      const createResponse = await testApp.request()
        .post('/api/v1/missions')
        .send(missionData)
        .expect(201);

      const missionId = createResponse.body.data.missionId;

      // Wait for automatic drone assignment
      await testApp.waitForCondition(
        async () => {
          const mission = await testDatabase.findMission(missionId);
          return mission.assignedDroneId !== null;
        },
        { timeout: 5000, interval: 100 }
      );

      // Start mission
      await testApp.request()
        .post(`/api/v1/missions/${missionId}/start`)
        .expect(200);

      // Wait for mission completion
      await testApp.waitForCondition(
        async () => {
          const mission = await testDatabase.findMission(missionId);
          return mission.status === 'completed';
        },
        { timeout: 30000, interval: 1000 }
      );

      // Assert: Verify mission results
      const completedMission = await testDatabase.findMission(missionId);
      expect(completedMission.status).toBe('completed');
      expect(completedMission.completedAt).toBeDefined();

      // Verify all waypoints were completed
      const waypoints = await testDatabase.findMissionWaypoints(missionId);
      expect(waypoints.every(wp => wp.completionStatus === 'completed')).toBe(true);

      // Verify telemetry was recorded
      const telemetryRecords = await testDatabase.getTelemetryDuringMission(
        completedMission.assignedDroneId,
        completedMission.actualStart,
        completedMission.completedAt
      );
      expect(telemetryRecords.length).toBeGreaterThan(10);

      // Verify analytics were updated
      const analytics = await testRedis.get('analytics:live');
      expect(JSON.parse(analytics).missions_completed_today).toBeGreaterThan(0);
    });
  });
});
```

---

## Documentation Standards

### Code Documentation

#### JSDoc Standards
```typescript
/**
 * Calculates optimal route for multi-stop delivery mission considering multiple constraints.
 * 
 * This function implements a multi-constraint optimization algorithm that considers:
 * - Battery consumption and range limitations
 * - Payload capacity and weight distribution
 * - Weather conditions and flight safety
 * - Time windows for pickup/delivery appointments
 * - Restricted airspace and no-fly zones
 * 
 * @param missionWaypoints - Array of waypoints to visit in order
 * @param droneCapabilities - Current drone capabilities and status
 * @param realTimeConditions - Current weather and environmental conditions
 * @param constraints - Configuration for constraint weights and limits
 * 
 * @returns Promise resolving to optimized route with alternatives
 * 
 * @throws {RouteOptimizationError} When no valid route can be calculated
 * @throws {ValidationError} When input parameters are invalid
 * 
 * @example
 * ```typescript
 * const waypoints = [
 *   { coordinates: { lat: 19.0800, lng: 72.8800 }, action: 'pickup' },
 *   { coordinates: { lat: 19.0900, lng: 72.8900 }, action: 'delivery' }
 * ];
 * 
 * const route = await calculateOptimalRoute(
 *   waypoints,
 *   droneCapabilities,
 *   currentWeather,
 *   optimizationConfig
 * );
 * 
 * console.log(`Estimated duration: ${route.estimatedDuration} minutes`);
 * ```
 * 
 * @since 1.0.0
 * @see {@link RouteConstraint} for constraint configuration options
 * @see {@link DroneCapabilities} for drone capability parameters
 */
async function calculateOptimalRoute(
  missionWaypoints: Waypoint[],
  droneCapabilities: DroneCapabilities,
  realTimeConditions: EnvironmentalConditions,
  constraints: RouteConstraint[]
): Promise<OptimizedRoute> {
  // Implementation...
}
```

#### README Standards
```markdown
# 🚁 Multi-Drone Fleet Management System

## Overview

A professional-grade multi-drone delivery simulation system demonstrating enterprise-level fleet management capabilities, real-time coordination, and advanced analytics for autonomous delivery operations.

## 🌟 Key Features

- **Multi-Drone Fleet Management**: Simultaneous control and monitoring of 5 independent drones
- **Real-Time Telemetry**: Live position tracking with interactive 3D map visualization  
- **Intelligent Mission Planning**: Automated route optimization for multi-stop deliveries
- **Safety-First Operations**: Comprehensive safety validation and emergency response
- **Advanced Analytics**: Performance insights and operational efficiency metrics

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- Python 3.8+ (for ROS2 development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/drone-fleet-management.git
   cd drone-fleet-management
   ```

2. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the system**
   ```bash
   docker-compose up -d
   ```

4. **Access the dashboard**
   - Open http://localhost:3001 in your browser
   - Default login: admin/admin (development only)

### First Mission

1. Navigate to the Fleet Dashboard
2. Verify all 5 drones are connected and operational
3. Click "Create Mission" and select delivery waypoints
4. Monitor real-time progress on the map

## 📖 Documentation

- [Architecture Documentation](./docs/architecture/)
- [API Reference](./docs/api/)
- [Development Guide](./docs/development/)
- [Deployment Guide](./docs/deployment/)

## 🛠️ Development

### Local Development Setup

1. **Install dependencies**
   ```bash
   npm install
   cd frontend && npm install
   ```

2. **Start development services**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d postgres redis
   ```

3. **Run in development mode**
   ```bash
   npm run dev          # Backend services
   npm run dev:frontend # Frontend dashboard
   ```

### Testing

```bash
npm test              # Unit tests
npm run test:integration  # Integration tests
npm run test:e2e     # End-to-end tests
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           Web Dashboard                 │
│    React + TypeScript + Tailwind       │
└─────────────────┬───────────────────────┘
                  │ WebSocket + REST API
┌─────────────────┴───────────────────────┐
│         API Gateway                     │
│    Node.js + Express + Microservices    │
└─────────────────┬───────────────────────┘
                  │ ROS2 Topics/Services
┌─────────────────┴───────────────────────┐
│        Fleet Coordination               │
│     ROS2 + PX4 + Gazebo Simulation      │
└─────────────────────────────────────────┘
```

## 🤝 Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and development process.

## 📄 License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) file for details.
```

---

## Git Workflow Standards

### Branch Naming Convention

```bash
# ✅ Good: Descriptive branch names with prefixes
git checkout -b feature/mission-waypoint-modification
git checkout -b bugfix/telemetry-websocket-disconnect
git checkout -b hotfix/emergency-landing-validation
git checkout -b docs/api-endpoint-documentation
git checkout -b refactor/database-connection-pooling
git checkout -b test/integration-mission-flow

# ❌ Bad: Vague or inconsistent branch names
git checkout -b fix-bug
git checkout -b new-feature
git checkout -b john-updates
```

### Commit Message Standards

```bash
# ✅ Good: Clear, structured commit messages
git commit -m "feat(telemetry): add real-time battery monitoring with alerts

- Implement battery percentage tracking with 5-second updates
- Add critical battery alerts at 20% threshold
- Include battery trend analysis for predictive warnings
- Update WebSocket message format to include battery data

Closes #DRONE-123"

git commit -m "fix(coordination): resolve collision detection false positives

The collision detection algorithm was triggering false positives
when drones were at different altitudes. Updated the 3D distance
calculation to properly account for altitude differences.

- Fix 3D distance calculation in collision detection
- Add altitude difference threshold of 20m minimum separation
- Update unit tests for collision detection scenarios
- Add integration test for multi-altitude flight paths

Fixes #DRONE-456"

git commit -m "docs(api): update mission management endpoint documentation

- Add examples for multi-waypoint mission creation
- Document error responses for validation failures
- Include rate limiting information
- Add authentication requirements

Related to #DRONE-789"

# ❌ Bad: Vague or poorly formatted commits
git commit -m "fix bug"
git commit -m "update code"
git commit -m "WIP"
```

### Pull Request Standards

```markdown
## 🚁 [DRONE-123] Add Real-time Battery Monitoring

### Summary
Implements comprehensive battery monitoring system with real-time alerts and predictive analysis for fleet safety management.

### Changes Made
- ✅ Added battery percentage tracking with 5-second WebSocket updates
- ✅ Implemented critical battery alerts at configurable thresholds (20% default)
- ✅ Created battery trend analysis for predictive maintenance
- ✅ Updated telemetry service with battery data processing
- ✅ Added comprehensive unit and integration tests

### Technical Details
**Backend Changes:**
- Modified `TelemetryService` to process battery data with validation
- Updated WebSocket message format to include battery trends
- Added Redis caching for battery alert states
- Implemented configurable alert thresholds via environment variables

**Frontend Changes:**
- Created `BatteryIndicator` component with visual alert states
- Added battery trend charts to drone detail views
- Implemented real-time battery alerts in notification system
- Updated fleet map to show battery status via color coding

**Database Changes:**
- Added battery trend tracking to `drone_telemetry_snapshots` table
- Created indexes for efficient battery history queries
- Added migration script for new battery alert configuration

### Testing
- ✅ Unit tests: 95% coverage for new battery monitoring components
- ✅ Integration tests: End-to-end battery alert flow validation
- ✅ Performance tests: Confirmed <100ms response time for battery queries
- ✅ Manual testing: Validated alert notifications across all severity levels

### Performance Impact
- Minimal: <5ms additional processing time per telemetry update
- Memory: +2MB for battery trend caching per drone
- Network: +50 bytes per WebSocket message for battery data

### Screenshots
![Battery Monitoring Dashboard](./docs/images/battery-monitoring-dashboard.png)
![Alert Notification System](./docs/images/battery-alerts.png)

### Deployment Notes
- Requires Redis cache flush for new alert configuration
- Environment variable `BATTERY_ALERT_THRESHOLD` defaults to 20%
- Feature flag `ENABLE_BATTERY_PREDICTION` controls trend analysis

### Related Issues
- Closes #DRONE-123: Real-time battery monitoring
- Addresses #DRONE-145: Predictive maintenance alerts
- Related to #DRONE-167: Fleet safety improvements

### Checklist
- [x] Code follows project coding standards
- [x] Unit tests added/updated with >90% coverage
- [x] Integration tests verify end-to-end functionality
- [x] Documentation updated (API docs, README)
- [x] Performance impact assessed and documented
- [x] Security implications reviewed
- [x] Database migrations tested
- [x] Feature flags configured appropriately
- [x] Monitoring/alerting updated for new metrics
```

---

## Code Review Standards

### Review Process

#### Reviewer Responsibilities
- **Functionality**: Verify code meets requirements and works as intended
- **Code Quality**: Ensure adherence to coding standards and best practices
- **Security**: Identify potential security vulnerabilities or data exposure
- **Performance**: Assess performance implications and optimization opportunities
- **Maintainability**: Evaluate code clarity, documentation, and future maintenance
- **Testing**: Verify adequate test coverage and quality

#### Review Checklist Template
```markdown
## Code Review Checklist

### Functionality ✅
- [ ] Code implements requirements correctly
- [ ] Edge cases are handled appropriately
- [ ] Error handling is comprehensive
- [ ] Business logic is sound

### Code Quality ✅
- [ ] Follows established coding standards
- [ ] Variable/function names are descriptive
- [ ] Code is properly structured and organized
- [ ] No code duplication or redundancy
- [ ] Comments explain "why" not "what"

### Security 🔒
- [ ] Input validation is thorough
- [ ] No sensitive data exposed in logs
- [ ] Authentication/authorization properly implemented
- [ ] SQL injection and XSS vulnerabilities addressed

### Performance ⚡
- [ ] No obvious performance bottlenecks
- [ ] Database queries are optimized
- [ ] Appropriate caching strategies used
- [ ] Memory usage is reasonable

### Testing 🧪
- [ ] Unit tests cover new functionality
- [ ] Integration tests verify end-to-end behavior
- [ ] Test cases include error scenarios
- [ ] Test coverage meets minimum requirements (90%)

### Documentation 📚
- [ ] API documentation updated
- [ ] Code comments are helpful and accurate
- [ ] README updated if needed
- [ ] Migration/deployment notes provided
```

### Review Comments Standards

```typescript
// ✅ Good: Constructive feedback with suggestions
/*
Consider using a more specific error type here:

Instead of:
throw new Error('Validation failed');

Try:
throw new ValidationError('Battery percentage must be between 0 and 100', 'batteryPercentage');

This makes error handling more specific and provides better debugging information.
*/

// ✅ Good: Positive reinforcement for good practices
/*
Great use of type guards here! This makes the runtime validation very clear and the error messages helpful for debugging.
*/

// ✅ Good: Question for clarification
/*
Question: Should we add a timeout to this WebSocket connection? 
I'm concerned about connections that might hang indefinitely.
*/

// ❌ Bad: Non-constructive criticism
/*
This is wrong.
*/

// ❌ Bad: Overly pedantic comment
/*
You have an extra space here.
*/
```

---

## Performance Standards

### Performance Monitoring

#### Metrics Collection
```typescript
// ✅ Good: Comprehensive performance monitoring
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metricsCollector: MetricsCollector;
  
  // Core performance metrics
  public trackApiEndpoint(endpoint: string, method: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = process.hrtime.bigint();
      
      res.on('finish', () => {
        const duration = Number(process.hrtime.bigint() - startTime) / 1000000; // Convert to ms
        
        this.metricsCollector.histogram('api_request_duration_ms', duration, {
          endpoint,
          method,
          status_code: res.statusCode.toString(),
        });
        
        this.metricsCollector.counter('api_requests_total', 1, {
          endpoint,
          method,
          status_code: res.statusCode.toString(),
        });
        
        // Alert on slow requests
        if (duration > 500) {
          this.metricsCollector.counter('api_requests_slow_total', 1, {
            endpoint,
            method,
          });
        }
      });
      
      next();
    };
  }
  
  public trackDatabaseQuery(queryName: string) {
    return <T>(queryFunction: () => Promise<T>): Promise<T> => {
      const startTime = process.hrtime.bigint();
      
      return queryFunction()
        .then(result => {
          const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
          
          this.metricsCollector.histogram('db_query_duration_ms', duration, {
            query_name: queryName,
            status: 'success',
          });
          
          return result;
        })
        .catch(error => {
          const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
          
          this.metricsCollector.histogram('db_query_duration_ms', duration, {
            query_name: queryName,
            status: 'error',
          });
          
          throw error;
        });
    };
  }
  
  public trackMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    
    this.metricsCollector.gauge('memory_usage_bytes', memUsage.heapUsed, {
      type: 'heap_used',
    });
    
    this.metricsCollector.gauge('memory_usage_bytes', memUsage.heapTotal, {
      type: 'heap_total',
    });
    
    this.metricsCollector.gauge('memory_usage_bytes', memUsage.rss, {
      type: 'rss',
    });
  }
}

// Usage example
const performanceMonitor = PerformanceMonitor.getInstance();

// Track API endpoints
app.use('/api/v1/drones', performanceMonitor.trackApiEndpoint('/api/v1/drones', 'GET'));

// Track database queries
const droneData = await performanceMonitor.trackDatabaseQuery('get_drone_telemetry')(
  () => database.query('SELECT * FROM drone_telemetry_current WHERE drone_id = $1', [droneId])
);
```

### Performance Optimization Guidelines

#### Database Optimization
```sql
-- ✅ Good: Optimized query with proper indexing strategy
-- Create composite index for common query pattern
CREATE INDEX CONCURRENTLY idx_telemetry_drone_time_battery 
ON drone_telemetry_current (drone_id, timestamp DESC, battery_percentage)
WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours';

-- Optimized query using the index
SELECT 
    drone_id,
    timestamp,
    position_lat,
    position_lng,
    battery_percentage,
    velocity_ms,
    flight_mode
FROM drone_telemetry_current 
WHERE drone_id = $1 
    AND timestamp >= $2 
    AND battery_percentage < 30  -- Uses partial index condition
ORDER BY timestamp DESC 
LIMIT 100;

-- Partition maintenance for performance
-- Automatically drop old partitions to maintain performance
DO $ 
DECLARE
    partition_date DATE;
    partition_name TEXT;
BEGIN
    -- Drop partitions older than 7 days
    FOR partition_date IN 
        SELECT generate_series(
            CURRENT_DATE - INTERVAL '30 days',
            CURRENT_DATE - INTERVAL '7 days',
            '1 day'::INTERVAL
        )::DATE
    LOOP
        partition_name := 'drone_telemetry_current_' || to_char(partition_date, 'YYYY_MM_DD');
        
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = partition_name
        ) THEN
            EXECUTE 'DROP TABLE IF EXISTS ' || partition_name;
            RAISE NOTICE 'Dropped partition: %', partition_name;
        END IF;
    END LOOP;
END $;
```

#### Caching Strategy
```typescript
// ✅ Good: Multi-tier caching with proper invalidation
export class CacheManager {
  private memoryCache: LRUCache<string, any>;
  private redisCache: Redis;
  
  constructor() {
    this.memoryCache = new LRUCache({
      max: 1000,
      ttl: 30 * 1000, // 30 seconds
    });
  }
  
  async get<T>(key: string, fallback: () => Promise<T>, ttl = 300): Promise<T> {
    // Level 1: Memory cache (fastest)
    const memoryResult = this.memoryCache.get(key);
    if (memoryResult !== undefined) {
      return memoryResult as T;
    }
    
    // Level 2: Redis cache (fast)
    const redisResult = await this.redisCache.get(key);
    if (redisResult) {
      const parsed = JSON.parse(redisResult) as T;
      this.memoryCache.set(key, parsed);
      return parsed;
    }
    
    // Level 3: Database/API call (slow)
    const freshData = await fallback();
    
    // Store in both caches
    await this.redisCache.setex(key, ttl, JSON.stringify(freshData));
    this.memoryCache.set(key, freshData);
    
    return freshData;
  }
  
  async invalidate(pattern: string): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();
    
    // Clear matching Redis keys
    const keys = await this.redisCache.keys(pattern);
    if (keys.length > 0) {
      await this.redisCache.del(...keys);
    }
  }
  
  // Cache warmer for frequently accessed data
  async warmCache(): Promise<void> {
    const criticalData = [
      'fleet:status:aggregate',
      'analytics:live:fleet_utilization',
      'telemetry:live:drone_0',
      'telemetry:live:drone_1',
      'telemetry:live:drone_2',
      'telemetry:live:drone_3',
      'telemetry:live:drone_4',
    ];
    
    await Promise.all(
      criticalData.map(async (key) => {
        try {
          await this.get(key, async () => {
            // Appropriate fallback function for each key type
            return await this.generateFreshData(key);
          });
        } catch (error) {
          console.warn(`Failed to warm cache for key: ${key}`, error);
        }
      })
    );
  }
}
```

---

## Security Standards

### Input Validation and Sanitization

```typescript
// ✅ Good: Comprehensive input validation with Zod
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Validation schemas with security considerations
const CoordinateSchema = z.object({
  latitude: z.number()
    .min(-90, 'Latitude must be >= -90')
    .max(90, 'Latitude must be <= 90')
    .refine(val => !isNaN(val), 'Latitude must be a valid number'),
  longitude: z.number()
    .min(-180, 'Longitude must be >= -180')
    .max(180, 'Longitude must be <= 180')
    .refine(val => !isNaN(val), 'Longitude must be a valid number'),
  altitude: z.number()
    .min(0, 'Altitude must be non-negative')
    .max(500, 'Altitude cannot exceed 500m for safety')
});

const MissionCreationSchema = z.object({
  assignedDroneId: z.string()
    .regex(/^drone_[0-9]+$/, 'Invalid drone ID format')
    .optional(),
  missionType: z.enum(['pickup', 'delivery', 'patrol', 'maintenance', 'emergency']),
  priority: z.number().int().min(1).max(10),
  scheduledStart: z.string().datetime().optional(),
  payloadWeightKg: z.number().min(0).max(10),
  waypoints: z.array(z.object({
    sequenceOrder: z.number().int().positive(),
    coordinates: CoordinateSchema,
    actionRequired: z.string()
      .min(1, 'Action is required')
      .max(200, 'Action description too long')
      .transform(val => DOMPurify.sanitize(val.trim())), // Sanitize HTML
    durationMinutes: z.number().int().min(1).max(60).default(5),
  })).min(1, 'At least one waypoint is required').max(20, 'Too many waypoints'),
  specialInstructions: z.string()
    .max(1000, 'Instructions too long')
    .transform(val => val ? DOMPurify.sanitize(val.trim()) : undefined)
    .optional(),
  customerInfo: z.object({
    customerId: z.string().uuid().optional(),
    contactPhone: z.string()
      .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
      .optional(),
    deliveryNotes: z.string()
      .max(500, 'Delivery notes too long')
      .transform(val => val ? DOMPurify.sanitize(val.trim()) : undefined)
      .optional(),
  }).optional(),
});

// Security middleware
export const securityMiddleware = {
  // Rate limiting
  rateLimiter: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Helmet for security headers
  helmet: helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),

  // Input sanitization
  sanitizeInput: (req: Request, res: Response, next: NextFunction) => {
    // Recursively sanitize all string inputs
    const sanitizeObject = (obj: any): any => {
      if (typeof obj === 'string') {
        return DOMPurify.sanitize(obj.trim());
      }
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          sanitized[key] = sanitizeObject(value);
        }
        return sanitized;
      }
      return obj;
    };

    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    next();
  },

  // CORS configuration
  cors: cors({
    origin: (origin, callback) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
      
      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
  }),
};
```

### Authentication and Authorization

```typescript
// ✅ Good: Comprehensive auth system with role-based access
export enum UserRole {
  FLEET_OPERATOR = 'fleet_operator',
  SAFETY_MANAGER = 'safety_manager',
  SYSTEM_ADMIN = 'system_admin',
  ANALYST = 'analyst',
}

export enum Permission {
  // Read permissions
  READ_FLEET_STATUS = 'read:fleet_status',
  READ_TELEMETRY = 'read:telemetry',
  READ_MISSIONS = 'read:missions',
  READ_ANALYTICS = 'read:analytics',
  
  // Write permissions
  CREATE_MISSION = 'create:mission',
  MODIFY_MISSION = 'modify:mission',
  DELETE_MISSION = 'delete:mission',
  
  // Control permissions
  CONTROL_DRONE = 'control:drone',
  EMERGENCY_STOP = 'emergency:stop',
  SYSTEM_CONFIG = 'system:config',
  
  // Admin permissions
  MANAGE_USERS = 'admin:users',
  MANAGE_SYSTEM = 'admin:system',
}

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ANALYST]: [
    Permission.READ_FLEET_STATUS,
    Permission.READ_TELEMETRY,
    Permission.READ_MISSIONS,
    Permission.READ_ANALYTICS,
  ],
  [UserRole.FLEET_OPERATOR]: [
    Permission.READ_FLEET_STATUS,
    Permission.READ_TELEMETRY,
    Permission.READ_MISSIONS,
    Permission.READ_ANALYTICS,
    Permission.CREATE_MISSION,
    Permission.MODIFY_MISSION,
    Permission.CONTROL_DRONE,
    Permission.EMERGENCY_STOP,
  ],
  [UserRole.SAFETY_MANAGER]: [
    ...ROLE_PERMISSIONS[UserRole.FLEET_OPERATOR],
    Permission.DELETE_MISSION,
    Permission.SYSTEM_CONFIG,
  ],
  [UserRole.SYSTEM_ADMIN]: [
    ...Object.values(Permission),
  ],
};

export class AuthService {
  private jwtSecret: string;
  private refreshTokens: Set<string> = new Set();

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || (() => {
      throw new Error('JWT_SECRET environment variable is required');
    })();
  }

  async authenticateToken(token: string): Promise<AuthenticatedUser | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JWTPayload;
      
      // Verify token hasn't been revoked
      if (decoded.jti && this.refreshTokens.has(decoded.jti)) {
        return null;
      }

      // Verify user still exists and is active
      const user = await this.getUserById(decoded.userId);
      if (!user || !user.isActive) {
        return null;
      }

      return {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role,
        permissions: this.getPermissionsForRole(decoded.role),
        sessionId: decoded.sessionId,
      };
    } catch (error) {
      return null;
    }
  }

  hasPermission(user: AuthenticatedUser, permission: Permission): boolean {
    return user.permissions.includes(permission);
  }

  // Middleware factory for permission checking
  requirePermission(permission: Permission) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json(
          ApiResponseBuilder.error('UNAUTHORIZED', 'Authentication required')
        );
      }

      if (!this.hasPermission(req.user, permission)) {
        return res.status(403).json(
          ApiResponseBuilder.error(
            'FORBIDDEN',
            `Insufficient permissions. Required: ${permission}`,
            { requiredPermission: permission, userRole: req.user.role }
          )
        );
      }

      next();
    };
  }

  // Multi-factor authentication for critical operations
  async requireMFA(userId: string, operation: string): Promise<MFAChallenge> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate MFA challenge
    const challenge: MFAChallenge = {
      challengeId: generateUUID(),
      userId,
      operation,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      attempts: 0,
      maxAttempts: 3,
    };

    // Store challenge temporarily
    await this.storeMFAChallenge(challenge);

    // Send challenge to user (SMS, email, etc.)
    await this.sendMFAChallenge(user, challenge);

    return challenge;
  }

  async verifyMFA(challengeId: string, code: string): Promise<boolean> {
    const challenge = await this.getMFAChallenge(challengeId);
    if (!challenge || challenge.expiresAt < new Date()) {
      return false;
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      await this.invalidateMFAChallenge(challengeId);
      return false;
    }

    // Increment attempts
    challenge.attempts++;
    await this.updateMFAChallenge(challenge);

    // Verify code (implementation depends on MFA method)
    const isValid = await this.validateMFACode(challenge.userId, code);
    
    if (isValid) {
      await this.invalidateMFAChallenge(challengeId);
      
      // Log successful MFA
      await this.auditLog('MFA_SUCCESS', {
        userId: challenge.userId,
        operation: challenge.operation,
        challengeId,
      });
    } else {
      // Log failed MFA attempt
      await this.auditLog('MFA_FAILED', {
        userId: challenge.userId,
        operation: challenge.operation,
        challengeId,
        attempts: challenge.attempts,
      });
    }

    return isValid;
  }
}
```