#!/bin/bash

echo "🐳 Docker Setup and Deployment Script for Drone Fleet Management"
echo "================================================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if Docker is installed
if command_exists docker; then
    echo "✅ Docker is already installed"
    docker --version
else
    echo "📦 Installing Docker..."
    
    # Update package list
    sudo apt-get update
    
    # Install prerequisites
    sudo apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Set up repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Add current user to docker group
    sudo usermod -aG docker $USER
    
    echo "✅ Docker installed successfully"
    echo "⚠️  Please log out and back in for group changes to take effect"
fi

# Check if Docker Compose is available
if command_exists docker-compose || docker compose version >/dev/null 2>&1; then
    echo "✅ Docker Compose is available"
    if command_exists docker-compose; then
        docker-compose --version
    else
        docker compose version
    fi
else
    echo "📦 Installing Docker Compose..."
    
    # Install docker-compose-plugin if not available
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
    
    # Alternative: Install standalone docker-compose
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    echo "✅ Docker Compose installed"
fi

# Start Docker service
echo "🚀 Starting Docker service..."
sudo systemctl start docker
sudo systemctl enable docker

echo ""
echo "🧪 Testing Docker installation..."
if docker run hello-world; then
    echo "✅ Docker is working correctly"
else
    echo "❌ Docker test failed"
    exit 1
fi

echo ""
echo "🔧 Setting up Drone Fleet Management System..."

# Navigate to docker-compose directory
cd 006-infrastructure/docker-compose

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p ../../002-simulation/gazebo/worlds
mkdir -p ../../002-simulation/px4-sitl
mkdir -p ../../002-simulation/ros2-nodes

# Check if delivery_city.world exists, create a placeholder if not
WORLD_FILE="../../002-simulation/gazebo/worlds/delivery_city.world"
if [ ! -f "$WORLD_FILE" ]; then
    echo "🌍 Creating placeholder Gazebo world file..."
    cat > "$WORLD_FILE" << 'EOF'
<?xml version="1.0" ?>
<sdf version="1.6">
  <world name="delivery_city">
    <physics name="default_physics" default="0" type="ode">
      <gravity>0 0 -9.8066</gravity>
      <ode>
        <solver>
          <type>quick</type>
          <iters>10</iters>
          <sor>1.3</sor>
        </solver>
        <constraints>
          <cfm>0</cfm>
          <erp>0.2</erp>
          <contact_max_correcting_vel>100</contact_max_correcting_vel>
          <contact_surface_layer>0.001</contact_surface_layer>
        </constraints>
      </ode>
      <max_step_size>0.002</max_step_size>
      <real_time_factor>1.0</real_time_factor>
      <real_time_update_rate>500</real_time_update_rate>
    </physics>
    
    <include>
      <uri>model://ground_plane</uri>
    </include>
    
    <include>
      <uri>model://sun</uri>
    </include>
    
    <!-- Simple urban environment for delivery simulation -->
    <model name="delivery_zone_1">
      <pose>100 100 0 0 0 0</pose>
      <static>true</static>
      <link name="box">
        <visual name="visual">
          <geometry>
            <box><size>10 10 1</size></box>
          </geometry>
          <material><ambient>0 1 0 1</ambient></material>
        </visual>
        <collision name="collision">
          <geometry>
            <box><size>10 10 1</size></box>
          </geometry>
        </collision>
      </link>
    </model>
    
  </world>
</sdf>
EOF
    echo "✅ Created delivery_city.world"
fi

echo ""
echo "🏗️  Building and starting services..."

# Build and start services
if command_exists docker-compose; then
    COMPOSE_CMD="docker-compose"
else
    COMPOSE_CMD="docker compose"
fi

# Pull base images first
echo "⬇️  Pulling base images..."
docker pull postgres:15
docker pull redis:7-alpine
docker pull osrf/ros:humble-desktop
docker pull node:18-alpine

# Build services
echo "🔨 Building custom images..."
$COMPOSE_CMD build

# Start infrastructure services first
echo "🗄️  Starting database services..."
$COMPOSE_CMD up -d postgres redis

# Wait for databases to be ready
echo "⏳ Waiting for databases to be ready..."
sleep 10

# Start simulation services
echo "🚁 Starting simulation services..."
$COMPOSE_CMD up -d gazebo

# Wait for Gazebo to be ready
echo "⏳ Waiting for Gazebo to be ready..."
sleep 15

# Start PX4 drones
echo "🛩️  Starting PX4 drones..."
$COMPOSE_CMD up -d px4_drone_0 px4_drone_1 px4_drone_2 px4_drone_3 px4_drone_4

# Wait for drones to be ready
echo "⏳ Waiting for drones to initialize..."
sleep 20

# Start backend services
echo "⚙️  Starting backend services..."
$COMPOSE_CMD up -d telemetry_service

# Start ROS2 coordinator
echo "🤖 Starting ROS2 coordinator..."
$COMPOSE_CMD up -d ros2_coordinator

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📊 Service Status:"
$COMPOSE_CMD ps

echo ""
echo "🔍 Health Checks:"
echo "  Database: docker exec dfm_postgres pg_isready"
echo "  Redis: docker exec dfm_redis redis-cli ping"
echo "  Telemetry Service: curl http://localhost:3001/health"
echo ""
echo "📡 API Endpoints:"
echo "  Health: http://localhost:3001/health"
echo "  Fleet Status: http://localhost:3001/api/fleet/telemetry"
echo "  Drone Status: http://localhost:3001/api/drones/status"
echo "  Statistics: http://localhost:3001/api/stats"
echo ""
echo "🔧 Management Commands:"
echo "  View logs: $COMPOSE_CMD logs -f [service_name]"
echo "  Stop all: $COMPOSE_CMD down"
echo "  Restart: $COMPOSE_CMD restart [service_name]"
echo "  Scale drones: $COMPOSE_CMD up -d --scale px4_drone_0=2"
echo ""
echo "✅ Drone Fleet Management System is ready!"