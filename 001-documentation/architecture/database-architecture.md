## Database Architecture

### Data Storage Strategy

#### Hot Data (Recent + High-Frequency)
- **Retention**: Last 48 hours at full resolution
- **Update Frequency**: 5-10 second intervals
- **Storage Location**: PostgreSQL with Redis caching
- **Purpose**: Real-time operations, immediate analytics, incident investigation

#### Warm Data (Periodic Snapshots)
- **Retention**: Indefinite (1-minute aggregates)
- **Update Frequency**: Every minute
- **Storage Location**: PostgreSQL optimized tables
- **Purpose**: Historical trends, performance analysis, regulatory compliance

### Core Database Schema

#### 1. Fleet Management Tables

```sql
-- Drone fleet registry
CREATE TABLE drones (
    drone_id VARCHAR(50) PRIMARY KEY,
    serial_number VARCHAR(100) UNIQUE NOT NULL,
    model VARCHAR(50) NOT NULL,
    max_payload_kg DECIMAL(5,2) NOT NULL,
    max_range_km DECIMAL(6,2) NOT NULL,
    battery_capacity_mah INTEGER NOT NULL,
    status ENUM('active', 'maintenance', 'retired') DEFAULT 'active',
    current_location POINT,
    home_base_location POINT NOT NULL,
    last_maintenance_date TIMESTAMP,
    flight_hours_total DECIMAL(8,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Real-time drone status (hot data)
CREATE TABLE drone_telemetry_current (
    drone_id VARCHAR(50) REFERENCES drones(drone_id),
    timestamp TIMESTAMP NOT NULL,
    position_lat DECIMAL(10,8) NOT NULL,
    position_lng DECIMAL(11,8) NOT NULL,
    altitude_m DECIMAL(6,2) NOT NULL,
    battery_percentage DECIMAL(5,2) NOT NULL,
    velocity_ms DECIMAL(5,2) NOT NULL,
    heading_degrees DECIMAL(5,2) NOT NULL,
    flight_mode VARCHAR(50) NOT NULL,
    connection_status ENUM('connected', 'disconnected', 'error') NOT NULL,
    armed BOOLEAN NOT NULL,
    mission_id UUID,
    PRIMARY KEY (drone_id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Telemetry snapshots (warm data)
CREATE TABLE drone_telemetry_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drone_id VARCHAR(50) REFERENCES drones(drone_id),
    snapshot_time TIMESTAMP NOT NULL,
    avg_position POINT NOT NULL,
    avg_altitude_m DECIMAL(6,2) NOT NULL,
    min_battery_percentage DECIMAL(5,2) NOT NULL,
    max_battery_percentage DECIMAL(5,2) NOT NULL,
    distance_traveled_m DECIMAL(8,2) NOT NULL,
    flight_time_seconds INTEGER NOT NULL,
    incidents JSONB DEFAULT '[]',
    performance_score DECIMAL(3,2), -- 0.00-1.00 rating
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(drone_id, snapshot_time)
);
```

#### 2. Mission Management Tables

