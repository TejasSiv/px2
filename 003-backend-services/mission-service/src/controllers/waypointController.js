const Waypoint = require('../models/Waypoint');
const Mission = require('../models/Mission');
const logger = require('../utils/logger');

class WaypointController {
    // Get waypoints for a specific mission
    async getWaypointsByMission(req, res) {
        try {
            const { missionId } = req.params;

            // Check if mission exists
            const mission = await Mission.findById(missionId);
            if (!mission) {
                return res.status(404).json({
                    error: 'Mission not found',
                    missionId,
                    timestamp: new Date().toISOString()
                });
            }

            const waypoints = await Waypoint.findByMissionId(missionId);

            res.json({
                success: true,
                data: waypoints.map(w => w.toJSON()),
                missionId,
                count: waypoints.length,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error(`Error getting waypoints for mission ${req.params.missionId}:`, error);
            res.status(500).json({
                error: 'Failed to get waypoints',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Get a specific waypoint by ID
    async getWaypointById(req, res) {
        try {
            const { id } = req.params;
            const waypoint = await Waypoint.findById(id);

            if (!waypoint) {
                return res.status(404).json({
                    error: 'Waypoint not found',
                    id,
                    timestamp: new Date().toISOString()
                });
            }

            res.json({
                success: true,
                data: waypoint.toJSON(),
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error(`Error getting waypoint ${req.params.id}:`, error);
            res.status(500).json({
                error: 'Failed to get waypoint',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Create a new waypoint
    async createWaypoint(req, res) {
        try {
            const { missionId, position, action, parameters, hoverTime, notes, estimatedTime } = req.body;

            // Check if mission exists
            const mission = await Mission.findById(missionId);
            if (!mission) {
                return res.status(404).json({
                    error: 'Mission not found',
                    missionId,
                    timestamp: new Date().toISOString()
                });
            }

            // Get the next sequence number
            const existingWaypoints = await Waypoint.findByMissionId(missionId);
            const nextSequence = existingWaypoints.length;

            const waypointData = {
                missionId,
                sequence: nextSequence,
                position,
                action,
                parameters: parameters || {},
                hoverTime: hoverTime || 0,
                notes: notes || '',
                estimatedTime
            };

            const waypoint = new Waypoint(waypointData);
            await waypoint.save();

            // Invalidate mission cache since waypoints changed
            const { missionCache } = require('../cache/redis');
            await missionCache.deleteMission(missionId);

            // Broadcast waypoint creation via WebSocket
            if (req.missionManager && req.missionManager.wsServer) {
                req.missionManager.wsServer.broadcast('waypoint_created', {
                    waypoint: waypoint.toJSON(),
                    missionId
                });
            }

            res.status(201).json({
                success: true,
                data: waypoint.toJSON(),
                message: 'Waypoint created successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Error creating waypoint:', error);
            res.status(500).json({
                error: 'Failed to create waypoint',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Update an existing waypoint
    async updateWaypoint(req, res) {
        try {
            const { id } = req.params;
            const waypoint = await Waypoint.findById(id);

            if (!waypoint) {
                return res.status(404).json({
                    error: 'Waypoint not found',
                    id,
                    timestamp: new Date().toISOString()
                });
            }

            // Update waypoint properties
            const allowedUpdates = ['position', 'action', 'parameters', 'hoverTime', 'notes', 'estimatedTime'];
            allowedUpdates.forEach(field => {
                if (req.body[field] !== undefined) {
                    waypoint[field] = req.body[field];
                }
            });

            await waypoint.save();

            // Invalidate mission cache
            const { missionCache } = require('../cache/redis');
            await missionCache.deleteMission(waypoint.missionId);

            // Broadcast waypoint update via WebSocket
            if (req.missionManager && req.missionManager.wsServer) {
                req.missionManager.wsServer.broadcast('waypoint_updated', {
                    waypoint: waypoint.toJSON(),
                    missionId: waypoint.missionId
                });
            }

            res.json({
                success: true,
                data: waypoint.toJSON(),
                message: 'Waypoint updated successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error(`Error updating waypoint ${req.params.id}:`, error);
            res.status(500).json({
                error: 'Failed to update waypoint',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Delete a waypoint
    async deleteWaypoint(req, res) {
        try {
            const { id } = req.params;
            const waypoint = await Waypoint.findById(id);

            if (!waypoint) {
                return res.status(404).json({
                    error: 'Waypoint not found',
                    id,
                    timestamp: new Date().toISOString()
                });
            }

            const missionId = waypoint.missionId;
            await waypoint.delete();

            // Resequence remaining waypoints
            const remainingWaypoints = await Waypoint.findByMissionId(missionId);
            for (let i = 0; i < remainingWaypoints.length; i++) {
                if (remainingWaypoints[i].sequence !== i) {
                    remainingWaypoints[i].sequence = i;
                    await remainingWaypoints[i].save();
                }
            }

            // Invalidate mission cache
            const { missionCache } = require('../cache/redis');
            await missionCache.deleteMission(missionId);

            // Broadcast waypoint deletion via WebSocket
            if (req.missionManager && req.missionManager.wsServer) {
                req.missionManager.wsServer.broadcast('waypoint_deleted', {
                    waypointId: id,
                    missionId
                });
            }

            res.json({
                success: true,
                message: 'Waypoint deleted successfully',
                data: { id, missionId },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error(`Error deleting waypoint ${req.params.id}:`, error);
            res.status(500).json({
                error: 'Failed to delete waypoint',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Mark waypoint as completed
    async markWaypointCompleted(req, res) {
        try {
            const { id } = req.params;
            const { actualTime } = req.body;

            const waypoint = await Waypoint.findById(id);
            if (!waypoint) {
                return res.status(404).json({
                    error: 'Waypoint not found',
                    id,
                    timestamp: new Date().toISOString()
                });
            }

            if (waypoint.completed) {
                return res.status(400).json({
                    error: 'Waypoint already completed',
                    id,
                    timestamp: new Date().toISOString()
                });
            }

            await waypoint.markCompleted(actualTime);

            // Update mission progress
            const mission = await Mission.findById(waypoint.missionId);
            if (mission) {
                const allWaypoints = await Waypoint.findByMissionId(waypoint.missionId);
                const completedWaypoints = allWaypoints.filter(w => w.completed);
                const progress = Math.round((completedWaypoints.length / allWaypoints.length) * 100);
                
                mission.progress = progress;
                mission.currentWaypoint = waypoint.sequence + 1;
                
                // Mark mission as completed if all waypoints are done
                if (progress >= 100 && mission.status === 'active') {
                    mission.status = 'completed';
                    mission.completedAt = new Date().toISOString();
                }
                
                await mission.save();

                // Invalidate mission cache
                const { missionCache } = require('../cache/redis');
                await missionCache.deleteMission(waypoint.missionId);
            }

            // Broadcast waypoint completion via WebSocket
            if (req.missionManager && req.missionManager.wsServer) {
                req.missionManager.wsServer.broadcast('waypoint_completed', {
                    waypoint: waypoint.toJSON(),
                    missionId: waypoint.missionId,
                    missionProgress: mission ? mission.progress : null
                });
            }

            res.json({
                success: true,
                data: {
                    waypoint: waypoint.toJSON(),
                    missionProgress: mission ? mission.progress : null
                },
                message: 'Waypoint marked as completed',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error(`Error completing waypoint ${req.params.id}:`, error);
            res.status(500).json({
                error: 'Failed to mark waypoint as completed',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Reorder waypoints in a mission
    async reorderWaypoints(req, res) {
        try {
            const { missionId } = req.params;
            const { waypointIds } = req.body;

            if (!Array.isArray(waypointIds)) {
                return res.status(400).json({
                    error: 'waypointIds must be an array',
                    timestamp: new Date().toISOString()
                });
            }

            // Check if mission exists
            const mission = await Mission.findById(missionId);
            if (!mission) {
                return res.status(404).json({
                    error: 'Mission not found',
                    missionId,
                    timestamp: new Date().toISOString()
                });
            }

            // Get existing waypoints
            const existingWaypoints = await Waypoint.findByMissionId(missionId);
            const existingIds = existingWaypoints.map(w => w.id);

            // Validate that all provided IDs exist
            const invalidIds = waypointIds.filter(id => !existingIds.includes(id));
            if (invalidIds.length > 0) {
                return res.status(400).json({
                    error: 'Invalid waypoint IDs provided',
                    invalidIds,
                    timestamp: new Date().toISOString()
                });
            }

            // Update sequences
            for (let i = 0; i < waypointIds.length; i++) {
                const waypoint = existingWaypoints.find(w => w.id === waypointIds[i]);
                if (waypoint) {
                    waypoint.sequence = i;
                    await waypoint.save();
                }
            }

            // Get updated waypoints
            const updatedWaypoints = await Waypoint.findByMissionId(missionId);

            // Invalidate mission cache
            const { missionCache } = require('../cache/redis');
            await missionCache.deleteMission(missionId);

            // Broadcast waypoint reorder via WebSocket
            if (req.missionManager && req.missionManager.wsServer) {
                req.missionManager.wsServer.broadcast('waypoints_reordered', {
                    missionId,
                    waypoints: updatedWaypoints.map(w => w.toJSON())
                });
            }

            res.json({
                success: true,
                data: updatedWaypoints.map(w => w.toJSON()),
                message: 'Waypoints reordered successfully',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error(`Error reordering waypoints for mission ${req.params.missionId}:`, error);
            res.status(500).json({
                error: 'Failed to reorder waypoints',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
}

module.exports = new WaypointController();