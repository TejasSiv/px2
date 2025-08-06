const Mission = require('../models/Mission');
const Waypoint = require('../models/Waypoint');
const { missionCache } = require('../cache/redis');
const logger = require('../utils/logger');

class MissionManager {
    constructor() {
        this.activeMissions = new Map();
        this.missionMonitorInterval = null;
        this.wsServer = null;
        this.eventHandlers = new Map();
    }

    async initialize() {
        logger.info('Initializing Mission Manager...');

        try {
            // Load active missions from database
            await this.loadActiveMissions();

            // Setup event handlers
            this.setupEventHandlers();

            logger.info(`Mission Manager initialized with ${this.activeMissions.size} active missions`);
        } catch (error) {
            logger.error('Failed to initialize Mission Manager:', error);
            throw error;
        }
    }

    async start() {
        logger.info('Starting Mission Manager monitoring...');

        // Start mission monitoring interval (every 10 seconds)
        this.missionMonitorInterval = setInterval(() => {
            this.monitorMissions().catch(error => {
                logger.error('Error in mission monitoring:', error);
            });
        }, 10000);

        // Monitor mission assignments
        this.assignmentMonitorInterval = setInterval(() => {
            this.monitorAssignments().catch(error => {
                logger.error('Error in assignment monitoring:', error);
            });
        }, 30000);

        logger.info('Mission Manager monitoring started');
    }

    async stop() {
        logger.info('Stopping Mission Manager...');

        if (this.missionMonitorInterval) {
            clearInterval(this.missionMonitorInterval);
            this.missionMonitorInterval = null;
        }

        if (this.assignmentMonitorInterval) {
            clearInterval(this.assignmentMonitorInterval);
            this.assignmentMonitorInterval = null;
        }

        this.activeMissions.clear();
        logger.info('Mission Manager stopped');
    }

    async loadActiveMissions() {
        try {
            const activeMissions = await Mission.findAll({
                status: 'active',
                sortBy: 'priority',
                sortOrder: 'DESC'
            });

            this.activeMissions.clear();
            activeMissions.forEach(mission => {
                this.activeMissions.set(mission.id, {
                    mission,
                    lastUpdate: Date.now(),
                    waypoints: null, // Will be loaded on demand
                    metadata: {
                        startTime: Date.now(),
                        progressUpdates: 0,
                        lastProgressUpdate: null
                    }
                });
            });

            logger.info(`Loaded ${activeMissions.length} active missions`);
        } catch (error) {
            logger.error('Error loading active missions:', error);
            throw error;
        }
    }

    setupEventHandlers() {
        // Mission status change handler
        this.on('mission_status_changed', async (data) => {
            const { missionId, oldStatus, newStatus, timestamp } = data;
            
            try {
                if (newStatus === 'active') {
                    await this.addActiveMission(missionId);
                } else if (oldStatus === 'active' && newStatus !== 'active') {
                    await this.removeActiveMission(missionId);
                }

                // Broadcast status change
                if (this.wsServer) {
                    this.wsServer.broadcast('mission_status_changed', data);
                }
            } catch (error) {
                logger.error('Error handling mission status change:', error);
            }
        });

        // Mission progress handler
        this.on('mission_progress_updated', async (data) => {
            const { missionId, progress, currentWaypoint } = data;
            
            if (this.activeMissions.has(missionId)) {
                const missionData = this.activeMissions.get(missionId);
                missionData.mission.progress = progress;
                missionData.mission.currentWaypoint = currentWaypoint;
                missionData.lastUpdate = Date.now();
                missionData.metadata.progressUpdates++;
                missionData.metadata.lastProgressUpdate = Date.now();
            }

            // Broadcast progress update
            if (this.wsServer) {
                this.wsServer.broadcast('mission_progress_updated', data);
            }
        });

        // Mission assignment handler
        this.on('mission_assigned', async (data) => {
            const { missionId, droneId, timestamp } = data;
            
            if (this.activeMissions.has(missionId)) {
                const missionData = this.activeMissions.get(missionId);
                missionData.mission.assignedDrone = droneId;
                missionData.lastUpdate = Date.now();
            }

            // Update cache
            await missionCache.assignMissionToDrone(droneId, missionId);

            // Broadcast assignment
            if (this.wsServer) {
                this.wsServer.broadcast('mission_assigned', data);
            }
        });
    }

