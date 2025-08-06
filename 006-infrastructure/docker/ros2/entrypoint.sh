#!/bin/bash

# Source ROS2
source /opt/ros/humble/setup.bash

# Wait for PX4 to be ready
echo "Waiting for PX4 drone..."
sleep 10

# Build ROS2 workspace if source code exists
if [ -d "/workspace/ros2_ws/src" ]; then
    cd /workspace/ros2_ws
    colcon build
    source install/setup.bash
fi

# Set ROS2 environment
export ROS_DOMAIN_ID=1
export RMW_IMPLEMENTATION=rmw_cyclonedx_cpp

echo "Starting ROS2 coordinator..."
# For now, just keep container running
tail -f /dev/null