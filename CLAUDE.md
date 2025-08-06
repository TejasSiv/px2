# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Multi-Drone Fleet Management System** - a professional-grade simulation platform for autonomous delivery operations featuring real-time telemetry, fleet coordination, and safety management. The system simulates 5 PX4 drones performing delivery missions with comprehensive coordination and analytics.

**Key Architecture**: Microservices backend + ROS2/PX4 simulation + React dashboard + PostgreSQL/Redis hybrid database

## Common Development Commands

### Quick Start
```bash
# Start entire system (when docker-compose is implemented)
cd 006-infrastructure/docker-compose
docker-compose up -d

# Start simulation services
cd 006-infrastructure/scripts
./start-simulation.sh

# Setup development environment
./setup.sh
```

### Development Workflow
```bash
# Backend services (Node.js microservices)
cd 003-backend-services/[service-name]
npm install
npm run dev

# Frontend dashboard
cd 004-frontend
npm install
npm run dev

# Database operations
cd 005-database
# Run migrations
psql -f migrations/001_initial_schema.sql
# Seed test data
psql -f seeds/001_drone_fleet.sql
```

### Testing
```bash
# Run test scenarios (when implemented)
cd 007-test-scenarios/test-runner
npm test

# Manual testing with predefined scenarios
# Use JSON files in 007-test-scenarios/ directories
```

## High-Level Architecture

### System Components

**1. Simulation Layer (002-simulation/)**
- **PX4 SITL**: 5 independent drone instances with realistic flight dynamics
- **Gazebo Headless**: Physics simulation with urban delivery environment
- **ROS2 Humble**: Fleet coordination, mission planning, safety monitoring
- **Container Strategy**: Each drone in separate Docker container with shared Gazebo world

**2. Backend Services (003-backend-services/)**
- **Microservices Architecture**: 6 independent services
  - Mission Service: Mission planning, assignment, execution tracking
  - Telemetry Service: Real-time data collection and streaming
  - Coordination Service: Inter-drone coordination and collision avoidance
  - Safety Service: Continuous safety validation and emergency response
  - Analytics Service: Performance metrics and trend analysis
  - Config Service: Dynamic configuration with hot reload
- **Communication**: REST APIs + ROS2 topics/services integration

**3. Data Architecture (005-database/)**
- **Hot Data Strategy**: Last 48 hours in PostgreSQL + Redis caching (5-10 sec updates)
- **Warm Data Strategy**: Historical snapshots in PostgreSQL (1-minute aggregates)
- **Real-time Caching**: Redis for live telemetry, mission status, fleet analytics
- **Hybrid Approach**: Eventual consistency with PostgreSQL as authoritative source

**4. Frontend Dashboard (004-frontend/)**
- **Technology**: React + TypeScript + Tailwind CSS
- **Architecture**: Component-driven with atomic design principles
- **Real-time**: Single WebSocket connection for all live updates
- **Design**: Modern dark theme optimized for control room operations
- **Responsive**: Desktop-first with mobile optimization for field operations

### Data Flow Patterns

```
PX4 Drones → ROS2 Topics → Telemetry Service → Redis (immediate) → PostgreSQL (batch)
                    ↓
WebSocket Server → React Dashboard (real-time updates)
```

**Mission Flow**:
```
Dashboard → Mission Service → ROS2 Mission Planner → PX4 Autopilot → Execution
```

**Coordination Flow**:
```
Fleet Coordinator (ROS2) → Coordination Service → Safety Validation → Action
```

### Key Design Patterns

**1. Safety-First Architecture**
- Pre-flight validation for all missions
- Supervised decision-making for critical operations
- Automatic collision avoidance with 50m minimum separation
- Emergency protocols with operator oversight

**2. Real-time Priority System**
- Critical data (positions, alerts): 1-2 second updates
- Operational data (battery, progress): 5 second updates
- Analytics data: 15-30 second updates
- Background data: 1-5 minute updates

**3. Scalable Foundation**
- Current: 5 drones with full telemetry
- Target: 100+ drones with horizontal scaling
- Service isolation preventing cascading failures
- Database partitioning for high-volume data

### Configuration Management

**Hot Reload Capable**:
- Safety parameters (battery thresholds, separation distances)
- Mission configurations and test scenarios
- Coordination algorithms and performance thresholds
- Display preferences and alert settings

**Static Configuration**:
- Database connections and service endpoints
- Container networking and security settings
- ROS2 topics and PX4 parameters

### Testing Strategy

**File-based Test Cases**: JSON configurations in `007-test-scenarios/`
- **Delivery Scenarios**: Standard delivery, multi-stop, emergency priority
- **Performance Tests**: High load, battery stress, coordination stress
- **Coordination Tests**: Collision avoidance, charging queues, formation flight
- **Failure Scenarios**: Equipment failure, weather delays, emergency landing

**Manual Testing Procedures**: Documented workflows for system validation

## Development Priorities

### Week 1 MVP Focus
1. **Infrastructure**: Docker environment with all services
2. **Core Simulation**: 5 PX4 drones with telemetry flow
3. **Basic Services**: Essential microservices with APIs
4. **Dashboard**: Read-only interface with real-time updates
5. **Integration**: End-to-end data flow validation

### Phase 2 Enhancements
1. **Control Integration**: Mission management through dashboard
2. **Advanced Coordination**: Formation flying, adaptive separation
3. **Enhanced Analytics**: Historical trends, predictive insights
4. **Production Readiness**: Monitoring, security, scalability testing

## Important Notes

- **Technology Stack**: PX4 + ROS2 + Gazebo for authentic drone simulation
- **Professional Focus**: Enterprise-grade architecture suitable for portfolio demonstration
- **Safety Critical**: All operations include comprehensive safety validation
- **Real-world Applicable**: Architecture patterns used in actual drone fleet management systems
- **Documentation Driven**: Extensive documentation in `001-documentation/` for all architectural decisions

## File Locations for Common Tasks

- **Architecture Documentation**: `001-documentation/architecture/`
- **Service Implementation**: `003-backend-services/[service-name]/src/`
- **Database Schema**: `005-database/schemas/` and `005-database/migrations/`
- **Frontend Components**: `004-frontend/src/components/`
- **Docker Configuration**: `006-infrastructure/docker/`
- **Test Scenarios**: `007-test-scenarios/`
- **Deployment Scripts**: `006-infrastructure/scripts/`