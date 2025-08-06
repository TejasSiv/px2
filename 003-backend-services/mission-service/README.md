# Mission Service

A comprehensive mission management microservice for the Multi-Drone Fleet Management System. Provides CRUD operations for missions and waypoints, real-time mission monitoring, and WebSocket-based updates.

## Features

### Core Mission Management
- **Full CRUD Operations**: Create, read, update, and delete missions
- **Waypoint Management**: Complete waypoint lifecycle management
- **Mission Assignment**: Assign missions to specific drones
- **Progress Tracking**: Real-time mission progress monitoring
- **Status Management**: Comprehensive mission status handling

### Advanced Capabilities
- **Real-time Updates**: WebSocket server for live mission updates
- **Mission Monitoring**: Automated monitoring and timeout detection
- **Route Calculation**: Distance and time estimation for mission routes
- **Data Validation**: Comprehensive input validation and business rules
- **Caching Strategy**: Redis caching for performance optimization

### API Features
- **RESTful API**: Well-structured REST endpoints
- **Input Validation**: Joi-based schema validation
- **Error Handling**: Comprehensive error handling and logging
- **Documentation**: OpenAPI/Swagger documentation
- **Health Monitoring**: Service health and status endpoints

## Quick Start

### Prerequisites
- Node.js 16+
- PostgreSQL 13+
- Redis 6+

### Installation

```bash
# Clone the repository (if not already done)
cd 003-backend-services/mission-service

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Initialize database (ensure PostgreSQL is running)
npm run migrate

# Seed with test data (optional)
npm run seed

# Start the service
npm run dev
```

### Docker Setup (Alternative)

```bash
# Build and run with Docker
docker build -t mission-service .
docker run -p 3001:3001 --env-file .env mission-service
```

## API Endpoints

### Mission Management

#### GET /api/missions
Get all missions with optional filtering
```bash
curl "http://localhost:3001/api/missions?status=active&limit=10"
```

#### GET /api/missions/:id
Get a specific mission by ID
```bash
curl "http://localhost:3001/api/missions/123e4567-e89b-12d3-a456-426614174000"
```

#### POST /api/missions
Create a new mission
```bash
curl -X POST "http://localhost:3001/api/missions" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Emergency Medical Delivery",
    "description": "Urgent medical supply delivery",
    "priority": 9,
    "waypoints": [
      {
        "position": {"lat": 37.7749, "lng": -122.4194, "alt": 50},
        "action": "pickup",
        "notes": "Hospital pickup point"
      },
      {
        "position": {"lat": 37.7849, "lng": -122.4094, "alt": 50},
        "action": "delivery",
        "notes": "Emergency delivery location"
      }
    ]
  }'
```

#### PUT /api/missions/:id
Update a mission
```bash
curl -X PUT "http://localhost:3001/api/missions/123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "active",
    "progress": 25
  }'
```

#### DELETE /api/missions/:id
Delete a mission
```bash
curl -X DELETE "http://localhost:3001/api/missions/123e4567-e89b-12d3-a456-426614174000"
```

#### POST /api/missions/:id/assign
Assign mission to drone
```bash
curl -X POST "http://localhost:3001/api/missions/123e4567-e89b-12d3-a456-426614174000/assign" \
  -H "Content-Type: application/json" \
  -d '{"droneId": "drone-001"}'
```

#### PUT /api/missions/:id/progress
Update mission progress
```bash
curl -X PUT "http://localhost:3001/api/missions/123e4567-e89b-12d3-a456-426614174000/progress" \
  -H "Content-Type: application/json" \
  -d '{"progress": 75, "currentWaypoint": 1}'
```

### Waypoint Management

#### GET /api/waypoints/mission/:missionId
Get waypoints for a mission
```bash
curl "http://localhost:3001/api/waypoints/mission/123e4567-e89b-12d3-a456-426614174000"
```

#### POST /api/waypoints
Create a new waypoint
```bash
curl -X POST "http://localhost:3001/api/waypoints" \
  -H "Content-Type: application/json" \
  -d '{
    "missionId": "123e4567-e89b-12d3-a456-426614174000",
    "position": {"lat": 37.7749, "lng": -122.4194, "alt": 50},
    "action": "hover",
    "hoverTime": 30,
    "notes": "Survey point"
  }'
```

#### PUT /api/waypoints/:id/complete
Mark waypoint as completed
```bash
curl -X PUT "http://localhost:3001/api/waypoints/waypoint-001/complete" \
  -H "Content-Type: application/json" \
  -d '{"actualTime": 45}'
```

### Utility Endpoints

#### GET /api/missions/stats
Get mission statistics
```bash
curl "http://localhost:3001/api/missions/stats"
```

#### GET /api/missions/active
Get active missions
```bash
curl "http://localhost:3001/api/missions/active"
```

#### POST /api/validate/mission
Validate mission data
```bash
curl -X POST "http://localhost:3001/api/validate/mission" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Mission",
    "waypoints": [...]
  }'
```

