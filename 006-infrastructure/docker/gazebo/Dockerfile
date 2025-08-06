FROM osrf/ros:humble-desktop

# Install Gazebo and dependencies
RUN apt-get update && apt-get install -y \
    gazebo \
    ros-humble-gazebo-ros \
    ros-humble-gazebo-ros-pkgs \
    ros-humble-ros2-control \
    ros-humble-gazebo-ros2-control \
    netcat \
    && rm -rf /var/lib/apt/lists/*

# Set up workspace
WORKDIR /workspace

# Copy custom worlds and models
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose Gazebo master port
EXPOSE 11345

ENTRYPOINT ["/entrypoint.sh"]