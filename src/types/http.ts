/**
 * HTTP and Fastify-related type definitions
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AnthropicRequest, AnthropicResponse } from './api.js';

// Re-export Fastify types for convenience
export type { FastifyReply } from 'fastify';

export interface ProxyRequest extends FastifyRequest<{
  Body: AnthropicRequest;
}> {
  requestId?: string;
  startTime?: number;
}

export interface ProxyReply extends FastifyReply {
  // Uses the native raw response from Fastify
}

export interface RequestContext {
  requestId: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: AnthropicRequest;
  startTime: number;
  model: string;
  thinking: boolean;
}

export interface ResponseContext {
  statusCode: number;
  headers: Record<string, string>;
  body?: AnthropicResponse;
  duration: number;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
}

export interface HttpError {
  statusCode: number;
  message: string;
  code?: string;
  details?: unknown;
}

export interface ProxyHeaders {
  'Content-Type': string;
  'Authorization': string;
  'HTTP-Referer'?: string;
  'X-Title'?: string;
  'User-Agent'?: string;
}

export interface StreamingHeaders {
  'Content-Type': 'text/event-stream';
  'Cache-Control': 'no-cache';
  'Connection': 'keep-alive';
  'Access-Control-Allow-Origin'?: string;
  'Access-Control-Allow-Headers'?: string;
  'Access-Control-Allow-Methods'?: string;
}

export interface RequestMetrics {
  duration: number;
  size: {
    request: number;
    response: number;
  };
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  model: string;
  thinking: boolean;
  cached: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}