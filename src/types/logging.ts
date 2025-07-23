/**
 * Logging and error handling type definitions
 */

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  requestId?: string;
  type?: string;
  data?: unknown;
  error?: ErrorDetails;
  duration?: number;
}

export interface ErrorDetails {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  status?: number;
  context?: Record<string, unknown>;
}

export interface RequestLogEntry extends LogEntry {
  requestId: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
  response?: {
    status: number;
    headers: Record<string, string>;
    body?: unknown;
  };
}

export interface ErrorContext {
  requestId?: string;
  model?: string;
  thinking?: boolean;
  timestamp: number;
  operation?: string;
  state?: string;
  metadata?: Record<string, unknown>;
}

export type ErrorTypes = 
  | 'CONFIGURATION_ERROR'
  | 'VALIDATION_ERROR' 
  | 'TRANSFORMATION_ERROR'
  | 'API_ERROR'
  | 'NETWORK_ERROR'
  | 'STREAMING_ERROR'
  | 'TIMEOUT_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'INTERNAL_ERROR';

export interface ProxyErrorOptions {
  type: ErrorTypes;
  message: string;
  statusCode?: number;
  context?: ErrorContext;
  cause?: Error;
  recoverable?: boolean;
}

export interface IRequestLogger {
  log(entry: LogEntry | RequestLogEntry): void;
  error(message: string, error?: Error, context?: ErrorContext): void;
  warn(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  debug(message: string, data?: unknown): void;
  close(): Promise<void>;
}

export interface LoggerOptions {
  requestId: string;
  baseDirectory?: string;
  enableConsole?: boolean;
  level?: 'debug' | 'info' | 'warn' | 'error';
}

export interface GlobalLoggerOptions {
  level: 'debug' | 'info' | 'warn' | 'error';
  directory: string;
  maxFiles?: number;
  maxSize?: string;
  enableConsole?: boolean;
}

export interface LogRotationOptions {
  maxFiles: number;
  maxSize: string;
  datePattern?: string;
  zippedArchive?: boolean;
}