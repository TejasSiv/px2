#!/bin/bash

# Telemetry Testing Script
# Tests the 5-drone telemetry flow from simulation to database

echo "🧪 Testing 5-Drone Telemetry Flow..."
echo "===================================="

TELEMETRY_URL="http://localhost:3001"
POSTGRES_CMD="docker-compose exec -T postgres psql -U dfm_user -d drone_fleet_management"

echo ""
echo "1️⃣ Testing Telemetry Service Health..."
response=$(curl -s -w "%{http_code}" -o /tmp/health_response.json "$TELEMETRY_URL/health")
if [ "$response" = "200" ]; then
    echo "✅ Telemetry service is healthy"
    cat /tmp/health_response.json | jq '.'
else
    echo "❌ Telemetry service health check failed (HTTP $response)"
    exit 1
fi

echo ""
echo "2️⃣ Testing Database Connection..."
db_test=$($POSTGRES_CMD -c "SELECT COUNT(*) FROM drones;" 2>/dev/null | grep -E "^\s*[0-9]+\s*$" | xargs)
if [ ! -z "$db_test" ]; then
    echo "✅ Database connection successful - Found $db_test drones"
else
    echo "❌ Database connection failed"
    exit 1
fi

echo ""
echo "3️⃣ Testing Redis Connection..."
redis_test=$(docker-compose exec -T redis redis-cli ping 2>/dev/null)
if [ "$redis_test" = "PONG" ]; then
    echo "✅ Redis connection successful"
else
    echo "❌ Redis connection failed"
    exit 1
fi

echo ""
echo "4️⃣ Checking Drone Connections..."
response=$(curl -s "$TELEMETRY_URL/api/drones/status")
echo "$response" | jq '.data[] | {id: .id, connected: .connected, telemetryCount: .telemetryCount}'

echo ""
echo "5️⃣ Testing Fleet Telemetry API..."
response=$(curl -s "$TELEMETRY_URL/api/fleet/telemetry")
count=$(echo "$response" | jq '.count // 0')
echo "📊 Fleet telemetry records: $count"
if [ "$count" -gt 0 ]; then
    echo "✅ Fleet telemetry API working"
    echo "$response" | jq '.data[0] | {drone_id: .drone_id, battery: .battery_level_percent, timestamp: .received_at}'
else
    echo "⚠️  No telemetry data yet (drones may still be starting)"
fi

echo ""
echo "6️⃣ Testing Individual Drone Telemetry..."
for drone in "DRN001" "DRN002" "DRN003" "DRN004" "DRN005"; do
    response=$(curl -s "$TELEMETRY_URL/api/drones/$drone/telemetry?limit=1")
    count=$(echo "$response" | jq '.count // 0')
    if [ "$count" -gt 0 ]; then
        echo "✅ $drone: Telemetry available"
    else
        echo "⚠️  $drone: No telemetry data yet"
    fi
done

echo ""
echo "7️⃣ Checking Database Telemetry Storage..."
sleep 5  # Wait a bit for data to be written
db_count=$($POSTGRES_CMD -c "SELECT COUNT(*) FROM telemetry_realtime WHERE received_at > NOW() - INTERVAL '2 minutes';" 2>/dev/null | grep -E "^\s*[0-9]+\s*$" | xargs)
if [ ! -z "$db_count" ] && [ "$db_count" -gt 0 ]; then
    echo "✅ Database has $db_count recent telemetry records"
    
    # Show sample data
    echo ""
    echo "📊 Sample telemetry data from database:"
    $POSTGRES_CMD -c "
        SELECT d.drone_id, t.battery_level_percent, t.altitude_m, t.received_at 
        FROM telemetry_realtime t 
        JOIN drones d ON t.drone_id = d.id 
        ORDER BY t.received_at DESC 
        LIMIT 5;
    " 2>/dev/null
else
    echo "⚠️  No recent telemetry data in database"
fi

echo ""
echo "8️⃣ Checking Redis Cache..."
redis_keys=$(docker-compose exec -T redis redis-cli KEYS "telemetry:*" 2>/dev/null | wc -l)
if [ "$redis_keys" -gt 0 ]; then
    echo "✅ Redis has $redis_keys telemetry cache keys"
    
    # Show sample cached data
    echo ""
    echo "📊 Sample cached telemetry keys:"
    docker-compose exec -T redis redis-cli KEYS "telemetry:latest:*" 2>/dev/null | head -3
else
    echo "⚠️  No telemetry data in Redis cache"
fi

echo ""
echo "9️⃣ Testing Service Statistics..."
response=$(curl -s "$TELEMETRY_URL/api/stats")
echo "📈 Service Statistics:"
echo "$response" | jq '{
    telemetry_counters: .data.telemetry_counters,
    database_connected: .data.database.connected,
    cache_connected: .data.cache.connected,
    uptime_seconds: .data.uptime_seconds
}'

echo ""
echo "🔟 Testing WebSocket Connection..."
# Simple WebSocket test (requires wscat to be installed)
if command -v wscat &> /dev/null; then
    echo "Testing WebSocket connection (5 seconds)..."
    timeout 5 wscat -c "ws://localhost:3001/ws/telemetry" <<EOF || echo "WebSocket test completed"
{"type": "subscribe", "target": "fleet:all"}
EOF
else
    echo "⚠️  wscat not available for WebSocket testing"
    echo "   Install with: npm install -g wscat"
    echo "   Then test with: wscat -c ws://localhost:3001/ws/telemetry"
fi

echo ""
echo "✅ Telemetry Testing Complete!"
echo ""
echo "📋 Summary:"
echo "==========="
echo "• Telemetry Service: Running on http://localhost:3001"
echo "• WebSocket Stream: ws://localhost:3001/ws/telemetry"
echo "• Database Records: $db_count recent telemetry entries"
echo "• Redis Cache Keys: $redis_keys cache entries"
echo ""
echo "🔧 Manual Testing Commands:"
echo "=========================="
echo "• Watch live telemetry: watch -n 2 'curl -s http://localhost:3001/api/fleet/telemetry | jq .'"
echo "• Monitor database: watch -n 5 'psql -h localhost -p 5432 -U dfm_user -d drone_fleet_management -c \"SELECT COUNT(*) FROM telemetry_realtime WHERE received_at > NOW() - INTERVAL \\'1 minute\\';\"'"
echo "• Check Redis cache: redis-cli -h localhost MONITOR"
echo "• WebSocket testing: wscat -c ws://localhost:3001/ws/telemetry"
echo ""
echo "🚀 If all tests pass, your 5-drone telemetry system is working correctly!"