/**
 * Handler for streaming responses with state machine architecture
 */

import { TextDecoder } from 'util';
import { sendSSE, generateMessageId } from '../utils/sseUtils.js';
import { debug } from '../utils/logger.js';
import { ProxyError, ErrorTypes } from '../utils/errorHandler.js';

/**
 * Streaming state machine states
 */
const StreamingStates = {
  INITIALIZING: 'initializing',
  STREAMING: 'streaming',
  FINALIZING: 'finalizing',
  COMPLETED: 'completed',
  ERROR: 'error'
};

/**
 * Streaming response handler class with state machine
 */
class StreamingResponseHandler {
  constructor(reply, model, logger) {
    this.reply = reply;
    this.model = model;
    this.logger = logger;
    this.state = StreamingStates.INITIALIZING;
    this.isSucceeded = false;
    this.accumulatedContent = '';
    this.accumulatedReasoning = '';
    this.usage = null;
    this.textBlockStarted = false;
    this.encounteredToolCall = false;
    this.toolCallAccumulators = {};
    this.decoder = new TextDecoder('utf-8');
  }

  /**
   * Initialize the streaming response
   */
  initializeStream() {
    if (this.isSucceeded) return;
    this.isSucceeded = true;
    this.state = StreamingStates.STREAMING;

    // Set streaming headers
    this.reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    // Send initial events
    const messageId = generateMessageId();
    sendSSE(this.reply, 'message_start', {
      type: 'message_start',
      message: {
        id: messageId,
        type: 'message',
        role: 'assistant',
        model: this.model,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 },
      }
    });

