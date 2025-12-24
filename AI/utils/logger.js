/**
 * AI Logger Utility
 * Logging cho các module AI
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

class AILogger {
  constructor() {
    this.logLevel = config.logging.level;
    this.logToFile = config.logging.logToFile;
    
    if (this.logToFile) {
      this.ensureLogDirectory();
    }
  }

  ensureLogDirectory() {
    const logDir = path.join(__dirname, '../../AI/logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  formatMessage(level, module, message, data = null) {
    // Use VN local time for AI logs to match site timezone
    let timestamp;
    try {
      const vnTime = require('../../backend/utils/vnTime');
      timestamp = vnTime.toVnIso();
    } catch (e) {
      // Fallback: create VN-local ISO by adding +07:00 to UTC
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const vn = new Date(utc + 7 * 60 * 60000);
      timestamp = vn.toISOString().replace('Z', '+07:00');
    }
    const dataStr = data ? `\n${JSON.stringify(data, null, 2)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}${dataStr}`;
  }

  writeToFile(level, module, message, data) {
    if (!this.logToFile) return;

    try {
      const logFile = path.join(__dirname, '../logs', `ai-${level}.log`);
      const formattedMessage = this.formatMessage(level, module, message, data);
      fs.appendFileSync(logFile, formattedMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  log(level, module, message, data = null) {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    if (messageLevelIndex >= currentLevelIndex) {
      const formattedMessage = this.formatMessage(level, module, message, data);
      // Allow suppressing info/debug messages from console output via env var
      // Useful to keep terminal quiet while still writing logs to files.
      const suppressInfo = process.env.AI_SUPPRESS_INFO === 'true';
      if (!(suppressInfo && (level === 'info' || level === 'debug'))) {
        console.log(formattedMessage);
      }
      // Always write to file if enabled so logs are preserved
      this.writeToFile(level, module, message, data);
    }
  }

  debug(module, message, data) {
    this.log('debug', module, message, data);
  }

  info(module, message, data) {
    this.log('info', module, message, data);
  }

  warn(module, message, data) {
    this.log('warn', module, message, data);
  }

  error(module, message, data) {
    this.log('error', module, message, data);
  }
}

module.exports = new AILogger();
