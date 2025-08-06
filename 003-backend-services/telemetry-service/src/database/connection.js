const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool = null;

class DatabaseConnection {
    constructor() {
        this.pool = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            const config = {
                connectionString: process.env.DATABASE_URL || 
                    'postgresql://dfm_user:dfm_password@postgres:5432/drone_fleet_management',
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 5000,
                query_timeout: 30000,
                statement_timeout: 30000,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            };

            this.pool = new Pool(config);

            // Handle pool events
            this.pool.on('error', (err) => {
                logger.error('Database pool error:', err);
                this.isConnected = false;
            });

            this.pool.on('connect', (client) => {
                logger.debug('New database client connected');
                this.isConnected = true;
            });

            this.pool.on('remove', (client) => {
                logger.debug('Database client removed');
            });

            // Test connection
            const client = await this.pool.connect();
            try {
                const result = await client.query('SELECT NOW()');
                logger.info('Database connection established successfully');
                logger.debug('Database time:', result.rows[0].now);
                this.isConnected = true;
            } finally {
                client.release();
            }

            return this.pool;
        } catch (error) {
            logger.error('Failed to connect to database:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            logger.info('Database connection closed');
        }
    }

    getPool() {
        return this.pool;
    }

    async query(text, params) {
        const start = Date.now();
        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            
            if (duration > 1000) {
                logger.warn('Slow query detected:', {
                    query: text.substring(0, 100),
                    duration: `${duration}ms`,
                    rowCount: result.rowCount
                });
            }
            
            return result;
        } catch (error) {
            const duration = Date.now() - start;
            logger.error('Database query error:', {
                query: text.substring(0, 100),
                duration: `${duration}ms`,
                error: error.message
            });
            throw error;
        }
    }

    async transaction(callback) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    isHealthy() {
        return this.isConnected && this.pool && this.pool.totalCount > 0;
    }

    // Telemetry-specific database operations
    async saveTelemetryBatch(telemetryRecords) {
        const start = Date.now();
        try {
            if (telemetryRecords.length === 0) return { inserted: 0 };

            // Get drone UUIDs
            const droneIds = [...new Set(telemetryRecords.map(t => t.drone_id))];
            const droneQuery = 'SELECT id, drone_id FROM drones WHERE drone_id = ANY($1)';
            const droneResult = await this.query(droneQuery, [droneIds]);
            
            const droneMap = new Map();
            droneResult.rows.forEach(row => {
                droneMap.set(row.drone_id, row.id);
            });

            // Filter out records for unknown drones
            const validRecords = telemetryRecords.filter(t => droneMap.has(t.drone_id));
            
            if (validRecords.length === 0) {
                logger.warn('No valid telemetry records to save');
                return { inserted: 0 };
            }

            // Prepare batch insert
            const values = [];
            const placeholders = [];
            let paramCount = 1;

            for (const telemetry of validRecords) {
                const droneUuid = droneMap.get(telemetry.drone_id);
                
                const rowValues = [
                    droneUuid,
                    telemetry.latitude || 0,
                    telemetry.longitude || 0,
                    telemetry.altitude_m || 0,
                    telemetry.heading_degrees || 0,
                    telemetry.velocity_x_ms || 0,
                    telemetry.velocity_y_ms || 0,
                    telemetry.velocity_z_ms || 0,
                    telemetry.ground_speed_ms || 0,
                    telemetry.battery_voltage_v || 0,
                    telemetry.battery_current_a || 0,
                    telemetry.battery_level_percent || 0,
                    telemetry.power_consumption_w || 0,
                    telemetry.gps_fix_type || 0,
                    telemetry.satellites_visible || 0,
                    telemetry.hdop || 0,
                    telemetry.signal_strength_dbm || 0,
                    telemetry.flight_mode || 'UNKNOWN',
                    telemetry.armed || false,
                    telemetry.autopilot_enabled || false,
                    telemetry.temperature_celsius || 0,
                    telemetry.humidity_percent || 0,
                    telemetry.pressure_hpa || 0,
                    telemetry.drone_timestamp || new Date(),
                    telemetry.received_at || new Date()
                ];

                values.push(...rowValues);
                const placeholder = `(${Array.from({length: rowValues.length}, (_, i) => `$${paramCount + i}`).join(',')})`;
                placeholders.push(placeholder);
                paramCount += rowValues.length;
            }

            const insertQuery = `
                INSERT INTO telemetry_realtime (
                    drone_id, latitude, longitude, altitude_m, heading_degrees,
                    velocity_x_ms, velocity_y_ms, velocity_z_ms, ground_speed_ms,
                    battery_voltage_v, battery_current_a, battery_level_percent, power_consumption_w,
                    gps_fix_type, satellites_visible, hdop, signal_strength_dbm,
                    flight_mode, armed, autopilot_enabled,
                    temperature_celsius, humidity_percent, pressure_hpa,
                    drone_timestamp, received_at
                ) VALUES ${placeholders.join(',')}
            `;

            const result = await this.query(insertQuery, values);
            const duration = Date.now() - start;
            
            logger.info(`Saved telemetry batch: ${result.rowCount} records in ${duration}ms`);
            
            return { 
                inserted: result.rowCount,
                duration,
                total_attempted: telemetryRecords.length,
                valid_records: validRecords.length
            };
        } catch (error) {
            const duration = Date.now() - start;
            logger.error(`Error saving telemetry batch (${duration}ms):`, error);
            throw error;
        }
    }

    async getLatestTelemetry(droneId, limit = 10) {
        try {
            const query = `
                SELECT t.*, d.drone_id, d.name as drone_name
                FROM telemetry_realtime t
                JOIN drones d ON t.drone_id = d.id
                WHERE d.drone_id = $1
                ORDER BY t.received_at DESC
                LIMIT $2
            `;
            
            const result = await this.query(query, [droneId, limit]);
            return result.rows;
        } catch (error) {
            logger.error(`Error getting latest telemetry for ${droneId}:`, error);
            throw error;
        }
    }

    async getFleetTelemetrySnapshot() {
        try {
            const query = `
                SELECT DISTINCT ON (d.drone_id) 
                    d.drone_id,
                    d.name,
                    d.status,
                    t.latitude,
                    t.longitude,
                    t.altitude_m,
                    t.battery_level_percent,
                    t.flight_mode,
                    t.armed,
                    t.received_at
                FROM drones d
                LEFT JOIN telemetry_realtime t ON d.id = t.drone_id
                WHERE d.is_active = true
                ORDER BY d.drone_id, t.received_at DESC
            `;
            
            const result = await this.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error getting fleet telemetry snapshot:', error);
            throw error;
        }
    }

    async cleanupOldTelemetry(hoursOld = 48) {
        try {
            const query = `
                DELETE FROM telemetry_realtime 
                WHERE received_at < NOW() - INTERVAL '${hoursOld} hours'
            `;
            
            const result = await this.query(query);
            logger.info(`Cleaned up ${result.rowCount} old telemetry records`);
            return result.rowCount;
        } catch (error) {
            logger.error('Error cleaning up old telemetry:', error);
            throw error;
        }
    }

    async getHealthMetrics() {
        try {
            const queries = [
                'SELECT COUNT(*) as active_connections FROM pg_stat_activity WHERE state = \'active\'',
                'SELECT COUNT(*) as total_drones FROM drones WHERE is_active = true',
                'SELECT COUNT(*) as recent_telemetry FROM telemetry_realtime WHERE received_at > NOW() - INTERVAL \'5 minutes\'',
                'SELECT pg_database_size(current_database()) as db_size'
            ];

            const results = await Promise.all(queries.map(q => this.query(q)));
            
            return {
                connected: this.isConnected,
                active_connections: parseInt(results[0].rows[0].active_connections),
                total_drones: parseInt(results[1].rows[0].total_drones),
                recent_telemetry_count: parseInt(results[2].rows[0].recent_telemetry),
                database_size_bytes: parseInt(results[3].rows[0].db_size)
            };
        } catch (error) {
            logger.error('Error getting database health metrics:', error);
            return {
                connected: false,
                error: error.message
            };
        }
    }
}

// Singleton instance
const dbConnection = new DatabaseConnection();

async function initDatabase() {
    pool = await dbConnection.connect();
    return pool;
}

function getDatabase() {
    return dbConnection;
}

function getDatabasePool() {
    return pool;
}

module.exports = {
    initDatabase,
    getDatabase,
    getDatabasePool,
    DatabaseConnection
};