## Simulation Architecture

### PX4 + ROS2 + Gazebo Architecture

#### System Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Web Dashboard Layer                          │
│         React + TypeScript + Tailwind + WebSocket              │
└─────────────────────┬───────────────────────────────────────────┘
                      │ WebSocket API
┌─────────────────────┴───────────────────────────────────────────┐
│                API Gateway & Fleet Manager                     │
│            Node.js + Express + ROS2 Bridge                    │
└─────────────────────┬───────────────────────────────────────────┘
                      │ ROS2 Topics/Services
┌─────────────────────┴───────────────────────────────────────────┐
│                    ROS2 Ecosystem                              │
│   Fleet Coordinator + Mission Planner + Safety Monitor        │
└──┬─────┬─────┬─────┬─────┬────────────────────────────────────────┘
   │     │     │     │     │ ROS2 Topics (telemetry, commands)
   │     │     │     │     │
┌──▼──┐┌─▼──┐┌─▼──┐┌─▼──┐┌─▼──┐
│DR-0 ││DR-1││DR-2││DR-3││DR-4│  ← Docker Containers
│PX4  ││PX4 ││PX4 ││PX4 ││PX4 │
│SITL ││SITL││SITL││SITL││SITL│
└─────┘└────┘└────┘└────┘└────┘
   │     │     │     │     │
   └─────┴─────┴─────┴─────┴──────── MAVLink Protocol
                 │
┌─────────────────────────────────────────────────────────────────┐
│              Gazebo Headless Physics Engine                     │
│         Shared World: delivery_city.world                      │
└─────────────────────────────────────────────────────────────────┘
```

### Detailed Component Architecture

#### 1. Docker Container Strategy

**Gazebo Physics Container:**
```dockerfile
# gazebo-physics/Dockerfile
FROM osrf/ros:humble-desktop
RUN apt-get update && apt-get install -y \
    gazebo \
    ros-humble-gazebo-* \
    ros-humble-geometry-msgs \
    ros-humble-sensor-msgs

