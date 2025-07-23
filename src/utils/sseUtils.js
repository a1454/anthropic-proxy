/**
 * Server-Sent Events utilities for streaming responses
 */

/**
 * Send SSE events and flush immediately
 * @param {Object} reply - Fastify reply object
 * @param {string} event - Event type
 * @param {Object} data - Data to send
 */
export function sendSSE(reply, event, data) {
  const sseMessage = `event: ${event}\n` +
                     `data: ${JSON.stringify(data)}\n\n`;
  reply.raw.write(sseMessage);
  // Flush if the flush method is available
  if (typeof reply.raw.flush === 'function') {
    reply.raw.flush();
  }
}

/**
 * Map OpenAI finish reason to Anthropic stop reason
 * @param {string} finishReason - OpenAI finish reason
 * @returns {string} - Anthropic stop reason
 */
export function mapStopReason(finishReason) {
  switch (finishReason) {
    case 'tool_calls': return 'tool_use';
    case 'stop': return 'end_turn';
    case 'length': return 'max_tokens';
    default: return 'end_turn';
  }
}

/**
 * Generate a unique message ID
 * @param {string} [openaiId] - Optional OpenAI ID to transform
 * @returns {string} - Unique message ID
 */
export function generateMessageId(openaiId) {
  if (openaiId) {
    return openaiId.replace('chatcmpl', 'msg');
  }
  return 'msg_' + Math.random().toString(36).substring(2, 26);
}