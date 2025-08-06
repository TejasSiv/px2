const dgram = require('dgram');
const { EventEmitter } = require('events');
const logger = require('../utils/logger');
const { getRedisClient } = require('../cache/redis');
const { getDatabase } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');

class TelemetryProcessor extends EventEmitter {
    constructor() {
        super();
        this.drones = new Map(); // Store drone connections
        this.sockets = new Map(); // Store UDP sockets for each drone
        this.isRunning = false;
        this.batchInterval = null;
        this.telemetryBatch = [];
        this.batchSize = 100;
        this.batchTimeoutMs = 5000; // 5 seconds
        
        // Drone configurations (ports and IDs)
        this.droneConfigs = [
            { id: 'DRN001', port: 14550, instance: 0 },
            { id: 'DRN002', port: 14551, instance: 1 },
            { id: 'DRN003', port: 14552, instance: 2 },
            { id: 'DRN004', port: 14553, instance: 3 },
            { id: 'DRN005', port: 14554, instance: 4 }
        ];
    }

    async initialize() {
        try {
            this.redis = getRedisClient();
            this.db = getDatabase();
            
            logger.info('Telemetry processor initialized');
        } catch (error) {
            logger.error('Failed to initialize telemetry processor:', error);
            throw error;
        }
    }

    async start() {
        if (this.isRunning) {
            logger.warn('Telemetry processor already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting telemetry processor...');

        try {
            // Initialize connections to all drones
            for (const config of this.droneConfigs) {
                await this.connectToDrone(config);
            }

            // Start batch processing
            this.startBatchProcessing();

            logger.info('Telemetry processor started successfully');
        } catch (error) {
            logger.error('Failed to start telemetry processor:', error);
            throw error;
        }
    }

    async stop() {
        if (!this.isRunning) return;

        this.isRunning = false;
        logger.info('Stopping telemetry processor...');

        // Clear batch interval
        if (this.batchInterval) {
            clearInterval(this.batchInterval);
        }

        // Process remaining batch
        if (this.telemetryBatch.length > 0) {
            await this.processBatch();
        }

        // Close all sockets
        for (const [droneId, socket] of this.sockets) {
            socket.close();
            logger.info(`Closed connection to drone ${droneId}`);
        }

        this.sockets.clear();
        this.drones.clear();

        logger.info('Telemetry processor stopped');
    }

    async connectToDrone(config) {
        try {
            logger.info(`Connecting to drone ${config.id} on port ${config.port}...`);

            const socket = dgram.createSocket('udp4');
            
            socket.on('message', (msg, rinfo) => {
                this.handleTelemetryMessage(config, msg, rinfo);
            });

            socket.on('error', (err) => {
                logger.error(`Socket error for drone ${config.id}:`, err);
                this.handleConnectionError(config, err);
            });

            socket.on('close', () => {
                logger.info(`Socket closed for drone ${config.id}`);
            });

            // Bind socket to listen for MAVLink messages
            socket.bind(config.port, '0.0.0.0', () => {
                logger.info(`Listening for drone ${config.id} on port ${config.port}`);
            });

            this.sockets.set(config.id, socket);
            
            // Initialize drone state
            this.drones.set(config.id, {
                id: config.id,
                instance: config.instance,
                port: config.port,
                connected: true,
                lastSeen: new Date(),
                systemId: config.instance + 1,
                componentId: 1,
                telemetryCount: 0
            });

        } catch (error) {
            logger.error(`Failed to connect to drone ${config.id}:`, error);
            throw error;
        }
    }

    handleTelemetryMessage(config, message, remoteInfo) {
        try {
            // Parse MAVLink message (simplified - in production use proper MAVLink parser)
            const telemetryData = this.parseMavlinkMessage(config, message);
            
            if (telemetryData) {
                // Update drone state
                const drone = this.drones.get(config.id);
                if (drone) {
                    drone.lastSeen = new Date();
                    drone.telemetryCount++;
                }

                // Add to processing queue
                this.queueTelemetryData(telemetryData);

                // Emit event for real-time subscribers
                this.emit('telemetry', telemetryData);
            }
        } catch (error) {
            logger.error(`Error processing telemetry for drone ${config.id}:`, error);
        }
    }

    parseMavlinkMessage(config, message) {
        // Simplified MAVLink parsing - in production, use proper MAVLink library
        // For now, generate realistic mock data
        const now = new Date();
        
        // Simulate different message types based on timing
        const messageTypes = ['GLOBAL_POSITION_INT', 'SYS_STATUS', 'ATTITUDE', 'GPS_RAW_INT'];
        const messageType = messageTypes[Math.floor(Math.random() * messageTypes.length)];

        const drone = this.drones.get(config.id);
        const baseLocation = this.getBaseLocation(config.instance);

        return {
            id: uuidv4(),
            drone_id: config.id,
            system_id: drone ? drone.systemId : config.instance + 1,
            component_id: 1,
            message_type: messageType,
            
            // Position data (simulate movement in small area)
            latitude: baseLocation.lat + (Math.random() - 0.5) * 0.001,
            longitude: baseLocation.lon + (Math.random() - 0.5) * 0.001,
            altitude_m: Math.random() * 50 + 10, // 10-60m altitude
            heading_degrees: Math.random() * 360,
            
            // Velocity data
            velocity_x_ms: (Math.random() - 0.5) * 10,
            velocity_y_ms: (Math.random() - 0.5) * 10,
            velocity_z_ms: (Math.random() - 0.5) * 3,
            ground_speed_ms: Math.random() * 15,
            
            // Battery data
            battery_voltage_v: 12.6 + Math.random() * 1.4,
            battery_current_a: Math.random() * 20,
            battery_level_percent: 70 + Math.random() * 30,
            power_consumption_w: 100 + Math.random() * 150,
            
            // GPS data
            gps_fix_type: 3, // 3D fix
            satellites_visible: 8 + Math.floor(Math.random() * 8),
            hdop: 1.0 + Math.random() * 2.0,
            signal_strength_dbm: -70 - Math.floor(Math.random() * 30),
            
            // Flight status
            flight_mode: 'STABILIZED',
            armed: Math.random() > 0.5,
            autopilot_enabled: true,
            
            // Environmental
            temperature_celsius: 20 + Math.random() * 15,
            humidity_percent: 40 + Math.random() * 40,
            pressure_hpa: 1013 + (Math.random() - 0.5) * 50,
            
            // Timestamps
            drone_timestamp: now,
            received_at: now,
            
            // Raw message for debugging
            raw_message: message.toString('hex').substring(0, 100)
        };
    }

    getBaseLocation(instance) {
        // Base locations for each drone (San Francisco area)
        const baseLocations = [
            { lat: 37.7749, lon: -122.4194 }, // Drone 0
            { lat: 37.7759, lon: -122.4184 }, // Drone 1
            { lat: 37.7739, lon: -122.4204 }, // Drone 2
            { lat: 37.7769, lon: -122.4174 }, // Drone 3
            { lat: 37.7729, lon: -122.4214 }  // Drone 4
        ];
        
        return baseLocations[instance] || baseLocations[0];
    }

    queueTelemetryData(telemetryData) {
        this.telemetryBatch.push(telemetryData);
        
        // Process batch if it reaches max size
        if (this.telemetryBatch.length >= this.batchSize) {
            setImmediate(() => this.processBatch());
        }
    }

    startBatchProcessing() {
        // Process batches on a timer
        this.batchInterval = setInterval(async () => {
            if (this.telemetryBatch.length > 0) {
                await this.processBatch();
            }
        }, this.batchTimeoutMs);
    }

    async processBatch() {
        if (this.telemetryBatch.length === 0) return;

        const batch = [...this.telemetryBatch];
        this.telemetryBatch = [];

        try {
            // Process batch concurrently
            await Promise.all([
                this.cacheToRedis(batch),
                this.saveToDatabase(batch)
            ]);

            logger.info(`Processed telemetry batch: ${batch.length} records`);
        } catch (error) {
            logger.error('Error processing telemetry batch:', error);
            // Re-queue failed items
            this.telemetryBatch.unshift(...batch);
        }
    }

    async cacheToRedis(batch) {
        try {
            const pipeline = this.redis.pipeline();
            
            for (const telemetry of batch) {
                // Cache latest telemetry for each drone
                const key = `telemetry:latest:${telemetry.drone_id}`;
                pipeline.setex(key, 300, JSON.stringify(telemetry)); // 5 min TTL
                
                // Add to real-time stream
                const streamKey = `telemetry:stream:${telemetry.drone_id}`;
                pipeline.xadd(streamKey, 'MAXLEN', '~', '1000', '*', 
                    'data', JSON.stringify(telemetry));
            }
            
            await pipeline.exec();
        } catch (error) {
            logger.error('Error caching telemetry to Redis:', error);
            throw error;
        }
    }

    async saveToDatabase(batch) {
        try {
            // Get drone UUIDs
            const droneIds = [...new Set(batch.map(t => t.drone_id))];
            const droneQuery = 'SELECT id, drone_id FROM drones WHERE drone_id = ANY($1)';
            const droneResult = await this.db.query(droneQuery, [droneIds]);
            
            const droneMap = new Map();
            droneResult.rows.forEach(row => {
                droneMap.set(row.drone_id, row.id);
            });

            // Prepare batch insert
            const values = [];
            const placeholders = [];
            let paramCount = 1;

            for (const telemetry of batch) {
                const droneUuid = droneMap.get(telemetry.drone_id);
                if (!droneUuid) {
                    logger.warn(`Unknown drone ID: ${telemetry.drone_id}`);
                    continue;
                }

                const rowValues = [
                    droneUuid,
                    telemetry.latitude,
                    telemetry.longitude,
                    telemetry.altitude_m,
                    telemetry.heading_degrees,
                    telemetry.velocity_x_ms,
                    telemetry.velocity_y_ms,
                    telemetry.velocity_z_ms,
                    telemetry.ground_speed_ms,
                    telemetry.battery_voltage_v,
                    telemetry.battery_current_a,
                    telemetry.battery_level_percent,
                    telemetry.power_consumption_w,
                    telemetry.gps_fix_type,
                    telemetry.satellites_visible,
                    telemetry.hdop,
                    telemetry.signal_strength_dbm,
                    telemetry.flight_mode,
                    telemetry.armed,
                    telemetry.autopilot_enabled,
                    telemetry.temperature_celsius,
                    telemetry.humidity_percent,
                    telemetry.pressure_hpa,
                    telemetry.drone_timestamp,
                    telemetry.received_at
                ];

                values.push(...rowValues);
                const placeholder = `(${Array.from({length: rowValues.length}, (_, i) => `$${paramCount + i}`).join(',')})`;
                placeholders.push(placeholder);
                paramCount += rowValues.length;
            }

            if (placeholders.length === 0) return;

            const query = `
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

            await this.db.query(query, values);
        } catch (error) {
            logger.error('Error saving telemetry to database:', error);
            throw error;
        }
    }

    handleConnectionError(config, error) {
        logger.error(`Connection error for drone ${config.id}:`, error);
        
        // Mark drone as disconnected
        const drone = this.drones.get(config.id);
        if (drone) {
            drone.connected = false;
        }

        // Implement reconnection logic here if needed
    }

    // Public methods for status and control
    getConnectedDrones() {
        return Array.from(this.drones.values());
    }

    getDroneStatus(droneId) {
        return this.drones.get(droneId);
    }

    isHealthy() {
        const connectedCount = Array.from(this.drones.values())
            .filter(drone => drone.connected).length;
        return connectedCount > 0;
    }
}

module.exports = TelemetryProcessor;