# Copy custom world files
COPY ./worlds/delivery_city.world /opt/ros/worlds/
COPY ./models/* /opt/ros/models/

CMD ["gzserver", "--verbose", "/opt/ros/worlds/delivery_city.world"]
```

**Individual Drone Container:**
```dockerfile
# drone-simulation/Dockerfile
FROM px4io/px4-dev-simulation-focal

# Install ROS2 and MAVROS2
RUN apt-get update && apt-get install -y \
    ros-humble-desktop \
    ros-humble-mavros \
    ros-humble-mavros-extras \
    ros-humble-geographic-msgs

# Copy PX4 configuration
COPY ./px4_configs /opt/px4_configs
COPY ./launch_files /opt/launch_files

# Startup script
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

**Fleet Manager Container:**
```dockerfile
# fleet-manager/Dockerfile
FROM osrf/ros:humble-desktop

# Install Node.js for API gateway
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Install Python dependencies for ROS2 nodes
RUN pip3 install \
    rclpy \
    pymavlink \
    asyncio \
    websockets \
    redis \
    psycopg2-binary

COPY ./ros2_workspace /opt/ros2_ws
COPY ./api_gateway /opt/api_gateway

CMD ["bash", "/opt/start_fleet_services.sh"]
```

#### 2. ROS2 Node Architecture

**Fleet Coordinator Node:**
```python
#!/usr/bin/env python3
"""
Fleet Coordinator: Central management for multi-drone operations
Handles mission assignment, coordination events, and safety monitoring
"""

import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, DurabilityPolicy
from geometry_msgs.msg import PoseStamped, TwistStamped
from mavros_msgs.msg import State, BatteryStatus
from mavros_msgs.srv import CommandBool, CommandTOL, SetMode
from std_msgs.msg import String
import json
from typing import Dict, List, Optional
from dataclasses import dataclass
from enum import Enum

class CoordinationEventType(Enum):
    COLLISION_AVOIDANCE = "collision_avoidance"
    CHARGING_QUEUE = "charging_queue"
    EMERGENCY_LANDING = "emergency_landing"
    AIRSPACE_CONFLICT = "airspace_conflict"

@dataclass
class DroneState:
    drone_id: str
    position: PoseStamped
    velocity: TwistStamped
    battery_percentage: float
    flight_mode: str
    armed: bool
    mission_id: Optional[str]
    last_update: float

class FleetCoordinator(Node):
    def __init__(self):
        super().__init__('fleet_coordinator')
        
        self.num_drones = 5
        self.drone_states: Dict[str, DroneState] = {}
        self.active_coordination_events: Dict[str, dict] = {}
        self.safety_constraints = {
            'min_separation_distance_m': 50,
            'max_battery_for_emergency': 20,
            'collision_check_radius_m': 100,
            'emergency_landing_clearance_m': 200
        }
        
        # Initialize QoS profiles
        self.reliable_qos = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            durability=DurabilityPolicy.VOLATILE,
            depth=10
        )
        
        # Initialize subscribers for each drone
        self.init_drone_subscribers()
        
        # Coordination timers
        self.create_timer(1.0, self.check_collision_avoidance)
        self.create_timer(2.0, self.manage_charging_queue)
        self.create_timer(0.5, self.monitor_emergency_conditions)
        
        self.get_logger().info(f"Fleet Coordinator initialized for {self.num_drones} drones")
    
    def init_drone_subscribers(self):
        """Initialize ROS2 subscribers for all drones"""
        for drone_id in range(self.num_drones):
            namespace = f"drone_{drone_id}"
            
            # Position updates
            self.create_subscription(
                PoseStamped,
                f"/{namespace}/mavros/local_position/pose",
                lambda msg, did=str(drone_id): self.update_drone_position(did, msg),
                self.reliable_qos
            )
            
            # Battery status
            self.create_subscription(
                BatteryStatus,
                f"/{namespace}/mavros/battery",
                lambda msg, did=str(drone_id): self.update_drone_battery(did, msg),
                self.reliable_qos
            )
            
            # Flight state
            self.create_subscription(
                State,
                f"/{namespace}/mavros/state",
                lambda msg, did=str(drone_id): self.update_drone_state(did, msg),
                self.reliable_qos
            )
    
    def check_collision_avoidance(self):
        """Medium granularity collision avoidance coordination"""
        active_drones = [drone for drone in self.drone_states.values() if drone.armed]
        
        for i, drone_a in enumerate(active_drones):
            for drone_b in active_drones[i+1:]:
                distance = self.calculate_distance(drone_a.position, drone_b.position)
                
                if distance < self.safety_constraints['min_separation_distance_m']:
                    self.initiate_collision_avoidance(drone_a, drone_b, distance)
    
    def manage_charging_queue(self):
        """Smart charging queue management with priority"""
        low_battery_drones = [
            drone for drone in self.drone_states.values() 
            if drone.battery_percentage < 30
        ]
        
        # Sort by priority: emergency < scheduled < opportunistic
        charging_queue = sorted(low_battery_drones, 
                              key=lambda d: (d.battery_percentage, d.drone_id))
        
        for drone in charging_queue:
            self.assign_charging_station(drone)
    
    def monitor_emergency_conditions(self):
        """Real-time emergency monitoring and coordination"""
        for drone in self.drone_states.values():
            if drone.battery_percentage < self.safety_constraints['max_battery_for_emergency']:
                self.initiate_emergency_landing(drone)
```

**Mission Planner Node:**
```python
#!/usr/bin/env python3
"""
Mission Planner: Handles multi-stop mission planning with real-time optimization
Implements safety constraints and waypoint modification capabilities
"""

class MissionPlanner(Node):
    def __init__(self):
        super().__init__('mission_planner')
        
        self.safety_validator = SafetyConstraintValidator()
        self.route_optimizer = MultiConstraintRouter()
        
        # Service servers for mission management
        self.create_service(
            'assign_mission',
            AssignMission,
            self.handle_mission_assignment
        )
        
        self.create_service(
            'modify_waypoint',
            ModifyWaypoint,
            self.handle_waypoint_modification
        )
    
    def handle_waypoint_modification(self, request, response):
        """Real-time waypoint modification with safety validation"""
        drone_id = request.drone_id
        new_waypoint = request.new_waypoint
        current_mission = self.get_current_mission(drone_id)
        
        # Safety validation
        validation_result = self.safety_validator.validate_waypoint_modification(
            drone_id, new_waypoint, current_mission
        )
        
        if validation_result.approved:
            # Update mission waypoints
            self.update_mission_waypoints(current_mission.mission_id, new_waypoint)
            
            # Notify drone via MAVLink
            self.send_mission_update_to_drone(drone_id, new_waypoint)
            
            # Log modification
            self.log_waypoint_modification(
                drone_id, new_waypoint, request.modification_reason
            )
            
            response.success = True
            response.message = "Waypoint modified successfully"
        else:
            response.success = False
            response.message = f"Safety violation: {', '.join(validation_result.violations)}"
            response.alternative_suggestions = validation_result.alternative_suggestions
        
        return response
```

#### 3. Gazebo World Configuration

**Custom Delivery City World:**
```xml
<?xml version="1.0" ?>
<sdf version="1.6">
  <world name="delivery_city">
    <!-- Physics engine configuration -->
    <physics type="ode">
      <max_step_size>0.001</max_step_size>
      <real_time_factor>1.0</real_time_factor>
      <real_time_update_rate>1000</real_time_update_rate>
    </physics>
    
    <!-- Lighting and environment -->
    <include>
      <uri>model://sun</uri>
    </include>
    
    <!-- Ground plane -->
    <include>
      <uri>model://ground_plane</uri>
    </include>
    
    <!-- Urban environment models -->
    <include>
      <uri>model://office_building</uri>
      <pose>100 100 0 0 0 0</pose>
    </include>
    
    <include>
      <uri>model://warehouse</uri>
      <pose>-100 -100 0 0 0 0</pose>
    </include>
    
    <!-- Charging stations -->
    <model name="charging_station_alpha">
      <pose>50 50 0 0 0 0</pose>
      <static>true</static>
      <link name="base">
        <visual name="visual">
          <geometry>
            <cylinder>
              <radius>2</radius>
              <length>0.1</length>
            </cylinder>
          </geometry>
          <material>
            <ambient>0 1 0 1</ambient>
            <diffuse>0 1 0 1</diffuse>
          </material>
        </visual>
        <collision name="collision">
          <geometry>
            <cylinder>
              <radius>2</radius>
              <length>0.1</length>
            </cylinder>
          </geometry>
        </collision>
      </link>
    </model>
    
    <!-- Delivery zones -->
    <model name="delivery_zone_1">
      <pose>200 150 0 0 0 0</pose>
      <static>true</static>
      <link name="base">
        <visual name="visual">
          <geometry>
            <box>
              <size>10 10 0.1</size>
            </box>
          </geometry>
          <material>
            <ambient>0 0 1 1</ambient>
            <diffuse>0 0 1 1</diffuse>
          </material>
        </visual>
      </link>
    </model>
    
    <!-- Wind simulation plugin -->
    <plugin name="wind_plugin" filename="libgazebo_wind_plugin.so">
      <horizontal>
        <magnitude>
          <time_for_rise>10</time_for_rise>
          <sin>
            <amplitude_percent>0.05</amplitude_percent>
            <period>60</period>
          </sin>
        </magnitude>
        <direction>
          <time_for_rise>30</time_for_rise>
          <sin>
            <amplitude>5</amplitude>
            <period>40</period>
          </sin>
        </direction>
      </horizontal>
      <vertical>
        <noise type="gaussian">
          <mean>0</mean>
          <stddev>0.1</stddev>
        </noise>
      </vertical>
    </plugin>
    
    <!-- Traffic simulation for dynamic obstacles -->
    <plugin name="traffic_plugin" filename="libgazebo_traffic_plugin.so">
      <update_rate>10</update_rate>
      <vehicle_count>5</vehicle_count>
      <route_file>routes/city_traffic.xml</route_file>
    </plugin>
  </world>
</sdf>
```

#### 4. Multi-Constraint Routing System

**Route Optimization Algorithm:**
```python
class MultiConstraintRouter:
    def __init__(self):
        self.constraints = {
            'battery_range': {'weight': 0.30, 'critical': True},
            'payload_capacity': {'weight': 0.25, 'critical': True},
            'weather_conditions': {'weight': 0.15, 'critical': False},
            'restricted_airspace': {'weight': 0.20, 'critical': True},
            'time_windows': {'weight': 0.10, 'critical': False}
        }
    
    def calculate_optimal_route(self, mission_waypoints, drone_capabilities, real_time_conditions):
        """
        Multi-constraint route optimization using A* with custom cost functions
        """
        # Initialize route graph
        route_graph = self.build_route_graph(mission_waypoints)
        
        # Apply constraints to calculate edge costs
        for edge in route_graph.edges:
            total_cost = 0
            constraint_violations = []
            
            for constraint_type, config in self.constraints.items():
                cost, violation = self.evaluate_constraint(
                    edge, constraint_type, drone_capabilities, real_time_conditions
                )
                
                if violation and config['critical']:
                    constraint_violations.append(constraint_type)
                
                total_cost += cost * config['weight']
            
            # Mark invalid routes
            if constraint_violations:
                edge.cost = float('inf')
                edge.violations = constraint_violations
            else:
                edge.cost = total_cost
        
        # Execute A* pathfinding
        optimal_path = self.a_star_search(route_graph)
        
        return {
            'waypoints': optimal_path.waypoints,
            'total_cost': optimal_path.total_cost,
            'estimated_duration': optimal_path.duration_minutes,
            'battery_consumption': optimal_path.battery_required,
            'safety_margin': optimal_path.safety_buffer,
            'alternative_routes': self.generate_alternatives(route_graph, top_n=3)
        }
    
    def evaluate_constraint(self, edge, constraint_type, drone_capabilities, conditions):
        """Evaluate individual constraint impact on route segment"""
        if constraint_type == 'battery_range':
            distance = edge.distance_km
            consumption_rate = self.calculate_consumption_rate(
                distance, drone_capabilities.payload_current, conditions.wind_speed
            )
            required_battery = consumption_rate * distance
            available_battery = drone_capabilities.battery_current
            
            if required_battery > available_battery * 0.8:  # 20% safety margin
                return float('inf'), True  # Critical violation
            else:
                return required_battery / available_battery, False
        
        elif constraint_type == 'weather_conditions':
            wind_factor = min(conditions.wind_speed / 15.0, 1.0)  # Normalize to 0-1
            visibility_factor = 1.0 - (conditions.visibility_km / 10.0)
            precipitation_factor = conditions.precipitation_mm / 50.0
            
            weather_cost = (wind_factor + visibility_factor + precipitation_factor) / 3.0
            return weather_cost, weather_cost > 0.8
        
        # Additional constraint evaluations...
        return 0.0, False
```

#### 5. Safety Constraint Validation System

```python
class SafetyConstraintValidator:
    def __init__(self):
        self.safety_rules = {
            'min_battery_for_mission': 25.0,  # Percentage
            'max_payload_ratio': 0.85,  # 85% of max capacity
            'weather_visibility_min': 1000,  # Meters
            'wind_speed_max': 12.0,  # m/s
            'restricted_altitude_min': 50,  # Meters AGL
            'restricted_altitude_max': 150,  # Meters AGL
            'population_density_max': 1000,  # People per km²
        }
        
        self.emergency_protocols = {
            'battery_critical': self.initiate_emergency_landing,
            'weather_severe': self.initiate_weather_hold,
            'airspace_violation': self.initiate_reroute,
            'system_failure': self.initiate_fail_safe_mode
        }
    
    def validate_waypoint_modification(self, drone_id, new_waypoint, current_mission):
        """Comprehensive safety validation for real-time waypoint changes"""
        drone_state = self.get_current_drone_state(drone_id)
        validation_results = []
        
        # Battery range validation
        battery_check = self.validate_battery_range(
            drone_state, new_waypoint, current_mission.remaining_waypoints
        )
        validation_results.append(battery_check)
        
        # Airspace compliance
        airspace_check = self.validate_airspace_compliance(new_waypoint)
        validation_results.append(airspace_check)
        
        # Weather conditions
        weather_check = self.validate_weather_conditions(new_waypoint)
        validation_results.append(weather_check)
        
        # Collision risk assessment
        collision_check = self.validate_collision_risk(drone_id, new_waypoint)
        validation_results.append(collision_check)
        
        # Mission completion feasibility
        completion_check = self.validate_mission_completion(
            drone_state, new_waypoint, current_mission
        )
        validation_results.append(completion_check)
        
        # Aggregate results
        all_valid = all(check.valid for check in validation_results)
        violations = [check.reason for check in validation_results if not check.valid]
        
        return ValidationResult(
            approved=all_valid,
            violations=violations,
            alternative_suggestions=self.generate_safe_alternatives(new_waypoint) if not all_valid else [],
            safety_margin=min(check.safety_margin for check in validation_results)
        )
    
    def validate_battery_range(self, drone_state, new_waypoint, remaining_waypoints):
        """Calculate if drone has sufficient battery for modified route"""
        current_battery = drone_state.battery_percentage
        current_position = drone_state.position
        
        # Calculate distance to new waypoint
        distance_to_new = self.calculate_distance(current_position, new_waypoint)
        
        # Calculate distance for remaining mission
        remaining_distance = self.calculate_total_mission_distance(
            new_waypoint, remaining_waypoints
        )
        
        # Calculate battery consumption
        total_distance = distance_to_new + remaining_distance
        estimated_consumption = self.estimate_battery_consumption(
            total_distance, drone_state.payload_weight, drone_state.weather_conditions
        )
        
        # Apply safety margin (20% minimum battery on return)
        required_battery = estimated_consumption + 20.0
        
        return ValidationCheck(
            valid=current_battery >= required_battery,
            reason="Insufficient battery for modified route" if current_battery < required_battery else None,
            safety_margin=current_battery - required_battery,
            details={
                'current_battery': current_battery,
                'required_battery': required_battery,
                'total_distance_km': total_distance,
                'estimated_consumption': estimated_consumption
            }
        )
```

---

