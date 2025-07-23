/**
 * API-related type definitions for request/response structures
 */

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export interface AnthropicContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string | AnthropicContentBlock[];
  tool_use_id?: string;
  is_error?: boolean;
}

export interface AnthropicSystemMessage {
  type: 'text';
  text: string;
}

export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string | AnthropicSystemMessage[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  tools?: AnthropicTool[];
  tool_choice?: AnthropicToolChoice;
  metadata?: {
    user_id?: string;
  };
  thinking?: boolean;
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
}

export interface AnthropicToolChoice {
  type: 'auto' | 'any' | 'tool';
  name?: string;
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: OpenRouterToolCall[];
}

export interface OpenRouterToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// OpenAI-compatible message type (alias for OpenRouterMessage)
export type OpenAIMessage = OpenRouterMessage;

export interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop?: string[];
  stream?: boolean;
  tools?: OpenRouterTool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
  reasoning?: boolean;
}

export interface OpenRouterTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  stop_sequence?: string;
  usage: TokenUsage;
}

export interface StreamingEvent {
  type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop' | 'ping' | 'error';
  message?: Partial<AnthropicResponse>;
  content_block?: AnthropicContentBlock;
  delta?: {
    type: 'text_delta' | 'input_json_delta';
    text?: string;
    partial_json?: string;
  };
  index?: number;
  usage?: Partial<TokenUsage>;
}

export interface OpenRouterStreamingData {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
      reasoning?: string;
    };
    finish_reason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ApiError {
  type: string;
  message: string;
  code?: string;
  status?: number;
}