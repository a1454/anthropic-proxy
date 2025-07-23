/**
 * Buffer management for streaming JSON data
 */

import type { IRequestLogger, IBufferManager } from '../../types/index.js';

interface BufferConfig {
  maxBufferSize?: number;
  bufferTimeoutMs?: number;
}

export class BufferManager implements IBufferManager {
  private logger: IRequestLogger;
  private maxBufferSize: number;
  private bufferTimeoutMs: number;
  private lineBuffer: string = '';
  private jsonBuffer: string = '';
  private isBuffering: boolean = false;
  private bufferStartTime: number | null = null;

  constructor(logger: IRequestLogger, config: BufferConfig = {}) {
    this.logger = logger;
    
    // Configuration
    this.maxBufferSize = config.maxBufferSize || 50000; // 50KB default
    this.bufferTimeoutMs = config.bufferTimeoutMs || 5000; // 5 seconds default
  }

  /**
   * Extract complete lines from the line buffer
   */
  extractCompleteLines(newChunk: string): string[] {
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
   */
  getRemainingLineBuffer(): string {
    const remaining = this.lineBuffer;
    this.lineBuffer = '';
    return remaining;
  }

  /**
   * Start buffering JSON data
   */
  startJsonBuffering(): void {
    this.isBuffering = true;
    this.bufferStartTime = Date.now();
    this.jsonBuffer = '';
  }

  /**
   * Add data to JSON buffer
   */
  addToJsonBuffer(data: string): void {
    if (!this.isBuffering) return;
    
    this.jsonBuffer += data;
    
    // Check buffer size limits
    if (this.jsonBuffer.length > this.maxBufferSize) {
      this.logger.warn(`JSON buffer exceeded max size: ${this.jsonBuffer.length} bytes`);
      this.flushJsonBuffer();
    }
    
    // Check buffer timeout
    if (this.bufferStartTime && (Date.now() - this.bufferStartTime) > this.bufferTimeoutMs) {
      this.logger.warn('JSON buffer timed out, flushing');
      this.flushJsonBuffer();
    }
  }

  /**
   * Try to extract complete JSON objects from buffer
   */
  extractCompleteJson(): unknown[] {
    if (!this.isBuffering || !this.jsonBuffer.trim()) {
      return [];
    }

    const objects: unknown[] = [];
    let buffer = this.jsonBuffer.trim();
    
    while (buffer.length > 0) {
      try {
        // Try to find and parse a complete JSON object
        let braceCount = 0;
        let inString = false;
        let escaped = false;
        let jsonEnd = -1;
        
        for (let i = 0; i < buffer.length; i++) {
          const char = buffer[i];
          
          if (escaped) {
            escaped = false;
            continue;
          }
          
          if (char === '\\') {
            escaped = true;
            continue;
          }
          
          if (char === '"') {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '{') {
              braceCount++;
            } else if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                jsonEnd = i;
                break;
              }
            }
          }
        }
        
        if (jsonEnd !== -1) {
          const jsonStr = buffer.substring(0, jsonEnd + 1);
          const parsed = JSON.parse(jsonStr);
          objects.push(parsed);
          
          // Remove processed JSON from buffer
          buffer = buffer.substring(jsonEnd + 1).trim();
        } else {
          // No complete JSON object found
          break;
        }
      } catch (error) {
        // JSON parsing failed, try to recover
        this.logger.warn('JSON parsing failed, attempting recovery', { error });
        
        // Find the next potential JSON start
        const nextBrace = buffer.indexOf('{');
        if (nextBrace > 0) {
          buffer = buffer.substring(nextBrace);
        } else {
          break;
        }
      }
    }
    
    // Update buffer with remaining data
    this.jsonBuffer = buffer;
    
    return objects;
  }

  /**
   * Flush and clear JSON buffer
   */
  flushJsonBuffer(): string {
    const content = this.jsonBuffer;
    this.jsonBuffer = '';
    this.isBuffering = false;
    this.bufferStartTime = null;
    return content;
  }

  /**
   * Get current buffer status
   */
  getBufferStatus(): {
    lineBufferSize: number;
    jsonBufferSize: number;
    isBuffering: boolean;
    bufferAge?: number;
  } {
    const status = {
      lineBufferSize: this.lineBuffer.length,
      jsonBufferSize: this.jsonBuffer.length,
      isBuffering: this.isBuffering
    };
    
    if (this.bufferStartTime) {
      return {
        ...status,
        bufferAge: Date.now() - this.bufferStartTime
      };
    }
    
    return status;
  }

  /**
   * Clear all buffers
   */
  clear(): void {
    this.lineBuffer = '';
    this.jsonBuffer = '';
    this.isBuffering = false;
    this.bufferStartTime = null;
  }

  // IBufferManager interface methods
  addChunk(chunk: string): void {
    this.addToJsonBuffer(chunk);
  }

  getLines(): string[] {
    return this.extractCompleteLines('');
  }

  hasCompleteMessage(): boolean {
    return this.extractCompleteJson().length > 0;
  }
}