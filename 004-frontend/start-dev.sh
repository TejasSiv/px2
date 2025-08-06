#!/bin/bash

echo "🚁 Starting Drone Fleet Management Frontend"
echo "=========================================="

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start development server
echo "🚀 Starting development server on http://localhost:3000"
echo "   The frontend will proxy API calls to the backend on port 3001"
echo ""
echo "📱 Components implemented:"
echo "   ✅ FleetMap - Interactive map with drone positions"
echo "   ✅ TelemetryPanel - Real-time metrics and charts"
echo "   ✅ FleetStatus - Drone overview with status cards"
echo "   ✅ Dark theme UI with professional styling"
echo ""
echo "🔧 Available commands:"
echo "   npm run dev     - Start development server"
echo "   npm run build   - Build for production"
echo "   npm run preview - Preview production build"
echo ""

npm run dev