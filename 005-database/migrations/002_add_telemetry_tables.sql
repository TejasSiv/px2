-- Drone Fleet Management System - Telemetry Tables
-- This migration adds telemetry and real-time data tables

BEGIN;

-- Real-time telemetry data (hot data - last 48 hours)
CREATE TABLE telemetry_realtime (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drone_id UUID NOT NULL REFERENCES drones(id),
    
    -- Position and orientation
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    altitude_m DECIMAL(8,2) NOT NULL,
    heading_degrees DECIMAL(5,2) NOT NULL,
    
    -- Velocity
    velocity_x_ms DECIMAL(6,3),
    velocity_y_ms DECIMAL(6,3),
    velocity_z_ms DECIMAL(6,3),
    ground_speed_ms DECIMAL(6,3),
    
    -- Power and battery
    battery_voltage_v DECIMAL(5,2),
    battery_current_a DECIMAL(6,3),
    battery_level_percent INTEGER CHECK (battery_level_percent >= 0 AND battery_level_percent <= 100),
    power_consumption_w DECIMAL(7,2),
    
    -- System status
    gps_fix_type INTEGER, -- 0=no fix, 1=dead reckoning, 2=2D, 3=3D, 4=DGPS, 5=RTK
    satellites_visible INTEGER,
    hdop DECIMAL(4,2), -- Horizontal Dilution of Precision
    signal_strength_dbm INTEGER,
    
    -- Flight control
    flight_mode VARCHAR(50),
    armed BOOLEAN DEFAULT false,
    autopilot_enabled BOOLEAN DEFAULT false,
    
    -- Environmental
    temperature_celsius DECIMAL(5,2),
    humidity_percent DECIMAL(5,2),
    pressure_hpa DECIMAL(7,2),
    wind_speed_ms DECIMAL(5,2),
    wind_direction_degrees DECIMAL(5,2),
    
    -- Timestamps
    drone_timestamp TIMESTAMP WITH TIME ZONE, -- Time from drone's clock
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- Server reception time
);

-- Historical telemetry aggregates (warm data - 1-minute summaries)
CREATE TABLE telemetry_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drone_id UUID NOT NULL REFERENCES drones(id),
    
    -- Time window
    time_bucket TIMESTAMP WITH TIME ZONE NOT NULL, -- Start of 1-minute window
    
    -- Aggregated position data
    avg_latitude DECIMAL(10,8),
    avg_longitude DECIMAL(11,8),
    avg_altitude_m DECIMAL(8,2),
    max_altitude_m DECIMAL(8,2),
    min_altitude_m DECIMAL(8,2),
    
    -- Aggregated velocity data
    avg_ground_speed_ms DECIMAL(6,3),
    max_ground_speed_ms DECIMAL(6,3),
    distance_traveled_m DECIMAL(10,2),
    
    -- Battery statistics
    avg_battery_level INTEGER,
    min_battery_level INTEGER,
    avg_power_consumption_w DECIMAL(7,2),
    max_power_consumption_w DECIMAL(7,2),
    
    -- Flight statistics
    flight_time_seconds INTEGER DEFAULT 0,
    armed_time_seconds INTEGER DEFAULT 0,
    autopilot_time_seconds INTEGER DEFAULT 0,
    
    -- Data quality
    data_points_count INTEGER DEFAULT 0,
    gps_fix_rate DECIMAL(5,2), -- Percentage of time with good GPS fix
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(drone_id, time_bucket)
);

-- Alerts and notifications
CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'error', 'critical');
CREATE TYPE alert_status AS ENUM ('active', 'acknowledged', 'resolved');

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drone_id UUID REFERENCES drones(id),
    mission_id UUID REFERENCES missions(id),
    
    -- Alert details
    alert_type VARCHAR(100) NOT NULL, -- 'low_battery', 'gps_loss', 'geofence_violation', etc.
    severity alert_severity NOT NULL,
    status alert_status DEFAULT 'active',
    
    title VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Context data
    telemetry_snapshot JSONB,
    location POINT,
    
    -- Timing
    first_detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    acknowledged_by VARCHAR(100),
    resolution_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System events log
CREATE TYPE event_type AS ENUM ('mission_start', 'mission_end', 'takeoff', 'landing', 'emergency', 'maintenance', 'charging_start', 'charging_end');

CREATE TABLE system_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drone_id UUID REFERENCES drones(id),
    mission_id UUID REFERENCES missions(id),
    
    event_type event_type NOT NULL,
    event_description TEXT,
    
    -- Location context
    location POINT,
    altitude_m DECIMAL(8,2),
    
    -- Additional context
    metadata JSONB,
    
    -- Timing
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for telemetry performance
CREATE INDEX idx_telemetry_realtime_drone_time ON telemetry_realtime(drone_id, received_at DESC);
CREATE INDEX idx_telemetry_realtime_time ON telemetry_realtime(received_at DESC);
CREATE INDEX idx_telemetry_realtime_battery ON telemetry_realtime(battery_level_percent);

CREATE INDEX idx_telemetry_history_drone_bucket ON telemetry_history(drone_id, time_bucket DESC);
CREATE INDEX idx_telemetry_history_bucket ON telemetry_history(time_bucket DESC);

CREATE INDEX idx_alerts_drone ON alerts(drone_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_type ON alerts(alert_type);
CREATE INDEX idx_alerts_time ON alerts(first_detected_at DESC);

CREATE INDEX idx_system_events_drone ON system_events(drone_id);
CREATE INDEX idx_system_events_mission ON system_events(mission_id);
CREATE INDEX idx_system_events_type ON system_events(event_type);
CREATE INDEX idx_system_events_time ON system_events(event_timestamp DESC);

-- Partitioning function for telemetry data (for future scaling)
-- We'll partition telemetry_realtime by date to manage data size
CREATE OR REPLACE FUNCTION create_telemetry_partition(partition_date DATE)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
BEGIN
    partition_name := 'telemetry_realtime_' || to_char(partition_date, 'YYYY_MM_DD');
    start_date := quote_literal(partition_date);
    end_date := quote_literal(partition_date + INTERVAL '1 day');
    
    EXECUTE format('CREATE TABLE %I PARTITION OF telemetry_realtime 
                   FOR VALUES FROM (%s) TO (%s)',
                   partition_name, start_date, end_date);
                   
    EXECUTE format('CREATE INDEX %I ON %I(drone_id, received_at DESC)',
                   'idx_' || partition_name || '_drone_time', partition_name);
END;
$$ LANGUAGE plpgsql;

-- Data retention function (delete data older than 48 hours for realtime)
CREATE OR REPLACE FUNCTION cleanup_old_telemetry()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM telemetry_realtime 
    WHERE received_at < NOW() - INTERVAL '48 hours';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup
    INSERT INTO system_events (event_type, event_description, metadata)
    VALUES ('maintenance', 'Telemetry cleanup completed', 
            jsonb_build_object('deleted_records', deleted_count));
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update alert timestamps
CREATE OR REPLACE FUNCTION update_alert_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated_at = NOW();
    
    IF OLD.status != NEW.status AND NEW.status = 'acknowledged' THEN
        NEW.acknowledged_at = NOW();
    END IF;
    
    IF OLD.status != NEW.status AND NEW.status = 'resolved' THEN
        NEW.resolved_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_alerts_timestamps 
    BEFORE UPDATE ON alerts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_alert_timestamps();

COMMIT;