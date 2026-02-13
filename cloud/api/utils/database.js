/**
 * PostgreSQL Database Connection Pool
 */

const { Pool } = require('pg');
const logger = require('./logger');

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Log pool errors
pool.on('error', (err) => {
  logger.error('Unexpected database error', { error: err.message, stack: err.stack });
});

// Log pool connections (debug only)
if (process.env.LOG_LEVEL === 'debug') {
  pool.on('connect', (client) => {
    logger.debug('New database client connected');
  });
  
  pool.on('acquire', (client) => {
    logger.debug('Client acquired from pool');
  });
  
  pool.on('remove', (client) => {
    logger.debug('Client removed from pool');
  });
}

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
const query = async (text, params) => {
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug('Database query executed', {
        query: text.substring(0, 100),
        duration: `${duration}ms`,
        rows: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    logger.error('Database query error', {
      error: error.message,
      query: text.substring(0, 100),
      params
    });
    throw error;
  }
};

/**
 * Get a client from the pool (for transactions)
 * @returns {Promise<Object>} Database client
 */
const getClient = async () => {
  const client = await pool.connect();
  
  // Add transaction helpers
  client.beginTransaction = async () => {
    await client.query('BEGIN');
  };
  
  client.commit = async () => {
    await client.query('COMMIT');
  };
  
  client.rollback = async () => {
    await client.query('ROLLBACK');
  };
  
  return client;
};

/**
 * Close all connections
 */
const end = async () => {
  await pool.end();
  logger.info('Database pool closed');
};

/**
 * Check database connection
 */
const checkConnection = async () => {
  try {
    await pool.query('SELECT NOW()');
    return true;
  } catch (error) {
    logger.error('Database connection check failed', { error: error.message });
    return false;
  }
};

module.exports = {
  query,
  getClient,
  end,
  checkConnection,
  pool
};
