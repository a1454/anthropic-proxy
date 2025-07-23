import fs from 'fs';
import path from 'path';

/**
 * Configuration validation schema
 */
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
    enableDebug: { type: 'boolean', required: true },
    perRequestLogging: { type: 'boolean', required: false }
  },
  tools: {
    excludedTools: { type: 'array', required: false }
  }
};

/**
 * Validation error class
 */
class ConfigValidationError extends Error {
  constructor(message, path) {
    super(message);
    this.name = 'ConfigValidationError';
    this.path = path;
  }
}

/**
 * Validate a configuration value against schema
 */
function validateValue(value, schema, path) {
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
function validateConfig(config, schema, basePath = '') {
  for (const [key, fieldSchema] of Object.entries(schema)) {
    const currentPath = basePath ? `${basePath}.${key}` : key;
    const value = config[key];

    if (typeof fieldSchema === 'object' && fieldSchema.type) {
      // Leaf node validation
      validateValue(value, fieldSchema, currentPath);
    } else {
      // Nested object validation
      if (value && typeof value === 'object') {
        validateConfig(value, fieldSchema, currentPath);
      }
    }
  }
}

/**
 * Apply environment variable overrides
 */
function applyEnvironmentOverrides(config) {
  // Server configuration
  if (process.env.PORT) {
    config.server.port = parseInt(process.env.PORT, 10);
  }

  // API configuration
  if (process.env.ANTHROPIC_PROXY_BASE_URL) {
    config.api.baseUrl = process.env.ANTHROPIC_PROXY_BASE_URL;
    config.api.requiresApiKey = false;
  }

  // Model configuration
  if (process.env.REASONING_MODEL) {
    config.models.reasoning = process.env.REASONING_MODEL;
  }
  if (process.env.COMPLETION_MODEL) {
    config.models.completion = process.env.COMPLETION_MODEL;
  }

  // Logging configuration
  if (process.env.DEBUG) {
    config.logging.enableDebug = !!process.env.DEBUG;
  }

  return config;
}

/**
 * Load and validate configuration from JSON file
 */
export function loadConfig(configPath = 'config.json') {
  try {
    // Find config file path
    const fullPath = path.resolve(configPath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Configuration file not found: ${fullPath}`);
    }

    // Read and parse JSON
    const configData = fs.readFileSync(fullPath, 'utf8');
    let config;
    
    try {
      config = JSON.parse(configData);
    } catch (parseError) {
      throw new Error(`Invalid JSON in configuration file: ${parseError.message}`);
    }

    // Apply environment variable overrides
    config = applyEnvironmentOverrides(config);

    // Validate configuration
    validateConfig(config, CONFIG_SCHEMA);

    // Additional business logic validation
    validateModelConfigs(config);

    return config;
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
function validateModelConfigs(config) {
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
      if (!models.configs[targetModel]) {
        throw new ConfigValidationError(`Mapped model '${targetModel}' for '${mappedName}' not found in model configs`, `models.mappings.${mappedName}`);
      }
    }
  }

  // Validate individual model configs
  for (const [modelName, modelConfig] of Object.entries(models.configs)) {
    if (typeof modelConfig.enabled !== 'boolean') {
      throw new ConfigValidationError(`Model '${modelName}' must have boolean 'enabled' field`, `models.configs.${modelName}.enabled`);
    }
    if (typeof modelConfig.maxTokens !== 'number' || modelConfig.maxTokens <= 0) {
      throw new ConfigValidationError(`Model '${modelName}' must have positive 'maxTokens' field`, `models.configs.${modelName}.maxTokens`);
    }
    if (typeof modelConfig.supportsThinking !== 'boolean') {
      throw new ConfigValidationError(`Model '${modelName}' must have boolean 'supportsThinking' field`, `models.configs.${modelName}.supportsThinking`);
    }
  }
}

/**
 * Create a configuration manager with helper methods
 */
export function createConfigManager(config) {
  return {
    config,

    /**
     * Get the appropriate model based on request type
     */
    getModel(thinking) {
      return thinking ? config.models.reasoning : config.models.completion;
    },

    /**
     * Resolve model name through mappings
     */
    resolveModel(modelName) {
      return config.models.mappings?.[modelName] || modelName;
    },

    /**
     * Get model configuration
     */
    getModelConfig(modelName) {
      const resolvedName = this.resolveModel(modelName);
      return config.models.configs[resolvedName];
    },

    /**
     * Check if model supports thinking
     */
    supportsThinking(modelName) {
      const modelConfig = this.getModelConfig(modelName);
      return modelConfig?.supportsThinking || false;
    },

    /**
     * Get HTTP headers for OpenRouter requests
     */
    getHeaders() {
      const headers = {
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
     * Get all enabled models
     */
    getEnabledModels() {
      return Object.entries(config.models.configs)
        .filter(([, modelConfig]) => modelConfig.enabled)
        .map(([modelName]) => modelName);
    }
  };
}