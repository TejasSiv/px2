FROM px4io/px4-dev-simulation-focal:latest

# Set working directory
WORKDIR /workspace

# Install additional dependencies
RUN apt-get update && apt-get install -y \
    netcat \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Clone PX4 Autopilot (if not mounted as volume)
RUN git clone https://github.com/PX4/PX4-Autopilot.git --recursive

# Build PX4
WORKDIR /workspace/PX4-Autopilot
RUN make px4_sitl_default

# Copy custom configurations
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose MAVLink ports
EXPOSE 14550/udp 14580/udp

ENTRYPOINT ["/entrypoint.sh"]