import fs from 'fs';
import path from 'path';
import type { 
  ProxyConfig, 
  ConfigManager, 
  ModelConfig
} from '../types/index.js';

/**
 * Configuration validation schema
 */
interface ConfigFieldSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  min?: number;
  max?: number;
}

// ConfigSchema type removed - was unused

const CONFIG_SCHEMA = {
  server: {
    port: { type: 'number', required: true, min: 1, max: 65535 }
  },
  api: {
    baseUrl: { type: 'string', required: true },
    requiresApiKey: { type: 'boolean', required: true }
  },
  models: {
    default: { type: 'string', required: true },
    reasoning: { type: 'string', required: true },
    completion: { type: 'string', required: true },
    mappings: { type: 'object', required: false },
    configs: { type: 'object', required: true }
  },
  logging: {
    logDir: { type: 'string', required: true },
    directory: { type: 'string', required: true },
    enableDebug: { type: 'boolean', required: true },
    perRequestLogging: { type: 'boolean', required: false }
  },
  tools: {
    excludedTools: { type: 'array', required: false }
  },
  debug: { type: 'boolean', required: true }
};

/**
 * Validation error class
 */
class ConfigValidationError extends Error {
  public readonly path: string;

  constructor(message: string, path: string) {
    super(message);
    this.name = 'ConfigValidationError';
    this.path = path;
  }
}

/**
 * Validate a configuration value against schema
 */
function validateValue(value: unknown, schema: ConfigFieldSchema, path: string): void {
  if (schema.required && (value === undefined || value === null)) {
    throw new ConfigValidationError(`Required field missing`, path);
  }

  if (value === undefined || value === null) {
    return; // Optional field not provided
  }

  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') {
        throw new ConfigValidationError(`Expected string, got ${typeof value}`, path);
      }
      break;
    case 'number':
      if (typeof value !== 'number') {
        throw new ConfigValidationError(`Expected number, got ${typeof value}`, path);
      }
      if (schema.min !== undefined && value < schema.min) {
        throw new ConfigValidationError(`Value ${value} is below minimum ${schema.min}`, path);
      }
      if (schema.max !== undefined && value > schema.max) {
        throw new ConfigValidationError(`Value ${value} is above maximum ${schema.max}`, path);
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new ConfigValidationError(`Expected boolean, got ${typeof value}`, path);
      }
      break;
    case 'array':
      if (!Array.isArray(value)) {
        throw new ConfigValidationError(`Expected array, got ${typeof value}`, path);
      }
      break;
    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new ConfigValidationError(`Expected object, got ${typeof value}`, path);
      }
      break;
  }
}

/**
 * Recursively validate configuration against schema
 */
function validateConfig(
  config: Record<string, unknown>, 
  schema: Record<string, unknown>, 
  basePath = ''
): void {
  for (const [key, fieldSchema] of Object.entries(schema)) {
    const currentPath = basePath ? `${basePath}.${key}` : key;
    const value = config[key];

    if (typeof fieldSchema === 'object' && fieldSchema !== null && 'type' in fieldSchema) {
      // Leaf node validation
      validateValue(value, fieldSchema as ConfigFieldSchema, currentPath);
    } else if (typeof fieldSchema === 'object' && fieldSchema !== null) {
      // Nested object validation
      if (value && typeof value === 'object') {
        validateConfig(
          value as Record<string, unknown>, 
          fieldSchema as Record<string, unknown>, 
          currentPath
        );
      }
    }
  }
}

/**
 * Apply environment variable overrides
 */
function applyEnvironmentOverrides(config: ProxyConfig): ProxyConfig {
  const result = { ...config };

  // Server configuration
  if (process.env.PORT) {
    result.server.port = parseInt(process.env.PORT, 10);
  }

  // API configuration
  if (process.env.ANTHROPIC_PROXY_BASE_URL) {
    result.api.baseUrl = process.env.ANTHROPIC_PROXY_BASE_URL;
    result.api.requiresApiKey = false;
  }

  // Model configuration
  if (process.env.REASONING_MODEL) {
    result.models.reasoning = process.env.REASONING_MODEL;
  }
  if (process.env.COMPLETION_MODEL) {
    result.models.completion = process.env.COMPLETION_MODEL;
  }

  // Logging configuration
  if (process.env.DEBUG) {
    result.debug = !!process.env.DEBUG;
    result.logging.enableDebug = !!process.env.DEBUG;
  }

  return result;
}

