/**
 * Server-Sent Events utilities for streaming responses
 */

import type { FastifyReply } from 'fastify';
import type { SSEMessage } from '../types/index.js';

/**
 * Send SSE events and flush immediately
 */
export function sendSSE(
  reply: FastifyReply, 
  event: string, 
  data: unknown
): void {
  const sseMessage = `event: ${event}\n` +
                     `data: ${JSON.stringify(data)}\n\n`;
  reply.raw.write(sseMessage);
  
  // Flush if the flush method is available
  const rawResponse = reply.raw as any;
  if (typeof rawResponse.flush === 'function') {
    rawResponse.flush();
  }
}

/**
 * Send raw SSE message
 */
export function sendRawSSE(
  reply: FastifyReply, 
  message: SSEMessage
): void {
  let sseString = '';
  
  if (message.event) {
    sseString += `event: ${message.event}\n`;
  }
  
  if (message.id) {
    sseString += `id: ${message.id}\n`;
  }
  
  if (message.retry) {
    sseString += `retry: ${message.retry}\n`;
  }
  
  sseString += `data: ${message.data}\n\n`;
  
  reply.raw.write(sseString);
  
  const rawResponse = reply.raw as any;
  if (typeof rawResponse.flush === 'function') {
    rawResponse.flush();
  }
}

/**
 * Map OpenAI finish reason to Anthropic stop reason
 */
export function mapStopReason(finishReason: string | null | undefined): 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' {
  switch (finishReason) {
    case 'tool_calls': return 'tool_use';
    case 'stop': return 'end_turn';
    case 'length': return 'max_tokens';
    case 'content_filter': return 'stop_sequence';
    default: return 'end_turn';
  }
}

/**
 * Generate a unique message ID
 */
export function generateMessageId(openaiId?: string): string {
  if (openaiId) {
    return openaiId.replace('chatcmpl', 'msg');
  }
  return 'msg_' + Math.random().toString(36).substring(2, 26);
}

/**
 * Generate a unique content block ID
 */
export function generateContentBlockId(index = 0): string {
  return `bk_${String(index).padStart(2, '0')}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique tool call ID
 */
export function generateToolCallId(): string {
  return 'toolu_' + Math.random().toString(36).substring(2, 26);
}

/**
 * Parse SSE data chunk
 */
export function parseSSEChunk(chunk: string): Array<{ event?: string; data: string }> {
  const lines = chunk.split('\n');
  const events: Array<{ event?: string; data: string }> = [];
  let currentEvent: { event?: string; data?: string } = {};
  
  for (const line of lines) {
    if (line === '') {
      // Empty line indicates end of event
      if (currentEvent.data !== undefined) {
        const eventData: { event?: string; data: string } = {
          data: currentEvent.data
        };
        if (currentEvent.event) {
          eventData.event = currentEvent.event;
        }
        events.push(eventData);
      }
      currentEvent = {};
    } else if (line.startsWith('event: ')) {
      currentEvent.event = line.substring(7);
    } else if (line.startsWith('data: ')) {
      currentEvent.data = line.substring(6);
    }
  }
  
  return events;
}

/**
 * Create streaming headers for SSE response
 */
export function createStreamingHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
}

/**
 * Validate SSE message format
 */
export function isValidSSEMessage(message: SSEMessage): boolean {
  return typeof message.data === 'string' && message.data.length > 0;
}