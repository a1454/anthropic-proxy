/**
 * Logging utilities for the Anthropic proxy server
 */

import fs from 'fs';
import path from 'path';
import { config } from '../config/config.js';

let logStream = null;

/**
 * Initialize the logger with a timestamped log file
 */
export function initializeLogger() {
  // Create log directory if it doesn't exist
  if (!fs.existsSync(config.logDir)) {
    fs.mkdirSync(config.logDir, { recursive: true });
  }

  // Create timestamped log file
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const logFile = path.join(config.logDir, `requests-${timestamp}.log`);
  logStream = fs.createWriteStream(logFile, { flags: 'a' });
}

/**
 * Log request/response data to file
 * @param {Object} data - The data to log
 */
export function logRequest(data) {
  if (!logStream) {
    initializeLogger();
  }
  
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    ...data
  };
  logStream.write(JSON.stringify(logEntry, null, 2) + '\n\n');
}

/**
 * Debug logging function
 * @param {...any} args - Arguments to log
 */
export function debug(...args) {
  if (!config.enableDebug) return;
  console.log(...args);
}

/**
 * Close the log stream (for cleanup)
 */
export function closeLogger() {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}