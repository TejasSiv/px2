const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const logger = require('./utils/logger');
const { initDatabase } = require('./database/connection');
const { initRedis } = require('./cache/redis');
const MissionManager = require('./services/missionManager');
const WebSocketServer = require('./websocket/server');
const routes = require('./routes');

class MissionService {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3001;
        this.server = null;
        this.missionManager = null;
        this.wsServer = null;
    }

    async initialize() {
        try {
            // Setup middleware
            this.setupMiddleware();

            // Initialize database connection
            await initDatabase();
            logger.info('Database connection established');

            // Initialize Redis connection
            await initRedis();
            logger.info('Redis connection established');

            // Initialize mission manager
            this.missionManager = new MissionManager();
            await this.missionManager.initialize();
            logger.info('Mission manager initialized');

            // Setup routes
            this.setupRoutes();

            // Start HTTP server
            this.server = this.app.listen(this.port, () => {
                logger.info(`Mission service listening on port ${this.port}`);
            });

            // Initialize WebSocket server for real-time mission updates
            this.wsServer = new WebSocketServer(this.server, this.missionManager);
            await this.wsServer.initialize();
            logger.info('WebSocket server initialized');

            // Start mission monitoring and processing
            await this.missionManager.start();
            logger.info('Mission monitoring started');

            // Setup graceful shutdown
            this.setupGracefulShutdown();

        } catch (error) {
            logger.error('Failed to initialize mission service:', error);
            process.exit(1);
        }
    }

    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging
        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next();
        });

        // Add mission manager to request context
        this.app.use((req, res, next) => {
            req.missionManager = this.missionManager;
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'mission-service',
                version: process.env.npm_package_version || '1.0.0',
                activeMissions: this.missionManager ? this.missionManager.getActiveMissionCount() : 0
            });
        });

        // Service info
        this.app.get('/info', (req, res) => {
            res.json({
                service: 'mission-service',
                version: process.env.npm_package_version || '1.0.0',
                description: 'Mission management service for drone fleet',
                endpoints: {
                    missions: '/api/missions',
                    waypoints: '/api/waypoints',
                    validation: '/api/validate',
                    status: '/api/status'
                },
                capabilities: [
                    'Mission CRUD operations',
                    'Waypoint management',
                    'Mission validation',
                    'Real-time status updates',
                    'Assignment management'
                ]
            });
        });

        // API routes
        this.app.use('/api', routes);

        // Error handling
        this.app.use((err, req, res, next) => {
            logger.error('Unhandled error:', err);
            res.status(500).json({
                error: 'Internal server error',
                timestamp: new Date().toISOString(),
                requestId: req.id || 'unknown'
            });
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                path: req.originalUrl,
                timestamp: new Date().toISOString(),
                availableEndpoints: ['/health', '/info', '/api/missions', '/api/waypoints']
            });
        });
    }

    setupGracefulShutdown() {
        const gracefulShutdown = async (signal) => {
            logger.info(`Received ${signal}, shutting down gracefully...`);

            try {
                // Stop mission manager
                if (this.missionManager) {
                    await this.missionManager.stop();
                }

                // Close WebSocket server
                if (this.wsServer) {
                    await this.wsServer.close();
                }

                // Close HTTP server
                if (this.server) {
                    this.server.close(() => {
                        logger.info('HTTP server closed');
                    });
                }

                // Close database connections will be handled by respective modules

                logger.info('Graceful shutdown completed');
                process.exit(0);
            } catch (error) {
                logger.error('Error during graceful shutdown:', error);
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception:', error);
            gracefulShutdown('UNCAUGHT_EXCEPTION');
        });
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled rejection at:', promise, 'reason:', reason);
            gracefulShutdown('UNHANDLED_REJECTION');
        });
    }
}

// Start the service
const service = new MissionService();
service.initialize().catch((error) => {
    logger.error('Failed to start mission service:', error);
    process.exit(1);
});

module.exports = MissionService;