#### POST /api/calculate/route
Calculate route metrics
```bash
curl -X POST "http://localhost:3001/api/calculate/route" \
  -H "Content-Type: application/json" \
  -d '{
    "waypoints": [...],
    "speed": 12
  }'
```

## WebSocket API

Connect to `ws://localhost:3001/ws` for real-time updates.

### Message Types

#### Subscribe to mission updates
```json
{
  "type": "subscribe_missions",
  "requestId": "req-001"
}
```

#### Get active missions
```json
{
  "type": "get_active_missions",
  "requestId": "req-002"
}
```

#### Get mission status
```json
{
  "type": "get_mission_status",
  "data": {"missionId": "123e4567-e89b-12d3-a456-426614174000"},
  "requestId": "req-003"
}
```

### Broadcast Events
- `mission_created` - New mission created
- `mission_updated` - Mission data updated
- `mission_deleted` - Mission deleted
- `mission_assigned` - Mission assigned to drone
- `mission_progress` - Mission progress updated
- `waypoint_completed` - Waypoint marked completed

## Data Models

### Mission
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "status": "pending|active|paused|completed|failed|cancelled",
  "priority": "number (1-10)",
  "waypoints": "array of waypoint objects",
  "assignedDrone": "string (drone ID)",
  "progress": "number (0-100)",
  "currentWaypoint": "number",
  "estimatedDuration": "number (seconds)",
  "actualDuration": "number (seconds)",
  "createdAt": "ISO timestamp",
  "startedAt": "ISO timestamp",
  "completedAt": "ISO timestamp",
  "metadata": "object"
}
```

### Waypoint
```json
{
  "id": "uuid",
  "missionId": "uuid",
  "sequence": "number",
  "position": {
    "lat": "number",
    "lng": "number", 
    "alt": "number"
  },
  "action": "pickup|delivery|hover|survey|navigation|landing|takeoff",
  "parameters": "object",
  "hoverTime": "number (seconds)",
  "completed": "boolean",
  "notes": "string",
  "estimatedTime": "number (seconds)",
  "actualTime": "number (seconds)"
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment | development |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | drone_fleet_management |
| `REDIS_HOST` | Redis host | localhost |
| `REDIS_PORT` | Redis port | 6379 |
| `LOG_LEVEL` | Logging level | info |

### Service Configuration

The service supports various configuration options for mission management:

- **Mission Timeouts**: Automatic failure for long-running missions
- **Progress Monitoring**: Regular progress checks and updates
- **Assignment Rules**: Drone assignment validation
- **Validation Rules**: Business logic validation for missions
- **Cache Strategy**: Redis caching for performance

## Development

### Scripts

```bash
# Development server with hot reload
npm run dev

# Production server
npm start

# Run tests
npm test

# Database migrations
npm run migrate

# Seed test data
npm run seed

# Lint code
npm run lint

# Validate mission data
npm run validate
```

### Testing

```bash
# Run all tests
npm test

# Run integration tests
npm run test:integration

# Run unit tests
npm run test:unit

# Test coverage
npm run test:coverage
```

### Database Schema

The service uses PostgreSQL with the following main tables:

- `missions` - Mission data and metadata
- `waypoints` - Waypoint definitions and progress
- `mission_assignments` - Drone assignment history
- `mission_logs` - Audit trail and events

## Monitoring

### Health Check
```bash
curl "http://localhost:3001/health"
```

### Service Status
```bash
curl "http://localhost:3001/api/status"
```

### Metrics
- Active mission count
- Mission completion rate
- Average mission duration
- WebSocket connection count
- Database performance metrics

## Integration

### With Other Services

The Mission Service integrates with:

- **Telemetry Service**: Mission progress updates
- **Coordination Service**: Multi-drone coordination
- **Safety Service**: Mission safety validation
- **Config Service**: Dynamic configuration

### Frontend Integration

WebSocket connection for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Mission update:', message);
};

// Subscribe to mission updates
ws.send(JSON.stringify({
  type: 'subscribe_missions'
}));
```

## Security Considerations

- Input validation on all endpoints
- Rate limiting for API requests
- Authentication integration ready
- SQL injection prevention
- WebSocket connection limits

## Performance

- Redis caching for frequent queries
- Database query optimization
- Connection pooling
- Efficient WebSocket broadcasting
- Pagination for large datasets

## Troubleshooting

### Common Issues

1. **Database connection errors**
   - Check PostgreSQL is running
   - Verify connection credentials
   - Ensure database exists

2. **Redis connection issues**
   - Verify Redis is running
   - Check Redis configuration

3. **WebSocket connection problems**
   - Check firewall settings
   - Verify WebSocket path
   - Monitor connection limits

### Logs

Logs are stored in:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- `logs/exceptions.log` - Uncaught exceptions

## API Documentation

Full API documentation is available at:
- Development: `http://localhost:3001/api/docs`
- Swagger YAML: `api-docs/swagger.yaml`

## License

MIT License - see LICENSE file for details.