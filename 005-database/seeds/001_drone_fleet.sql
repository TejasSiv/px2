-- Seed data for drone fleet
-- This file creates initial test data for development

BEGIN;

-- Insert charging stations first (referenced by drones)
INSERT INTO charging_stations (station_id, name, location, total_slots, available_slots) VALUES
('CS001', 'Downtown Hub Station', POINT(-122.4194, 37.7749), 4, 4),
('CS002', 'Industrial District Station', POINT(-122.3984, 37.7849), 2, 2),
('CS003', 'Airport Service Station', POINT(-122.3748, 37.6213), 6, 6);

-- Insert initial drone fleet (5 drones for testing)
INSERT INTO drones (
    drone_id, name, type, status, current_battery_level, battery_health,
    current_location, altitude_m, heading_degrees, 
    max_payload_kg, max_flight_time_minutes, max_speed_ms
) VALUES 
(
    'DRN001', 'Alpha', 'delivery', 'idle', 85, 'excellent',
    POINT(-122.4194, 37.7749), 0, 0,
    5.0, 30, 15.0
),
(
    'DRN002', 'Bravo', 'delivery', 'idle', 92, 'excellent',
    POINT(-122.4094, 37.7849), 0, 45,
    5.0, 30, 15.0
),
(
    'DRN003', 'Charlie', 'delivery', 'charging', 45, 'good',
    POINT(-122.3984, 37.7849), 0, 180,
    4.5, 28, 14.0
),
(
    'DRN004', 'Delta', 'surveillance', 'idle', 78, 'excellent',
    POINT(-122.3894, 37.7949), 0, 270,
    2.0, 45, 18.0
),
(
    'DRN005', 'Echo', 'delivery', 'maintenance', 0, 'fair',
    POINT(-122.3748, 37.6213), 0, 90,
    5.0, 25, 13.0
);

-- Insert some test missions
INSERT INTO missions (
    mission_id, title, description, status, priority,
    estimated_duration_minutes, max_altitude_m, created_by
) VALUES
(
    'MSN001', 'Downtown Delivery Test', 
    'Test delivery mission to downtown area',
    'pending', 3, 25, 100, 'system'
),
(
    'MSN002', 'Industrial Survey',
    'Surveillance mission over industrial district',
    'pending', 2, 45, 150, 'system'
),
(
    'MSN003', 'Emergency Medical Supply',
    'Priority delivery of medical supplies',
    'pending', 5, 15, 80, 'system'
);

-- Insert waypoints for test missions
-- Mission 1 waypoints (Downtown Delivery)
INSERT INTO waypoints (mission_id, sequence_number, location, altitude_m, waypoint_type, hover_time_seconds) 
SELECT m.id, 1, POINT(-122.4194, 37.7749), 50, 'navigation', 0
FROM missions m WHERE m.mission_id = 'MSN001'
UNION ALL
SELECT m.id, 2, POINT(-122.4104, 37.7799), 75, 'pickup', 30
FROM missions m WHERE m.mission_id = 'MSN001'
UNION ALL
SELECT m.id, 3, POINT(-122.4004, 37.7849), 60, 'delivery', 45
FROM missions m WHERE m.mission_id = 'MSN001'
UNION ALL
SELECT m.id, 4, POINT(-122.4194, 37.7749), 30, 'navigation', 0
FROM missions m WHERE m.mission_id = 'MSN001';

-- Mission 2 waypoints (Industrial Survey)
INSERT INTO waypoints (mission_id, sequence_number, location, altitude_m, waypoint_type, hover_time_seconds)
SELECT m.id, 1, POINT(-122.3984, 37.7849), 100, 'navigation', 0
FROM missions m WHERE m.mission_id = 'MSN002'
UNION ALL
SELECT m.id, 2, POINT(-122.3884, 37.7899), 120, 'hover', 60
FROM missions m WHERE m.mission_id = 'MSN002'
UNION ALL
SELECT m.id, 3, POINT(-122.3784, 37.7949), 120, 'hover', 60
FROM missions m WHERE m.mission_id = 'MSN002'
UNION ALL
SELECT m.id, 4, POINT(-122.3984, 37.7849), 80, 'navigation', 0
FROM missions m WHERE m.mission_id = 'MSN002';

