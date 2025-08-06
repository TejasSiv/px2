const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { query, withTransaction } = require('../database/connection');
const { missionCache } = require('../cache/redis');
const logger = require('../utils/logger');

class Mission {
    constructor(data) {
        this.id = data.id || uuidv4();
        this.name = data.name;
        this.description = data.description || '';
        this.status = data.status || 'pending';
        this.priority = data.priority || 1;
        this.waypoints = data.waypoints || [];
        this.assignedDrone = data.assignedDrone || null;
        this.estimatedDuration = data.estimatedDuration || null;
        this.actualDuration = data.actualDuration || null;
        this.progress = data.progress || 0;
        this.currentWaypoint = data.currentWaypoint || 0;
        this.createdAt = data.createdAt || new Date().toISOString();
        this.startedAt = data.startedAt || null;
        this.completedAt = data.completedAt || null;
        this.metadata = data.metadata || {};
    }

    // Validate mission data
    validate() {
        const errors = [];

        if (!this.name || this.name.trim().length === 0) {
            errors.push('Mission name is required');
        }

        if (this.name && this.name.length > 100) {
            errors.push('Mission name must be less than 100 characters');
        }

        if (!Array.isArray(this.waypoints) || this.waypoints.length === 0) {
            errors.push('Mission must have at least one waypoint');
        }

        if (this.priority < 1 || this.priority > 10) {
            errors.push('Priority must be between 1 and 10');
        }

        const validStatuses = ['pending', 'active', 'paused', 'completed', 'failed', 'cancelled'];
        if (!validStatuses.includes(this.status)) {
            errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
        }

        // Validate waypoints
        this.waypoints.forEach((waypoint, index) => {
            if (!waypoint.position || typeof waypoint.position.lat !== 'number' || typeof waypoint.position.lng !== 'number') {
                errors.push(`Waypoint ${index + 1}: Invalid position coordinates`);
            }
            if (waypoint.position && (Math.abs(waypoint.position.lat) > 90 || Math.abs(waypoint.position.lng) > 180)) {
                errors.push(`Waypoint ${index + 1}: Invalid coordinate range`);
            }
            if (!waypoint.action || !['pickup', 'delivery', 'hover', 'survey', 'navigation'].includes(waypoint.action)) {
                errors.push(`Waypoint ${index + 1}: Invalid action type`);
            }
        });

        return errors;
    }

    // Save mission to database
    async save() {
        const validationErrors = this.validate();
        if (validationErrors.length > 0) {
            throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
        }

        try {
            const isUpdate = await Mission.exists(this.id);
            
            if (isUpdate) {
                await this.update();
            } else {
                await this.create();
            }

            // Update cache
            await missionCache.setMission(this.id, this.toJSON());
            
            logger.logMissionEvent(this.id, isUpdate ? 'updated' : 'created', {
                name: this.name,
                status: this.status,
                waypoints: this.waypoints.length
            });

            return this;
        } catch (error) {
            logger.logMissionError(this.id, error);
            throw error;
        }
    }

    // Create new mission
    async create() {
        const sql = `
            INSERT INTO missions (
                id, name, description, status, priority, waypoints, 
                assigned_drone, estimated_duration, progress, 
                current_waypoint, created_at, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `;

        const values = [
            this.id,
            this.name,
            this.description,
            this.status,
            this.priority,
            JSON.stringify(this.waypoints),
            this.assignedDrone,
            this.estimatedDuration,
            this.progress,
            this.currentWaypoint,
            this.createdAt,
            JSON.stringify(this.metadata)
        ];

        const result = await query(sql, values);
        return this.fromDatabaseRow(result.rows[0]);
    }

    // Update existing mission
    async update() {
        const sql = `
            UPDATE missions SET
                name = $2,
                description = $3,
                status = $4,
                priority = $5,
                waypoints = $6,
                assigned_drone = $7,
                estimated_duration = $8,
                actual_duration = $9,
                progress = $10,
                current_waypoint = $11,
                started_at = $12,
                completed_at = $13,
                metadata = $14,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
        `;

        const values = [
            this.id,
            this.name,
            this.description,
            this.status,
            this.priority,
            JSON.stringify(this.waypoints),
            this.assignedDrone,
            this.estimatedDuration,
            this.actualDuration,
            this.progress,
            this.currentWaypoint,
            this.startedAt,
            this.completedAt,
            JSON.stringify(this.metadata)
        ];

        const result = await query(sql, values);
        return this.fromDatabaseRow(result.rows[0]);
    }

    // Delete mission
    async delete() {
        try {
            await withTransaction(async (client) => {
                // Delete waypoints first
                await client.query('DELETE FROM waypoints WHERE mission_id = $1', [this.id]);
                
                // Delete mission
                await client.query('DELETE FROM missions WHERE id = $1', [this.id]);
            });

            // Remove from cache
            await missionCache.deleteMission(this.id);
            
            logger.logMissionEvent(this.id, 'deleted', { name: this.name });
            
            return true;
        } catch (error) {
            logger.logMissionError(this.id, error);
            throw error;
        }
    }

