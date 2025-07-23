/**
 * Content processor for different types of streaming content
 */

export class ContentProcessor {
  constructor(sseBuilder, logger) {
    this.sseBuilder = sseBuilder;
    this.logger = logger;
    
    // State tracking
    this.textBlockStarted = false;
    this.encounteredToolCall = false;
    this.toolCallAccumulators = {};
    
    // Accumulated content
    this.accumulatedContent = '';
    this.accumulatedReasoning = '';
  }

  /**
   * Process tool call delta
   * @param {Object} toolCall - Tool call data
   */
  processToolCall(toolCall) {
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
   * @param {string} content - Content delta
   */
  processContent(content) {
    if (!this.textBlockStarted) {
      this.textBlockStarted = true;
      this.sseBuilder.sendTextBlockStart(0);
    }

    this.accumulatedContent += content;
    this.sseBuilder.sendTextDelta(content, 0);
  }

  /**
   * Process reasoning delta
   * @param {string} reasoning - Reasoning delta
   */
  processReasoning(reasoning) {
    if (!this.textBlockStarted) {
      this.textBlockStarted = true;
      this.sseBuilder.sendTextBlockStart(0);
    }

    this.accumulatedReasoning += reasoning;
    this.sseBuilder.sendThinkingDelta(reasoning, 0);
  }

  /**
   * Process stream data delta
   * @param {Object} delta - Delta object from OpenRouter
   */
  processDelta(delta) {
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
  sendContentBlockStops() {
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
   * @param {Object} usage - Usage data from API
   * @returns {number} - Output token count
   */
  calculateOutputTokens(usage) {
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
   * @returns {Object} - Content state
   */
  getContentState() {
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
   * @returns {string} - Stop reason
   */
  getStopReason() {
    return this.encounteredToolCall ? 'tool_use' : 'end_turn';
  }
}