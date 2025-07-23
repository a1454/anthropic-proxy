/**
 * Refactored streaming response handler using modular components
 */

import { ProxyError, ErrorTypes } from '../../utils/errorHandler.js';
import { BufferManager } from './BufferManager.js';
import { SSEMessageBuilder } from './SSEMessageBuilder.js';
import { ContentProcessor } from './ContentProcessor.js';
import { StreamStateManager, StreamingStates } from './StreamStateManager.js';

/**
 * Streaming response handler class - orchestrates streaming components
 */
export class StreamingResponseHandler {
  constructor(reply, model, logger) {
    this.reply = reply;
    this.model = model;
    this.logger = logger;
    this.usage = null;
    
    // Initialize components
    this.stateManager = new StreamStateManager();
    this.bufferManager = new BufferManager(logger);
    this.sseBuilder = new SSEMessageBuilder(reply, model);
    this.contentProcessor = new ContentProcessor(this.sseBuilder, logger);
  }

  /**
   * Initialize the streaming response
   */
  initializeStream() {
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
   * @param {Object} parsed - Parsed streaming data
   */
  processStreamData(parsed) {
    if (parsed.error) {
      this.stateManager.setError();
      
      // Create structured error with rich context
      throw new ProxyError(
        `Streaming error: ${parsed.error.message}`,
        ErrorTypes.STREAMING_ERROR,
        500,
        parsed.error
      ).withContext({
        ...this.contentProcessor.getContentState(),
        model: this.model,
        state: this.stateManager.getState(),
        type: 'streaming_error'
      });
    }

    this.initializeStream();

    // Capture usage if available
    if (parsed.usage) {
      this.usage = parsed.usage;
    }

    // Process delta through content processor
    const delta = parsed.choices?.[0]?.delta;
    this.contentProcessor.processDelta(delta);
  }

  /**
   * Finalize the streaming response
   */
  finalizeStream() {
    this.stateManager.startFinalizing();

    const contentState = this.contentProcessor.getContentState();
    
    // Log the complete streaming response
    this.logger.log({
      type: 'streaming_response_complete',
      ...contentState,
      usage: this.usage,
      model: this.model
    });

    // Send content block stop events
    this.contentProcessor.sendContentBlockStops();

    // Send final message delta
    const outputTokens = this.contentProcessor.calculateOutputTokens(this.usage);
    const stopReason = this.contentProcessor.getStopReason();
    
    this.sseBuilder.sendMessageDelta(stopReason, outputTokens);
    this.sseBuilder.sendMessageStop();

    this.stateManager.complete();
    this.reply.raw.end();
  }

  /**
   * Split line on data: boundaries to handle multiple JSON objects in one line
   * @param {string} line - Line that may contain multiple data: entries
   * @returns {Array<string>} - Array of individual data entries
   */
  splitDataEntries(line) {
    const trimmed = line.trim();
    if (!trimmed) return [];
    
    // Handle case where multiple data: entries are concatenated
    const parts = trimmed.split(/(?=data:\s*)/);
    return parts.filter(part => part.trim().startsWith('data:'));
  }

  /**
   * Process a single data entry with buffer management
   * @param {string} dataEntry - Single data: entry to process
   * @returns {boolean} - Whether processing should continue
   */
  processDataEntry(dataEntry) {
    const trimmed = dataEntry.trim();
    if (!trimmed.startsWith('data:')) return true;

    const dataStr = trimmed.replace(/^data:\s*/, '');
    if (dataStr === '[DONE]') {
      this.finalizeStream();
      return false;
    }

    // Handle buffer timeout
    if (this.bufferManager.isBuffering && this.bufferManager.isBufferTimedOut()) {
      const bufferState = this.bufferManager.getBufferState();
      this.logger.log({
        type: 'json_buffer_timeout',
        ...bufferState
      });
      
      this.stateManager.setError();
      throw new ProxyError(
        'JSON buffer timeout - incomplete data received',
        ErrorTypes.STREAMING_ERROR,
        500
      ).withContext({
        ...bufferState,
        type: 'json_buffer_timeout'
      });
    }

    // Add to buffer if we're currently buffering
    if (this.bufferManager.isBuffering) {
      try {
        this.bufferManager.addToBuffer(dataStr);
      } catch (error) {
        this.stateManager.setError();
        throw new ProxyError(
          error.message,
          ErrorTypes.STREAMING_ERROR,
          500
        ).withContext({
          ...this.bufferManager.getBufferState(),
          type: 'json_buffer_overflow'
        });
      }
      
      // Try to parse the buffered data
      return this.processBufferedJson(this.bufferManager.jsonBuffer);
    }

    // Try to parse the current data directly
    try {
      const parsed = JSON.parse(dataStr);
      this.processStreamData(parsed);
    } catch (error) {
      // Check if this is a recoverable error
      if (this.bufferManager.isRecoverableJsonError(error)) {
        // Start buffering
        this.bufferManager.startBuffering(dataStr, error.message);
        return true; // Continue processing, waiting for more data
      }
      
      // For other JSON errors, fail immediately
      this.stateManager.setError();
      
      this.logger.log({
        type: 'json_parse_error_permanent',
        error: error.message,
        raw_data: dataStr
      });
      
      throw new ProxyError(
        `Streaming parse error: ${error.message}`,
        ErrorTypes.STREAMING_ERROR,
        500,
        error
      ).withContext({
        raw_data: dataStr,
        ...this.contentProcessor.getContentState(),
        model: this.model,
        state: this.stateManager.getState(),
        type: 'streaming_parse_error'
      });
    }

    return true;
  }

  /**
   * Process buffered JSON data
   * @param {string} jsonData - Complete JSON string to parse
   * @returns {boolean} - Whether processing should continue
   */
  processBufferedJson(jsonData) {
    try {
      const parsed = JSON.parse(jsonData);
      this.processStreamData(parsed);
      this.bufferManager.clearBuffer();
      return true;
    } catch (error) {
      // If parsing still fails after buffering, it's a permanent error
      this.stateManager.setError();
      
      const bufferState = this.bufferManager.getBufferState();
      this.logger.log({
        type: 'json_buffer_parse_error',
        error: error.message,
        ...bufferState
      });
      
      throw new ProxyError(
        `Buffered JSON parse error: ${error.message}`,
        ErrorTypes.STREAMING_ERROR,
        500,
        error
      ).withContext({
        ...bufferState,
        ...this.contentProcessor.getContentState(),
        model: this.model,
        state: this.stateManager.getState(),
        type: 'buffered_streaming_parse_error'
      });
    }
  }

  /**
   * Process a single line of streaming data
   * @param {string} line - Line to process
   * @returns {boolean} - Whether processing should continue
   */
  processLine(line) {
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
   * @param {string} chunk - New chunk from stream
   * @returns {Array<string>} - Complete lines
   */
  extractCompleteLines(chunk) {
    return this.bufferManager.extractCompleteLines(chunk);
  }

  /**
   * Process remaining line buffer
   */
  processRemainingLineBuffer() {
    const remaining = this.bufferManager.getRemainingLineBuffer();
    if (remaining.trim()) {
      this.processLine(remaining);
    }
  }

  /**
   * Get handler state for error context
   * @returns {Object} - Handler state
   */
  getHandlerState() {
    return {
      ...this.contentProcessor.getContentState(),
      model: this.model,
      state: this.stateManager.getState(),
      usage: this.usage
    };
  }
}