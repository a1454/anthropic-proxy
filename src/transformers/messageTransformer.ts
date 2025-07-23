/**
 * Message transformation utilities for converting between Anthropic and OpenAI formats
 */

import type { 
  AnthropicContentBlock, 
  AnthropicSystemMessage,
  OpenRouterMessage, 
  OpenRouterToolCall,
  AnthropicRequest
} from '../types/index.js';

/**
 * Normalize a message's content.
 * If content is a string, return it directly.
 * If it's an array (of objects with text property), join them.
 */
export function normalizeContent(content: string | AnthropicContentBlock[]): string | null {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(item => item.type === 'text' && item.text)
      .map(item => item.text)
      .join(' ');
  }
  return null;
}

/**
 * Transform system messages from Anthropic format to OpenAI format
 */
export function transformSystemMessages(systemMessages?: string | AnthropicSystemMessage[]): OpenRouterMessage[] {
  const messages: OpenRouterMessage[] = [];
  
  if (typeof systemMessages === 'string') {
    messages.push({
      role: 'system',
      content: systemMessages
    });
  } else if (systemMessages && Array.isArray(systemMessages)) {
    systemMessages.forEach(sysMsg => {
      const normalized = normalizeContent(sysMsg.text);
      if (normalized) {
        messages.push({
          role: 'system',
          content: normalized
        });
      }
    });
  }
  
  return messages;
}

/**
 * Transform tool calls from Anthropic format to OpenAI format
 */
export function transformToolCalls(content: string | AnthropicContentBlock[]): OpenRouterToolCall[] {
  const contentItems = Array.isArray(content) ? content : [];
  return contentItems
    .filter((item): item is AnthropicContentBlock => 
      item.type === 'tool_use' && Boolean(item.id && item.name)
    )
    .map(toolCall => ({
      id: toolCall.id!,
      type: 'function' as const,
      function: {
        name: toolCall.name!,
        arguments: JSON.stringify(toolCall.input || {}),
      }
    }));
}

/**
 * Transform tool results from Anthropic format to OpenAI format
 */
export function transformToolResults(content: string | AnthropicContentBlock[]): OpenRouterMessage[] {
  const messages: OpenRouterMessage[] = [];
  if (Array.isArray(content)) {
    const toolResults = content.filter((item): item is AnthropicContentBlock => 
      item.type === 'tool_result' && Boolean(item.tool_use_id)
    );
    
    toolResults.forEach(toolResult => {
      let resultContent = '';
      
      if (typeof toolResult.content === 'string') {
        resultContent = toolResult.content;
      } else if (Array.isArray(toolResult.content)) {
        resultContent = normalizeContent(toolResult.content) || '';
      }
      
      messages.push({
        role: 'tool',
        content: resultContent,
        tool_call_id: toolResult.tool_use_id!,
      });
    });
  }
  return messages;
}

/**
 * Transform all messages from Anthropic format to OpenAI format
 */
export function transformMessages(payload: AnthropicRequest): OpenRouterMessage[] {
  const messages: OpenRouterMessage[] = [];

  // Add system messages
  messages.push(...transformSystemMessages(payload.system));

  // Process messages with proper tool call/result sequencing
  if (payload.messages && Array.isArray(payload.messages)) {
    const toolCallTracker = new Set<string>(); // Track tool call IDs to ensure proper pairing
    
    payload.messages.forEach(msg => {
      // Process different message types
      if (msg.role === 'assistant') {
        // Assistant messages may contain tool calls
        const toolCalls = transformToolCalls(msg.content);
        const newMsg: OpenRouterMessage = { role: msg.role, content: '' };
        const normalized = normalizeContent(msg.content);
        
        // Add text content if present
        if (normalized) newMsg.content = normalized;
        
        // Add tool calls if present and track their IDs
        if (toolCalls.length > 0) {
          newMsg.tool_calls = toolCalls;
          
          // Track tool call IDs for validation
          toolCalls.forEach(call => {
            if (call.id) {
              toolCallTracker.add(call.id);
            }
          });
        }
        
        // Only add message if it has content or tool calls
        if (newMsg.content || newMsg.tool_calls) {
          messages.push(newMsg);
        }
        
      } else if (msg.role === 'user') {
        // User messages - handle normally but check for tool results
        const toolResults = extractValidToolResults(msg.content, toolCallTracker);
        
        // Add tool results as separate tool messages ONLY if they match tracked calls
        toolResults.forEach(toolResult => {
          let resultContent = '';
          
          if (typeof toolResult.content === 'string') {
            resultContent = toolResult.content;
          } else if (Array.isArray(toolResult.content)) {
            resultContent = normalizeContent(toolResult.content) || '';
          }
          
          messages.push({
            role: 'tool',
            content: resultContent,
            tool_call_id: toolResult.tool_use_id!,
          });
          
          // Remove from tracker as it's now been handled
          toolCallTracker.delete(toolResult.tool_use_id!);
        });
        
        // Add regular user message content
        const normalized = normalizeContent(msg.content);
        if (normalized) {
          messages.push({
            role: msg.role,
            content: normalized
          });
        }
        
      } else {
        // Other message types (system, etc.) - handle normally
        const normalized = normalizeContent(msg.content);
        if (normalized) {
          messages.push({
            role: msg.role as 'system' | 'user' | 'assistant' | 'tool',
            content: normalized
          });
        }
      }
    });
  }

  return messages;
}

/**
 * Extract tool results that have corresponding tool calls
 */
function extractValidToolResults(
  content: string | AnthropicContentBlock[], 
  toolCallTracker: Set<string>
): AnthropicContentBlock[] {
  if (!Array.isArray(content)) return [];
  
  return content
    .filter((item): item is AnthropicContentBlock => 
      item.type === 'tool_result' && Boolean(item.tool_use_id)
    )
    .filter(toolResult => {
      // Only include tool results that have corresponding tool calls
      return toolResult.tool_use_id && toolCallTracker.has(toolResult.tool_use_id);
    });
}