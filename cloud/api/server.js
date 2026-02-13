/**
 * xSPECTRE Ops Console - API Server
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');
const db = require('./utils/database');

// Import routes
const enrollRoutes = require('./routes/enroll');
const deviceRoutes = require('./routes/devices');
const heartbeatRoutes = require('./routes/heartbeat');
const commandRoutes = require('./routes/commands');
const alertRoutes = require('./routes/alerts');
const backupRoutes = require('./routes/backups');
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');

// Import background jobs
const alertEvaluator = require('./jobs/alert-evaluator');
const backupScheduler = require('./jobs/backup-scheduler');
const deviceMonitor = require('./jobs/device-monitor');

// Initialize Express
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// WebSocket for real-time updates
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  logger.info('WebSocket client connected', { ip: req.socket.remoteAddress });
  
  ws.on('message', (message) => {
    logger.debug('WebSocket message received', { message: message.toString() });
  });

  ws.on('close', () => {
    logger.info('WebSocket client disconnected');
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error', { error: error.message });
  });
});

// Broadcast function for real-time updates
global.broadcastUpdate = (type, data) => {
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });
  
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await db.query('SELECT 1');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: require('./package.json').version
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/enroll', enrollRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/heartbeat', heartbeatRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/users', userRoutes);

// Static files (for bootstrap script, agent download, etc.)
app.use('/downloads', express.static('public'));

// Serve static frontend files
const frontendPath = path.join(__dirname, '../web/dist');
const indexPath = path.join(frontendPath, 'index.html');
app.use(express.static(frontendPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  // Skip API routes and health endpoint
  if (req.path.startsWith('/api') || req.path === '/health' || req.path === '/ws' || req.path === '/downloads') {
    return next();
  }
  
  // Serve index.html for frontend routes
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // If frontend not built, show API info
    res.json({
      name: 'xSPECTRE Ops Console API',
      version: '1.0.0',
      status: 'online',
      message: 'Frontend not built. Run: cd /opt/xspectre/cloud/web && npm install && npm run build',
      endpoints: {
        health: '/health',
        enroll: '/api/enroll',
        devices: '/api/devices',
        heartbeat: '/api/heartbeat/:device_id',
        commands: '/api/commands',
        alerts: '/api/alerts',
        backups: '/api/backups',
        users: '/api/users',
        auth: '/api/auth',
        websocket: '/ws'
      }
    });
  }
});

// 404 handler for API routes only
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path
  });

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');
  
  wss.clients.forEach((client) => {
    client.close();
  });
  
  server.close(() => {
    logger.info('HTTP server closed');
    db.end().then(() => {
      logger.info('Database connections closed');
      process.exit(0);
    });
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
server.listen(PORT, () => {
  logger.info(`xSPECTRE Ops API listening on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
  
  // Start background jobs
  alertEvaluator.start();
  backupScheduler.start();
  deviceMonitor.start();
});

module.exports = { app, server, wss };
