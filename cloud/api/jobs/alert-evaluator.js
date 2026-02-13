const logger = require('../utils/logger');

// Placeholder: Alert Evaluator Job
// Periodically evaluates alert rules against device metrics

let isRunning = false;
let intervalId = null;

async function start() {
  if (isRunning) {
    logger.warn('Alert evaluator already running');
    return;
  }

  logger.info('Starting alert evaluator job');
  isRunning = true;

  // Run every 60 seconds
  intervalId = setInterval(async () => {
    try {
      // TODO: Implement alert evaluation logic
      logger.debug('Alert evaluator tick');
    } catch (error) {
      logger.error('Alert evaluator error:', error);
    }
  }, 60000);
}

async function stop() {
  if (!isRunning) {
    return;
  }

  logger.info('Stopping alert evaluator job');
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isRunning = false;
}

module.exports = { start, stop };
