-- Geofence Tables Migration
-- This migration adds tables for geofence validation functionality

-- Create geofences table
CREATE TABLE IF NOT EXISTS geofences (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('inclusion', 'exclusion', 'emergency')),
    coordinates JSONB NOT NULL, -- Array of {lat, lng} points defining polygon
    altitude_min REAL, -- Minimum altitude in meters (null = no limit)
    altitude_max REAL, -- Maximum altitude in meters (null = no limit)
    restriction_type VARCHAR(20) NOT NULL DEFAULT 'restricted' CHECK (restriction_type IN ('no_fly', 'restricted', 'emergency_only', 'warning_only')),
    severity VARCHAR(10) NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical', 'warning', 'info')),
    active BOOLEAN NOT NULL DEFAULT true,
    created_by VARCHAR(255) DEFAULT 'system',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create geofence_violations table
CREATE TABLE IF NOT EXISTS geofence_violations (
    id VARCHAR(36) PRIMARY KEY,
    drone_id VARCHAR(50) NOT NULL,
    geofence_id VARCHAR(36) NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
    violation_type VARCHAR(50) NOT NULL, -- 'exclusion_violation', 'inclusion_violation', 'altitude_above', 'altitude_below'
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
    message TEXT NOT NULL,
    position JSONB NOT NULL, -- {latitude, longitude, altitude}
    drone_status JSONB, -- {armed, missionStatus, etc.}
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by VARCHAR(255),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved BOOLEAN DEFAULT false,
    resolved_by VARCHAR(255),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_geofences_active ON geofences(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_geofences_type_severity ON geofences(type, severity);
CREATE INDEX IF NOT EXISTS idx_geofences_coordinates ON geofences USING GIST ((coordinates::jsonb));

CREATE INDEX IF NOT EXISTS idx_violations_drone_id ON geofence_violations(drone_id);
CREATE INDEX IF NOT EXISTS idx_violations_geofence_id ON geofence_violations(geofence_id);
CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON geofence_violations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_violations_severity ON geofence_violations(severity);
CREATE INDEX IF NOT EXISTS idx_violations_unresolved ON geofence_violations(resolved, timestamp DESC) WHERE resolved = false;

-- Insert default geofences for demonstration
INSERT INTO geofences (
    id, 
    name, 
    type, 
    coordinates, 
    altitude_min, 
    altitude_max, 
    restriction_type, 
    severity, 
    description
) VALUES 
-- Main operational area (inclusion zone)
(
    'operational-area-main',
    'Main Operational Area',
    'inclusion',
    '[
        {"lat": 19.0500, "lng": 72.8500},
        {"lat": 19.1000, "lng": 72.8500},
        {"lat": 19.1000, "lng": 72.9000},
        {"lat": 19.0500, "lng": 72.9000}
    ]'::jsonb,
    10.0,
    150.0,
    'warning_only',
    'warning',
    'Primary operational area for drone deliveries'
),

-- Airport exclusion zone
(
    'airport-exclusion-mumbai',
    'Mumbai Airport No-Fly Zone',
    'exclusion',
    '[
        {"lat": 19.0800, "lng": 72.8600},
        {"lat": 19.1200, "lng": 72.8600},
        {"lat": 19.1200, "lng": 72.8900},
        {"lat": 19.0800, "lng": 72.8900}
    ]'::jsonb,
    0.0,
    300.0,
    'no_fly',
    'critical',
    'Airport restricted airspace - no drone operations allowed'
),

-- Hospital emergency zone
(
    'hospital-emergency-zone',
    'Hospital Emergency Corridor',
    'exclusion',
    '[
        {"lat": 19.0650, "lng": 72.8650},
        {"lat": 19.0750, "lng": 72.8650},
        {"lat": 19.0750, "lng": 72.8750},
        {"lat": 19.0650, "lng": 72.8750}
    ]'::jsonb,
    0.0,
    100.0,
    'emergency_only',
    'warning',
    'Hospital area - emergency drones only during medical operations'
),

-- High-altitude restriction zone
(
    'high-altitude-restriction',
    'High Altitude Restricted Zone',
    'exclusion',
    '[
        {"lat": 19.0600, "lng": 72.8700},
        {"lat": 19.0900, "lng": 72.8700},
        {"lat": 19.0900, "lng": 72.8850},
        {"lat": 19.0600, "lng": 72.8850}
    ]'::jsonb,
    120.0,
    null,
    'restricted',
    'warning',
    'Area restricted for flights above 120m due to building heights'
)

ON CONFLICT (id) DO NOTHING;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_geofences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS geofences_updated_at ON geofences;
CREATE TRIGGER geofences_updated_at
    BEFORE UPDATE ON geofences
    FOR EACH ROW
    EXECUTE FUNCTION update_geofences_updated_at();

-- Add comments for documentation
COMMENT ON TABLE geofences IS 'Defines geographical boundaries and altitude restrictions for drone operations';
COMMENT ON COLUMN geofences.type IS 'inclusion: drones should stay inside, exclusion: drones should stay outside, emergency: special emergency protocols';
COMMENT ON COLUMN geofences.coordinates IS 'Array of lat/lng points defining a polygon boundary';
COMMENT ON COLUMN geofences.restriction_type IS 'Level of restriction enforcement';
COMMENT ON COLUMN geofences.severity IS 'Alert severity level for violations';

COMMENT ON TABLE geofence_violations IS 'Records of drone violations of geofence boundaries';
COMMENT ON COLUMN geofence_violations.violation_type IS 'Type of violation that occurred';
COMMENT ON COLUMN geofence_violations.position IS 'Drone position at time of violation';
COMMENT ON COLUMN geofence_violations.drone_status IS 'Additional drone status information';