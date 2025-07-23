/**
 * Configuration settings for the Anthropic proxy server
 */

export const config = {
  // Server configuration
  port: process.env.PORT || 3000,
  
  // API configuration  
  baseUrl: process.env.ANTHROPIC_PROXY_BASE_URL || 'https://openrouter.ai/api',
  requiresApiKey: !process.env.ANTHROPIC_PROXY_BASE_URL,
  key: !process.env.ANTHROPIC_PROXY_BASE_URL ? process.env.OPENROUTER_API_KEY : null,
  
  // Model configuration
  defaultModel: 'google/gemini-2.5-pro',
  models: {
    reasoning: process.env.REASONING_MODEL || 'google/gemini-2.5-pro',
    completion: process.env.COMPLETION_MODEL || 'google/gemini-2.5-pro',
  },
  
  // Logging configuration
  logDir: 'log',
  enableDebug: !!process.env.DEBUG,
  
  // Tool configuration
  excludedTools: ['BatchTool'],
};

/**
 * Get the appropriate model based on request type
 * @param {boolean} thinking - Whether this is a reasoning request
 * @returns {string} - The model to use
 */
export function getModel(thinking) {
  return thinking ? config.models.reasoning : config.models.completion;
}

/**
 * Get HTTP headers for OpenRouter requests
 * @returns {Object} - Headers object
 */
export function getHeaders() {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (config.requiresApiKey) {
    headers['Authorization'] = `Bearer ${config.key}`;
  }
  
  return headers;
}