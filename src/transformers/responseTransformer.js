/**
 * Response transformation utilities for converting OpenAI responses to Anthropic format
 */

import { mapStopReason, generateMessageId } from '../utils/sseUtils.js';

/**
 * Transform OpenAI tool calls to Anthropic format
 * @param {Array} toolCalls - OpenAI tool calls
 * @returns {Array} - Anthropic format tool calls
 */
function transformToolCallsToAnthropic(toolCalls) {
  if (!toolCalls || !Array.isArray(toolCalls)) return [];
  
  return toolCalls.map(toolCall => ({
    type: 'tool_use',
    id: toolCall.id,
    name: toolCall.function.name,
    input: JSON.parse(toolCall.function.arguments),
  }));
}

/**
 * Calculate token usage from messages or use provided usage
 * @param {Object} usage - OpenAI usage object
 * @param {Array} messages - Messages array for fallback calculation
 * @param {string} content - Response content for fallback calculation
 * @returns {Object} - Token usage object
 */
function calculateTokenUsage(usage, messages = [], content = '') {
  if (usage) {
    return {
      input_tokens: usage.prompt_tokens,
      output_tokens: usage.completion_tokens,
    };
  }
  
  // Fallback: rough estimation based on word count
  const inputTokens = messages.reduce((acc, msg) => {
    const msgContent = msg.content || '';
    return acc + msgContent.split(' ').length;
  }, 0);
  
  const outputTokens = content.split(' ').length;
  
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  };
}

/**
 * Transform OpenAI response to Anthropic format
 * @param {Object} data - OpenAI response data
 * @param {Array} messages - Original messages for token calculation
 * @param {string} model - Model used for the request
 * @returns {Object} - Anthropic format response
 */
export function transformResponse(data, messages, model) {
  const choice = data.choices[0];
  const openaiMessage = choice.message;
  const stopReason = mapStopReason(choice.finish_reason);
  const toolCalls = transformToolCallsToAnthropic(openaiMessage.tool_calls);
  const messageId = generateMessageId(data.id);
  
  const anthropicResponse = {
    content: [
      {
        text: openaiMessage.content,
        type: 'text'
      },
      ...toolCalls,
    ],
    id: messageId,
    model: model,
    role: openaiMessage.role,
    stop_reason: stopReason,
    stop_sequence: null,
    type: 'message',
    usage: calculateTokenUsage(data.usage, messages, openaiMessage.content),
  };

  return anthropicResponse;
}