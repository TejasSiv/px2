# Multi-Drone Fleet Management System

A professional-grade simulation platform for autonomous delivery operations featuring real-time telemetry, fleet coordination, and safety management. This system simulates 5 PX4 drones performing delivery missions with comprehensive coordination and analytics.

## =� System Overview

**Architecture**: Microservices backend + ROS2/PX4 simulation + React dashboard + PostgreSQL/Redis hybrid database

### Key Features
- **Real-time Fleet Monitoring**: Live telemetry and mission tracking for 5 autonomous drones
- **Safety-First Design**: Comprehensive safety validation with automatic collision avoidance
- **Enterprise Architecture**: Microservices design suitable for scaling to 100+ drones
- **Professional Dashboard**: Modern React interface optimized for control room operations
- **Authentic Simulation**: PX4 SITL + Gazebo for realistic flight dynamics

## <� System Architecture

### Core Components

**Simulation Layer** (`002-simulation/`)
- PX4 SITL: 5 independent drone instances with realistic flight dynamics
- Gazebo Headless: Physics simulation with urban delivery environment
- ROS2 Humble: Fleet coordination, mission planning, safety monitoring

**Backend Services** (`003-backend-services/`)
- Mission Service: Mission planning, assignment, execution tracking
- Telemetry Service: Real-time data collection and streaming
- Coordination Service: Inter-drone coordination and collision avoidance
- Safety Service: Continuous safety validation and emergency response
- Analytics Service: Performance metrics and trend analysis
- Config Service: Dynamic configuration with hot reload

**Data Architecture** (`005-database/`)
- Hot Data: Last 48 hours in PostgreSQL + Redis caching
- Real-time Updates: 1-10 second intervals based on data criticality
- Hybrid Strategy: Redis for live data, PostgreSQL for persistence

**Frontend Dashboard** (`004-frontend/`)
- React + TypeScript + Tailwind CSS
- Real-time WebSocket connections
- Modern dark theme for control room operations

## =� Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- PostgreSQL 14+
- ROS2 Humble (for development)

### Start the System
```bash
# Clone the repository
git clone <repository-url>
cd drone-fleet-management

# Start entire system
cd 006-infrastructure/docker-compose
docker-compose up -d

# Start simulation services
cd ../scripts
./start-simulation.sh
```

### Development Setup
```bash
# Backend services
cd 003-backend-services/[service-name]
npm install
npm run dev

# Frontend dashboard
cd 004-frontend
npm install
npm run dev

# Database setup
cd 005-database
psql -f migrations/001_initial_schema.sql
psql -f seeds/001_drone_fleet.sql
```

## =� Data Flow

```
PX4 Drones � ROS2 Topics � Telemetry Service � Redis (immediate) � PostgreSQL (batch)
                    �
WebSocket Server � React Dashboard (real-time updates)
```

## =� Safety Features

- **Pre-flight Validation**: All missions validated before execution
- **Collision Avoidance**: Automatic 50m minimum separation enforcement
- **Emergency Protocols**: Comprehensive failure handling with operator oversight
- **Real-time Monitoring**: Critical alerts within 1-2 seconds

## >� Testing

The system includes comprehensive test scenarios in `007-test-scenarios/`:

- **Delivery Scenarios**: Standard delivery, multi-stop, emergency priority
- **Performance Tests**: High load, battery stress, coordination stress
- **Coordination Tests**: Collision avoidance, charging queues, formation flight
- **Failure Scenarios**: Equipment failure, weather delays, emergency landing

```bash
# Run test scenarios
cd 007-test-scenarios/test-runner
npm test
```

## =� Project Structure

```
drone-fleet-management/
001-documentation/        # Architecture and design docs
002-simulation/           # PX4 SITL + Gazebo + ROS2
003-backend-services/     # 6 microservices
004-frontend/            # React dashboard
005-database/            # PostgreSQL + Redis
006-infrastructure/      # Docker + deployment scripts
007-test-scenarios/      # Test cases and scenarios
```

## =' Configuration

The system supports hot-reload configuration for:
- Safety parameters (battery thresholds, separation distances)
- Mission configurations and test scenarios
- Coordination algorithms and performance thresholds
- Display preferences and alert settings

## =� Scalability

**Current Capacity**: 5 drones with full telemetry
**Target Capacity**: 100+ drones with horizontal scaling
**Architecture**: Service isolation preventing cascading failures

## > Contributing

1. Review architecture documentation in `001-documentation/`
2. Follow the development workflow outlined in `CLAUDE.md`
3. Test with provided scenarios before submission
4. Ensure all safety validations pass

## =� License

[Add license information]

## <� Roadmap

### Phase 1 (MVP) 
- [x] Infrastructure setup with Docker
- [x] Core simulation with 5 PX4 drones
- [x] Essential microservices with APIs
- [x] Real-time dashboard interface
- [x] End-to-end data flow validation

### Phase 2 (Enhancement)
- [ ] Mission management through dashboard
- [ ] Advanced coordination algorithms
- [ ] Enhanced analytics and reporting
- [ ] Production monitoring and security

---
