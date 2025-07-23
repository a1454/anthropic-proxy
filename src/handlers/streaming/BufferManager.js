/**
 * Buffer management for streaming JSON data
 */

export class BufferManager {
  constructor(logger, config = {}) {
    this.logger = logger;
    
    // Configuration
    this.maxBufferSize = config.maxBufferSize || 50000; // 50KB default
    this.bufferTimeoutMs = config.bufferTimeoutMs || 5000; // 5 seconds default
    
    // Two-level buffering: line buffer + JSON buffer
    this.lineBuffer = ''; // Accumulates incomplete lines
    this.jsonBuffer = ''; // Accumulates incomplete JSON objects
    this.isBuffering = false;
    this.bufferStartTime = null;
  }

  /**
   * Extract complete lines from the line buffer
   * @param {string} newChunk - New chunk to add to line buffer
   * @returns {Array<string>} - Array of complete lines
   */
  extractCompleteLines(newChunk) {
    // Add new chunk to line buffer
    this.lineBuffer += newChunk;
    
    // Split on newlines to get complete lines
    const parts = this.lineBuffer.split('\n');
    
    // Last part is incomplete (unless chunk ended with \n)
    this.lineBuffer = parts.pop() || '';
    
    // Return complete lines
    return parts;
  }

  /**
   * Get any remaining data in line buffer
   * @returns {string} - Remaining line buffer content
   */
  getRemainingLineBuffer() {
    const remaining = this.lineBuffer;
    this.lineBuffer = '';
    return remaining;
  }

  /**
   * Start buffering JSON data
   * @param {string} initialData - Initial data that failed to parse
   * @param {string} errorMessage - Parse error message
   */
  startBuffering(initialData, errorMessage) {
    this.jsonBuffer = initialData;
    this.isBuffering = true;
    this.bufferStartTime = Date.now();
    
    this.logger.log({
      type: 'json_buffer_start',
      initial_data: initialData,
      error_message: errorMessage,
      buffer_size: initialData.length
    });
  }

  /**
   * Add data to JSON buffer
   * @param {string} data - Data to add to buffer
   * @throws {Error} - If buffer size limit exceeded
   */
  addToBuffer(data) {
    this.jsonBuffer += data;
    
    // Check buffer size limit
    if (this.jsonBuffer.length > this.maxBufferSize) {
      this.logger.log({
        type: 'json_buffer_overflow',
        buffer_size: this.jsonBuffer.length,
        max_size: this.maxBufferSize
      });
      
      throw new Error(`JSON buffer overflow - exceeded ${this.maxBufferSize} bytes`);
    }
  }

  /**
   * Clear the JSON buffer and reset buffering state
   */
  clearBuffer() {
    this.jsonBuffer = '';
    this.isBuffering = false;
    this.bufferStartTime = null;
  }

  /**
   * Check if buffer has timed out
   * @returns {boolean} - Whether buffer has exceeded timeout
   */
  isBufferTimedOut() {
    if (!this.bufferStartTime) return false;
    return Date.now() - this.bufferStartTime > this.bufferTimeoutMs;
  }

  /**
   * Get current buffer state for error context
   * @returns {Object} - Buffer state information
   */
  getBufferState() {
    return {
      isBuffering: this.isBuffering,
      jsonBufferSize: this.jsonBuffer.length,
      jsonBufferContent: this.jsonBuffer,
      lineBufferSize: this.lineBuffer.length,
      bufferAge: this.bufferStartTime ? Date.now() - this.bufferStartTime : null,
      isTimedOut: this.isBufferTimedOut()
    };
  }

  /**
   * Check if error indicates incomplete JSON that can be buffered
   * @param {Error} error - JSON parse error
   * @returns {boolean} - Whether error is recoverable through buffering
   */
  isRecoverableJsonError(error) {
    return error.message.includes('Unterminated string') || 
           error.message.includes('Unexpected end of JSON input') ||
           error.message.includes('Unexpected token');
  }
}