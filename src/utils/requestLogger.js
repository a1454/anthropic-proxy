/**
 * Per-request logging utilities - each request gets its own log file
 */

import fs from 'fs';
import path from 'path';
import { config } from '../config/config.js';

// Global sequence counter that resets every second
let currentSecond = '';
let sequenceCounter = 0;

/**
 * Generate unique request ID with format: req-YYYYMMDD-HHMMSS-SEQ
 * @returns {string} - Unique request ID
 */
export function generateRequestId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '');
  const currentTimeToSecond = `${dateStr}-${timeStr}`;
  
  // Reset sequence counter if we've moved to a new second
  if (currentTimeToSecond !== currentSecond) {
    currentSecond = currentTimeToSecond;
    sequenceCounter = 0;
  }
  
  sequenceCounter++;
  const sequence = sequenceCounter.toString().padStart(3, '0');
  
  return `req-${currentTimeToSecond}-${sequence}`;
}

/**
 * RequestLogger class for per-request logging
 */
export class RequestLogger {
  constructor(requestId) {
    this.requestId = requestId;
    this.logFile = this.createLogFile(requestId);
    this.stream = fs.createWriteStream(this.logFile, { flags: 'a' });
    this.isClosed = false;
  }

  /**
   * Create log file path and ensure directory exists
   * @param {string} requestId - The request ID
   * @returns {string} - Full path to log file
   */
  createLogFile(requestId) {
    // Extract date from request ID for directory organization
    const dateMatch = requestId.match(/req-(\d{8})/);
    const dateStr = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    // Format: YYYY-MM-DD
    const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    
    // Create directory structure: log/requests/YYYY-MM-DD/
    const logDir = path.join(config.logging.logDir, 'requests', formattedDate);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    return path.join(logDir, `${requestId}.log`);
  }

  /**
   * Log data to the request-specific file
   * @param {Object} data - The data to log
   */
  log(data) {
    if (this.isClosed) {
      console.warn(`Attempted to log to closed logger for request ${this.requestId}`);
      return;
    }
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      request_id: this.requestId,
      timestamp,
      ...data
    };
    
    this.stream.write(JSON.stringify(logEntry, null, 2) + '\n\n');
  }

  /**
   * Close the log stream
   */
  close() {
    if (!this.isClosed && this.stream) {
      this.stream.end();
      this.isClosed = true;
    }
  }

  /**
   * Get the log file path
   * @returns {string} - Path to the log file
   */
  getLogFile() {
    return this.logFile;
  }
}

/**
 * Cleanup old log files (optional utility)
 * @param {number} daysToKeep - Number of days to keep logs
 */
export function cleanupOldLogs(daysToKeep = 30) {
  const requestsDir = path.join(config.logging.logDir, 'requests');
  if (!fs.existsSync(requestsDir)) return;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  const dirs = fs.readdirSync(requestsDir);
  
  dirs.forEach(dir => {
    const dirPath = path.join(requestsDir, dir);
    const dirDate = new Date(dir);
    
    if (dirDate < cutoffDate) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`Cleaned up old logs from ${dir}`);
    }
  });
}