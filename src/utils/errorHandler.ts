/**
 * Structured error handling utilities
 */

import type { FastifyReply } from 'fastify';
import type { 
  ErrorTypes,
  ErrorContext, 
  ProxyErrorOptions, 
  IRequestLogger 
} from '../types/index.js';

// Re-export types for convenience
export type { ErrorTypes } from '../types/index.js';


/**
 * Custom error class for proxy-specific errors
 */
export class ProxyError extends Error {
  public readonly type: ErrorTypes;
  public readonly statusCode: number;
  public readonly originalError: Error | null;
  public readonly timestamp: string;
  public readonly recoverable: boolean;
  public context: ErrorContext;

  constructor(options: ProxyErrorOptions) {
    super(options.message);
    this.name = 'ProxyError';
    this.type = options.type;
    this.statusCode = options.statusCode ?? 500;
    this.originalError = options.cause ?? null;
    this.timestamp = new Date().toISOString();
    this.recoverable = options.recoverable ?? false;
    this.context = options.context ?? {
      timestamp: Date.now()
    };
  }

  /**
   * Add additional context to the error
   * @param context - Additional context data
   * @returns Returns this for chaining
   */
  withContext(context: Partial<ErrorContext>): ProxyError {
    this.context = { ...this.context, ...context };
    return this;
  }

  /**
   * Create a ProxyError from a generic Error
   */
  static fromError(
    error: Error, 
    type: ErrorTypes = 'INTERNAL_ERROR',
    statusCode = 500
  ): ProxyError {
    return new ProxyError({
      type,
      message: error.message,
      statusCode,
      cause: error
    });
  }
}

/**
 * Handle OpenRouter API errors
 */
export async function handleOpenRouterError(
  response: Response, 
  logger?: IRequestLogger
): Promise<ProxyError> {
  const errorDetails = await response.text();
  
  const error = new ProxyError({
    type: 'API_ERROR',
    message: `OpenRouter API error: ${errorDetails}`,
    statusCode: response.status,
    context: {
      timestamp: Date.now(),
      operation: 'openrouter_api_call',
      metadata: {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorDetails
      }
    }
  });

  if (logger) {
    logger.error('OpenRouter API error', error, error.context);
  }

  return error;
}

/**
 * Handle validation errors
 */
export function handleValidationError(
  message: string, 
  field?: string
): ProxyError {
  return new ProxyError({
    type: 'VALIDATION_ERROR',
    message,
    statusCode: 400,
    context: {
      timestamp: Date.now(),
      operation: 'validation',
      metadata: field ? { field } : {}
    }
  });
}

/**
 * Handle transformation errors
 */
export function handleTransformationError(
  error: Error, 
  context: string
): ProxyError {
  return new ProxyError({
    type: 'TRANSFORMATION_ERROR',
    message: `Transformation error in ${context}: ${error.message}`,
    statusCode: 500,
    cause: error,
    context: {
      timestamp: Date.now(),
      operation: 'transformation',
      metadata: { context }
    }
  });
}

/**
 * Handle streaming errors
 */
export function handleStreamingError(
  error: Error, 
  state?: string
): ProxyError {
  return new ProxyError({
    type: 'STREAMING_ERROR',
    message: `Streaming error: ${error.message}`,
    statusCode: 500,
    cause: error,
    context: {
      timestamp: Date.now(),
      operation: 'streaming',
      state: state || 'unknown',
      metadata: { state: state || 'unknown' }
    }
  });
}

/**
 * Handle configuration errors
 */
export function handleConfigurationError(
  message: string, 
  field?: string
): ProxyError {
  return new ProxyError({
    type: 'CONFIGURATION_ERROR',
    message,
    statusCode: 500,
    context: {
      timestamp: Date.now(),
      operation: 'configuration',
      metadata: field ? { field } : {}
    }
  });
}

/**
 * Format error response for client
 */
export function formatErrorResponse(error: ProxyError): Record<string, unknown> {
  const response: Record<string, unknown> = {
    error: {
      type: error.type,
      message: error.message,
      timestamp: error.timestamp
    }
  };

  // Include additional details for development
  if (process.env.NODE_ENV === 'development' && error.originalError) {
    (response.error as Record<string, unknown>).stack = error.originalError.stack;
    (response.error as Record<string, unknown>).context = error.context;
  }

  return response;
}

/**
 * Global error handler for Fastify routes
 */
export function handleRouteError(
  error: Error, 
  reply: FastifyReply, 
  logger?: IRequestLogger
): Record<string, unknown> | void {
  let proxyError: ProxyError;

  if (error instanceof ProxyError) {
    proxyError = error;
  } else {
    // Convert generic errors to ProxyError
    proxyError = ProxyError.fromError(error);
  }

  // Log the comprehensive error
  if (logger) {
    logger.error('Route error', proxyError, proxyError.context);
  } else {
    console.error('Route error:', proxyError);
  }

  // Handle streaming errors differently - don't set response if headers already sent
  if ((reply.raw as any).headersSent) {
    console.error('Headers already sent, cannot set error response');
    return;
  }

  reply.code(proxyError.statusCode);
  return formatErrorResponse(proxyError);
}