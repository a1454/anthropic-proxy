# Anthropic Proxy Server - Architecture Overhaul TODO

## Overview
The current implementation has several architectural issues that need to be addressed for a production-ready proxy server. This document outlines the major refactoring tasks needed.

## 1. Configuration System Overhaul

### 1.1 JSON-based Configuration
- [ ] Create `config.json` schema for all configuration options
- [ ] Implement configuration loader that reads JSON on app boot
- [ ] Add configuration validation with proper error messages
- [ ] Support environment variable overrides for sensitive data (API keys)
- [ ] Add configuration hot-reload capability (optional)

### 1.2 Model Configuration Schema
```json
{
  "models": {
    "google/gemini-2.5-pro": {
      "enabled": true,
      "maxTokens": 8192,
      "supportsThinking": true,
      "costPer1kTokens": 0.00125,
      "description": "Google's Gemini 2.5 Pro model"
    },
    "anthropic/claude-3.5-sonnet": {
      "enabled": true,
      "maxTokens": 4096,
      "supportsThinking": false,
      "costPer1kTokens": 0.003
    }
  }
}
```

### 1.3 Model Mapping System
- [ ] Implement Anthropic model name → OpenRouter model mapping
- [ ] Support custom model aliases defined by users
- [ ] Default mappings for common Anthropic model names
- [ ] Fallback logic when requested model is not available

Example mapping:
```json
{
  "modelMappings": {
    "claude-3-5-sonnet-20241022": "anthropic/claude-3.5-sonnet",
    "claude-3-opus-20240229": "anthropic/claude-3-opus"
  }
}
```

## 2. TypeScript Migration

### 2.1 Core Infrastructure
- [ ] Convert project to TypeScript
- [ ] Set up proper tsconfig.json with strict type checking
- [ ] Install necessary type dependencies (@types/node, etc.)
- [ ] Create comprehensive type definitions

### 2.2 Type Definitions Needed
- [ ] `AnthropicRequest` - Incoming request format
- [ ] `OpenRouterRequest` - Outgoing request format
- [ ] `ModelConfig` - Model configuration structure
- [ ] `StreamingState` - Streaming state machine types
- [ ] `ProxyConfig` - Global configuration types
- [ ] `LogEntry` - Logging structure types

### 2.3 Generic Types
- [ ] Request/Response transformation types
- [ ] Error handling types with proper error codes
- [ ] Streaming event types (SSE format)

## 3. Thinking Flag & Model Selection Separation

### 3.1 Proper Thinking Flag Handling
- [ ] Separate thinking flag from model selection logic
- [ ] Implement per-model thinking support configuration
- [ ] Add validation: reject thinking=true for models that don't support it
- [ ] Handle thinking flag in OpenRouter request format

### 3.2 Model Selection Logic
- [ ] Implement model mapping resolver
- [ ] Add model validation (exists, enabled, within token limits)
- [ ] Fallback model selection when requested model unavailable
- [ ] Cost tracking and limits per model (optional)

## 4. Streaming Response Architecture Refactoring

### 4.1 Further Modularization
Despite recent improvements, streaming logic needs clearer boundaries:

#### 4.1.1 Dependency Injection Architecture
- [ ] Create `StreamingHandlerFactory` for dependency injection
- [ ] Make all streaming components injectable and testable
- [ ] Implement proper interfaces for all components

#### 4.1.2 Additional Component Separation
- [ ] `EventParser` - Parse incoming SSE events from OpenRouter
- [ ] `DeltaProcessor` - Process content/tool/reasoning deltas
- [ ] `TokenCounter` - Track and calculate token usage
- [ ] `ErrorRecovery` - Handle and recover from streaming errors
- [ ] `StreamValidator` - Validate streaming data integrity

#### 4.1.3 State Management Enhancement
- [ ] Implement proper state transitions with validation
- [ ] Add state persistence for debugging
- [ ] Create state recovery mechanisms for interrupted streams

### 4.2 Streaming Component Interfaces
```typescript
interface IEventParser {
  parseSSEEvent(chunk: string): StreamingEvent | null;
}

interface IDeltaProcessor {
  processDelta(delta: OpenRouterDelta): AnthropicEvent[];
}

interface ITokenCounter {
  trackTokens(content: string): void;
  getUsage(): TokenUsage;
}
```

## 5. Comprehensive Testing Suite

### 5.1 Unit Tests
- [ ] Test configuration loading and validation
- [ ] Test model mapping resolution
- [ ] Test each streaming component in isolation
- [ ] Test error handling scenarios
- [ ] Test thinking flag validation logic

### 5.2 Integration Tests
- [ ] Test full request transformation pipeline
- [ ] Test streaming response handling end-to-end
- [ ] Test error propagation through the system
- [ ] Test configuration hot-reload

### 5.3 Mock Infrastructure
- [ ] Create OpenRouter API mocks for testing
- [ ] Mock streaming response scenarios
- [ ] Mock various error conditions
- [ ] Create test fixtures for different model responses

## 6. Additional Improvements

### 6.1 Observability
- [ ] Add structured metrics collection
- [ ] Implement request tracing with correlation IDs
- [ ] Add health check endpoints
- [ ] Performance monitoring and alerting

### 6.2 Security & Reliability
- [ ] Add request rate limiting per API key
- [ ] Implement request size limits
- [ ] Add timeout configurations
- [ ] Input sanitization and validation
- [ ] Secure API key handling

### 6.3 Documentation
- [ ] API documentation with OpenAPI spec
- [ ] Configuration guide with examples
- [ ] Deployment guide
- [ ] Troubleshooting guide

## Implementation Priority

### Phase 1: Foundation (Weeks 1-2)
1. Configuration system with JSON support
2. TypeScript migration
3. Basic type definitions

### Phase 2: Core Logic (Weeks 3-4)
4. Model mapping system
5. Thinking flag separation
6. Enhanced streaming architecture

### Phase 3: Quality & Testing (Weeks 5-6)
7. Comprehensive testing suite
8. Unit tests for all components
9. Integration tests

### Phase 4: Production Readiness (Week 7)
10. Observability and monitoring
11. Security enhancements
12. Documentation

## Notes
- Each component should be designed with testability in mind
- All configuration should be externalized and validated
- Error handling should provide clear, actionable messages
- The system should gracefully degrade when models are unavailable
- Performance should be measured and optimized throughout