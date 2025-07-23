/**
 * Main request handler that orchestrates the proxy workflow
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { transformRequest } from '../transformers/requestTransformer.js';
import { handleNonStreamingResponse } from './nonStreamingHandler.js';
import { handleStreamingResponse } from './streamingHandler.js';
import { generateRequestId, RequestLogger } from '../utils/requestLogger.js';
import { config, getHeaders } from '../config/config.js';
import { 
  handleOpenRouterError, 
  handleTransformationError, 
  handleRouteError,
} from '../utils/errorHandler.js';
import type { AnthropicRequest } from '../types/index.js';

/**
 * Handle /v1/messages POST requests
 */
export async function handleMessagesRequest(
  request: FastifyRequest<{ Body: AnthropicRequest }>, 
  reply: FastifyReply
): Promise<void> {
  // Generate unique request ID and create per-request logger
  const requestId = generateRequestId();
  const logger = new RequestLogger(requestId);
  
  try {
    const payload = request.body;
    
    // Convert headers to Record<string, string>
    const stringHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === 'string') {
        stringHeaders[key] = value;
      } else if (Array.isArray(value)) {
        stringHeaders[key] = value.join(', ');
      }
    }
    
    // Log the incoming request to request-specific file
    logger.info('Incoming request', {
      method: request.method,
      url: request.url,
      headers: stringHeaders,
      body: payload
    });

    // Transform the request
    let openaiPayload;
    try {
      openaiPayload = transformRequest(payload);
    } catch (error) {
      throw handleTransformationError(error as Error, 'request transformation');
    }

    // Prepare headers and URL
    const headers = getHeaders();
    const url = `${config.api.baseUrl}/v1/chat/completions`;
    
    // Log the outgoing request to OpenRouter
    logger.info('Outgoing request', {
      url,
      method: 'POST',
      headers,
      body: openaiPayload
    });

    // Make the request to OpenRouter
    const openaiResponse = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(openaiPayload)
    });

    // Handle error responses
    if (!openaiResponse.ok) {
      const error = await handleOpenRouterError(openaiResponse, logger);
      throw error;
    }

    // Handle response based on streaming mode
    if (openaiPayload.stream) {
      await handleStreamingResponse(openaiResponse, reply, openaiPayload.model, logger);
      return;
    } else {
      const response = await handleNonStreamingResponse(openaiResponse, openaiPayload.messages, openaiPayload.model, logger);
      reply.send(response);
      return;
    }

  } catch (error) {
    const errorResponse = handleRouteError(error as Error, reply, logger);
    if (errorResponse) {
      reply.send(errorResponse);
    }
    return;
  } finally {
    // Always close the logger to free resources
    await logger.close();
  }
}