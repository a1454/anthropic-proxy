/**
 * Content processor for different types of streaming content
 */

import type { SSEMessageBuilder } from './SSEMessageBuilder.js';
import type { RequestLogger } from '../../utils/requestLogger.js';

interface ToolCall {
  index: number;
  id: string;
  function: {
    name: string;
    arguments?: string;
  };
}

interface Delta {
  tool_calls?: ToolCall[];
  content?: string;
  reasoning?: string;
}

interface Usage {
  completion_tokens?: number;
}

export class ContentProcessor {
  private sseBuilder: SSEMessageBuilder;
  
  // State tracking
  private textBlockStarted: boolean = false;
  private encounteredToolCall: boolean = false;
  private toolCallAccumulators: Record<number, string> = {};
  
  // Accumulated content
  private accumulatedContent: string = '';
  private accumulatedReasoning: string = '';

  constructor(sseBuilder: SSEMessageBuilder, _logger?: RequestLogger) {
    this.sseBuilder = sseBuilder;
    // Logger reserved for future use
  }

  /**
   * Process tool call delta
   */
  processToolCall(toolCall: ToolCall): void {
    this.encounteredToolCall = true;
    const idx = toolCall.index;

    // Initialize tool call accumulator if needed
    if (this.toolCallAccumulators[idx] === undefined) {
      this.toolCallAccumulators[idx] = "";
      this.sseBuilder.sendToolUseBlockStart(idx, toolCall.id, toolCall.function.name);
    }

    // Process arguments delta
    const newArgs = toolCall.function.arguments || "";
    const oldArgs = this.toolCallAccumulators[idx];
    
    if (newArgs.length > oldArgs.length) {
      const deltaText = newArgs.substring(oldArgs.length);
      this.sseBuilder.sendToolInputDelta(idx, deltaText);
      this.toolCallAccumulators[idx] = newArgs;
    }
  }

  /**
   * Process content delta
   */
  processContent(content: string): void {
    if (!this.textBlockStarted) {
      this.textBlockStarted = true;
      this.sseBuilder.sendTextBlockStart(0);
    }

    this.accumulatedContent += content;
    this.sseBuilder.sendTextDelta(content, 0);
  }

  /**
   * Process reasoning delta
   */
  processReasoning(reasoning: string): void {
    if (!this.textBlockStarted) {
      this.textBlockStarted = true;
      this.sseBuilder.sendTextBlockStart(0);
    }

    this.accumulatedReasoning += reasoning;
    this.sseBuilder.sendThinkingDelta(reasoning, 0);
  }

  /**
   * Process stream data delta
   */
  processDelta(delta: Delta): void {
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
   * Send content block stop events
   */
  sendContentBlockStops(): void {
    if (this.encounteredToolCall) {
      // Send stop for each tool call block
      Object.keys(this.toolCallAccumulators).forEach(idx => {
        this.sseBuilder.sendContentBlockStop(parseInt(idx, 10));
      });
    } else if (this.textBlockStarted) {
      // Send stop for text block
      this.sseBuilder.sendContentBlockStop(0);
    }
  }

  /**
   * Calculate output tokens
   */
  calculateOutputTokens(usage?: Usage): number {
    if (usage?.completion_tokens) {
      return usage.completion_tokens;
    }
    
    // Fallback: estimate based on word count
    const contentWords = this.accumulatedContent.split(' ').length;
    const reasoningWords = this.accumulatedReasoning.split(' ').length;
    return contentWords + reasoningWords;
  }

  /**
   * Get accumulated content state
   */
  getContentState(): {
    accumulatedContent: string;
    accumulatedReasoning: string;
    encounteredToolCall: boolean;
    toolCalls: Record<number, string> | null;
  } {
    return {
      accumulatedContent: this.accumulatedContent,
      accumulatedReasoning: this.accumulatedReasoning,
      encounteredToolCall: this.encounteredToolCall,
      toolCalls: Object.keys(this.toolCallAccumulators).length > 0 
        ? this.toolCallAccumulators 
        : null
    };
  }

  /**
   * Get stop reason based on content type
   */
  getStopReason(): string {
    return this.encounteredToolCall ? 'tool_use' : 'end_turn';
  }
}