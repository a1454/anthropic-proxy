/**
 * SSE message builder for Anthropic format streaming responses
 */

import { sendSSE, generateMessageId } from '../../utils/sseUtils.js';

export class SSEMessageBuilder {
  constructor(reply, model) {
    this.reply = reply;
    this.model = model;
    this.messageId = null;
  }

  /**
   * Send initial message start event
   */
  sendMessageStart() {
    this.messageId = generateMessageId();
    
    sendSSE(this.reply, 'message_start', {
      type: 'message_start',
      message: {
        id: this.messageId,
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
   * Send content block start event
   * @param {number} index - Block index
   * @param {Object} contentBlock - Content block data
   */
  sendContentBlockStart(index, contentBlock) {
    sendSSE(this.reply, 'content_block_start', {
      type: 'content_block_start',
      index,
      content_block: contentBlock
    });
  }

  /**
   * Send content block delta event
   * @param {number} index - Block index
   * @param {Object} delta - Delta data
   */
  sendContentBlockDelta(index, delta) {
    sendSSE(this.reply, 'content_block_delta', {
      type: 'content_block_delta',
      index,
      delta
    });
  }

  /**
   * Send content block stop event
   * @param {number} index - Block index
   */
  sendContentBlockStop(index) {
    sendSSE(this.reply, 'content_block_stop', {
      type: 'content_block_stop',
      index
    });
  }

  /**
   * Send text content block start
   * @param {number} index - Block index
   */
  sendTextBlockStart(index = 0) {
    this.sendContentBlockStart(index, {
      type: 'text',
      text: ''
    });
  }

  /**
   * Send text delta
   * @param {string} text - Text content
   * @param {number} index - Block index
   */
  sendTextDelta(text, index = 0) {
    this.sendContentBlockDelta(index, {
      type: 'text_delta',
      text
    });
  }

  /**
   * Send thinking delta
   * @param {string} thinking - Thinking content
   * @param {number} index - Block index
   */
  sendThinkingDelta(thinking, index = 0) {
    this.sendContentBlockDelta(index, {
      type: 'thinking_delta',
      thinking
    });
  }

  /**
   * Send tool use block start
   * @param {number} index - Block index
   * @param {string} id - Tool call ID
   * @param {string} name - Tool name
   */
  sendToolUseBlockStart(index, id, name) {
    this.sendContentBlockStart(index, {
      type: 'tool_use',
      id,
      name,
      input: {}
    });
  }

  /**
   * Send tool input JSON delta
   * @param {number} index - Block index
   * @param {string} partialJson - Partial JSON string
   */
  sendToolInputDelta(index, partialJson) {
    this.sendContentBlockDelta(index, {
      type: 'input_json_delta',
      partial_json: partialJson
    });
  }

  /**
   * Send message delta with stop reason
   * @param {string} stopReason - Stop reason
   * @param {number} outputTokens - Output token count
   */
  sendMessageDelta(stopReason, outputTokens) {
    sendSSE(this.reply, 'message_delta', {
      type: 'message_delta',
      delta: {
        stop_reason: stopReason,
        stop_sequence: null
      },
      usage: { output_tokens: outputTokens }
    });
  }

  /**
   * Send message stop event
   */
  sendMessageStop() {
    sendSSE(this.reply, 'message_stop', {
      type: 'message_stop'
    });
  }
}