/**
 * Load and validate configuration from JSON file
 */
export function loadConfig(configPath = 'config.json'): ProxyConfig {
  try {
    // Find config file path
    const fullPath = path.resolve(configPath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Configuration file not found: ${fullPath}`);
    }

    // Read and parse JSON
    const configData = fs.readFileSync(fullPath, 'utf8');
    let config: unknown;
    
    try {
      config = JSON.parse(configData);
    } catch (parseError) {
      const error = parseError as Error;
      throw new Error(`Invalid JSON in configuration file: ${error.message}`);
    }

    // Apply environment variable overrides
    const configWithOverrides = applyEnvironmentOverrides(config as ProxyConfig);

    // Validate configuration
    validateConfig(configWithOverrides as any, CONFIG_SCHEMA);

    // Additional business logic validation
    validateModelConfigs(configWithOverrides);

    return configWithOverrides;
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      throw new Error(`Configuration validation failed at ${error.path}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate model-specific configurations
 */
function validateModelConfigs(config: ProxyConfig): void {
  const { models } = config;

  // Check that default models exist in configs
  if (!models.configs[models.default]) {
    throw new ConfigValidationError(`Default model '${models.default}' not found in model configs`, 'models.default');
  }
  if (!models.configs[models.reasoning]) {
    throw new ConfigValidationError(`Reasoning model '${models.reasoning}' not found in model configs`, 'models.reasoning');
  }
  if (!models.configs[models.completion]) {
    throw new ConfigValidationError(`Completion model '${models.completion}' not found in model configs`, 'models.completion');
  }

  // Validate model mappings point to existing configs
  if (models.mappings) {
    for (const [mappedName, targetModel] of Object.entries(models.mappings)) {
      if (typeof targetModel === 'string' && !models.configs[targetModel]) {
        throw new ConfigValidationError(`Mapped model '${targetModel}' for '${mappedName}' not found in model configs`, `models.mappings.${mappedName}`);
      }
    }
  }

  // Validate individual model configs
  for (const [modelName, modelConfig] of Object.entries(models.configs)) {
    const config = modelConfig as ModelConfig;
    
    if (typeof config.supportsThinking !== 'boolean') {
      throw new ConfigValidationError(`Model '${modelName}' must have boolean 'supportsThinking' field`, `models.configs.${modelName}.supportsThinking`);
    }
    
    if (config.maxTokens !== undefined && (typeof config.maxTokens !== 'number' || config.maxTokens <= 0)) {
      throw new ConfigValidationError(`Model '${modelName}' must have positive 'maxTokens' field`, `models.configs.${modelName}.maxTokens`);
    }
  }
}

/**
 * Create a configuration manager with helper methods
 */
export function createConfigManager(config: ProxyConfig): ConfigManager {
  return {
    config,

    /**
     * Get the appropriate model based on request type
     */
    getModel(thinking: boolean): string {
      return thinking ? config.models.reasoning : config.models.completion;
    },

    /**
     * Resolve model name through mappings
     */
    resolveModel(modelName: string): string {
      const mapping = config.models.mappings?.[modelName];
      if (typeof mapping === 'string') {
        return mapping;
      } else if (mapping && typeof mapping === 'object' && 'openRouterModel' in mapping) {
        return (mapping as ModelConfig).openRouterModel;
      }
      return modelName;
    },

    /**
     * Get model configuration
     */
    getModelConfig(modelName: string): ModelConfig | null {
      const resolvedName = this.resolveModel(modelName);
      const modelConfig = config.models.configs[resolvedName];
      
      if (typeof modelConfig === 'string') {
        // Simple string mapping, create a basic config
        return {
          openRouterModel: modelConfig,
          supportsThinking: false
        };
      }
      
      return modelConfig as ModelConfig || null;
    },

    /**
     * Check if model supports thinking
     */
    supportsThinking(modelName: string): boolean {
      const modelConfig = this.getModelConfig(modelName);
      return modelConfig?.supportsThinking || false;
    },

    /**
     * Get HTTP headers for OpenRouter requests
     */
    getHeaders(): Record<string, string> {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (config.api.requiresApiKey) {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          throw new Error('OPENROUTER_API_KEY environment variable is required when requiresApiKey is true');
        }
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      
      return headers;
    },

    /**
     * Validate configuration
     */
    validateConfig(): void {
      validateConfig(config as any, CONFIG_SCHEMA as any);
      validateModelConfigs(config);
    }
  };
}