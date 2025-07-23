/**
 * Configuration settings for the Anthropic proxy server
 * This module now loads configuration from JSON with environment overrides
 */

import { loadConfig, createConfigManager } from './configLoader.js';

let configManager;

try {
  const rawConfig = loadConfig();
  configManager = createConfigManager(rawConfig);
} catch (error) {
  console.error('Failed to load configuration:', error.message);
  process.exit(1);
}

export const config = configManager.config;
export const manager = configManager;

/**
 * Get the appropriate model based on request type
 * @param {boolean} thinking - Whether this is a reasoning request
 * @returns {string} - The model to use
 */
export function getModel(thinking) {
  return configManager.getModel(thinking);
}

/**
 * Get HTTP headers for OpenRouter requests
 * @returns {Object} - Headers object
 */
export function getHeaders() {
  return configManager.getHeaders();
}

/**
 * Resolve model name through mappings
 * @param {string} modelName - Original model name
 * @returns {string} - Resolved model name
 */
export function resolveModel(modelName) {
  return configManager.resolveModel(modelName);
}

/**
 * Get model configuration
 * @param {string} modelName - Model name
 * @returns {Object} - Model configuration
 */
export function getModelConfig(modelName) {
  return configManager.getModelConfig(modelName);
}

/**
 * Check if model supports thinking
 * @param {string} modelName - Model name
 * @returns {boolean} - Whether model supports thinking
 */
export function supportsThinking(modelName) {
  return configManager.supportsThinking(modelName);
}