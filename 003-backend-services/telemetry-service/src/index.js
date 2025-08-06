const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const logger = require('./utils/logger');
const { initDatabase } = require('./database/connection');
const { initRedis } = require('./cache/redis');
const TelemetryProcessor = require('./services/telemetryProcessor');
const WebSocketServer = require('./websocket/server');
const routes = require('./routes');

class TelemetryService {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.server = null;
        this.telemetryProcessor = null;
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

            // Initialize telemetry processor
            this.telemetryProcessor = new TelemetryProcessor();
            await this.telemetryProcessor.initialize();
            logger.info('Telemetry processor initialized');

            // Setup routes
            this.setupRoutes();

            // Start HTTP server
            this.server = this.app.listen(this.port, () => {
                logger.info(`Telemetry service listening on port ${this.port}`);
            });

            // Initialize WebSocket server
            this.wsServer = new WebSocketServer(this.server);
            await this.wsServer.initialize();
            logger.info('WebSocket server initialized');

            // Start telemetry processing
            await this.telemetryProcessor.start();
            logger.info('Telemetry processing started');

            // Setup graceful shutdown
            this.setupGracefulShutdown();

        } catch (error) {
            logger.error('Failed to initialize telemetry service:', error);
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
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: 'telemetry-service',
                version: process.env.npm_package_version || '1.0.0'
            });
        });

        // API routes
        this.app.use('/api', routes);

        // Error handling
        this.app.use((err, req, res, next) => {
            logger.error('Unhandled error:', err);
            res.status(500).json({
                error: 'Internal server error',
                timestamp: new Date().toISOString()
            });
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                path: req.originalUrl,
                timestamp: new Date().toISOString()
            });
        });
    }

    setupGracefulShutdown() {
        const gracefulShutdown = async (signal) => {
            logger.info(`Received ${signal}, shutting down gracefully...`);

            try {
                // Stop telemetry processor
                if (this.telemetryProcessor) {
                    await this.telemetryProcessor.stop();
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

                // Close database connections
                // Database and Redis cleanup will be handled by their respective modules

                logger.info('Graceful shutdown completed');
                process.exit(0);
            } catch (error) {
                logger.error('Error during graceful shutdown:', error);
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }
}

// Start the service
const service = new TelemetryService();
service.initialize().catch((error) => {
    logger.error('Failed to start telemetry service:', error);
    process.exit(1);
});

module.exports = TelemetryService;