```sql
-- Individual mission assignments
CREATE TABLE missions (
    mission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_drone_id VARCHAR(50) REFERENCES drones(drone_id),
    mission_type ENUM('pickup', 'delivery', 'patrol', 'maintenance', 'emergency') NOT NULL,
    status ENUM('pending', 'assigned', 'active', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    priority INTEGER NOT NULL DEFAULT 5, -- 1-10 scale (10 = emergency)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scheduled_start TIMESTAMP,
    actual_start TIMESTAMP,
    completed_at TIMESTAMP,
    estimated_duration_minutes INTEGER,
    actual_duration_minutes INTEGER,
    payload_weight_kg DECIMAL(5,2),
    customer_info JSONB,
    special_instructions TEXT,
    created_by VARCHAR(100), -- operator/system identifier
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Shared waypoint library for reusability
CREATE TABLE waypoint_library (
    waypoint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_name VARCHAR(200) NOT NULL,
    coordinates POINT NOT NULL,
    waypoint_type ENUM('pickup', 'delivery', 'charging_station', 'checkpoint', 'emergency_landing') NOT NULL,
    capacity_simultaneous INTEGER DEFAULT 1,
    operational_hours JSONB DEFAULT '{"start": "00:00", "end": "23:59"}',
    access_restrictions JSONB DEFAULT '{}', -- Weight limits, drone types, weather conditions
    address TEXT,
    contact_info JSONB,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Mission waypoints with real-time modification support
CREATE TABLE mission_waypoints (
    waypoint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID REFERENCES missions(mission_id) ON DELETE CASCADE,
    waypoint_library_id UUID REFERENCES waypoint_library(waypoint_id),
    sequence_order INTEGER NOT NULL,
    estimated_arrival TIMESTAMP,
    actual_arrival TIMESTAMP,
    duration_minutes INTEGER DEFAULT 5,
    action_required VARCHAR(200), -- 'pickup_package', 'deliver_package', 'hover_30s'
    completion_status ENUM('pending', 'in_progress', 'completed', 'modified', 'skipped') DEFAULT 'pending',
    -- Real-time modification tracking
    original_waypoint_id UUID, -- References waypoint_library if modified
    modification_reason VARCHAR(500),
    modified_at TIMESTAMP,
    modified_by VARCHAR(100), -- operator/system identifier
    safety_validated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Route optimization constraints
CREATE TABLE route_constraints (
    constraint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID REFERENCES missions(mission_id) ON DELETE CASCADE,
    constraint_type ENUM('battery_range', 'payload_capacity', 'weather', 'restricted_airspace', 'time_window', 'charging_requirement') NOT NULL,
    constraint_value JSONB NOT NULL, -- Flexible constraint parameters
    weight_factor DECIMAL(3,2) DEFAULT 1.00, -- Importance in optimization (0.00-1.00)
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. Coordination and Safety Tables

```sql
-- Medium granularity coordination events
CREATE TABLE coordination_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type ENUM('collision_avoidance', 'charging_queue', 'emergency_landing', 'airspace_conflict', 'formation_coordination') NOT NULL,
    involved_drones VARCHAR(50)[] NOT NULL, -- Array of drone IDs
    trigger_drone_id VARCHAR(50) REFERENCES drones(drone_id),
    trigger_condition VARCHAR(500),
    event_data JSONB NOT NULL, -- Specific coordination parameters
    resolution_action VARCHAR(500),
    status ENUM('pending', 'active', 'resolved', 'failed') DEFAULT 'pending',
    auto_resolved BOOLEAN DEFAULT TRUE, -- Automatic vs operator intervention
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolution_time_ms INTEGER -- Performance tracking
);

