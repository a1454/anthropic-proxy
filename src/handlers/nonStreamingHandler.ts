/**
 * Handler for non-streaming responses
 */

import { transformResponse } from '../transformers/responseTransformer.js';
import { debug } from '../utils/logger.js';
import { ProxyError } from '../utils/errorHandler.js';
import type { RequestLogger } from '../utils/requestLogger.js';
import type { OpenAIMessage, AnthropicResponse } from '../types/index.js';

interface OpenAIResponseData {
  id: string;
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
  choices: Array<{
    message: {
      role: string;
      content: string;
      tool_calls?: any[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

/**
 * Handle non-streaming response from OpenRouter
 */
export async function handleNonStreamingResponse(
  openaiResponse: Response, 
  messages: OpenAIMessage[], 
  model: string, 
  logger: RequestLogger
): Promise<AnthropicResponse> {
  const data = await openaiResponse.json();
  debug('OpenAI response:', data);
  
  // Log the successful response
  logger.info('OpenRouter success response', {
    status: openaiResponse.status,
    headers: Object.fromEntries(openaiResponse.headers.entries()),
    body: data
  });
  
  const typedData = data as OpenAIResponseData;
  
  if (typedData.error) {
    // Create structured error with rich context for centralized logging
    throw new ProxyError({
      type: 'API_ERROR',
      message: `OpenRouter response error: ${typedData.error.message}`,
      statusCode: openaiResponse.status,
      context: {
        timestamp: Date.now(),
        operation: 'openrouter_response',
        metadata: {
          response_data: typedData,
          headers: Object.fromEntries(openaiResponse.headers.entries()),
          model: model
        }
      }
    });
  }

  const anthropicResponse = transformResponse(typedData, messages, model);

  // Log the final response being sent to client
  logger.info('Outgoing response', {
    body: anthropicResponse
  });

  return anthropicResponse;
}