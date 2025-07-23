/**
 * Request transformation utilities for converting Anthropic requests to OpenAI format
 */

import { transformMessages } from './messageTransformer.js';
import { removeUriFormat } from '../utils/schemaUtils.js';
import { config, getModel } from '../config/config.js';

/**
 * Transform tools from Anthropic format to OpenAI format
 * @param {Array} tools - Array of Anthropic tools
 * @returns {Array} - Array of OpenAI format tools
 */
function transformTools(tools) {
  if (!tools || !Array.isArray(tools)) return [];
  
  return tools
    .filter(tool => !config.excludedTools.includes(tool.name))
    .map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: removeUriFormat(tool.input_schema),
      },
    }));
}

/**
 * Transform Anthropic request payload to OpenAI format
 * @param {Object} payload - Anthropic API request payload
 * @returns {Object} - OpenAI API request payload
 */
export function transformRequest(payload) {
  const messages = transformMessages(payload);
  const tools = transformTools(payload.tools);
  
  const openaiPayload = {
    model: getModel(payload.thinking),
    messages,
    max_tokens: payload.max_tokens,
    temperature: payload.temperature !== undefined ? payload.temperature : 1,
    stream: payload.stream === true,
  };
  
  if (tools.length > 0) {
    openaiPayload.tools = tools;
  }
  
  return openaiPayload;
}