    sendSSE(this.reply, 'ping', { type: 'ping' });
  }

  /**
   * Process tool call delta
   * @param {Object} toolCall - Tool call data
   */
  processToolCall(toolCall) {
    this.encounteredToolCall = true;
    const idx = toolCall.index;

    if (this.toolCallAccumulators[idx] === undefined) {
      this.toolCallAccumulators[idx] = "";
      sendSSE(this.reply, 'content_block_start', {
        type: 'content_block_start',
        index: idx,
        content_block: {
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: {}
        }
      });
    }

    const newArgs = toolCall.function.arguments || "";
    const oldArgs = this.toolCallAccumulators[idx];
    
    if (newArgs.length > oldArgs.length) {
      const deltaText = newArgs.substring(oldArgs.length);
      sendSSE(this.reply, 'content_block_delta', {
        type: 'content_block_delta',
        index: idx,
        delta: {
          type: 'input_json_delta',
          partial_json: deltaText
        }
      });
      this.toolCallAccumulators[idx] = newArgs;
    }
  }

  /**
   * Process content delta
   * @param {string} content - Content delta
   */
  processContent(content) {
    if (!this.textBlockStarted) {
      this.textBlockStarted = true;
      sendSSE(this.reply, 'content_block_start', {
        type: 'content_block_start',
        index: 0,
        content_block: {
          type: 'text',
          text: ''
        }
      });
    }

    this.accumulatedContent += content;
    sendSSE(this.reply, 'content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'text_delta',
        text: content
      }
    });
  }

  /**
   * Process reasoning delta
   * @param {string} reasoning - Reasoning delta
   */
  processReasoning(reasoning) {
    if (!this.textBlockStarted) {
      this.textBlockStarted = true;
      sendSSE(this.reply, 'content_block_start', {
        type: 'content_block_start',
        index: 0,
        content_block: {
          type: 'text',
          text: ''
        }
      });
    }

    this.accumulatedReasoning += reasoning;
    sendSSE(this.reply, 'content_block_delta', {
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'thinking_delta',
        thinking: reasoning
      }
    });
  }

  /**
   * Process parsed streaming data
   * @param {Object} parsed - Parsed streaming data
   */
  processStreamData(parsed) {
    if (parsed.error) {
      this.state = StreamingStates.ERROR;
      
      // Create structured error with rich context for centralized logging
      throw new ProxyError(
        `Streaming error: ${parsed.error.message}`,
        ErrorTypes.STREAMING_ERROR,
        500,
        parsed.error
      ).withContext({
        accumulated_content: this.accumulatedContent,
        accumulated_reasoning: this.accumulatedReasoning,
        model: this.model,
        state: this.state,
        type: 'streaming_error'
      });
    }

    this.initializeStream();

    // Capture usage if available
    if (parsed.usage) {
      this.usage = parsed.usage;
    }

    const delta = parsed.choices?.[0]?.delta;
    if (!delta) return;

    // Process different types of deltas
    if (delta.tool_calls) {
      delta.tool_calls.forEach(toolCall => this.processToolCall(toolCall));
    } else if (delta.content) {
      this.processContent(delta.content);
    } else if (delta.reasoning) {
      this.processReasoning(delta.reasoning);
    }
  }

  /**
   * Finalize the streaming response
   */
  finalizeStream() {
    this.state = StreamingStates.FINALIZING;

    // Log the complete streaming response
    this.logger.log({
      type: 'streaming_response_complete',
      accumulated_content: this.accumulatedContent,
      accumulated_reasoning: this.accumulatedReasoning,
      tool_calls: Object.keys(this.toolCallAccumulators).length > 0 ? this.toolCallAccumulators : null,
      usage: this.usage,
      model: this.model
    });

    // Send content block stop events
    if (this.encounteredToolCall) {
      Object.keys(this.toolCallAccumulators).forEach(idx => {
        sendSSE(this.reply, 'content_block_stop', {
          type: 'content_block_stop',
          index: parseInt(idx, 10)
        });
      });
    } else if (this.textBlockStarted) {
      sendSSE(this.reply, 'content_block_stop', {
        type: 'content_block_stop',
        index: 0
      });
    }

    // Send final message delta
    const outputTokens = this.usage?.completion_tokens || 
      (this.accumulatedContent.split(' ').length + this.accumulatedReasoning.split(' ').length);

    sendSSE(this.reply, 'message_delta', {
      type: 'message_delta',
      delta: {
        stop_reason: this.encounteredToolCall ? 'tool_use' : 'end_turn',
        stop_sequence: null
      },
      usage: { output_tokens: outputTokens }
    });

    // Send message stop
    sendSSE(this.reply, 'message_stop', {
      type: 'message_stop'
    });

    this.state = StreamingStates.COMPLETED;
    this.reply.raw.end();
  }

  /**
   * Process a single line of streaming data
   * @param {string} line - Line to process
   * @returns {boolean} - Whether processing should continue
   */
  processLine(line) {
    const trimmed = line.trim();
    if (trimmed === '' || !trimmed.startsWith('data:')) return true;

    const dataStr = trimmed.replace(/^data:\s*/, '');
    if (dataStr === '[DONE]') {
      this.finalizeStream();
      return false;
    }

    try {
      const parsed = JSON.parse(dataStr);
      this.processStreamData(parsed);
    } catch (error) {
      console.error('Error parsing streaming data:', error);
      this.state = StreamingStates.ERROR;
      
      // Create structured parsing error with context
      throw new ProxyError(
        `Streaming parse error: ${error.message}`,
        ErrorTypes.STREAMING_ERROR,
        500,
        error
      ).withContext({
        raw_data: dataStr,
        accumulated_content: this.accumulatedContent,
        accumulated_reasoning: this.accumulatedReasoning,
        model: this.model,
        state: this.state,
        type: 'streaming_parse_error'
      });
    }

    return true;
  }
}

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
  let done = false;

  try {
    while (!done && handler.state !== StreamingStates.COMPLETED) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;

      if (value) {
        const chunk = handler.decoder.decode(value);
        debug('OpenAI response chunk:', chunk);
        
        const lines = chunk.split('\n');
        for (const line of lines) {
          const shouldContinue = handler.processLine(line);
          if (!shouldContinue) {
            done = true;
            break;
          }
        }
      }
    }
  } catch (error) {
    handler.state = StreamingStates.ERROR;
    
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
      accumulated_content: handler.accumulatedContent,
      accumulated_reasoning: handler.accumulatedReasoning,
      model: model,
      state: handler.state,
      tool_calls: Object.keys(handler.toolCallAccumulators).length > 0 ? handler.toolCallAccumulators : null,
      type: 'streaming_handler_error'
    });
  }

  if (handler.state !== StreamingStates.COMPLETED) {
    reply.raw.end();
  }
}