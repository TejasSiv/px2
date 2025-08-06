## Integration Architecture

### Real-time Data Flow

#### WebSocket Communication Layer

```javascript
// API Gateway WebSocket Server
class FleetWebSocketServer {
    constructor() {
        this.wss = new WebSocketServer({ port: 3001 });
        this.clients = new Map();
        this.redis = new Redis({ host: 'redis', port: 6379 });
        this.ros2Bridge = new ROS2Bridge();
        
        this.initializeWebSocketHandlers();
        this.startTelemetryStream();
    }
    
    initializeWebSocketHandlers() {
        this.wss.on('connection', (ws, request) => {
            const clientId = this.generateClientId();
            this.clients.set(clientId, {
                socket: ws,
                subscriptions: new Set(),
                lastHeartbeat: Date.now()
            });
            
            ws.on('message', (data) => {
                this.handleClientMessage(clientId, JSON.parse(data));
            });
            
            ws.on('close', () => {
                this.clients.delete(clientId);
            });
            
            // Send initial fleet status
            this.sendFleetStatus(clientId);
        });
    }
    
    async startTelemetryStream() {
        // Subscribe to Redis streams for real-time updates
        const subscriber = this.redis.duplicate();
        
        subscriber.psubscribe('telemetry:*', 'mission:*', 'coordination:*', 'analytics:*');
        
        subscriber.on('pmessage', (pattern, channel, message) => {
            const data = JSON.parse(message);
            this.broadcastToSubscribedClients(channel, data);
        });
        
        // Periodic fleet status updates
        setInterval(() => {
            this.broadcastFleetStatus();
        }, 5000); // Every 5 seconds
    }
    
    handleClientMessage(clientId, message) {
        switch (message.type) {
            case 'subscribe_telemetry':
                this.handleTelemetrySubscription(clientId, message.drone_ids);
                break;
                
            case 'modify_waypoint':
                this.handleWaypointModification(clientId, message);
                break;
                
            case 'assign_mission':
                this.handleMissionAssignment(clientId, message);
                break;
                
            case 'emergency_land':
                this.handleEmergencyLanding(clientId, message.drone_id);
                break;
                
            case 'coordination_override':
                this.handleCoordinationOverride(clientId, message);
                break;
        }
    }
    
    async handleWaypointModification(clientId, message) {
        const { drone_id, new_waypoint, modification_reason } = message;
        
        try {
            // Call ROS2 service for waypoint modification
            const result = await this.ros2Bridge.modifyWaypoint({
                drone_id,
                new_waypoint,
                modification_reason
            });
            
            // Send response to client
            this.sendToClient(clientId, {
                type: 'waypoint_modification_response',
                success: result.success,
                message: result.message,
                alternative_suggestions: result.alternative_suggestions
            });
            
            // Broadcast update to all subscribed clients
            if (result.success) {
                this.broadcastMissionUpdate(drone_id, {
                    type: 'waypoint_modified',
                    drone_id,
                    new_waypoint,
                    modification_reason,
                    timestamp: new Date().toISOString()
                });
            }
            
        } catch (error) {
            this.sendToClient(clientId, {
                type: 'waypoint_modification_response',
                success: false,
                message: `Error: ${error.message}`
            });
        }
    }
}
```

### Live + Hourly Analytics Integration

#### Analytics Processing Pipeline

