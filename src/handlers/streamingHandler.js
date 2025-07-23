/**
 * Handler for streaming responses - simplified entry point
 */

import { TextDecoder } from 'util';
import { debug } from '../utils/logger.js';
import { ProxyError, ErrorTypes } from '../utils/errorHandler.js';
import { StreamingResponseHandler } from './streaming/StreamingResponseHandler.js';
import { StreamingStates } from './streaming/StreamStateManager.js';

/**
 * Handle streaming response from OpenRouter
 * @param {Response} openaiResponse - Response from OpenRouter
 * @param {Object} reply - Fastify reply object
 * @param {string} model - Model used for the request
 * @param {RequestLogger} logger - Request-specific logger
 */
export async function handleStreamingResponse(openaiResponse, reply, model, logger) {
  // Log the successful streaming response headers
  logger.log({
    type: 'openrouter_streaming_response_start',
    status: openaiResponse.status,
    headers: Object.fromEntries(openaiResponse.headers.entries()),
    model: model
  });

  const handler = new StreamingResponseHandler(reply, model, logger);
  const reader = openaiResponse.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let done = false;

  try {
    while (!done && !handler.stateManager.isCompleted()) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;

      if (value) {
        const chunk = decoder.decode(value);
        debug('OpenAI response chunk:', chunk);
        
        // Use line buffering to handle incomplete lines and multiple JSON objects
        const completeLines = handler.extractCompleteLines(chunk);
        for (const line of completeLines) {
          const shouldContinue = handler.processLine(line);
          if (!shouldContinue) {
            done = true;
            break;
          }
        }
      }
    }
    
    // Process any remaining data in line buffer when stream ends
    handler.processRemainingLineBuffer();
    
  } catch (error) {
    handler.stateManager.setError();
    
    // If it's already a ProxyError, just re-throw to preserve context
    if (error instanceof ProxyError) {
      throw error;
    }
    
    // Create structured error for general streaming errors
    throw new ProxyError(
      `Streaming handler error: ${error.message}`,
      ErrorTypes.STREAMING_ERROR,
      500,
      error
    ).withContext({
      ...handler.getHandlerState(),
      type: 'streaming_handler_error'
    });
  }

  if (!handler.stateManager.isCompleted()) {
    reply.raw.end();
  }
}

// Re-export StreamingStates for backward compatibility
export { StreamingStates };