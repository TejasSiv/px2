const { v4: uuidv4 } = require('uuid');
const { query, withTransaction } = require('../database/connection');
const logger = require('../utils/logger');

class Waypoint {
    constructor(data) {
        this.id = data.id || uuidv4();
        this.missionId = data.missionId;
        this.sequence = data.sequence || 0;
        this.position = data.position || { lat: 0, lng: 0, alt: 0 };
        this.action = data.action || 'navigation';
        this.parameters = data.parameters || {};
        this.hoverTime = data.hoverTime || 0;
        this.completed = data.completed || false;
        this.notes = data.notes || '';
        this.estimatedTime = data.estimatedTime || null;
        this.actualTime = data.actualTime || null;
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    // Validate waypoint data
    validate() {
        const errors = [];

        if (!this.missionId) {
            errors.push('Mission ID is required');
        }

        if (typeof this.sequence !== 'number' || this.sequence < 0) {
            errors.push('Sequence must be a non-negative number');
        }

        if (!this.position || typeof this.position !== 'object') {
            errors.push('Position is required');
        } else {
            if (typeof this.position.lat !== 'number' || Math.abs(this.position.lat) > 90) {
                errors.push('Invalid latitude');
            }
            if (typeof this.position.lng !== 'number' || Math.abs(this.position.lng) > 180) {
                errors.push('Invalid longitude');
            }
            if (typeof this.position.alt !== 'number' || this.position.alt < 0 || this.position.alt > 1000) {
                errors.push('Invalid altitude (must be 0-1000 meters)');
            }
        }

        const validActions = ['pickup', 'delivery', 'hover', 'survey', 'navigation', 'landing', 'takeoff'];
        if (!validActions.includes(this.action)) {
            errors.push(`Action must be one of: ${validActions.join(', ')}`);
        }

        if (this.action === 'hover' && (!this.hoverTime || this.hoverTime <= 0)) {
            errors.push('Hover time must be specified for hover action');
        }

        return errors;
    }

    // Save waypoint to database
    async save() {
        const validationErrors = this.validate();
        if (validationErrors.length > 0) {
            throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
        }

        try {
            const exists = await Waypoint.exists(this.id);
            
            if (exists) {
                await this.update();
            } else {
                await this.create();
            }

            return this;
        } catch (error) {
            logger.error(`Error saving waypoint ${this.id}:`, error);
            throw error;
        }
    }

    // Create new waypoint
    async create() {
        const sql = `
            INSERT INTO waypoints (
                id, mission_id, sequence, position, action, parameters, 
                hover_time, completed, notes, estimated_time, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `;

        const values = [
            this.id,
            this.missionId,
            this.sequence,
            JSON.stringify(this.position),
            this.action,
            JSON.stringify(this.parameters),
            this.hoverTime,
            this.completed,
            this.notes,
            this.estimatedTime,
            this.createdAt
        ];

        const result = await query(sql, values);
        return this.fromDatabaseRow(result.rows[0]);
    }

    // Update existing waypoint
    async update() {
        const sql = `
            UPDATE waypoints SET
                sequence = $2,
                position = $3,
                action = $4,
                parameters = $5,
                hover_time = $6,
                completed = $7,
                notes = $8,
                estimated_time = $9,
                actual_time = $10,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `;

        const values = [
            this.id,
            this.sequence,
            JSON.stringify(this.position),
            this.action,
            JSON.stringify(this.parameters),
            this.hoverTime,
            this.completed,
            this.notes,
            this.estimatedTime,
            this.actualTime
        ];

        const result = await query(sql, values);
        return this.fromDatabaseRow(result.rows[0]);
    }

    // Delete waypoint
    async delete() {
        try {
            await query('DELETE FROM waypoints WHERE id = $1', [this.id]);
            logger.info(`Waypoint ${this.id} deleted`);
            return true;
        } catch (error) {
            logger.error(`Error deleting waypoint ${this.id}:`, error);
            throw error;
        }
    }

    // Mark waypoint as completed
    async markCompleted(actualTime = null) {
        this.completed = true;
        this.actualTime = actualTime || Date.now();
        return await this.save();
    }

    // Convert database row to Waypoint instance
    fromDatabaseRow(row) {
        if (!row) return null;

        this.id = row.id;
        this.missionId = row.mission_id;
        this.sequence = row.sequence;
        this.position = typeof row.position === 'string' ? JSON.parse(row.position) : row.position;
        this.action = row.action;
        this.parameters = typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters;
        this.hoverTime = row.hover_time;
        this.completed = row.completed;
        this.notes = row.notes;
        this.estimatedTime = row.estimated_time;
        this.actualTime = row.actual_time;
        this.createdAt = row.created_at;

        return this;
    }

    // Convert to JSON representation
    toJSON() {
        return {
            id: this.id,
            missionId: this.missionId,
            sequence: this.sequence,
            position: this.position,
            action: this.action,
            parameters: this.parameters,
            hoverTime: this.hoverTime,
            completed: this.completed,
            notes: this.notes,
            estimatedTime: this.estimatedTime,
            actualTime: this.actualTime,
            createdAt: this.createdAt
        };
    }

    // Static methods

    // Find waypoint by ID
    static async findById(id) {
        try {
            const sql = 'SELECT * FROM waypoints WHERE id = $1';
            const result = await query(sql, [id]);
            
            if (result.rows.length === 0) {
                return null;
            }

            return new Waypoint({}).fromDatabaseRow(result.rows[0]);
        } catch (error) {
            logger.error(`Error finding waypoint by ID ${id}:`, error);
            throw error;
        }
    }

    // Find waypoints by mission ID
    static async findByMissionId(missionId) {
        try {
            const sql = 'SELECT * FROM waypoints WHERE mission_id = $1 ORDER BY sequence ASC';
            const result = await query(sql, [missionId]);
            
            return result.rows.map(row => new Waypoint({}).fromDatabaseRow(row));
        } catch (error) {
            logger.error(`Error finding waypoints for mission ${missionId}:`, error);
            throw error;
        }
    }

    // Check if waypoint exists
    static async exists(id) {
        try {
            const sql = 'SELECT 1 FROM waypoints WHERE id = $1';
            const result = await query(sql, [id]);
            return result.rows.length > 0;
        } catch (error) {
            logger.error(`Error checking if waypoint exists ${id}:`, error);
            throw error;
        }
    }

    // Create multiple waypoints for a mission
    static async createBatch(waypoints, missionId) {
        try {
            return await withTransaction(async (client) => {
                const createdWaypoints = [];
                
                for (let i = 0; i < waypoints.length; i++) {
                    const waypointData = {
                        ...waypoints[i],
                        missionId,
                        sequence: i
                    };
                    
                    const waypoint = new Waypoint(waypointData);
                    const validationErrors = waypoint.validate();
                    
                    if (validationErrors.length > 0) {
                        throw new Error(`Waypoint ${i} validation failed: ${validationErrors.join(', ')}`);
                    }

                    const sql = `
                        INSERT INTO waypoints (
                            id, mission_id, sequence, position, action, parameters, 
                            hover_time, completed, notes, estimated_time, created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                        RETURNING *
                    `;

                    const values = [
                        waypoint.id,
                        waypoint.missionId,
                        waypoint.sequence,
                        JSON.stringify(waypoint.position),
                        waypoint.action,
                        JSON.stringify(waypoint.parameters),
                        waypoint.hoverTime,
                        waypoint.completed,
                        waypoint.notes,
                        waypoint.estimatedTime,
                        waypoint.createdAt
                    ];

                    const result = await client.query(sql, values);
                    createdWaypoints.push(new Waypoint({}).fromDatabaseRow(result.rows[0]));
                }

                return createdWaypoints;
            });
        } catch (error) {
            logger.error(`Error creating waypoint batch for mission ${missionId}:`, error);
            throw error;
        }
    }

    // Delete all waypoints for a mission
    static async deleteByMissionId(missionId) {
        try {
            await query('DELETE FROM waypoints WHERE mission_id = $1', [missionId]);
            logger.info(`All waypoints deleted for mission ${missionId}`);
            return true;
        } catch (error) {
            logger.error(`Error deleting waypoints for mission ${missionId}:`, error);
            throw error;
        }
    }

    // Calculate distance between two waypoints (in meters)
    static calculateDistance(waypoint1, waypoint2) {
        const R = 6371000; // Earth's radius in meters
        const lat1Rad = waypoint1.position.lat * Math.PI / 180;
        const lat2Rad = waypoint2.position.lat * Math.PI / 180;
        const deltaLat = (waypoint2.position.lat - waypoint1.position.lat) * Math.PI / 180;
        const deltaLng = (waypoint2.position.lng - waypoint1.position.lng) * Math.PI / 180;

        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                  Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                  Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        const distance = R * c;
        const altitudeDiff = Math.abs(waypoint2.position.alt - waypoint1.position.alt);
        
        return Math.sqrt(distance * distance + altitudeDiff * altitudeDiff);
    }

    // Estimate flight time between waypoints (in seconds)
    static estimateFlightTime(waypoint1, waypoint2, speed = 10) {
        const distance = Waypoint.calculateDistance(waypoint1, waypoint2);
        return Math.ceil(distance / speed); // speed in m/s
    }
}

module.exports = Waypoint;