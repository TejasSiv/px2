const winston = require('winston');

// Create logger instance
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
        service: 'telemetry-service',
        environment: process.env.NODE_ENV || 'development'
    },
    transports: [
        // Write to console
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple(),
                winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
                    let log = `${timestamp} [${service}] ${level}: ${message}`;
                    
                    // Add metadata if present
                    const metaStr = Object.keys(meta).length > 0 ? 
                        JSON.stringify(meta, null, 2) : '';
                    
                    return metaStr ? `${log} ${metaStr}` : log;
                })
            )
        })
    ]
});

// Add file logging in production
if (process.env.NODE_ENV === 'production') {
    logger.add(new winston.transports.File({
        filename: '/var/log/telemetry-service/error.log',
        level: 'error',
        maxsize: 50 * 1024 * 1024, // 50MB
        maxFiles: 5,
        tailable: true
    }));

    logger.add(new winston.transports.File({
        filename: '/var/log/telemetry-service/combined.log',
        maxsize: 100 * 1024 * 1024, // 100MB
        maxFiles: 10,
        tailable: true
    }));
}

// Handle uncaught exceptions
logger.exceptions.handle(
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    })
);

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = logger;