/**
 * Refactored streaming response handler using modular components
 */

import type { FastifyReply } from 'fastify';
import { ProxyError } from '../../utils/errorHandler.js';
import { BufferManager } from './BufferManager.js';
import { SSEMessageBuilder } from './SSEMessageBuilder.js';
import { ContentProcessor } from './ContentProcessor.js';
import { StreamStateManager } from './StreamStateManager.js';
import type { RequestLogger } from '../../utils/requestLogger.js';

interface StreamingChoice {
  delta?: {
    tool_calls?: Array<{
      index: number;
      id: string;
      function: {
        name: string;
        arguments?: string;
      };
    }>;
    content?: string;
    reasoning?: string;
  };
}

interface StreamingData {
  error?: {
    message: string;
  };
  usage?: {
    completion_tokens?: number;
  };
  choices?: StreamingChoice[];
}

/**
 * Streaming response handler class - orchestrates streaming components
 */
export class StreamingResponseHandler {
  public stateManager: StreamStateManager;
  private reply: FastifyReply;
  private model: string;
  private logger: RequestLogger;
  private usage: any = null;
  
  private bufferManager: BufferManager;
  private sseBuilder: SSEMessageBuilder;
  private contentProcessor: ContentProcessor;

  constructor(reply: FastifyReply, model: string, logger: RequestLogger) {
    this.reply = reply;
    this.model = model;
    this.logger = logger;
    
    // Initialize components
    this.stateManager = new StreamStateManager();
    this.bufferManager = new BufferManager(logger);
    this.sseBuilder = new SSEMessageBuilder(reply, model);
    this.contentProcessor = new ContentProcessor(this.sseBuilder, logger);
  }

  /**
   * Initialize the streaming response
   */
  private initializeStream(): void {
    if (!this.stateManager.startStreaming()) return;

    // Set streaming headers
    this.reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    // Send initial events
    this.sseBuilder.sendMessageStart();
  }

  /**
   * Process parsed streaming data
   */
  private processStreamData(parsed: StreamingData): void {
    if (parsed.error) {
      this.stateManager.setError();
      
      // Create structured error with rich context
      throw new ProxyError({
        type: 'STREAMING_ERROR',
        message: `Streaming error: ${parsed.error.message}`,
        statusCode: 500,
        cause: new Error(parsed.error.message),
        context: {
          timestamp: Date.now(),
          operation: 'streaming_error',
          model: this.model,
          state: this.stateManager.getState(),
          metadata: {
            ...this.contentProcessor.getContentState()
          }
        }
      });
    }

    this.initializeStream();

    // Capture usage if available
    if (parsed.usage) {
      this.usage = parsed.usage;
    }

    // Process delta through content processor
    const delta = parsed.choices?.[0]?.delta;
    if (delta) {
      this.contentProcessor.processDelta(delta);
    }
  }

  /**
   * Finalize the streaming response
   */
  private finalizeStream(): void {
    this.stateManager.startFinalizing();

    const contentState = this.contentProcessor.getContentState();
    
    // Log the complete streaming response
    this.logger.info('Streaming response complete', {
      ...contentState,
      usage: this.usage,
      model: this.model
    });

    // Send content block stop events
    this.contentProcessor.sendContentBlockStops();

    // Send final message delta
    const outputTokens = this.contentProcessor.calculateOutputTokens(this.usage);
    const stopReason = this.contentProcessor.getStopReason();
    
    this.sseBuilder.sendMessageDeltaWithStop(stopReason, outputTokens);
    this.sseBuilder.sendMessageStop();

    this.stateManager.complete();
    this.reply.raw.end();
  }

  /**
   * Split line on data: boundaries to handle multiple JSON objects in one line
   */
  private splitDataEntries(line: string): string[] {
    const trimmed = line.trim();
    if (!trimmed) return [];
    
    // Handle case where multiple data: entries are concatenated
    const parts = trimmed.split(/(?=data:\s*)/);
    return parts.filter(part => part.trim().startsWith('data:'));
  }

