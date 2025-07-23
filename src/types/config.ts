/**
 * Configuration-related type definitions
 */

export interface ProxyConfig {
  server: ServerConfig;
  api: ApiConfig;
  models: {
    default: string;
    reasoning: string;
    completion: string;
    mappings?: ModelMappings;
    configs: Record<string, ModelConfig>;
  };
  logging: LoggingConfig;
  debug: boolean;
  tools?: {
    excludedTools?: string[];
  };
}

export interface ServerConfig {
  port: number;
  host?: string;
  timeout?: number;
}

export interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
  requiresApiKey: boolean;
  timeout?: number;
  retries?: number;
}

export interface ModelMappings {
  [anthropicModel: string]: string | ModelConfig;
}

export interface ModelConfig {
  openRouterModel: string;
  supportsThinking: boolean;
  maxTokens?: number;
  description?: string;
  contextWindow?: number;
  priceInput?: number;
  priceOutput?: number;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  directory: string;
  logDir: string;
  maxFiles?: number;
  maxSize?: string;
  requestLogging: boolean;
  enableDebug: boolean;
  perRequestLogging?: boolean;
}

export interface ConfigManager {
  config: ProxyConfig;
  getModel(thinking: boolean): string;
  getHeaders(): Record<string, string>;
  resolveModel(modelName: string): string;
  getModelConfig(modelName: string): ModelConfig | null;
  supportsThinking(modelName: string): boolean;
  validateConfig(): void;
}

export interface ConfigValidationError {
  field: string;
  message: string;
  value?: unknown;
}