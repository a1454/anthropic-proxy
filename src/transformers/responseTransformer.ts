/**
 * Response transformation utilities for converting OpenAI responses to Anthropic format
 */

import { mapStopReason, generateMessageId } from '../utils/sseUtils.js';
import type { OpenAIMessage, AnthropicResponse } from '../types/index.js';

interface OpenAIToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

interface AnthropicToolCall {
  type: 'tool_use';
  id: string;
  name: string;
  input: any;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
}

interface OpenAIResponseData {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: OpenAIUsage;
}

/**
 * Transform OpenAI tool calls to Anthropic format
 */
function transformToolCallsToAnthropic(toolCalls?: OpenAIToolCall[]): AnthropicToolCall[] {
  if (!toolCalls || !Array.isArray(toolCalls)) return [];
  
  return toolCalls.map(toolCall => ({
    type: 'tool_use' as const,
    id: toolCall.id,
    name: toolCall.function.name,
    input: JSON.parse(toolCall.function.arguments),
  }));
}

/**
 * Calculate token usage from messages or use provided usage
 */
function calculateTokenUsage(
  usage?: OpenAIUsage, 
  messages: OpenAIMessage[] = [], 
  content: string = ''
): { input_tokens: number; output_tokens: number } {
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
 */
export function transformResponse(
  data: OpenAIResponseData, 
  messages: OpenAIMessage[], 
  model: string
): AnthropicResponse {
  const choice = data.choices[0];
  if (!choice) {
    throw new Error('No choices found in OpenAI response');
  }
  const openaiMessage = choice.message;
  const stopReason = mapStopReason(choice.finish_reason);
  const toolCalls = transformToolCallsToAnthropic(openaiMessage.tool_calls);
  const messageId = generateMessageId(data.id);
  
  const tokenUsage = calculateTokenUsage(data.usage, messages, openaiMessage.content);
  
  const anthropicResponse: AnthropicResponse = {
    content: [
      {
        text: openaiMessage.content,
        type: 'text'
      },
      ...toolCalls,
    ],
    id: messageId,
    model: model,
    role: 'assistant' as const,
    stop_reason: stopReason,
    type: 'message',
    usage: {
      ...tokenUsage,
      total_tokens: tokenUsage.input_tokens + tokenUsage.output_tokens
    },
  };

  return anthropicResponse;
}