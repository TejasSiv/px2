# API Design Guidelines - Multi-Drone Fleet Management System

## Table of Contents
1. [Core Principles](#core-principles)
2. [RESTful API Standards](#restful-api-standards)
3. [Microservice-Specific API Patterns](#microservice-specific-api-patterns)
4. [Safety-Critical Operations](#safety-critical-operations)
5. [Coordination Event APIs](#coordination-event-apis)
6. [Week 1 MVP API Examples](#week-1-mvp-api-examples)
7. [Real-time WebSocket APIs](#real-time-websocket-apis)
8. [Testing & Validation Strategies](#testing--validation-strategies)
9. [Error Handling](#error-handling)
10. [Performance Guidelines](#performance-guidelines)

---

## Core Principles

### 1. Iterative Development First
- **Start Simple**: Begin with essential endpoints for Week 1 MVP
- **Add Incrementally**: New endpoints added as dashboard features require them
- **Avoid Over-Engineering**: Don't build APIs until there's a concrete consumer
- **Feedback-Driven**: Let actual usage guide API evolution

### 2. Consistency Over Perfection
- **Uniform Patterns**: Same conventions across all microservices
- **Predictable Behavior**: Similar operations work the same way everywhere
- **Standard Responses**: Consistent format for all API responses
- **Common Vocabulary**: Shared terminology across all services

### 3. Safety and Reliability
- **Fail-Safe Defaults**: APIs default to safe operations when in doubt
- **Validation First**: Comprehensive input validation before processing
- **Idempotent Operations**: Safe to retry without side effects
- **Audit Everything**: Complete logging for compliance and debugging

---

## RESTful API Standards

### Resource-Oriented Design

#### Resource Identification
```
GET    /api/v1/drones              # Collection
GET    /api/v1/drones/{id}         # Specific resource
GET    /api/v1/drones/{id}/telemetry  # Sub-resource
POST   /api/v1/missions            # Create new resource
PUT    /api/v1/missions/{id}       # Update entire resource
PATCH  /api/v1/missions/{id}       # Partial update
DELETE /api/v1/missions/{id}       # Remove resource
```

### Standard Response Format

#### Success Response
```json
{
  "status": "success",
  "data": {
    "type": "drone",
    "id": "drone_0",
    "attributes": {
      "status": "active",
      "battery_percentage": 67.3,
      "position": {
        "lat": 19.0760,
        "lng": 72.8777,
        "alt": 120.5
      }
    }
  },
  "meta": {
    "timestamp": "2025-07-23T10:30:45Z",
    "version": "1.0"
  }
}
```

---

## Microservice-Specific API Patterns

### 1. Mission Management Service

#### Base URL: `/api/v1/missions`

#### Core Endpoints
```
# Mission CRUD Operations
POST   /missions                    # Create new mission
GET    /missions                    # List missions (filtered)
GET    /missions/{id}               # Get mission details
PUT    /missions/{id}               # Update mission
DELETE /missions/{id}               # Cancel mission

# Mission Control
POST   /missions/{id}/start         # Start mission execution
POST   /missions/{id}/pause         # Pause active mission
POST   /missions/{id}/resume        # Resume paused mission
POST   /missions/{id}/abort         # Emergency abort

# Waypoint Management
GET    /missions/{id}/waypoints     # List mission waypoints
POST   /missions/{id}/waypoints     # Add waypoint
PUT    /missions/{id}/waypoints/{wid} # Modify waypoint
DELETE /missions/{id}/waypoints/{wid} # Remove waypoint

# Drone Assignment
POST   /missions/{id}/assign        # Assign drone to mission
POST   /missions/{id}/reassign      # Reassign to different drone
```

#### Example: Create Multi-Stop Delivery Mission
```http
POST /api/v1/missions
Content-Type: application/json

{
  "data": {
    "type": "mission",
    "attributes": {
      "mission_type": "delivery",
      "priority": 5,
      "scheduled_start": "2025-07-23T14:00:00Z",
      "payload_weight_kg": 2.5,
      "customer_info": {
        "name": "John Doe",
        "contact": "+1234567890"
      }
    },
    "relationships": {
      "waypoints": {
        "data": [
          {
            "type": "waypoint",
            "attributes": {
              "sequence_order": 1,
              "waypoint_library_id": "warehouse_alpha",
              "action": "pickup_package",
              "duration_minutes": 5
            }
          },
          {
            "type": "waypoint",
            "attributes": {
              "sequence_order": 2,
              "coordinates": {"lat": 19.0900, "lng": 72.8900},
              "action": "deliver_package",
              "duration_minutes": 3
            }
          }
        ]
      }
    }
  }
}
```

### 2. Telemetry Processing Service

#### Base URL: `/api/v1/telemetry`

#### Core Endpoints
```
# Real-time Telemetry Access
GET    /telemetry/current           # Current telemetry for all drones
GET    /telemetry/drone/{id}        # Current telemetry for specific drone
GET    /telemetry/drone/{id}/history # Historical telemetry (time-range)

# Telemetry Subscriptions (for internal services)
POST   /telemetry/subscriptions     # Create telemetry subscription
DELETE /telemetry/subscriptions/{id} # Cancel subscription

# Telemetry Aggregations
GET    /telemetry/fleet/summary     # Fleet-wide telemetry summary
GET    /telemetry/snapshots         # Periodic telemetry snapshots
```

#### Example: Get Current Drone Telemetry
```http
GET /api/v1/telemetry/drone/drone_0
Accept: application/json

Response:
{
  "status": "success",
  "data": {
    "drone_id": "drone_0",
    "timestamp": "2025-07-23T10:30:45.123Z",
    "position": {
      "lat": 19.0760,
      "lng": 72.8777,
      "alt": 120.5
    },
    "velocity": {
      "ground_speed_ms": 12.8,
      "vertical_speed_ms": -0.5,
      "heading_degrees": 145.2
    },
    "battery": {
      "percentage": 67.3,
      "voltage": 22.4,
      "current": 15.2,
      "temperature_c": 35.2
    },
    "flight_mode": "AUTO.MISSION",
    "armed": true,
    "connection": {
      "status": "connected",
      "signal_strength": -65,
      "latency_ms": 45
    }
  }
}
```

### 3. Coordination Service

#### Base URL: `/api/v1/coordination`

#### Core Endpoints
```
# Coordination Events
GET    /coordination/events         # List active coordination events
GET    /coordination/events/{id}    # Get event details
POST   /coordination/events/{id}/resolve # Manual resolution

# Collision Avoidance
GET    /coordination/conflicts      # Current airspace conflicts
POST   /coordination/conflicts/predict # Predict future conflicts

# Charging Management
GET    /coordination/charging/queue # Current charging queue
POST   /coordination/charging/request # Request charging slot
PUT    /coordination/charging/priority # Update charging priority

# Formation Flying
POST   /coordination/formations     # Create formation
PUT    /coordination/formations/{id} # Update formation
DELETE /coordination/formations/{id} # Dissolve formation
```

#### Example: Coordination Event Response
```json
{
  "status": "success",
  "data": {
    "event_id": "coord_001",
    "event_type": "collision_avoidance",
    "status": "active",
    "involved_drones": ["drone_1", "drone_3"],
    "created_at": "2025-07-23T10:29:15Z",
    "trigger": {
      "condition": "separation_distance_violation",
      "distance_m": 45.2,
      "threshold_m": 50.0
    },
    "resolution": {
      "strategy": "altitude_adjustment",
      "actions": [
        {
          "drone_id": "drone_3",
          "action": "climb",
          "altitude_change_m": 15,
          "duration_seconds": 10
        }
      ]
    }
  }
}
```

### 4. Safety Monitoring Service

#### Base URL: `/api/v1/safety`

#### Core Endpoints
```
# Pre-flight Validation
POST   /safety/validate/mission     # Validate mission parameters
POST   /safety/validate/waypoint    # Validate waypoint modification
GET    /safety/validate/conditions  # Current safety conditions

# Emergency Operations
POST   /safety/emergency/land/{drone_id} # Emergency land single drone
POST   /safety/emergency/stop-all   # Fleet-wide emergency stop
POST   /safety/emergency/rtl/{drone_id} # Return to launch

# Safety Monitoring
GET    /safety/status              # Overall safety status
GET    /safety/violations          # Active safety violations
GET    /safety/audit-log           # Safety decision audit trail

# Supervised Decisions
GET    /safety/decisions/pending   # Decisions awaiting approval
POST   /safety/decisions/{id}/approve # Approve decision
POST   /safety/decisions/{id}/reject  # Reject with alternative
```

### 5. Analytics Service

#### Base URL: `/api/v1/analytics`

#### Core Endpoints
```
# Live Analytics (1-5 second updates)
GET    /analytics/live/fleet       # Real-time fleet metrics
GET    /analytics/live/missions    # Active mission metrics
GET    /analytics/live/performance # System performance metrics

# Historical Analytics (hourly aggregations)
GET    /analytics/historical/summary # Time-range summaries
GET    /analytics/historical/trends  # Performance trends
GET    /analytics/reports/{type}    # Generated reports

# Custom Analytics
POST   /analytics/query            # Custom analytics query
GET    /analytics/dashboards       # Available dashboards
GET    /analytics/export           # Export analytics data
```

#### Example: Live Fleet Analytics
```http
GET /api/v1/analytics/live/fleet

Response:
{
  "status": "success",
  "data": {
    "timestamp": "2025-07-23T10:30:45Z",
    "fleet_metrics": {
      "total_drones": 5,
      "active_drones": 4,
      "charging_drones": 1,
      "maintenance_drones": 0
    },
    "mission_metrics": {
      "active_missions": 3,
      "completed_today": 47,
      "success_rate": 0.923,
      "avg_completion_time_minutes": 23.4
    },
    "battery_metrics": {
      "fleet_average": 72.4,
      "critical_batteries": 0,
      "charging_queue_length": 2
    },
    "coordination_metrics": {
      "active_events": 1,
      "events_last_hour": 8,
      "auto_resolved_rate": 0.875
    }
  }
}
```

### 6. Configuration Service

#### Base URL: `/api/v1/config`

#### Core Endpoints
```
# Configuration Management
GET    /config/current             # Get current configuration
GET    /config/schemas             # Available config schemas
PUT    /config/{section}           # Update configuration section
POST   /config/validate            # Validate configuration
POST   /config/rollback            # Rollback to previous version

# Test Scenarios
GET    /config/test-scenarios      # List available test scenarios
GET    /config/test-scenarios/{id} # Get scenario details
POST   /config/test-scenarios/{id}/run # Execute test scenario
GET    /config/test-results        # Test execution results

# Hot Reload
POST   /config/reload              # Trigger hot reload
GET    /config/reload/status       # Reload operation status
```

---

## Safety-Critical Operations

### Pre-flight Validation Pattern

#### Validation Request Structure
```http
POST /api/v1/safety/validate/mission
Content-Type: application/json

{
  "mission_id": "mission_123",
  "validation_level": "comprehensive",
  "checks": {
    "battery": {
      "min_percentage": 25,
      "safety_margin": 20
    },
    "weather": {
      "max_wind_speed_ms": 12,
      "min_visibility_m": 1000
    },
    "airspace": {
      "check_restrictions": true,
      "time_window_minutes": 60
    },
    "payload": {
      "max_weight_ratio": 0.85
    }
  }
}
```

#### Validation Response with Actions
```json
{
  "status": "success",
  "data": {
    "validation_id": "val_456",
    "overall_status": "failed",
    "safety_score": 0.72,
    "checks": [
      {
        "category": "battery",
        "status": "passed",
        "details": {
          "current_battery": 85,
          "required_battery": 45,
          "margin_available": 40
        }
      },
      {
        "category": "weather",
        "status": "failed",
        "severity": "high",
        "details": {
          "current_wind_speed": 14.5,
          "max_allowed": 12.0,
          "violation_percentage": 20.8
        },
        "recommendations": [
          {
            "action": "delay_mission",
            "duration_minutes": 120,
            "confidence": 0.85
          },
          {
            "action": "modify_route",
            "altitude_adjustment_m": -30,
            "confidence": 0.65
          }
        ]
      }
    ],
    "operator_decision_required": true,
    "auto_abort_timeout_seconds": 300
  }
}
```

### Supervised Decision Flow

#### 1. System Recommendation
```http
POST /api/v1/safety/decisions
Content-Type: application/json

{
  "decision_type": "emergency_landing",
  "trigger": {
    "type": "low_battery",
    "drone_id": "drone_2",
    "battery_percentage": 18
  },
  "context": {
    "current_position": {"lat": 19.0850, "lng": 72.8850, "alt": 100},
    "mission_progress": 0.75,
    "distance_to_base_km": 4.2
  },
  "recommendations": [
    {
      "action": "emergency_land_nearest",
      "landing_zone": {"lat": 19.0820, "lng": 72.8840},
      "eta_seconds": 45,
      "risk_score": 0.15
    },
    {
      "action": "continue_to_destination",
      "eta_seconds": 180,
      "risk_score": 0.65
    }
  ]
}
```

#### 2. Operator Review Interface
```http
GET /api/v1/safety/decisions/pending

Response:
{
  "data": [
    {
      "decision_id": "dec_789",
      "urgency": "high",
      "time_remaining_seconds": 285,
      "drone_id": "drone_2",
      "situation": "Battery critical - 18%",
      "recommended_action": {
        "type": "emergency_land_nearest",
        "description": "Land at nearest safe zone",
        "consequences": [
          "Mission will be incomplete",
          "Package retrieval required",
          "Customer notification needed"
        ]
      },
      "alternative_actions": [...],
      "auto_execute_at": "2025-07-23T10:35:30Z"
    }
  ]
}
```

#### 3. Operator Decision
```http
POST /api/v1/safety/decisions/dec_789/approve
Content-Type: application/json

{
  "action_selected": "emergency_land_nearest",
  "operator_notes": "Wind conditions deteriorating, safest option",
  "additional_actions": [
    "notify_customer",
    "dispatch_recovery_team"
  ]
}
```

---

## Coordination Event APIs

### Collision Avoidance Pattern

#### Real-time Conflict Detection
```http
GET /api/v1/coordination/conflicts/active

Response:
{
  "data": [
    {
      "conflict_id": "conf_001",
      "severity": "medium",
      "involved_drones": ["drone_1", "drone_3"],
      "conflict_type": "intersecting_paths",
      "time_to_conflict_seconds": 45,
      "closest_approach_distance_m": 35,
      "current_separation_m": 120,
      "resolution_status": "computing"
    }
  ]
}
```

#### Conflict Resolution
```http
POST /api/v1/coordination/conflicts/conf_001/resolve
Content-Type: application/json

{
  "resolution_strategy": "altitude_separation",
  "actions": [
    {
      "drone_id": "drone_1",
      "action": "maintain_altitude"
    },
    {
      "drone_id": "drone_3",
      "action": "climb",
      "altitude_change_m": 20,
      "rate_ms": 2.0
    }
  ],
  "estimated_resolution_time_seconds": 15
}
```

### Charging Queue Management

#### Queue Status
```http
GET /api/v1/coordination/charging/queue

Response:
{
  "data": {
    "stations": [
      {
        "station_id": "station_alpha",
        "status": "active",
        "current_drone": "drone_2",
        "charging_progress": 0.45,
        "eta_minutes": 25,
        "queue": [
          {
            "position": 1,
            "drone_id": "drone_4",
            "battery_percentage": 22,
            "priority": "emergency",
            "estimated_wait_minutes": 25
          },
          {
            "position": 2,
            "drone_id": "drone_0",
            "battery_percentage": 35,
            "priority": "scheduled",
            "estimated_wait_minutes": 55
          }
        ]
      }
    ]
  }
}
```

#### Priority Charging Request
```http
POST /api/v1/coordination/charging/request
Content-Type: application/json

{
  "drone_id": "drone_1",
  "battery_percentage": 15,
  "priority": "emergency",
  "reason": "critical_battery",
  "preferred_station": "station_alpha",
  "target_charge_percentage": 80
}

Response:
{
  "status": "success",
  "data": {
    "request_id": "chrg_123",
    "assigned_station": "station_alpha",
    "queue_position": 1,
    "estimated_wait_minutes": 0,
    "estimated_charge_time_minutes": 35,
    "actions_taken": [
      "Bumped drone_4 to position 2",
      "Notified affected mission controllers"
    ]
  }
}
```

### Emergency Landing Coordination

#### Emergency Landing Request
```http
POST /api/v1/safety/emergency/land/drone_1
Content-Type: application/json

{
  "reason": "system_failure",
  "failure_type": "motor_malfunction",
  "current_position": {
    "lat": 19.0850,
    "lng": 72.8850,
    "alt": 120
  },
  "descent_capability": "controlled",
  "time_available_seconds": 180
}
```

#### Coordinated Response
```json
{
  "status": "success",
  "data": {
    "emergency_id": "emrg_456",
    "landing_zone": {
      "coordinates": {"lat": 19.0835, "lng": 72.8845},
      "type": "designated_emergency_zone",
      "distance_m": 450,
      "eta_seconds": 65
    },
    "coordination_actions": [
      {
        "action": "airspace_cleared",
        "radius_m": 200,
        "affected_drones": ["drone_3", "drone_4"],
        "reroute_status": "completed"
      },
      {
        "action": "ground_team_notified",
        "team_id": "recovery_team_1",
        "eta_minutes": 15
      },
      {
        "action": "mission_suspended",
        "mission_id": "mission_789",
        "package_status": "secure"
      }
    ],
    "monitoring_url": "/api/v1/safety/emergency/emrg_456/status"
  }
}
```

---

## Week 1 MVP API Examples

### Day 1-2: Foundation APIs

#### Basic Drone Status
```http
GET /api/v1/drones

Response:
{
  "status": "success",
  "data": [
    {
      "drone_id": "drone_0",
      "status": "active",
      "battery_percentage": 85.2,
      "position": {"lat": 19.0760, "lng": 72.8777, "alt": 0},
      "armed": false,
      "flight_mode": "STABILIZED"
    }
  ]
}
```

#### Simple Telemetry
```http
GET /api/v1/telemetry/drone/drone_0

Response:
{
  "status": "success",
  "data": {
    "drone_id": "drone_0",
    "timestamp": "2025-07-23T10:30:45Z",
    "battery": 85.2,
    "position": {"lat": 19.0760, "lng": 72.8777, "alt": 0},
    "connected": true
  }
}
```

### Day 3-4: Mission Management

#### Create Simple Mission
```http
POST /api/v1/missions
Content-Type: application/json

{
  "mission_type": "delivery",
  "waypoints": [
    {"lat": 19.0800, "lng": 72.8800, "action": "pickup"},
    {"lat": 19.0900, "lng": 72.8900, "action": "deliver"}
  ]
}
```

#### Start Mission
```http
POST /api/v1/missions/mission_001/start

{
  "drone_id": "drone_0",
  "pre_flight_check": true
}
```

### Day 5-6: Dashboard Integration

#### Fleet Status for Dashboard
```http
GET /api/v1/fleet/status

Response:
{
  "active_drones": 3,
  "total_drones": 5,
  "active_missions": 2,
  "fleet_battery_avg": 72.4,
  "system_status": "operational"
}
```

#### Live Analytics
```http
GET /api/v1/analytics/live

Response:
{
  "missions_completed_today": 12,
  "active_missions": 2,
  "fleet_utilization": 0.60,
  "avg_mission_time_minutes": 22.5
}
```

### Day 7: Integration Testing

#### End-to-End Test Execution
```http
POST /api/v1/config/test-scenarios/standard-delivery/run

{
  "speed_multiplier": 2.0,
  "log_level": "debug"
}
```

---

## Real-time WebSocket APIs

### Connection and Authentication

```javascript
// Client connection
const ws = new WebSocket('wss://api.drone-fleet.com/ws/v1/telemetry');

// Authentication
ws.send(JSON.stringify({
  type: 'auth',
  token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
}));
```

### Subscription Management

```javascript
// Subscribe to specific drones
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: {
    telemetry: ['drone_0', 'drone_1'],
    missions: ['all'],
    alerts: ['all']
  }
}));
```

### Message Types

#### Telemetry Update (5-10 second intervals)
```json
{
  "type": "telemetry",
  "drone_id": "drone_0",
  "timestamp": "2025-07-23T10:30:45.123Z",
  "data": {
    "position": {"lat": 19.0760, "lng": 72.8777, "alt": 120.5},
    "battery": 67.3,
    "velocity": 12.8,
    "heading": 145.2,
    "flight_mode": "AUTO.MISSION",
    "armed": true
  }
}
```

#### Mission Update
```json
{
  "type": "mission_update",
  "mission_id": "mission_123",
  "drone_id": "drone_0",
  "timestamp": "2025-07-23T10:30:45Z",
  "data": {
    "status": "active",
    "current_waypoint": 2,
    "total_waypoints": 4,
    "progress_percentage": 45,
    "eta_minutes": 12
  }
}
```

#### Alert Notification
```json
{
  "type": "alert",
  "severity": "warning",
  "drone_id": "drone_2",
  "timestamp": "2025-07-23T10:30:45Z",
  "data": {
    "alert_type": "low_battery",
    "message": "Battery at 22% - charging recommended",
    "current_battery": 22,
    "estimated_flight_time_minutes": 8
  }
}
```

---

## Testing & Validation Strategies

### API Testing Framework

#### 1. Contract Testing
```yaml
# test-contracts/mission-api.yaml
name: Mission Creation Contract
endpoint: POST /api/v1/missions
request:
  headers:
    Content-Type: application/json
    Authorization: Bearer ${auth_token}
  body:
    mission_type: delivery
    priority: 5
    waypoints:
      - lat: 19.0800
        lng: 72.8800
        action: pickup
expected_response:
  status: 201
  body:
    status: success
    data:
      mission_id: !string
      status: pending
      estimated_duration_minutes: !number
```

#### 2. Scenario-Based Testing

```json
{
  "test_scenario": "multi_drone_coordination",
  "description": "Test collision avoidance with 3 drones",
  "setup": {
    "drones": [
      {"id": "drone_0", "position": {"lat": 19.0750, "lng": 72.8750}},
      {"id": "drone_1", "position": {"lat": 19.0760, "lng": 72.8760}},
      {"id": "drone_2", "position": {"lat": 19.0770, "lng": 72.8770}}
    ]
  },
  "test_steps": [
    {
      "action": "create_intersecting_missions",
      "expected": "coordination_event_created"
    },
    {
      "action": "verify_separation_maintained",
      "expected": "minimum_50m_separation"
    }
  ],
  "assertions": [
    "No collision warnings",
    "All missions completed",
    "Coordination events resolved automatically"
  ]
}
```

#### 3. Load Testing Configuration

```yaml
# load-tests/telemetry-load.yaml
name: Telemetry Service Load Test
scenarios:
  - name: Normal Operations
    duration: 300s
    users: 10
    requests_per_second: 50
    endpoints:
      - method: GET
        url: /api/v1/telemetry/drone/{drone_id}
        weight: 70
      - method: GET
        url: /api/v1/telemetry/fleet/summary
        weight: 30
    success_criteria:
      p95_response_time_ms: 100
      p99_response_time_ms: 500
      error_rate_percent: 0.1
```

### Validation Patterns

#### Input Validation Rules
```javascript
// Mission Creation Validation
{
  "mission_type": {
    "type": "string",
    "enum": ["delivery", "patrol", "emergency"],
    "required": true
  },
  "priority": {
    "type": "integer",
    "min": 1,
    "max": 10,
    "required": true
  },
  "waypoints": {
    "type": "array",
    "minItems": 2,
    "maxItems": 10,
    "items": {
      "lat": {"type": "number", "min": -90, "max": 90},
      "lng": {"type": "number", "min": -180, "max": 180},
      "alt": {"type": "number", "min": 50, "max": 150}
    }
  }
}
```

#### Business Rule Validation
```javascript
// Pre-flight Validation Rules
{
  "battery_check": {
    "rule": "battery_percentage >= 25",
    "error": "Insufficient battery for mission"
  },
  "weather_check": {
    "rule": "wind_speed < 12 && visibility > 1000",
    "error": "Weather conditions unsafe for flight"
  },
  "payload_check": {
    "rule": "payload_weight <= drone.max_payload * 0.85",
    "error": "Payload exceeds safe operating limits"
  }
}
```

### Test Data Management

#### Test Case File Structure
```
/test-cases
  /api-tests
    /mission-service
      - create-mission-valid.json
      - create-mission-invalid-battery.json
      - waypoint-modification-inflight.json
    /coordination-service
      - collision-avoidance-trigger.json
      - charging-queue-priority.json
    /safety-service
      - emergency-landing-low-battery.json
      - pre-flight-validation-fail.json
```

#### Test Execution Pipeline
```bash
# Run API tests for specific service
npm run test:api --service=mission

# Run integration tests
npm run test:integration --scenario=delivery-workflow

# Run load tests
npm run test:load --profile=normal-operations

# Run safety validation tests
npm run test:safety --critical-only
```

---

## Error Handling

### Service-Specific Error Codes

#### Mission Service Errors
```json
{
  "error": {
    "code": "MISSION_DRONE_UNAVAILABLE",
    "message": "Selected drone is not available for mission assignment",
    "details": {
      "drone_id": "drone_2",
      "current_status": "charging",
      "available_in_minutes": 45,
      "alternative_drones": ["drone_0", "drone_3"]
    }
  }
}
```

#### Safety Service Errors
```json
{
  "error": {
    "code": "SAFETY_VALIDATION_FAILED",
    "message": "Mission fails safety validation",
    "details": {
      "violations": [
        {
          "rule": "minimum_battery",
          "required": 25,
          "actual": 22,
          "severity": "critical"
        },
        {
          "rule": "weather_conditions",
          "wind_speed_ms": 14,
          "limit": 12,
          "severity": "warning"
        }
      ],
      "override_possible": true,
      "supervisor_approval_required": true
    }
  }
}
```

#### Coordination Service Errors
```json
{
  "error": {
    "code": "COORDINATION_CONFLICT_UNRESOLVABLE",
    "message": "Unable to automatically resolve coordination conflict",
    "details": {
      "conflict_type": "multiple_drone_convergence",
      "involved_drones": ["drone_1", "drone_2", "drone_3"],
      "manual_intervention_required": true,
      "suggested_actions": [
        "Pause drone_2 for 30 seconds",
        "Reroute drone_3 via waypoint_alt_4"
      ]
    }
  }
}
```