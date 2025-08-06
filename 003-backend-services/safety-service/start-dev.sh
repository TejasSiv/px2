#!/bin/bash

# Safety Service Development Startup Script
# This script starts the Safety Service with proper configuration

echo "🛡️  Starting Safety Service (Development Mode)"
echo "============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ to continue."
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Please run this script from the safety-service directory."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if .env file exists, if not copy from example
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file from example..."
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your configuration before running the service."
fi

# Create logs directory if it doesn't exist
if [ ! -d "logs" ]; then
    echo "📁 Creating logs directory..."
    mkdir -p logs
fi

echo ""
echo "🔧 Configuration:"
echo "   - Node Environment: development"
echo "   - Port: ${PORT:-3005}"
echo "   - Database: ${DB_HOST:-localhost}:${DB_PORT:-5432}/${DB_NAME:-drone_fleet_db}"
echo "   - Redis: ${REDIS_HOST:-localhost}:${REDIS_PORT:-6379}"
echo ""

echo "🚀 Starting Safety Service..."
echo "   - API Server: http://localhost:${PORT:-3005}"
echo "   - WebSocket: ws://localhost:${PORT:-3005}/safety-ws"
echo "   - Health Check: http://localhost:${PORT:-3005}/health"
echo ""

echo "📊 Battery Monitoring Thresholds:"
echo "   - Emergency: ${BATTERY_EMERGENCY_THRESHOLD:-10}%"
echo "   - Critical: ${BATTERY_CRITICAL_THRESHOLD:-15}%"
echo "   - Warning: ${BATTERY_WARNING_THRESHOLD:-25}%"
echo "   - Low: ${BATTERY_LOW_THRESHOLD:-35}%"
echo ""

echo "⚠️  Make sure the following services are running:"
echo "   - PostgreSQL Database"
echo "   - Redis Cache"
echo "   - Telemetry Service (http://localhost:3001)"
echo ""

echo "Press Ctrl+C to stop the service"
echo "============================================="
echo ""

# Start the service
NODE_ENV=development npm run dev