```python
class AnalyticsProcessor:
    def __init__(self):
        self.redis_client = redis.Redis(host='redis', port=6379, decode_responses=True)
        self.db_connection = psycopg2.connect(
            host='postgres', database='drone_fleet', user='user', password='pass'
        )
        
        # Start processing pipelines
        self.start_live_analytics_processor()
        self.start_hourly_aggregation_processor()
    
    def start_live_analytics_processor(self):
        """Process real-time analytics every 5 seconds"""
        def process_live_metrics():
            try:
                # Aggregate current drone states
                live_metrics = self.calculate_live_metrics()
                
                # Update Redis with live analytics
                self.redis_client.hset('analytics:live', mapping=live_metrics)
                
                # Update performance metrics table
                self.update_performance_metrics(live_metrics)
                
                # Check for threshold violations
                self.check_alert_thresholds(live_metrics)
                
            except Exception as e:
                logging.error(f"Error in live analytics processing: {e}")
        
        # Schedule every 5 seconds
        schedule.every(5).seconds.do(process_live_metrics)
    
    def start_hourly_aggregation_processor(self):
        """Process hourly analytics aggregation"""
        def process_hourly_aggregation():
            try:
                current_hour = datetime.now().replace(minute=0, second=0, microsecond=0)
                previous_hour = current_hour - timedelta(hours=1)
                
                # Aggregate telemetry data from previous hour
                hourly_metrics = self.calculate_hourly_metrics(previous_hour, current_hour)
                
                # Store in hourly analytics table
                self.store_hourly_analytics(hourly_metrics, previous_hour)
                
                # Update trend calculations
                self.update_trend_analysis(hourly_metrics, previous_hour)
                
                # Generate automated insights
                insights = self.generate_automated_insights(hourly_metrics)
                self.store_insights(insights, previous_hour)
                
            except Exception as e:
                logging.error(f"Error in hourly aggregation: {e}")
        
        # Schedule at the start of each hour
        schedule.every().hour.at(":02").do(process_hourly_aggregation)
    
    def calculate_live_metrics(self):
        """Calculate real-time fleet metrics"""
        # Get all current drone telemetry
        drone_telemetry = {}
        for drone_id in range(5):
            telemetry_key = f"telemetry:drone_{drone_id}"
            telemetry = self.redis_client.hgetall(telemetry_key)
            if telemetry:
                drone_telemetry[f"drone_{drone_id}"] = telemetry
        
        # Calculate fleet-wide metrics
        active_drones = len([d for d in drone_telemetry.values() if d.get('armed') == 'true'])
        total_battery = sum(float(d.get('battery', 0)) for d in drone_telemetry.values())
        avg_battery = total_battery / len(drone_telemetry) if drone_telemetry else 0
        
        # Get active missions
        active_missions_pattern = "mission:*"
        active_missions = []
        for key in self.redis_client.scan_iter(match=active_missions_pattern):
            mission_data = self.redis_client.hgetall(key)
            if mission_data.get('status') == 'active':
                active_missions.append(mission_data)
        
        # Calculate coordination events
        coordination_events = self.redis_client.llen('coordination:active')
        
        return {
            'timestamp': datetime.now().isoformat(),
            'active_drones': active_drones,
            'total_drones': len(drone_telemetry),
            'fleet_battery_average': round(avg_battery, 2),
            'active_missions': len(active_missions),
            'coordination_events_active': coordination_events,
            'fleet_utilization_percentage': round((active_drones / 5) * 100, 2),
            'emergency_status': self.calculate_emergency_status(drone_telemetry)
        }
    
    def calculate_hourly_metrics(self, start_time, end_time):
        """Calculate comprehensive hourly metrics from database"""
        with self.db_connection.cursor(cursor_factory=RealDictCursor) as cursor:
            hourly_metrics = {}
            
            # Mission completion metrics
            cursor.execute("""
                SELECT 
                    COUNT(*) as missions_completed,
                    AVG(actual_duration_minutes) as avg_duration,
                    COUNT(*) FILTER (WHERE status = 'completed') as successful_missions,
                    COUNT(*) FILTER (WHERE status = 'failed') as failed_missions
                FROM missions 
                WHERE completed_at BETWEEN %s AND %s
            """, (start_time, end_time))
            
            mission_stats = cursor.fetchone()
            hourly_metrics.update(dict(mission_stats))
            
            # Battery and charging metrics
            cursor.execute("""
                SELECT 
                    AVG(end_battery_percentage - start_battery_percentage) as avg_charge_gained,
                    AVG(EXTRACT(EPOCH FROM (end_time - start_time))/60) as avg_charging_time,
                    COUNT(*) as charging_sessions
                FROM charging_sessions 
                WHERE start_time BETWEEN %s AND %s
            """, (start_time, end_time))
            
            charging_stats = cursor.fetchone()
            hourly_metrics.update(dict(charging_stats))
            
            # Coordination events analysis
            cursor.execute("""
                SELECT 
                    event_type,
                    COUNT(*) as event_count,
                    AVG(resolution_time_ms) as avg_resolution_time
                FROM coordination_events 
                WHERE created_at BETWEEN %s AND %s
                GROUP BY event_type
            """, (start_time, end_time))
            
            coordination_stats = cursor.fetchall()
            for stat in coordination_stats:
                hourly_metrics[f"coordination_{stat['event_type']}_count"] = stat['event_count']
                hourly_metrics[f"coordination_{stat['event_type']}_avg_resolution"] = stat['avg_resolution_time']
            
            # Fleet utilization
            cursor.execute("""
                WITH hourly_snapshots AS (
                    SELECT 
                        snapshot_time,
                        COUNT(*) FILTER (WHERE distance_traveled_m > 0) as active_drones
                    FROM drone_telemetry_snapshots 
                    WHERE snapshot_time BETWEEN %s AND %s
                    GROUP BY snapshot_time
                )
                SELECT AVG(active_drones::float / 5 * 100) as avg_utilization_percentage
                FROM hourly_snapshots
            """, (start_time, end_time))
            
            utilization_result = cursor.fetchone()
            hourly_metrics['fleet_utilization_percentage'] = utilization_result['avg_utilization_percentage']
            
            return hourly_metrics
```

### Performance Specifications

#### System Performance Targets

**Real-time Performance:**
- **Telemetry Update Frequency**: 5-10 seconds per drone
- **WebSocket Latency**: < 100ms for dashboard updates
- **Mission Assignment Time**: < 2 seconds for optimal drone selection
- **Waypoint Modification Response**: < 500ms including safety validation
- **Coordination Event Resolution**: < 3 seconds for collision avoidance

**Scalability Metrics:**
- **Current Capacity**: 5 drones with full telemetry and analytics
- **Target Scalability**: 100+ drones with horizontal scaling
