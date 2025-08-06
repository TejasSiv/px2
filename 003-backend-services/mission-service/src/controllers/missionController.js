const Mission = require('../models/Mission');
const Waypoint = require('../models/Waypoint');
const { missionCache } = require('../cache/redis');
const logger = require('../utils/logger');
const { validateMissionData, validateUpdateData } = require('../validation/missionValidation');

class MissionController {
    // CREATE - Create a new mission
    async createMission(req, res) {
        try {
            const validationResult = validateMissionData(req.body);
            if (!validationResult.isValid) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationResult.errors,
                    timestamp: new Date().toISOString()
                });
            }

            const mission = new Mission(req.body);
            await mission.save();

            // Create waypoints if provided
            if (req.body.waypoints && Array.isArray(req.body.waypoints)) {
                const waypoints = await Waypoint.createBatch(req.body.waypoints, mission.id);
                mission.waypoints = waypoints.map(w => w.toJSON());
            }

            // Broadcast mission creation via WebSocket
            if (req.missionManager && req.missionManager.wsServer) {
                req.missionManager.wsServer.broadcast('mission_created', mission.toJSON());
            }

            res.status(201).json({
                success: true,
                data: mission.toJSON(),
                message: 'Mission created successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.logMissionError(req.body.id || 'unknown', error, { action: 'create' });
            res.status(500).json({
                error: 'Failed to create mission',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // READ - Get all missions with optional filtering
    async getAllMissions(req, res) {
        try {
            const {
                status,
                assignedDrone,
                priority,
                sortBy = 'created_at',
                sortOrder = 'DESC',
                limit = 50,
                offset = 0
            } = req.query;

            const filters = {
                status,
                assignedDrone,
                priority: priority ? parseInt(priority) : undefined,
                sortBy,
                sortOrder,
                limit: parseInt(limit),
                offset: parseInt(offset)
            };

            const missions = await Mission.findAll(filters);
            const stats = await Mission.getStats();

            res.json({
                success: true,
                data: missions.map(m => m.toJSON()),
                meta: {
                    total: stats.total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    filters: { status, assignedDrone, priority }
                },
                stats,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error getting all missions:', error);
            res.status(500).json({
                error: 'Failed to get missions',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // READ - Get a single mission by ID
    async getMissionById(req, res) {
        try {
            const { id } = req.params;
            const mission = await Mission.findById(id);

            if (!mission) {
                return res.status(404).json({
                    error: 'Mission not found',
                    id,
                    timestamp: new Date().toISOString()
                });
            }

            // Get waypoints for this mission
            const waypoints = await Waypoint.findByMissionId(id);
            const missionData = mission.toJSON();
            missionData.waypoints = waypoints.map(w => w.toJSON());

            res.json({
                success: true,
                data: missionData,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.logMissionError(req.params.id, error, { action: 'get' });
            res.status(500).json({
                error: 'Failed to get mission',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // UPDATE - Update an existing mission
    async updateMission(req, res) {
        try {
            const { id } = req.params;
            const mission = await Mission.findById(id);

            if (!mission) {
                return res.status(404).json({
                    error: 'Mission not found',
                    id,
                    timestamp: new Date().toISOString()
                });
            }

            // Validate update data
            const validationResult = validateUpdateData(req.body);
            if (!validationResult.isValid) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationResult.errors,
                    timestamp: new Date().toISOString()
                });
            }

            // Update mission properties
            Object.keys(req.body).forEach(key => {
                if (key !== 'id' && mission.hasOwnProperty(key)) {
                    mission[key] = req.body[key];
                }
            });

            // Special handling for status changes
            if (req.body.status) {
                if (req.body.status === 'active' && mission.status !== 'active') {
                    mission.startedAt = new Date().toISOString();
                } else if (['completed', 'failed', 'cancelled'].includes(req.body.status) && !mission.completedAt) {
                    mission.completedAt = new Date().toISOString();
                    if (req.body.status === 'completed' && mission.progress < 100) {
                        mission.progress = 100;
                    }
                }
            }

            await mission.save();

            // Update waypoints if provided
            if (req.body.waypoints && Array.isArray(req.body.waypoints)) {
                // Delete existing waypoints and create new ones
                await Waypoint.deleteByMissionId(id);
                const waypoints = await Waypoint.createBatch(req.body.waypoints, id);
                mission.waypoints = waypoints.map(w => w.toJSON());
            }

            // Invalidate caches
            await missionCache.deleteMission(id);
            await missionCache.invalidateAll();

            // Broadcast mission update via WebSocket
            if (req.missionManager && req.missionManager.wsServer) {
                req.missionManager.wsServer.broadcast('mission_updated', mission.toJSON());
            }

            res.json({
                success: true,
                data: mission.toJSON(),
                message: 'Mission updated successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.logMissionError(req.params.id, error, { action: 'update' });
            res.status(500).json({
                error: 'Failed to update mission',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // DELETE - Delete a mission
    async deleteMission(req, res) {
        try {
            const { id } = req.params;
            const mission = await Mission.findById(id);

            if (!mission) {
                return res.status(404).json({
                    error: 'Mission not found',
                    id,
                    timestamp: new Date().toISOString()
                });
            }

            // Check if mission can be deleted
            if (mission.status === 'active') {
                return res.status(400).json({
                    error: 'Cannot delete active mission',
                    message: 'Mission must be completed, cancelled, or failed before deletion',
                    id,
                    status: mission.status,
                    timestamp: new Date().toISOString()
                });
            }

            await mission.delete();

            // Invalidate caches
            await missionCache.invalidateAll();

            // Broadcast mission deletion via WebSocket
            if (req.missionManager && req.missionManager.wsServer) {
                req.missionManager.wsServer.broadcast('mission_deleted', { id, name: mission.name });
            }

            res.json({
                success: true,
                message: 'Mission deleted successfully',
                data: { id, name: mission.name },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.logMissionError(req.params.id, error, { action: 'delete' });
            res.status(500).json({
                error: 'Failed to delete mission',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Get mission statistics
    async getMissionStats(req, res) {
        try {
            const stats = await Mission.getStats();

            res.json({
                success: true,
                data: stats,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error getting mission stats:', error);
            res.status(500).json({
                error: 'Failed to get mission statistics',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Get active missions
    async getActiveMissions(req, res) {
        try {
            const missions = await Mission.getActiveMissions();

            res.json({
                success: true,
                data: missions.map(m => m.toJSON()),
                count: missions.length,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error getting active missions:', error);
            res.status(500).json({
                error: 'Failed to get active missions',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Assign mission to drone
    async assignMissionToDrone(req, res) {
        try {
            const { id } = req.params;
            const { droneId } = req.body;

            if (!droneId) {
                return res.status(400).json({
                    error: 'Drone ID is required',
                    timestamp: new Date().toISOString()
                });
            }

            const mission = await Mission.findById(id);
            if (!mission) {
                return res.status(404).json({
                    error: 'Mission not found',
                    id,
                    timestamp: new Date().toISOString()
                });
            }

            // Check if mission can be assigned
            if (mission.status !== 'pending') {
                return res.status(400).json({
                    error: 'Mission cannot be assigned',
                    message: 'Only pending missions can be assigned to drones',
                    currentStatus: mission.status,
                    timestamp: new Date().toISOString()
                });
            }

            mission.assignedDrone = droneId;
            mission.status = 'active';
            mission.startedAt = new Date().toISOString();
            await mission.save();

            // Update cache assignment
            await missionCache.assignMissionToDrone(droneId, id);

            // Broadcast assignment via WebSocket
            if (req.missionManager && req.missionManager.wsServer) {
                req.missionManager.wsServer.broadcast('mission_assigned', {
                    missionId: id,
                    droneId,
                    mission: mission.toJSON()
                });
            }

            res.json({
                success: true,
                data: mission.toJSON(),
                message: 'Mission assigned successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.logMissionError(req.params.id, error, { action: 'assign', droneId: req.body.droneId });
            res.status(500).json({
                error: 'Failed to assign mission',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Update mission progress
    async updateMissionProgress(req, res) {
        try {
            const { id } = req.params;
            const { progress, currentWaypoint } = req.body;

            if (typeof progress !== 'number' || progress < 0 || progress > 100) {
                return res.status(400).json({
                    error: 'Invalid progress value',
                    message: 'Progress must be a number between 0 and 100',
                    timestamp: new Date().toISOString()
                });
            }

            const mission = await Mission.findById(id);
            if (!mission) {
                return res.status(404).json({
                    error: 'Mission not found',
                    id,
                    timestamp: new Date().toISOString()
                });
            }

            mission.progress = progress;
            if (typeof currentWaypoint === 'number') {
                mission.currentWaypoint = currentWaypoint;
            }

            // Mark as completed if progress is 100%
            if (progress >= 100 && mission.status === 'active') {
                mission.status = 'completed';
                mission.completedAt = new Date().toISOString();
                mission.actualDuration = new Date() - new Date(mission.startedAt);
            }

            await mission.save();

            // Broadcast progress update via WebSocket
            if (req.missionManager && req.missionManager.wsServer) {
                req.missionManager.wsServer.broadcast('mission_progress', {
                    missionId: id,
                    progress,
                    currentWaypoint,
                    status: mission.status
                });
            }

            res.json({
                success: true,
                data: {
                    id,
                    progress,
                    currentWaypoint: mission.currentWaypoint,
                    status: mission.status
                },
                message: 'Mission progress updated successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.logMissionError(req.params.id, error, { action: 'updateProgress' });
            res.status(500).json({
                error: 'Failed to update mission progress',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
}

module.exports = new MissionController();