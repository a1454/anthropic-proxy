/**
 * Debug logging utilities for the Anthropic proxy server
 */

import { config } from '../config/config.js';
import type { LogEntry, GlobalLoggerOptions } from '../types/index.js';

/**
 * Debug logging function
 */
export function debug(...args: unknown[]): void {
  if (!config.debug) return;
  console.log('[DEBUG]', new Date().toISOString(), ...args);
}

/**
 * Info logging function
 */
export function info(...args: unknown[]): void {
  console.log('[INFO]', new Date().toISOString(), ...args);
}

/**
 * Warning logging function
 */
export function warn(...args: unknown[]): void {
  console.warn('[WARN]', new Date().toISOString(), ...args);
}

/**
 * Error logging function
 */
export function error(...args: unknown[]): void {
  console.error('[ERROR]', new Date().toISOString(), ...args);
}

/**
 * Global logger class for application-wide logging
 */
export class GlobalLogger {
  private options: GlobalLoggerOptions;

  constructor(options: GlobalLoggerOptions) {
    this.options = options;
  }

  log(entry: LogEntry): void {
    const formattedEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString()
    };

    // Filter by log level
    if (!this.shouldLog(entry.level)) {
      return;
    }

    if (this.options.enableConsole) {
      this.logToConsole(formattedEntry);
    }

    // File logging would be implemented here if needed
  }

  debug(message: string, data?: unknown): void {
    this.log({
      level: 'debug',
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  info(message: string, data?: unknown): void {
    this.log({
      level: 'info',
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  warn(message: string, data?: unknown): void {
    this.log({
      level: 'warn',
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  error(message: string, error?: Error, data?: unknown): void {
    const logEntry: any = {
      level: 'error',
      message,
      data,
      timestamp: new Date().toISOString()
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

  private shouldLog(level: LogEntry['level']): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.options.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private logToConsole(entry: LogEntry): void {
    const prefix = `[${entry.level.toUpperCase()}] ${entry.timestamp}`;
    
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

// Default global logger instance
let globalLogger: GlobalLogger | null = null;

export function createGlobalLogger(options: GlobalLoggerOptions): GlobalLogger {
  globalLogger = new GlobalLogger(options);
  return globalLogger;
}

export function getGlobalLogger(): GlobalLogger | null {
  return globalLogger;
}