-- Mission 3 waypoints (Emergency Medical)
INSERT INTO waypoints (mission_id, sequence_number, location, altitude_m, waypoint_type, hover_time_seconds)
SELECT m.id, 1, POINT(-122.4194, 37.7749), 60, 'navigation', 0
FROM missions m WHERE m.mission_id = 'MSN003'
UNION ALL
SELECT m.id, 2, POINT(-122.4044, 37.7699), 50, 'delivery', 20
FROM missions m WHERE m.mission_id = 'MSN003'
UNION ALL
SELECT m.id, 3, POINT(-122.4194, 37.7749), 40, 'navigation', 0
FROM missions m WHERE m.mission_id = 'MSN003';

-- Insert some sample telemetry data for testing
INSERT INTO telemetry_realtime (
    drone_id, latitude, longitude, altitude_m, heading_degrees,
    velocity_x_ms, velocity_y_ms, velocity_z_ms, ground_speed_ms,
    battery_voltage_v, battery_current_a, battery_level_percent, power_consumption_w,
    gps_fix_type, satellites_visible, hdop, signal_strength_dbm,
    flight_mode, armed, autopilot_enabled,
    temperature_celsius, humidity_percent, pressure_hpa,
    drone_timestamp, received_at
)
SELECT 
    d.id,
    37.7749 + (random() - 0.5) * 0.01,  -- Random position near base
    -122.4194 + (random() - 0.5) * 0.01,
    random() * 100,  -- Random altitude 0-100m
    random() * 360,  -- Random heading
    (random() - 0.5) * 10,  -- Random velocity
    (random() - 0.5) * 10,
    (random() - 0.5) * 5,
    random() * 15,  -- Ground speed 0-15 m/s
    12.6 + random() * 1.4,  -- Battery voltage 12.6-14V
    random() * 20,  -- Current 0-20A
    d.current_battery_level + (random() - 0.5) * 5,  -- Battery level +/- 5%
    50 + random() * 200,  -- Power consumption 50-250W
    3,  -- GPS fix type (3D)
    8 + floor(random() * 8),  -- Satellites 8-15
    1.0 + random() * 2.0,  -- HDOP 1.0-3.0
    -70 - floor(random() * 30),  -- Signal strength -70 to -100 dBm
    'STABILIZED',
    false,
    true,
    20 + random() * 15,  -- Temperature 20-35°C
    40 + random() * 40,  -- Humidity 40-80%
    1013 + (random() - 0.5) * 50,  -- Pressure around 1013 hPa
    NOW() - INTERVAL '1 second' * floor(random() * 3600),  -- Random time in last hour
    NOW() - INTERVAL '1 second' * floor(random() * 3600)
FROM drones d
WHERE d.status != 'maintenance'  -- No telemetry for drones in maintenance
ORDER BY random()
LIMIT 20;  -- 20 random telemetry records

-- Insert some sample alerts
INSERT INTO alerts (
    drone_id, alert_type, severity, title, description, location
)
SELECT 
    d.id,
    'low_battery',
    'warning',
    'Low Battery Warning',
    'Battery level is below 50%',
    d.current_location
FROM drones d 
WHERE d.current_battery_level < 50
UNION ALL
SELECT 
    d.id,
    'maintenance_required',
    'info',
    'Scheduled Maintenance Due',
    'Drone requires scheduled maintenance check',
    d.current_location
FROM drones d 
WHERE d.status = 'maintenance';

-- Insert some system events
INSERT INTO system_events (
    drone_id, event_type, event_description, location, metadata
)
SELECT 
    d.id,
    'charging_start',
    'Drone started charging session',
    d.current_location,
    jsonb_build_object('battery_level', d.current_battery_level, 'station_id', 'CS002')
FROM drones d 
WHERE d.status = 'charging'
UNION ALL
SELECT 
    d.id,
    'maintenance',
    'Drone entered maintenance mode',
    d.current_location,
    jsonb_build_object('reason', 'scheduled_maintenance', 'technician', 'John Doe')
FROM drones d 
WHERE d.status = 'maintenance';

COMMIT;