    // Convert database row to Mission instance
    fromDatabaseRow(row) {
        if (!row) return null;

        this.id = row.id;
        this.name = row.name;
        this.description = row.description;
        this.status = row.status;
        this.priority = row.priority;
        this.waypoints = typeof row.waypoints === 'string' ? JSON.parse(row.waypoints) : row.waypoints;
        this.assignedDrone = row.assigned_drone;
        this.estimatedDuration = row.estimated_duration;
        this.actualDuration = row.actual_duration;
        this.progress = row.progress;
        this.currentWaypoint = row.current_waypoint;
        this.createdAt = row.created_at;
        this.startedAt = row.started_at;
        this.completedAt = row.completed_at;
        this.metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;

        return this;
    }

    // Convert to JSON representation
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            status: this.status,
            priority: this.priority,
            waypoints: this.waypoints,
            assignedDrone: this.assignedDrone,
            estimatedDuration: this.estimatedDuration,
            actualDuration: this.actualDuration,
            progress: this.progress,
            currentWaypoint: this.currentWaypoint,
            createdAt: this.createdAt,
            startedAt: this.startedAt,
            completedAt: this.completedAt,
            metadata: this.metadata
        };
    }

    // Static methods

    // Find mission by ID
    static async findById(id) {
        try {
            // Try cache first
            const cached = await missionCache.getMission(id);
            if (cached) {
                return new Mission(cached);
            }

            // Query database
            const sql = 'SELECT * FROM missions WHERE id = $1';
            const result = await query(sql, [id]);
            
            if (result.rows.length === 0) {
                return null;
            }

            const mission = new Mission({}).fromDatabaseRow(result.rows[0]);
            
            // Update cache
            await missionCache.setMission(id, mission.toJSON());
            
            return mission;
        } catch (error) {
            logger.error(`Error finding mission by ID ${id}:`, error);
            throw error;
        }
    }

    // Find all missions with optional filters
    static async findAll(filters = {}) {
        try {
            let sql = 'SELECT * FROM missions WHERE 1=1';
            const params = [];
            let paramIndex = 1;

            // Apply filters
            if (filters.status) {
                sql += ` AND status = $${paramIndex}`;
                params.push(filters.status);
                paramIndex++;
            }

            if (filters.assignedDrone) {
                sql += ` AND assigned_drone = $${paramIndex}`;
                params.push(filters.assignedDrone);
                paramIndex++;
            }

            if (filters.priority) {
                sql += ` AND priority = $${paramIndex}`;
                params.push(filters.priority);
                paramIndex++;
            }

            // Add sorting
            const sortBy = filters.sortBy || 'created_at';
            const sortOrder = filters.sortOrder || 'DESC';
            sql += ` ORDER BY ${sortBy} ${sortOrder}`;

            // Add pagination
            if (filters.limit) {
                sql += ` LIMIT $${paramIndex}`;
                params.push(filters.limit);
                paramIndex++;

                if (filters.offset) {
                    sql += ` OFFSET $${paramIndex}`;
                    params.push(filters.offset);
                }
            }

            const result = await query(sql, params);
            
            return result.rows.map(row => new Mission({}).fromDatabaseRow(row));
        } catch (error) {
            logger.error('Error finding missions:', error);
            throw error;
        }
    }

    // Check if mission exists
    static async exists(id) {
        try {
            const sql = 'SELECT 1 FROM missions WHERE id = $1';
            const result = await query(sql, [id]);
            return result.rows.length > 0;
        } catch (error) {
            logger.error(`Error checking if mission exists ${id}:`, error);
            throw error;
        }
    }

    // Get mission statistics
    static async getStats() {
        try {
            // Try cache first
            const cached = await missionCache.getMissionStats();
            if (cached) {
                return cached;
            }

            const sql = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'active') as active,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE status = 'failed') as failed,
                    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                    AVG(progress) FILTER (WHERE status = 'active') as avg_progress,
                    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today
                FROM missions
            `;

            const result = await query(sql);
            const stats = result.rows[0];

            // Convert to numbers
            Object.keys(stats).forEach(key => {
                if (stats[key] !== null) {
                    stats[key] = parseFloat(stats[key]) || 0;
                }
            });

            // Cache the stats
            await missionCache.setMissionStats(stats);

            return stats;
        } catch (error) {
            logger.error('Error getting mission stats:', error);
            throw error;
        }
    }

    // Get active missions
    static async getActiveMissions() {
        try {
            const cached = await missionCache.getActiveMissions();
            if (cached.length > 0) {
                return cached.map(data => new Mission(data));
            }

            const missions = await Mission.findAll({ 
                status: 'active',
                sortBy: 'priority',
                sortOrder: 'DESC'
            });

            // Cache active missions
            await missionCache.setActiveMissions(missions.map(m => m.toJSON()));

            return missions;
        } catch (error) {
            logger.error('Error getting active missions:', error);
            throw error;
        }
    }
}

module.exports = Mission;