  /**
   * Process a single data entry with buffer management
   */
  private processDataEntry(dataEntry: string): boolean {
    const trimmed = dataEntry.trim();
    if (!trimmed.startsWith('data:')) return true;

    const dataStr = trimmed.replace(/^data:\s*/, '');
    if (dataStr === '[DONE]') {
      this.finalizeStream();
      return false;
    }

    // Handle buffer timeout
    const bufferStatus = this.bufferManager.getBufferStatus();
    if (bufferStatus.isBuffering) {
      const bufferState = this.bufferManager.getBufferStatus();
      this.logger.warn('JSON buffer timeout', bufferState);
      
      this.stateManager.setError();
      throw new ProxyError({
        type: 'STREAMING_ERROR',
        message: 'JSON buffer timeout - incomplete data received',
        statusCode: 500,
        context: {
          timestamp: Date.now(),
          operation: 'json_buffer_timeout',
          ...bufferState
        }
      });
    }

    // Add to buffer if we're currently buffering
    const currentStatus = this.bufferManager.getBufferStatus();
    if (currentStatus.isBuffering) {
      try {
        this.bufferManager.addToJsonBuffer(dataStr);
      } catch (error) {
        this.stateManager.setError();
        throw new ProxyError({
          type: 'STREAMING_ERROR',
          message: error instanceof Error ? error.message : String(error),
          statusCode: 500,
          context: {
            timestamp: Date.now(),
            operation: 'json_buffer_overflow',
            ...this.bufferManager.getBufferStatus()
          }
        });
      }
      
      // Try to parse the buffered data
      const bufferedData = this.bufferManager.flushJsonBuffer();
      if (bufferedData) {
        return this.processBufferedJson(bufferedData);
      }
      return true;
    }

    // Try to parse the current data directly
    try {
      const parsed = JSON.parse(dataStr);
      this.processStreamData(parsed);
    } catch (error) {
      // Start buffering on JSON parse error
      this.bufferManager.startJsonBuffering();
      this.bufferManager.addToJsonBuffer(dataStr);
      return true; // Continue processing, waiting for more data
    }

    return true;
  }

  /**
   * Process buffered JSON data
   */
  private processBufferedJson(jsonData: string): boolean {
    try {
      const parsed = JSON.parse(jsonData);
      this.processStreamData(parsed);
      this.bufferManager.clear();
      return true;
    } catch (error) {
      // If parsing still fails after buffering, it's a permanent error
      this.stateManager.setError();
      
      const bufferState = this.bufferManager.getBufferStatus();
      this.logger.error('JSON buffer parse error', error instanceof Error ? error : new Error(String(error)), {
        timestamp: Date.now(),
        operation: 'json_buffer_parse',
        metadata: bufferState
      });
      
      throw new ProxyError({
        type: 'STREAMING_ERROR',
        message: `Buffered JSON parse error: ${error instanceof Error ? error.message : String(error)}`,
        statusCode: 500,
        cause: error instanceof Error ? error : new Error(String(error)),
        context: {
          timestamp: Date.now(),
          operation: 'buffered_streaming_parse_error',
          model: this.model,
          state: this.stateManager.getState(),
          metadata: {
            ...bufferState,
            ...this.contentProcessor.getContentState()
          }
        }
      });
    }
  }

  /**
   * Process a single line of streaming data
   */
  processLine(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed) return true;
    
    // Handle multiple data: entries that may be concatenated in one line
    const dataEntries = this.splitDataEntries(trimmed);
    
    // If no data entries found, return true to continue
    if (dataEntries.length === 0) return true;
    
    // Process each data entry separately
    for (const dataEntry of dataEntries) {
      const shouldContinue = this.processDataEntry(dataEntry);
      if (!shouldContinue) {
        return false; // Stop processing if any entry returns false
      }
    }
    
    return true;
  }

  /**
   * Extract complete lines from chunk
   */
  extractCompleteLines(chunk: string): string[] {
    return this.bufferManager.extractCompleteLines(chunk);
  }

  /**
   * Process remaining line buffer
   */
  processRemainingLineBuffer(): void {
    const remaining = this.bufferManager.getRemainingLineBuffer();
    if (remaining.trim()) {
      this.processLine(remaining);
    }
  }

  /**
   * Get handler state for error context
   */
  getHandlerState(): any {
    return {
      ...this.contentProcessor.getContentState(),
      model: this.model,
      state: this.stateManager.getState(),
      usage: this.usage
    };
  }
}