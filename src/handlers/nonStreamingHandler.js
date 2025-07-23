/**
 * Handler for non-streaming responses
 */

import { transformResponse } from '../transformers/responseTransformer.js';
import { debug } from '../utils/logger.js';
import { ProxyError, ErrorTypes } from '../utils/errorHandler.js';

/**
 * Handle non-streaming response from OpenRouter
 * @param {Response} openaiResponse - Response from OpenRouter
 * @param {Array} messages - Original messages for token calculation
 * @param {string} model - Model used for the request
 * @param {RequestLogger} logger - Request-specific logger
 * @returns {Object} - Anthropic format response
 */
export async function handleNonStreamingResponse(openaiResponse, messages, model, logger) {
  const data = await openaiResponse.json();
  debug('OpenAI response:', data);
  
  // Log the successful response
  logger.log({
    type: 'openrouter_success_response',
    status: openaiResponse.status,
    headers: Object.fromEntries(openaiResponse.headers.entries()),
    body: data
  });
  
  if (data.error) {
    // Create structured error with rich context for centralized logging
    throw new ProxyError(
      `OpenRouter response error: ${data.error.message}`,
      ErrorTypes.EXTERNAL_API_ERROR,
      openaiResponse.status,
      data.error
    ).withContext({
      response_data: data,
      headers: Object.fromEntries(openaiResponse.headers.entries()),
      model: model,
      type: 'openrouter_response_error'
    });
  }

  const anthropicResponse = transformResponse(data, messages, model);

  // Log the final response being sent to client
  logger.log({
    type: 'outgoing_response',
    body: anthropicResponse
  });

  return anthropicResponse;
}