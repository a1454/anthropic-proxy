/**
 * SSE message builder for Anthropic format streaming responses
 */

import { sendSSE, generateMessageId } from '../../utils/sseUtils.js';
import type { 
  FastifyReply, 
  ISSEMessageBuilder, 
  ContentDelta, 
  TokenUsageAccumulator 
} from '../../types/index.js';

export class SSEMessageBuilder implements ISSEMessageBuilder {
  private reply: FastifyReply;
  private model: string;
  private messageId: string | null = null;

  constructor(reply: FastifyReply, model: string) {
    this.reply = reply;
    this.model = model;
  }

  /**
   * Send initial message start event
   */
  sendMessageStart(): void {
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
   */
  sendContentBlockStart(index: number, type: string): void {
    const contentBlock = type === 'text' 
      ? { type: 'text', text: '' }
      : { type, id: '', name: '', input: {} };

    sendSSE(this.reply, 'content_block_start', {
      type: 'content_block_start',
      index,
      content_block: contentBlock
    });
  }

  /**
   * Send content block delta event
   */
  sendContentBlockDelta(index: number, delta: ContentDelta): void {
    let deltaData: any;

    switch (delta.type) {
      case 'text':
        deltaData = {
          type: 'text_delta',
          text: delta.content || ''
        };
        break;
      case 'tool_call':
        if (delta.toolCall?.arguments) {
          deltaData = {
            type: 'input_json_delta',
            partial_json: delta.toolCall.arguments
          };
        }
        break;
      case 'reasoning':
        deltaData = {
          type: 'thinking_delta',
          thinking: delta.reasoning || ''
        };
        break;
      default:
        deltaData = delta;
    }

    sendSSE(this.reply, 'content_block_delta', {
      type: 'content_block_delta',
      index,
      delta: deltaData
    });
  }

  /**
   * Send content block stop event
   */
  sendContentBlockStop(index: number): void {
    sendSSE(this.reply, 'content_block_stop', {
      type: 'content_block_stop',
      index
    });
  }

  /**
   * Send text content block start
   */
  sendTextBlockStart(index = 0): void {
    this.sendContentBlockStart(index, 'text');
  }

  /**
   * Send text delta
   */
  sendTextDelta(text: string, index = 0): void {
    this.sendContentBlockDelta(index, {
      type: 'text',
      content: text
    });
  }

  /**
   * Send thinking delta
   */
  sendThinkingDelta(thinking: string, index = 0): void {
    this.sendContentBlockDelta(index, {
      type: 'reasoning',
      reasoning: thinking
    });
  }

  /**
   * Send tool use block start
   */
  sendToolUseBlockStart(index: number, id: string, name: string): void {
    sendSSE(this.reply, 'content_block_start', {
      type: 'content_block_start',
      index,
      content_block: {
        type: 'tool_use',
        id,
        name,
        input: {}
      }
    });
  }

  /**
   * Send tool input JSON delta
   */
  sendToolInputDelta(index: number, partialJson: string): void {
    this.sendContentBlockDelta(index, {
      type: 'tool_call',
      toolCall: {
        id: '',
        arguments: partialJson
      }
    });
  }

  /**
   * Send message delta with stop reason and usage
   */
  sendMessageDelta(usage?: Partial<TokenUsageAccumulator>): void {
    const deltaData: any = {
      type: 'message_delta',
      delta: {
        stop_reason: null,
        stop_sequence: null
      }
    };

    if (usage) {
      deltaData.usage = {
        output_tokens: usage.outputTokens || 0
      };
    }

    sendSSE(this.reply, 'message_delta', deltaData);
  }

  /**
   * Send message delta with stop reason
   */
  sendMessageDeltaWithStop(stopReason: string, outputTokens?: number): void {
    sendSSE(this.reply, 'message_delta', {
      type: 'message_delta',
      delta: {
        stop_reason: stopReason,
        stop_sequence: null
      },
      usage: outputTokens ? { output_tokens: outputTokens } : undefined
    });
  }

  /**
   * Send message stop event
   */
  sendMessageStop(): void {
    sendSSE(this.reply, 'message_stop', {
      type: 'message_stop'
    });
  }

  /**
   * Send error event
   */
  sendError(error: { type: string; message: string }): void {
    sendSSE(this.reply, 'error', {
      type: 'error',
      error: {
        type: error.type,
        message: error.message
      }
    });
  }

  /**
   * Get the current message ID
   */
  getMessageId(): string | null {
    return this.messageId;
  }
}