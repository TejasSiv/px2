#!/bin/bash

# Source ROS2
source /opt/ros/humble/setup.bash

# Set Gazebo environment
export GAZEBO_MASTER_URI=http://0.0.0.0:11345
export GAZEBO_HEADLESS=${GAZEBO_HEADLESS:-1}

# Start Gazebo server (headless by default)
echo "Starting Gazebo server..."
if [ "$GAZEBO_HEADLESS" = "1" ]; then
    gzserver --verbose /workspace/gazebo/worlds/delivery_city.world
else
    gazebo --verbose /workspace/gazebo/worlds/delivery_city.world
fi