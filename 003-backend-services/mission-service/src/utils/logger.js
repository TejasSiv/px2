const winston = require('winston');

// Configure winston logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { 
        service: 'mission-service',
        version: process.env.npm_package_version || '1.0.0'
    },
    transports: [
        // Write all logs with level 'error' and below to 'error.log'
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        }),
        // Write all logs with level 'info' and below to 'combined.log'
        new winston.transports.File({ 
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            tailable: true
        })
    ],
    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.File({ filename: 'logs/exceptions.log' })
    ],
    // Handle unhandled rejections
    rejectionHandlers: [
        new winston.transports.File({ filename: 'logs/rejections.log' })
    ]
});

// If we're not in production, log to the console with simple format
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({
                format: 'HH:mm:ss'
            }),
            winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
                let msg = `[${timestamp}] ${level}: ${message}`;
                
                // Add service name in development
                if (service) {
                    msg = `[${service}] ${msg}`;
                }
                
                // Add metadata if present
                const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
                return metaStr ? `${msg} ${metaStr}` : msg;
            })
        )
    }));
}

// Create logs directory if it doesn't exist
const fs = require('fs');
const path = require('path');
const logsDir = path.join(__dirname, '../../logs');

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Add mission-specific logging methods
logger.logMissionEvent = (missionId, event, details = {}) => {
    logger.info(`Mission Event: ${event}`, {
        missionId,
        event,
        ...details,
        category: 'mission'
    });
};

logger.logMissionError = (missionId, error, details = {}) => {
    logger.error(`Mission Error`, {
        missionId,
        error: error.message || error,
        stack: error.stack,
        ...details,
        category: 'mission'
    });
};

logger.logValidationError = (type, data, errors) => {
    logger.warn(`Validation Error: ${type}`, {
        type,
        data,
        errors,
        category: 'validation'
    });
};

module.exports = logger;