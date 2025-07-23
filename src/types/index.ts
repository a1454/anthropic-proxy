/**
 * Main type definitions export
 */

export * from './api.js';
export * from './config.js';
export * from './streaming.js';
export * from './logging.js';
export * from './http.js';

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  dependencies: {
    openRouter: 'connected' | 'disconnected' | 'error';
    config: 'loaded' | 'error';
  };
  metrics?: {
    requestCount: number;
    errorRate: number;
    avgResponseTime: number;
  };
}

export interface ValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
  constraint?: string;
}

export interface TransformationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

export interface AsyncOperation<T = unknown> {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: T;
  error?: Error;
  startTime: number;
  endTime?: number;
  progress?: number;
}

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

export interface PerformanceMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connectionsActive: number;
  };
  requests: {
    total: number;
    perSecond: number;
    errors: number;
    avgDuration: number;
  };
}