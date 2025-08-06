const express = require('express');
const missionController = require('../controllers/missionController');
const waypointController = require('../controllers/waypointController');
const { validateMissionCreation, validateMissionUpdate } = require('../validation/missionValidation');

const router = express.Router();

// Mission routes

// GET /api/missions - Get all missions with optional filtering
router.get('/missions', missionController.getAllMissions);

// GET /api/missions/active - Get active missions
router.get('/missions/active', missionController.getActiveMissions);

// GET /api/missions/stats - Get mission statistics
router.get('/missions/stats', missionController.getMissionStats);

// GET /api/missions/:id - Get a specific mission by ID
router.get('/missions/:id', missionController.getMissionById);

// POST /api/missions - Create a new mission
router.post('/missions', validateMissionCreation, missionController.createMission);

// PUT /api/missions/:id - Update a mission
router.put('/missions/:id', validateMissionUpdate, missionController.updateMission);

// DELETE /api/missions/:id - Delete a mission
router.delete('/missions/:id', missionController.deleteMission);

// POST /api/missions/:id/assign - Assign mission to drone
router.post('/missions/:id/assign', missionController.assignMissionToDrone);

// PUT /api/missions/:id/progress - Update mission progress
router.put('/missions/:id/progress', missionController.updateMissionProgress);

// Waypoint routes

// GET /api/waypoints/mission/:missionId - Get waypoints for a mission
router.get('/waypoints/mission/:missionId', waypointController.getWaypointsByMission);

// GET /api/waypoints/:id - Get a specific waypoint
router.get('/waypoints/:id', waypointController.getWaypointById);

// POST /api/waypoints - Create a new waypoint
router.post('/waypoints', waypointController.createWaypoint);

// PUT /api/waypoints/:id - Update a waypoint
router.put('/waypoints/:id', waypointController.updateWaypoint);

// DELETE /api/waypoints/:id - Delete a waypoint
router.delete('/waypoints/:id', waypointController.deleteWaypoint);

// PUT /api/waypoints/:id/complete - Mark waypoint as completed
router.put('/waypoints/:id/complete', waypointController.markWaypointCompleted);

// Utility routes

// POST /api/validate/mission - Validate mission data without creating
router.post('/validate/mission', (req, res) => {
    const { validateMissionData } = require('../validation/missionValidation');
    const result = validateMissionData(req.body);
    
    res.json({
        valid: result.isValid,
        errors: result.errors,
        timestamp: new Date().toISOString()
    });
});

// POST /api/calculate/route - Calculate route distance and time
router.post('/calculate/route', (req, res) => {
    try {
        const { waypoints, speed = 10 } = req.body;
        
        if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
            return res.status(400).json({
                error: 'At least 2 waypoints are required for route calculation',
                timestamp: new Date().toISOString()
            });
        }

        const Waypoint = require('../models/Waypoint');
        let totalDistance = 0;
        let totalTime = 0;

        for (let i = 1; i < waypoints.length; i++) {
            const distance = Waypoint.calculateDistance(waypoints[i - 1], waypoints[i]);
            const time = Waypoint.estimateFlightTime(waypoints[i - 1], waypoints[i], speed);
            
            totalDistance += distance;
            totalTime += time;
            
            // Add hover time if specified
            if (waypoints[i].hoverTime) {
                totalTime += waypoints[i].hoverTime;
            }
        }

        res.json({
            success: true,
            data: {
                totalDistance: Math.round(totalDistance),
                totalTime: Math.round(totalTime),
                averageSpeed: speed,
                waypointCount: waypoints.length,
                segments: waypoints.slice(1).map((waypoint, index) => {
                    const prev = waypoints[index];
                    const distance = Waypoint.calculateDistance(prev, waypoint);
                    const time = Waypoint.estimateFlightTime(prev, waypoint, speed);
                    
                    return {
                        from: index,
                        to: index + 1,
                        distance: Math.round(distance),
                        time: Math.round(time),
                        hoverTime: waypoint.hoverTime || 0
                    };
                })
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            error: 'Failed to calculate route',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// GET /api/status - Service status and health
router.get('/status', (req, res) => {
    res.json({
        service: 'mission-service',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
        node: process.version,
        platform: process.platform,
        activeMissions: req.missionManager ? req.missionManager.getActiveMissionCount() : 0
    });
});

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Route error:', error);
    res.status(error.status || 500).json({
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString(),
        path: req.originalUrl
    });
});

module.exports = router;