    async addActiveMission(missionId) {
        try {
            const mission = await Mission.findById(missionId);
            if (mission && mission.status === 'active') {
                this.activeMissions.set(missionId, {
                    mission,
                    lastUpdate: Date.now(),
                    waypoints: null,
                    metadata: {
                        startTime: Date.now(),
                        progressUpdates: 0,
                        lastProgressUpdate: null
                    }
                });
                logger.info(`Added active mission: ${missionId}`);
            }
        } catch (error) {
            logger.error(`Error adding active mission ${missionId}:`, error);
        }
    }

    async removeActiveMission(missionId) {
        if (this.activeMissions.has(missionId)) {
            this.activeMissions.delete(missionId);
            logger.info(`Removed active mission: ${missionId}`);
        }
    }

    async monitorMissions() {
        const now = Date.now();
        const staleThreshold = 300000; // 5 minutes

        for (const [missionId, missionData] of this.activeMissions) {
            try {
                // Check for stale missions (no updates in 5 minutes)
                if (now - missionData.lastUpdate > staleThreshold) {
                    logger.warn(`Mission ${missionId} appears stale, refreshing from database`);
                    
                    const freshMission = await Mission.findById(missionId);
                    if (freshMission) {
                        if (freshMission.status !== 'active') {
                            await this.removeActiveMission(missionId);
                            continue;
                        } else {
                            missionData.mission = freshMission;
                            missionData.lastUpdate = now;
                        }
                    }
                }

                // Monitor mission progress and estimate completion
                if (missionData.mission.assignedDrone && missionData.mission.progress < 100) {
                    await this.estimateMissionCompletion(missionId, missionData);
                }

                // Check for timeout conditions
                await this.checkMissionTimeouts(missionId, missionData);

            } catch (error) {
                logger.error(`Error monitoring mission ${missionId}:`, error);
            }
        }
    }

