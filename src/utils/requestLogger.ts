/**
 * Per-request logging utilities - each request gets its own log file
 */

import fs from 'fs';
import path from 'path';
import { config } from '../config/config.js';
import type { 
  LogEntry, 
  RequestLogEntry, 
  ErrorContext, 
  IRequestLogger, 
  LoggerOptions 
} from '../types/index.js';

// Global sequence counter that resets every second
let currentSecond = '';
let sequenceCounter = 0;

/**
 * Generate unique request ID with format: req-YYYYMMDD-HHMMSS-SEQ
 */
export function generateRequestId(): string {
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
export class RequestLogger implements IRequestLogger {
  private readonly requestId: string;
  private readonly logFile: string;
  private readonly stream: fs.WriteStream;
  private isClosed: boolean = false;
  private readonly enableConsole: boolean;

  constructor(requestId: string, options?: Partial<LoggerOptions>) {
    this.requestId = requestId;
    this.enableConsole = options?.enableConsole ?? true;
    this.logFile = this.createLogFile(requestId, options?.baseDirectory);
    this.stream = fs.createWriteStream(this.logFile, { flags: 'a' });
  }

  /**
   * Create log file path and ensure directory exists
   */
  private createLogFile(requestId: string, baseDirectory?: string): string {
    // Extract date from request ID for directory organization
    const dateMatch = requestId.match(/req-(\d{8})/);
    const dateStr = dateMatch?.[1] ?? new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    // Format: YYYY-MM-DD
    const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    
    // Create directory structure: log/requests/YYYY-MM-DD/
    const logDir = path.join(
      baseDirectory || config.logging.directory, 
      'requests', 
      formattedDate
    );
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    return path.join(logDir, `${requestId}.log`);
  }

  /**
   * Log data to the request-specific file
   */
  log(entry: LogEntry | RequestLogEntry): void {
    if (this.isClosed) {
      console.warn(`Attempted to log to closed logger for request ${this.requestId}`);
      return;
    }
    
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      ...entry,
      timestamp,
      requestId: this.requestId,
      level: entry.level || 'info',
      message: entry.message
    };
    
    // Write to file
    this.stream.write(JSON.stringify(logEntry, null, 2) + '\n\n');
    
    // Also log to console if enabled
    if (this.enableConsole) {
      this.logToConsole(logEntry);
    }
  }

  /**
   * Log error with context
   */
  error(message: string, error?: Error, context?: ErrorContext): void {
    const logEntry: any = {
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      data: context
    };
    
    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    
    this.log(logEntry);
  }

  /**
   * Log warning
   */
  warn(message: string, data?: unknown): void {
    this.log({
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      data
    });
  }

  /**
   * Log info
   */
  info(message: string, data?: unknown): void {
    this.log({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      data
    });
  }

  /**
   * Log debug
   */
  debug(message: string, data?: unknown): void {
    this.log({
      level: 'debug',
      message,
      timestamp: new Date().toISOString(),
      data
    });
  }

  /**
   * Close the log stream
   */
  async close(): Promise<void> {
    if (!this.isClosed && this.stream) {
      return new Promise((resolve) => {
        this.stream.end(() => {
          this.isClosed = true;
          resolve();
        });
      });
    }
  }

  /**
   * Get the log file path
   */
  getLogFile(): string {
    return this.logFile;
  }

  /**
   * Get the request ID
   */
  getRequestId(): string {
    return this.requestId;
  }

  /**
   * Log to console with formatting
   */
  private logToConsole(entry: LogEntry): void {
    const prefix = `[${entry.level.toUpperCase()}] ${entry.timestamp} [${this.requestId}]`;
    
    switch (entry.level) {
      case 'debug':
        console.log(prefix, entry.message, entry.data || '');
        break;
      case 'info':
        console.log(prefix, entry.message, entry.data || '');
        break;
      case 'warn':
        console.warn(prefix, entry.message, entry.data || '');
        break;
      case 'error':
        console.error(prefix, entry.message, entry.error || '', entry.data || '');
        break;
    }
  }
}

/**
 * Cleanup old log files (optional utility)
 */
export function cleanupOldLogs(daysToKeep = 30): void {
  const requestsDir = path.join(config.logging.directory, 'requests');
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

/**
 * Create a request logger instance
 */
export function createRequestLogger(
  requestId?: string, 
  options?: Partial<LoggerOptions>
): RequestLogger {
  const id = requestId || generateRequestId();
  return new RequestLogger(id, options);
}