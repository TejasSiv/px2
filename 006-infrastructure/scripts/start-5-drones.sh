#!/bin/bash

# Drone Fleet Management - 5-Drone Simulation Startup Script
# This script starts the Docker environment for 5-drone fleet testing

set -e

echo "🚁 Starting 5-Drone Fleet Management Simulation..."
echo "================================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Change to docker-compose directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="$SCRIPT_DIR/../docker-compose"
cd "$COMPOSE_DIR"

echo "📍 Working directory: $(pwd)"

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found in $COMPOSE_DIR"
    exit 1
fi

echo "🐳 Starting Docker containers..."

# Start the infrastructure services first (database, cache)
echo "  └── Starting database and cache services..."
docker-compose up -d postgres redis

echo "  └── Waiting for database to be ready..."
timeout 60 bash -c 'until docker-compose exec -T postgres pg_isready -U dfm_user -d drone_fleet_management; do sleep 2; done'

if [ $? -ne 0 ]; then
    echo "❌ Error: Database failed to start within 60 seconds"
    exit 1
fi

echo "  └── Database is ready!"

# Run database migrations
echo "🗄️  Running database migrations..."
docker-compose exec -T postgres psql -U dfm_user -d drone_fleet_management -f /docker-entrypoint-initdb.d/001_initial_schema.sql
docker-compose exec -T postgres psql -U dfm_user -d drone_fleet_management -f /docker-entrypoint-initdb.d/002_add_telemetry_tables.sql

# Seed the database with initial data
echo "🌱 Seeding database with test data..."
docker-compose exec -T postgres psql -U dfm_user -d drone_fleet_management -f /docker-entrypoint-initdb.d/001_drone_fleet.sql

# Start simulation services
echo "🎮 Starting simulation services..."
echo "  └── Starting Gazebo simulation..."
docker-compose up -d gazebo

echo "  └── Waiting for Gazebo to be ready..."
sleep 15

echo "  └── Starting PX4 drone fleet (5 drones)..."
echo "      • Starting Drone 0 (DRN001) - Alpha..."
docker-compose up -d px4_drone_0
sleep 3

echo "      • Starting Drone 1 (DRN002) - Bravo..."
docker-compose up -d px4_drone_1
sleep 3

echo "      • Starting Drone 2 (DRN003) - Charlie..."
docker-compose up -d px4_drone_2
sleep 3

echo "      • Starting Drone 3 (DRN004) - Delta..."
docker-compose up -d px4_drone_3
sleep 3

echo "      • Starting Drone 4 (DRN005) - Echo..."
docker-compose up -d px4_drone_4
sleep 5

echo "  └── Starting ROS2 coordinator..."
docker-compose up -d ros2_coordinator

echo "  └── Starting telemetry processing service..."
docker-compose up -d telemetry_service

echo ""
echo "🎉 5-Drone fleet simulation environment started successfully!"
echo ""
echo "📊 Service Status:"
echo "=================="

# Check service health
services=("postgres" "redis" "gazebo" "px4_drone_0" "px4_drone_1" "px4_drone_2" "px4_drone_3" "px4_drone_4" "ros2_coordinator" "telemetry_service")

for service in "${services[@]}"; do
    if docker-compose ps "$service" | grep -q "Up"; then
        echo "✅ $service: Running"
    else
        echo "❌ $service: Not running"
    fi
done

echo ""
echo "🔗 Connection Information:"
echo "=========================="
echo "📦 PostgreSQL: localhost:5432"
echo "   Database: drone_fleet_management"
echo "   Username: dfm_user"
echo "   Password: dfm_password"
echo ""
echo "🔗 Redis: localhost:6379"
echo ""
echo "🚁 PX4 MAVLink Ports:"
echo "   • Drone 0 (DRN001): localhost:14550"
echo "   • Drone 1 (DRN002): localhost:14551"
echo "   • Drone 2 (DRN003): localhost:14552"
echo "   • Drone 3 (DRN004): localhost:14553"
echo "   • Drone 4 (DRN005): localhost:14554"
echo ""
echo "🌐 Telemetry Service: localhost:3001"
echo "   • REST API: http://localhost:3001/api"
echo "   • WebSocket: ws://localhost:3001/ws/telemetry"
echo "   • Health: http://localhost:3001/health"
echo ""

echo "🛠️  Useful Commands:"
echo "==================="
echo "• View logs: docker-compose logs -f [service_name]"
echo "• Stop all: docker-compose down"
echo "• Restart service: docker-compose restart [service_name]"
echo "• Connect to DB: psql -h localhost -p 5432 -U dfm_user -d drone_fleet_management"
echo "• Test telemetry API: curl http://localhost:3001/api/fleet/telemetry"
echo ""

echo "📊 Real-time Monitoring:"
echo "======================="
echo "• Fleet telemetry: curl http://localhost:3001/api/fleet/telemetry"
echo "• Drone status: curl http://localhost:3001/api/drones/status"
echo "• Service stats: curl http://localhost:3001/api/stats"
echo "• WebSocket test: wscat -c ws://localhost:3001/ws/telemetry"
echo ""

echo "📚 Next Steps:"
echo "=============="
echo "1. Monitor drone connections: docker-compose logs -f telemetry_service"
echo "2. Check telemetry flow: curl http://localhost:3001/api/fleet/telemetry"
echo "3. Verify database storage: psql connection and SELECT from telemetry_realtime"
echo "4. Test WebSocket streaming: Connect to ws://localhost:3001/ws/telemetry"
echo "5. Monitor Redis cache: redis-cli -h localhost KEYS 'telemetry:*'"
echo ""

# Optional: Show recent logs from critical services
echo "📄 Recent logs (last 5 lines from critical services):"
echo "===================================================="
for service in "telemetry_service" "px4_drone_0" "px4_drone_1"; do
    echo ""
    echo "--- $service ---"
    docker-compose logs --tail=5 "$service" 2>/dev/null || echo "No logs available"
done

echo ""
echo "🚀 5-drone fleet simulation is ready for telemetry testing!"
echo "   Monitor telemetry flow with: watch -n 2 'curl -s http://localhost:3001/api/stats | jq .'"