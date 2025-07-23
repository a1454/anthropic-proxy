/**
 * Message transformation utilities for converting between Anthropic and OpenAI formats
 */

/**
 * Normalize a message's content.
 * If content is a string, return it directly.
 * If it's an array (of objects with text property), join them.
 * @param {string|Array} content - The content to normalize
 * @returns {string|null} - The normalized content
 */
export function normalizeContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(item => item.text).join(' ');
  }
  return null;
}

/**
 * Transform system messages from Anthropic format to OpenAI format
 * @param {Array} systemMessages - Array of system messages
 * @returns {Array} - Array of OpenAI format messages
 */
export function transformSystemMessages(systemMessages) {
  const messages = [];
  if (systemMessages && Array.isArray(systemMessages)) {
    systemMessages.forEach(sysMsg => {
      const normalized = normalizeContent(sysMsg.text || sysMsg.content);
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
 * @param {Array} content - Message content array
 * @returns {Array} - Array of OpenAI format tool calls
 */
export function transformToolCalls(content) {
  const toolCallItems = Array.isArray(content) ? content : [];
  return toolCallItems
    .filter(item => item.type === 'tool_use')
    .map(toolCall => ({
      id: toolCall.id,
      type: 'function',
      function: {
        name: toolCall.name,
        arguments: JSON.stringify(toolCall.input),
      }
    }));
}

/**
 * Transform tool results from Anthropic format to OpenAI format
 * @param {Array} content - Message content array
 * @returns {Array} - Array of OpenAI format tool result messages
 */
export function transformToolResults(content) {
  const messages = [];
  if (Array.isArray(content)) {
    const toolResults = content.filter(item => item.type === 'tool_result');
    toolResults.forEach(toolResult => {
      messages.push({
        role: 'tool',
        content: toolResult.text || toolResult.content,
        tool_call_id: toolResult.tool_use_id,
      });
    });
  }
  return messages;
}

/**
 * Transform all messages from Anthropic format to OpenAI format
 * @param {Object} payload - The Anthropic API payload
 * @returns {Array} - Array of OpenAI format messages
 */
export function transformMessages(payload) {
  const messages = [];

  // Add system messages
  messages.push(...transformSystemMessages(payload.system));

  // Process messages with proper tool call/result sequencing
  if (payload.messages && Array.isArray(payload.messages)) {
    const toolCallTracker = new Set(); // Track tool call IDs to ensure proper pairing
    
    payload.messages.forEach(msg => {
      // Process different message types
      if (msg.role === 'assistant') {
        // Assistant messages may contain tool calls
        const toolCalls = transformToolCalls(msg.content);
        const newMsg = { role: msg.role };
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
          messages.push({
            role: 'tool',
            content: toolResult.text || toolResult.content,
            tool_call_id: toolResult.tool_use_id,
          });
          
          // Remove from tracker as it's now been handled
          toolCallTracker.delete(toolResult.tool_use_id);
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
            role: msg.role,
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
 * @param {Array} content - Message content array
 * @param {Set} toolCallTracker - Set of valid tool call IDs
 * @returns {Array} - Array of valid tool results
 */
function extractValidToolResults(content, toolCallTracker) {
  if (!Array.isArray(content)) return [];
  
  return content
    .filter(item => item.type === 'tool_result')
    .filter(toolResult => {
      // Only include tool results that have corresponding tool calls
      return toolResult.tool_use_id && toolCallTracker.has(toolResult.tool_use_id);
    });
}