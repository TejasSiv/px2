const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'drone_fleet_db',
  user: process.env.DB_USER || 'fleet_user',
  password: process.env.DB_PASSWORD || '',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

const connectDB = async () => {
  try {
    pool = new Pool(dbConfig);
    
    // Test the connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    logger.info('Database connection established successfully');
    
    // Handle pool errors
    pool.on('error', (err) => {
      logger.error('Database pool error:', err);
    });
    
    return pool;
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
};

const getPool = () => {
  if (!pool) {
    throw new Error('Database not initialized. Call connectDB() first.');
  }
  return pool;
};

const query = async (text, params) => {
  if (!pool) {
    throw new Error('Database not initialized. Call connectDB() first.');
  }
  
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      logger.warn('Slow query detected', { 
        query: text, 
        duration: `${duration}ms`,
        rows: result.rowCount 
      });
    }
    
    return result;
  } catch (error) {
    logger.error('Database query error:', {
      error: error.message,
      query: text,
      params: params
    });
    throw error;
  }
};

const closeDB = async () => {
  if (pool) {
    await pool.end();
    logger.info('Database connection closed');
  }
};

module.exports = {
  connectDB,
  getPool,
  query,
  closeDB
};