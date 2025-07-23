/**
 * Handler for streaming responses - simplified entry point
 */

import { TextDecoder } from 'util';
import type { FastifyReply } from 'fastify';
import { debug } from '../utils/logger.js';
import { ProxyError } from '../utils/errorHandler.js';
import { StreamingResponseHandler } from './streaming/StreamingResponseHandler.js';
import { StreamingStates } from './streaming/StreamStateManager.js';
import type { RequestLogger } from '../utils/requestLogger.js';

/**
 * Handle streaming response from OpenRouter
 */
export async function handleStreamingResponse(
  openaiResponse: Response, 
  reply: FastifyReply, 
  model: string, 
  logger: RequestLogger
): Promise<void> {
  // Log the successful streaming response headers
  logger.info('OpenRouter streaming response start', {
    status: openaiResponse.status,
    headers: Object.fromEntries(openaiResponse.headers.entries()),
    model: model
  });

  const handler = new StreamingResponseHandler(reply, model, logger);
  const reader = openaiResponse.body?.getReader();
  
  if (!reader) {
    throw new ProxyError({
      type: 'STREAMING_ERROR',
      message: 'No response body reader available',
      statusCode: 500
    });
  }

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
    throw new ProxyError({
      type: 'STREAMING_ERROR',
      message: `Streaming handler error: ${error instanceof Error ? error.message : String(error)}`,
      statusCode: 500,
      cause: error instanceof Error ? error : new Error(String(error)),
      context: {
        timestamp: Date.now(),
        operation: 'streaming_handler',
        ...handler.getHandlerState()
      }
    });
  }

  if (!handler.stateManager.isCompleted()) {
    reply.raw.end();
  }
}

// Re-export StreamingStates for backward compatibility
export { StreamingStates };