const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool;

const initDatabase = async () => {
    try {
        const config = {
            user: process.env.DB_USER || 'postgres',
            host: process.env.DB_HOST || 'localhost',
            database: process.env.DB_NAME || 'drone_fleet_management',
            password: process.env.DB_PASSWORD || 'postgres',
            port: process.env.DB_PORT || 5432,
            // Connection pool settings
            max: 20, // Maximum number of clients in pool
            idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
            connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection could not be established
            maxUses: 7500, // Close a connection after it has been used this many times
        };

        pool = new Pool(config);

        // Test the connection
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();

        logger.info('Database connection established successfully', {
            database: config.database,
            host: config.host,
            port: config.port,
            timestamp: result.rows[0].now
        });

        // Handle pool errors
        pool.on('error', (err) => {
            logger.error('Database pool error:', err);
        });

        // Handle client errors
        pool.on('connect', (client) => {
            client.on('error', (err) => {
                logger.error('Database client error:', err);
            });
        });

        return pool;
    } catch (error) {
        logger.error('Failed to initialize database connection:', error);
        throw error;
    }
};

const getPool = () => {
    if (!pool) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return pool;
};

const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        
        // Log slow queries (>100ms)
        if (duration > 100) {
            logger.warn('Slow query detected', {
                query: text,
                duration: `${duration}ms`,
                rowCount: res.rowCount
            });
        }
        
        return res;
    } catch (error) {
        logger.error('Database query error:', {
            query: text,
            params,
            error: error.message
        });
        throw error;
    }
};

const getClient = async () => {
    return await pool.connect();
};

const closeDatabase = async () => {
    if (pool) {
        await pool.end();
        logger.info('Database connection pool closed');
    }
};

// Transaction helper
const withTransaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    initDatabase,
    getPool,
    query,
    getClient,
    closeDatabase,
    withTransaction
};