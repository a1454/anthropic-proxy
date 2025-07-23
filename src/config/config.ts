/**
 * Configuration settings for the Anthropic proxy server
 * This module now loads configuration from JSON with environment overrides
 */

import { loadConfig, createConfigManager } from './configLoader.js';
import type { ProxyConfig, ConfigManager, ModelConfig } from '../types/index.js';

let configManager: ConfigManager;

try {
  const rawConfig = loadConfig();
  configManager = createConfigManager(rawConfig);
} catch (error) {
  const err = error as Error;
  console.error('Failed to load configuration:', err.message);
  process.exit(1);
}

export const config: ProxyConfig = configManager.config;
export const manager: ConfigManager = configManager;

/**
 * Get the appropriate model based on request type
 */
export function getModel(thinking: boolean): string {
  return configManager.getModel(thinking);
}

/**
 * Get HTTP headers for OpenRouter requests
 */
export function getHeaders(): Record<string, string> {
  return configManager.getHeaders();
}

/**
 * Resolve model name through mappings
 */
export function resolveModel(modelName: string): string {
  return configManager.resolveModel(modelName);
}

/**
 * Get model configuration
 */
export function getModelConfig(modelName: string): ModelConfig | null {
  return configManager.getModelConfig(modelName);
}

/**
 * Check if model supports thinking
 */
export function supportsThinking(modelName: string): boolean {
  return configManager.supportsThinking(modelName);
}