    async monitorAssignments() {
        try {
            // Check for unassigned high-priority missions
            const unassignedMissions = await Mission.findAll({
                status: 'pending',
                priority: 8, // High priority and above
                sortBy: 'priority',
                sortOrder: 'DESC',
                limit: 10
            });

            for (const mission of unassignedMissions) {
                if (this.wsServer) {
                    this.wsServer.broadcast('unassigned_high_priority_mission', {
                        mission: mission.toJSON(),
                        timestamp: new Date().toISOString()
                    });
                }
            }

            // Check for missions without progress updates
            const staleMissions = await Mission.findAll({
                status: 'active',
                sortBy: 'updated_at',
                sortOrder: 'ASC',
                limit: 20
            });

            const staleThreshold = 600000; // 10 minutes
            const now = Date.now();

            for (const mission of staleMissions) {
                const lastUpdate = new Date(mission.updatedAt || mission.startedAt).getTime();
                if (now - lastUpdate > staleThreshold) {
                    logger.warn(`Mission ${mission.id} has not been updated in over 10 minutes`);
                    
                    if (this.wsServer) {
                        this.wsServer.broadcast('mission_stale', {
                            mission: mission.toJSON(),
                            lastUpdate: new Date(lastUpdate).toISOString(),
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }
        } catch (error) {
            logger.error('Error monitoring assignments:', error);
        }
    }

    async estimateMissionCompletion(missionId, missionData) {
        try {
            const { mission } = missionData;
            
            // Load waypoints if not cached
            if (!missionData.waypoints) {
                missionData.waypoints = await Waypoint.findByMissionId(missionId);
            }

            const waypoints = missionData.waypoints;
            const completedWaypoints = waypoints.filter(w => w.completed);
            const totalWaypoints = waypoints.length;
            
            if (totalWaypoints === 0) return;

            // Calculate progress based on waypoints
            const waypointProgress = (completedWaypoints.length / totalWaypoints) * 100;
            
            // Update progress if it differs significantly
            if (Math.abs(waypointProgress - mission.progress) > 5) {
                mission.progress = Math.round(waypointProgress);
                mission.currentWaypoint = completedWaypoints.length;
                await mission.save();
                
                this.emit('mission_progress_updated', {
                    missionId,
                    progress: mission.progress,
                    currentWaypoint: mission.currentWaypoint,
                    timestamp: new Date().toISOString()
                });
            }

            // Estimate completion time
            if (completedWaypoints.length > 0 && mission.startedAt) {
                const startTime = new Date(mission.startedAt).getTime();
                const elapsed = Date.now() - startTime;
                const progressRate = mission.progress / elapsed; // progress per millisecond
                
                if (progressRate > 0) {
                    const remainingProgress = 100 - mission.progress;
                    const estimatedRemainingTime = remainingProgress / progressRate;
                    const estimatedCompletion = new Date(Date.now() + estimatedRemainingTime);
                    
                    // Update estimated completion if changed significantly
                    const currentEta = mission.metadata?.estimatedCompletion;
                    if (!currentEta || Math.abs(estimatedCompletion.getTime() - new Date(currentEta).getTime()) > 300000) {
                        mission.metadata = mission.metadata || {};
                        mission.metadata.estimatedCompletion = estimatedCompletion.toISOString();
                        await mission.save();
                    }
                }
            }
        } catch (error) {
            logger.error(`Error estimating completion for mission ${missionId}:`, error);
        }
    }

    async checkMissionTimeouts(missionId, missionData) {
        try {
            const { mission } = missionData;
            const now = Date.now();
            
            // Check for missions that have been active too long without progress
            if (mission.startedAt) {
                const startTime = new Date(mission.startedAt).getTime();
                const maxDuration = 3600000; // 1 hour max for any mission
                
                if (now - startTime > maxDuration && mission.progress < 100) {
                    logger.warn(`Mission ${missionId} has exceeded maximum duration`);
                    
                    // Auto-fail missions that are taking too long
                    if (mission.progress < 50) {
                        mission.status = 'failed';
                        mission.completedAt = new Date().toISOString();
                        mission.metadata = mission.metadata || {};
                        mission.metadata.failureReason = 'Timeout - exceeded maximum duration';
                        await mission.save();
                        
                        await this.removeActiveMission(missionId);
                        
                        this.emit('mission_status_changed', {
                            missionId,
                            oldStatus: 'active',
                            newStatus: 'failed',
                            reason: 'timeout',
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }
        } catch (error) {
            logger.error(`Error checking timeouts for mission ${missionId}:`, error);
        }
    }

    // Event emitter methods
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    logger.error(`Error in event handler for ${event}:`, error);
                }
            });
        }
    }

    // Public methods
    getActiveMissionCount() {
        return this.activeMissions.size;
    }

    getActiveMissionIds() {
        return Array.from(this.activeMissions.keys());
    }

    getActiveMissionsData() {
        const missions = [];
        for (const [id, data] of this.activeMissions) {
            missions.push({
                ...data.mission.toJSON(),
                metadata: data.metadata,
                lastUpdate: data.lastUpdate
            });
        }
        return missions;
    }

    async getMissionStatus(missionId) {
        if (this.activeMissions.has(missionId)) {
            const missionData = this.activeMissions.get(missionId);
            return {
                ...missionData.mission.toJSON(),
                metadata: missionData.metadata,
                lastUpdate: missionData.lastUpdate,
                isActive: true
            };
        } else {
            // Try to load from database
            const mission = await Mission.findById(missionId);
            return mission ? {
                ...mission.toJSON(),
                isActive: false
            } : null;
        }
    }

    setWebSocketServer(wsServer) {
        this.wsServer = wsServer;
        logger.info('WebSocket server attached to Mission Manager');
    }
}

module.exports = MissionManager;