/**
 * Structured error handling utilities
 */

import { logRequest } from './logger.js';

/**
 * Error types for structured error handling
 */
export const ErrorTypes = {
  VALIDATION_ERROR: 'validation_error',
  EXTERNAL_API_ERROR: 'external_api_error',
  TRANSFORMATION_ERROR: 'transformation_error',
  STREAMING_ERROR: 'streaming_error',
  INTERNAL_ERROR: 'internal_error'
};

/**
 * Custom error class for proxy-specific errors
 */
export class ProxyError extends Error {
  constructor(message, type = ErrorTypes.INTERNAL_ERROR, statusCode = 500, originalError = null) {
    super(message);
    this.name = 'ProxyError';
    this.type = type;
    this.statusCode = statusCode;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
    this.context = {};
  }

  /**
   * Add additional context to the error
   * @param {Object} context - Additional context data
   * @returns {ProxyError} - Returns this for chaining
   */
  withContext(context) {
    this.context = { ...this.context, ...context };
    return this;
  }
}

/**
 * Handle OpenRouter API errors
 * @param {Response} response - OpenRouter response
 * @returns {ProxyError} - Structured error
 */
export async function handleOpenRouterError(response) {
  const errorDetails = await response.text();
  
  // Log the error response
  logRequest({
    type: 'openrouter_error_response',
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body: errorDetails
  });

  return new ProxyError(
    `OpenRouter API error: ${errorDetails}`,
    ErrorTypes.EXTERNAL_API_ERROR,
    response.status
  );
}

/**
 * Handle validation errors
 * @param {string} message - Error message
 * @returns {ProxyError} - Structured error
 */
export function handleValidationError(message) {
  return new ProxyError(
    message,
    ErrorTypes.VALIDATION_ERROR,
    400
  );
}

/**
 * Handle transformation errors
 * @param {Error} error - Original error
 * @param {string} context - Context where error occurred
 * @returns {ProxyError} - Structured error
 */
export function handleTransformationError(error, context) {
  return new ProxyError(
    `Transformation error in ${context}: ${error.message}`,
    ErrorTypes.TRANSFORMATION_ERROR,
    500,
    error
  );
}

/**
 * Handle streaming errors
 * @param {Error} error - Original error
 * @returns {ProxyError} - Structured error
 */
export function handleStreamingError(error) {
  return new ProxyError(
    `Streaming error: ${error.message}`,
    ErrorTypes.STREAMING_ERROR,
    500,
    error
  );
}

/**
 * Format error response for client
 * @param {ProxyError} error - Proxy error
 * @returns {Object} - Error response object
 */
export function formatErrorResponse(error) {
  const response = {
    error: {
      type: error.type,
      message: error.message,
      timestamp: error.timestamp
    }
  };

  // Include additional details for development
  if (process.env.NODE_ENV === 'development' && error.originalError) {
    response.error.stack = error.originalError.stack;
  }

  return response;
}

/**
 * Global error handler for Fastify routes
 * @param {Error} error - Error object
 * @param {Object} reply - Fastify reply object
 */
export function handleRouteError(error, reply) {
  let proxyError;

  if (error instanceof ProxyError) {
    proxyError = error;
  } else {
    // Convert generic errors to ProxyError
    proxyError = new ProxyError(
      error.message || 'Internal server error',
      ErrorTypes.INTERNAL_ERROR,
      500,
      error
    );
  }

  // Create comprehensive log entry with context
  const logEntry = {
    type: proxyError.context.type || 'error',
    error_type: proxyError.type,
    message: proxyError.message,
    status_code: proxyError.statusCode,
    timestamp: proxyError.timestamp,
    ...proxyError.context
  };

  // Add stack trace for development
  if (process.env.NODE_ENV === 'development' && proxyError.originalError?.stack) {
    logEntry.stack = proxyError.originalError.stack;
  }

  // Log the comprehensive error
  logRequest(logEntry);

  console.error('Route error:', proxyError);

  // Handle streaming errors differently - don't set response if headers already sent
  if (reply.raw.headersSent) {
    console.error('Headers already sent, cannot set error response');
    return;
  }

  reply.code(proxyError.statusCode);
  return formatErrorResponse(proxyError);
}