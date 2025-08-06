#!/bin/bash

# Wait for Gazebo to be ready
echo "Waiting for Gazebo..."
while ! nc -z gazebo 11345; do
  sleep 1
done
echo "Gazebo is ready!"

# Set PX4 environment variables
export PX4_SIM_MODEL=${PX4_SIM_MODEL:-iris}
export PX4_INSTANCE=${PX4_INSTANCE:-0}
export PX4_SIM_SPEED_FACTOR=${PX4_SIM_SPEED_FACTOR:-1}
export DRONE_ID=${DRONE_ID:-DRN001}
export SPAWN_X=${SPAWN_X:-0}
export SPAWN_Y=${SPAWN_Y:-0}

# Calculate ports based on instance
MAVLINK_PORT=$((14550 + PX4_INSTANCE))
MAVLINK_CAM_PORT=$((14580 + PX4_INSTANCE))

echo "Starting PX4 SITL for drone ${DRONE_ID} (instance ${PX4_INSTANCE})"
echo "  Spawn position: X=${SPAWN_X}, Y=${SPAWN_Y}"
echo "  MAVLink port: ${MAVLINK_PORT}"
echo "  Camera port: ${MAVLINK_CAM_PORT}"

# Navigate to PX4 directory
cd /workspace/PX4-Autopilot

# Set instance-specific environment
export PX4_SIM_HOSTNAME=localhost
export PX4_SITL_WORLD=/workspace/gazebo/worlds/delivery_city.world

# Create instance-specific directory
mkdir -p /tmp/px4_instance_${PX4_INSTANCE}
cd /tmp/px4_instance_${PX4_INSTANCE}

# Copy PX4 build
cp -r /workspace/PX4-Autopilot/* .

# Start PX4 SITL with instance-specific parameters
echo "Launching PX4 SITL..."
./build/px4_sitl_default/bin/px4 \
    -s etc/init.d-posix/rcS \
    -t /workspace/gazebo/worlds/delivery_city.world \
    -i ${PX4_INSTANCE}