const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.colorize(),
  winston.format.printf(info => {
    const { timestamp, level, message, ...extra } = info;
    return `${timestamp} [${level}]: ${message} ${Object.keys(extra).length ? JSON.stringify(extra, null, 2) : ''}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'safety-service'
  },
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'safety-service.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: logFormat
    }),
    
    // File transport for error logs only
    new winston.transports.File({
      filename: path.join(logsDir, 'safety-errors.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
      format: logFormat
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Safety-specific logging methods
logger.safety = (message, data = {}) => {
  logger.info(message, { category: 'safety', ...data });
};

logger.battery = (message, data = {}) => {
  logger.info(message, { category: 'battery', ...data });
};

logger.emergency = (message, data = {}) => {
  logger.warn(message, { category: 'emergency', ...data });
};

logger.alert = (severity, message, data = {}) => {
  const logLevel = severity === 'critical' ? 'error' : 
                   severity === 'warning' ? 'warn' : 'info';
  logger[logLevel](message, { category: 'alert', severity, ...data });
};

module.exports = logger;