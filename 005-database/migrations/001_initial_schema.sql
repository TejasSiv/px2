-- Drone Fleet Management System - Initial Schema
-- This migration creates the core tables for fleet management

BEGIN;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Enums for drone states and mission status
CREATE TYPE drone_status AS ENUM ('idle', 'in_flight', 'charging', 'maintenance', 'emergency');
CREATE TYPE mission_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled');
CREATE TYPE drone_type AS ENUM ('delivery', 'surveillance', 'maintenance');
CREATE TYPE battery_health AS ENUM ('excellent', 'good', 'fair', 'poor', 'critical');

-- Core fleet table
CREATE TABLE drones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drone_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    type drone_type NOT NULL DEFAULT 'delivery',
    status drone_status NOT NULL DEFAULT 'idle',
    
    -- Physical specifications
    max_payload_kg DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    max_flight_time_minutes INTEGER NOT NULL DEFAULT 30,
    max_speed_ms DECIMAL(5,2) NOT NULL DEFAULT 15.0,
    
    -- Current state
    current_battery_level INTEGER CHECK (current_battery_level >= 0 AND current_battery_level <= 100),
    battery_health battery_health DEFAULT 'excellent',
    current_location POINT,
    altitude_m DECIMAL(8,2),
    heading_degrees DECIMAL(5,2),
    
    -- Operational counters
    total_flight_time_hours DECIMAL(10,2) DEFAULT 0,
    total_missions_completed INTEGER DEFAULT 0,
    last_maintenance_date TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Missions table
CREATE TABLE missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status mission_status NOT NULL DEFAULT 'pending',
    
    -- Assignment
    assigned_drone_id UUID REFERENCES drones(id),
    
    -- Mission parameters
    priority INTEGER DEFAULT 1 CHECK (priority >= 1 AND priority <= 5),
    estimated_duration_minutes INTEGER,
    max_altitude_m DECIMAL(8,2) DEFAULT 100,
    
    -- Timing
    scheduled_start_time TIMESTAMP WITH TIME ZONE,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    estimated_completion_time TIMESTAMP WITH TIME ZONE,
    actual_completion_time TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100)
);

-- Waypoints for missions
CREATE TABLE waypoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    
    -- Position
    sequence_number INTEGER NOT NULL,
    location POINT NOT NULL,
    altitude_m DECIMAL(8,2) NOT NULL,
    
    -- Waypoint behavior
    waypoint_type VARCHAR(50) DEFAULT 'navigation', -- 'navigation', 'pickup', 'delivery', 'hover'
    hover_time_seconds INTEGER DEFAULT 0,
    speed_ms DECIMAL(5,2),
    
    -- Status
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(mission_id, sequence_number)
);

-- Charging stations
CREATE TABLE charging_stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    station_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    location POINT NOT NULL,
    
    -- Capacity and status
    total_slots INTEGER NOT NULL DEFAULT 1,
    available_slots INTEGER NOT NULL DEFAULT 1,
    is_operational BOOLEAN DEFAULT true,
    
    -- Technical specs
    charging_power_watts INTEGER DEFAULT 500,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Charging sessions
CREATE TABLE charging_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drone_id UUID NOT NULL REFERENCES drones(id),
    charging_station_id UUID NOT NULL REFERENCES charging_stations(id),
    
    -- Session details
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    start_battery_level INTEGER NOT NULL,
    end_battery_level INTEGER,
    
    -- Calculated fields
    charging_duration_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time)) / 60
    ) STORED,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_drones_status ON drones(status);
CREATE INDEX idx_drones_location ON drones USING GIST(current_location);
CREATE INDEX idx_drones_active ON drones(is_active);

CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_missions_drone ON missions(assigned_drone_id);
CREATE INDEX idx_missions_priority ON missions(priority);
CREATE INDEX idx_missions_schedule ON missions(scheduled_start_time);

CREATE INDEX idx_waypoints_mission ON waypoints(mission_id);
CREATE INDEX idx_waypoints_sequence ON waypoints(mission_id, sequence_number);

CREATE INDEX idx_charging_stations_location ON charging_stations USING GIST(location);
CREATE INDEX idx_charging_sessions_drone ON charging_sessions(drone_id);
CREATE INDEX idx_charging_sessions_station ON charging_sessions(charging_station_id);

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_drones_updated_at BEFORE UPDATE ON drones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_missions_updated_at BEFORE UPDATE ON missions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_charging_stations_updated_at BEFORE UPDATE ON charging_stations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;