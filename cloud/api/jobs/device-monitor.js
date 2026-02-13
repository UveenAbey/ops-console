const logger = require('../utils/logger');

// Placeholder: Device Monitor Job
// Monitors device health and marks devices as offline if no heartbeat received

let isRunning = false;
let intervalId = null;

async function start() {
  if (isRunning) {
    logger.warn('Device monitor already running');
    return;
  }

  logger.info('Starting device monitor job');
  isRunning = true;

  // Run every 2 minutes
  intervalId = setInterval(async () => {
    try {
      // TODO: Implement device monitoring logic
      logger.debug('Device monitor tick');
    } catch (error) {
      logger.error('Device monitor error:', error);
    }
  }, 120000);
}

async function stop() {
  if (!isRunning) {
    return;
  }

  logger.info('Stopping device monitor job');
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isRunning = false;
}

module.exports = { start, stop };
