/**
 * Request transformation utilities for converting Anthropic requests to OpenAI format
 */

import { transformMessages } from './messageTransformer.js';
import { convertToolSchema } from '../utils/schemaUtils.js';
import { config, getModel } from '../config/config.js';
import type { 
  AnthropicRequest, 
  OpenRouterRequest, 
  AnthropicTool,
  OpenRouterTool
} from '../types/index.js';

/**
 * Transform tools from Anthropic format to OpenAI format
 */
function transformTools(tools?: AnthropicTool[]): OpenRouterTool[] {
  if (!tools || !Array.isArray(tools)) return [];
  
  return tools
    .filter(tool => !config.tools?.excludedTools?.includes(tool.name))
    .map(tool => convertToolSchema(tool));
}

/**
 * Transform tool choice from Anthropic format to OpenRouter format
 */
function transformToolChoice(
  toolChoice?: { type: 'auto' | 'any' | 'tool'; name?: string }
): OpenRouterRequest['tool_choice'] {
  if (!toolChoice) return undefined;
  
  switch (toolChoice.type) {
    case 'auto':
      return 'auto';
    case 'any':
      return 'auto'; // OpenRouter doesn't have 'any', use 'auto'
    case 'tool':
      return toolChoice.name ? {
        type: 'function',
        function: { name: toolChoice.name }
      } : 'auto';
    default:
      return 'auto';
  }
}

/**
 * Transform Anthropic request payload to OpenAI format
 */
export function transformRequest(payload: AnthropicRequest): OpenRouterRequest {
  const messages = transformMessages(payload);
  const tools = transformTools(payload.tools);
  
  const openaiPayload: OpenRouterRequest = {
    model: getModel(payload.thinking || false),
    messages,
    max_tokens: payload.max_tokens,
    temperature: payload.temperature !== undefined ? payload.temperature : 1,
    stream: payload.stream === true,
  };
  
  // Add optional parameters if present
  if (payload.top_p !== undefined) {
    openaiPayload.top_p = payload.top_p;
  }
  
  if (payload.top_k !== undefined) {
    openaiPayload.top_k = payload.top_k;
  }
  
  if (payload.stop_sequences && payload.stop_sequences.length > 0) {
    openaiPayload.stop = payload.stop_sequences;
  }
  
  if (tools.length > 0) {
    openaiPayload.tools = tools;
    const toolChoice = transformToolChoice(payload.tool_choice);
    if (toolChoice !== undefined) {
      openaiPayload.tool_choice = toolChoice;
    }
  }
  
  // Handle reasoning/thinking flag
  if (payload.thinking) {
    openaiPayload.reasoning = true;
  }
  
  return openaiPayload;
}

/**
 * Validate Anthropic request payload
 */
export function validateAnthropicRequest(payload: unknown): payload is AnthropicRequest {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  
  const request = payload as Record<string, unknown>;
  
  // Check required fields
  if (typeof request.model !== 'string') return false;
  if (typeof request.max_tokens !== 'number' || request.max_tokens <= 0) return false;
  if (!Array.isArray(request.messages)) return false;
  
  // Validate messages structure
  for (const message of request.messages) {
    if (typeof message !== 'object' || message === null) return false;
    const msg = message as Record<string, unknown>;
    
    if (!['user', 'assistant'].includes(msg.role as string)) return false;
    if (typeof msg.content !== 'string' && !Array.isArray(msg.content)) return false;
  }
  
  return true;
}

/**
 * Get request size in bytes for logging/metrics
 */
export function getRequestSize(payload: AnthropicRequest): number {
  return Buffer.byteLength(JSON.stringify(payload), 'utf8');
}

/**
 * Extract metadata from request for logging
 */
export function extractRequestMetadata(payload: AnthropicRequest): {
  model: string;
  thinking: boolean;
  streaming: boolean;
  messageCount: number;
  toolCount: number;
  maxTokens: number;
} {
  return {
    model: payload.model,
    thinking: payload.thinking || false,
    streaming: payload.stream || false,
    messageCount: payload.messages?.length || 0,
    toolCount: payload.tools?.length || 0,
    maxTokens: payload.max_tokens
  };
}