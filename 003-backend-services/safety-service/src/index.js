const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const logger = require('./utils/logger');
const { connectDB } = require('./database/connection');
const { connectRedis } = require('./cache/redis');
const routes = require('./routes');
const { initializeWebSocket } = require('./websocket/server');
const SafetyMonitor = require('./services/safetyMonitor');
const BatteryMonitor = require('./services/batteryMonitor');
const EmergencyProtocol = require('./services/emergencyProtocol');

const app = express();
const PORT = process.env.PORT || 3005;

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'drone-fleet-safety-service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/v1', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Initialize the service
async function initializeService() {
  try {
    logger.info('Starting Safety Service...');

    // Initialize database connection
    await connectDB();
    logger.info('Database connected successfully');

    // Initialize Redis connection
    await connectRedis();
    logger.info('Redis connected successfully');

    // Initialize WebSocket server
    const server = app.listen(PORT, () => {
      logger.info(`Safety Service listening on port ${PORT}`);
    });

    const wsServer = initializeWebSocket(server);
    logger.info(`WebSocket server initialized on port ${PORT}`);

    // Initialize safety monitoring services
    const safetyMonitor = new SafetyMonitor();
    const batteryMonitor = new BatteryMonitor();
    const emergencyProtocol = new EmergencyProtocol();

    // Start monitoring services
    await safetyMonitor.start();
    await batteryMonitor.start();
    await emergencyProtocol.start();

    logger.info('Safety Service initialized successfully');

    // Make services available globally for routes
    app.locals.safetyMonitor = safetyMonitor;
    app.locals.batteryMonitor = batteryMonitor;
    app.locals.emergencyProtocol = emergencyProtocol;

  } catch (error) {
    logger.error('Failed to initialize Safety Service:', error);
    process.exit(1);
  }
}

// Start the service
initializeService();