-- Charging infrastructure management
CREATE TABLE charging_stations (
    station_id VARCHAR(50) PRIMARY KEY,
    location_name VARCHAR(200) NOT NULL,
    coordinates POINT NOT NULL,
    station_type ENUM('fast_charge', 'standard', 'solar', 'emergency') NOT NULL,
    max_simultaneous_drones INTEGER DEFAULT 1,
    operational_status ENUM('active', 'maintenance', 'offline') DEFAULT 'active',
    power_capacity_kw DECIMAL(6,2) NOT NULL,
    charging_rate_percentage_per_minute DECIMAL(4,2) NOT NULL,
    queue_capacity INTEGER DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Charging session tracking
CREATE TABLE charging_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drone_id VARCHAR(50) REFERENCES drones(drone_id),
    station_id VARCHAR(50) REFERENCES charging_stations(station_id),
    session_type ENUM('scheduled', 'emergency', 'opportunistic') NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    start_battery_percentage DECIMAL(5,2) NOT NULL,
    end_battery_percentage DECIMAL(5,2),
    target_battery_percentage DECIMAL(5,2) DEFAULT 100,
    energy_consumed_kwh DECIMAL(8,4),
    queue_wait_time_minutes INTEGER DEFAULT 0,
    charging_efficiency_percentage DECIMAL(5,2), -- Actual vs theoretical charge rate
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. Analytics and Performance Tables

```sql
-- Hourly aggregated analytics
CREATE TABLE hourly_analytics (
    analytics_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hour_timestamp TIMESTAMP NOT NULL, -- Rounded to hour
    metric_type VARCHAR(100) NOT NULL,
    drone_id VARCHAR(50) REFERENCES drones(drone_id), -- NULL for fleet-wide metrics
    metric_value DECIMAL(12,4) NOT NULL,
    metric_data JSONB DEFAULT '{}', -- Additional context and breakdown
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(hour_timestamp, metric_type, drone_id)
);

-- Real-time performance tracking
CREATE TABLE performance_metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL UNIQUE,
    current_value DECIMAL(12,4) NOT NULL, -- Live value
    hourly_average DECIMAL(12,4), -- Last hour average
    daily_average DECIMAL(12,4), -- Last 24h average
    weekly_average DECIMAL(12,4), -- Last 7 days average
    trend_direction ENUM('up', 'down', 'stable') DEFAULT 'stable',
    trend_percentage DECIMAL(6,2), -- % change from previous period
    threshold_min DECIMAL(12,4), -- Alert thresholds
    threshold_max DECIMAL(12,4),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Mission performance analysis
CREATE TABLE mission_performance (
    performance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID REFERENCES missions(mission_id),
    drone_id VARCHAR(50) REFERENCES drones(drone_id),
    planned_duration_minutes INTEGER NOT NULL,
    actual_duration_minutes INTEGER NOT NULL,
    planned_distance_km DECIMAL(8,3) NOT NULL,
    actual_distance_km DECIMAL(8,3) NOT NULL,
    planned_battery_consumption DECIMAL(5,2) NOT NULL,
    actual_battery_consumption DECIMAL(5,2) NOT NULL,
    waypoints_completed INTEGER NOT NULL,
    waypoints_modified INTEGER DEFAULT 0,
    coordination_events_count INTEGER DEFAULT 0,
    efficiency_score DECIMAL(3,2), -- 0.00-1.00 rating
    delay_reasons JSONB DEFAULT '[]',
    weather_impact JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Redis Caching Strategy

#### Real-time Data Structures

```javascript
// Live telemetry (updated every 5-10 seconds)
"telemetry:drone_0": {
    "timestamp": "2025-07-23T10:30:45Z",
    "position": {"lat": 19.0760, "lng": 72.8777, "alt": 120.5},
    "battery": 67.3,
    "velocity": 12.8,
    "heading": 145.2,
    "flight_mode": "AUTO.MISSION",
    "armed": true,
    "mission_id": "uuid-mission-123"
}

// Fleet status aggregation
"fleet:status": {
    "active_drones": 5,
    "active_missions": 3,
    "charging_drones": 1,
    "total_battery_average": 72.4,
    "coordination_events_active": 2,
    "emergency_status": "normal",
    "last_updated": "2025-07-23T10:30:45Z"
}

// Mission progress tracking
"mission:uuid-mission-123": {
    "status": "active",
    "current_waypoint": 2,
    "waypoints_total": 5,
    "eta_minutes": 15,
    "progress_percentage": 40,
    "last_waypoint_completed": "2025-07-23T10:25:30Z"
}

// Coordination events (medium granularity)
"coordination:active": [
    {
        "event_id": "coord-001",
        "type": "collision_avoidance",
        "drones": ["drone_1", "drone_3"],
        "action": "drone_3_adjust_altitude_+15m",
        "duration_seconds": 45,
        "created_at": "2025-07-23T10:29:15Z"
    },
    {
        "event_id": "coord-002",
        "type": "charging_queue",
        "drones": ["drone_2", "drone_4"],
        "station": "station_alpha",
        "queue_position": {"drone_2": 1, "drone_4": 2},
        "estimated_wait_minutes": {"drone_2": 0, "drone_4": 25}
    }
]

// Charging queue management
"charging:station_alpha:queue": [
    {"drone_id": "drone_2", "battery": 18, "priority": "emergency", "eta": 3},
    {"drone_id": "drone_4", "battery": 31, "priority": "scheduled", "eta": 28}
]

// Live analytics (1-5 second updates)
"analytics:live": {
    "missions_completed_today": 47,
    "missions_active": 3,
    "fleet_utilization_percentage": 78.2,
    "average_delivery_time_minutes": 23.4,
    "energy_efficiency_kwh_per_km": 0.152,
    "coordination_events_count_hourly": 8,
    "emergency_landings_today": 0,
    "battery_health_average": 94.7
}
```

---

