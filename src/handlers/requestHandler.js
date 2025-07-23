/**
 * Main request handler that orchestrates the proxy workflow
 */

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

/**
 * Handle /v1/messages POST requests
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 */
export async function handleMessagesRequest(request, reply) {
  // Generate unique request ID and create per-request logger
  const requestId = generateRequestId();
  const logger = new RequestLogger(requestId);
  
  try {
    const payload = request.body;
    
    // Log the incoming request to request-specific file
    logger.log({
      type: 'incoming_request',
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: payload
    });

    // Transform the request
    let openaiPayload;
    try {
      openaiPayload = transformRequest(payload);
    } catch (error) {
      throw handleTransformationError(error, 'request transformation');
    }

    // Prepare headers and URL
    const headers = getHeaders();
    const url = `${config.baseUrl}/v1/chat/completions`;
    
    // Log the outgoing request to OpenRouter
    logger.log({
      type: 'outgoing_request',
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
      return await handleStreamingResponse(openaiResponse, reply, openaiPayload.model, logger);
    } else {
      return await handleNonStreamingResponse(openaiResponse, openaiPayload.messages, openaiPayload.model, logger);
    }

  } catch (error) {
    return handleRouteError(error, reply, logger);
  } finally {
    // Always close the logger to free resources
    logger.close();
  }
}