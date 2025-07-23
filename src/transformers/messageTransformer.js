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
      function: {
        type: 'function',
        id: toolCall.id,
        function: {
          name: toolCall.name,
          parameters: toolCall.input,
        },
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

  // Add user and other messages
  if (payload.messages && Array.isArray(payload.messages)) {
    payload.messages.forEach(msg => {
      const toolCalls = transformToolCalls(msg.content);
      const newMsg = { role: msg.role };
      const normalized = normalizeContent(msg.content);
      
      if (normalized) newMsg.content = normalized;
      if (toolCalls.length > 0) newMsg.tool_calls = toolCalls;
      if (newMsg.content || newMsg.tool_calls) messages.push(newMsg);

      // Add tool results as separate messages
      messages.push(...transformToolResults(msg.content));
    });
  }

  return messages;
}