# Anthropic Proxy Server - Master TODO

## 1. Configuration System Overhaul

### 1.1 JSON-based Configuration
1. [x] Create `config.json` schema for all configuration options
2. [x] Implement configuration loader that reads JSON on app boot
3. [x] Add configuration validation with proper error messages
4. [x] Support environment variable overrides for sensitive data (API keys)
5. [ ] Add configuration hot-reload capability (optional)

### 1.2 Model Mapping System
6. [ ] Implement Anthropic model name → OpenRouter model mapping
7. [ ] Support custom model aliases defined by users
8. [ ] Default mappings for common Anthropic model names
9. [ ] Fallback logic when requested model is not available

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
1. [ ] Convert project to TypeScript
2. [ ] Set up proper tsconfig.json with strict type checking
3. [ ] Install necessary type dependencies (@types/node, etc.)
4. [ ] Create comprehensive type definitions

### 2.2 Type Definitions Needed
5. [ ] `AnthropicRequest` - Incoming request format
6. [ ] `OpenRouterRequest` - Outgoing request format
7. [ ] `ModelConfig` - Model configuration structure
8. [ ] `StreamingState` - Streaming state machine types
9. [ ] `ProxyConfig` - Global configuration types
10. [ ] `LogEntry` - Logging structure types

### 2.3 Generic Types
11. [ ] Request/Response transformation types
12. [ ] Error handling types with proper error codes
13. [ ] Streaming event types (SSE format)

## 3. Thinking Flag & Model Selection Separation

### 3.1 Proper Thinking Flag Handling
14. [ ] Separate thinking flag from model selection logic
15. [ ] Implement per-model thinking support configuration
16. [ ] Add validation: reject thinking=true for models that don't support it
17. [ ] Handle thinking flag in OpenRouter request format

### 3.2 Model Selection Logic
18. [ ] Implement model mapping resolver
19. [ ] Add model validation (exists, enabled, within token limits)
20. [ ] Fallback model selection when requested model unavailable
21. [ ] Cost tracking and limits per model (optional)

## 4. Streaming Response Architecture Refactoring

### 4.1 Further Modularization
Despite recent improvements, streaming logic needs clearer boundaries:

#### 4.1.1 Dependency Injection Architecture
22. [ ] Create `StreamingHandlerFactory` for dependency injection
23. [ ] Make all streaming components injectable and testable
24. [ ] Implement proper interfaces for all components

#### 4.1.2 Additional Component Separation
25. [ ] `EventParser` - Parse incoming SSE events from OpenRouter
26. [ ] `DeltaProcessor` - Process content/tool/reasoning deltas
27. [ ] `TokenCounter` - Track and calculate token usage
28. [ ] `ErrorRecovery` - Handle and recover from streaming errors
29. [ ] `StreamValidator` - Validate streaming data integrity

#### 4.1.3 State Management Enhancement
30. [ ] Implement proper state transitions with validation
31. [ ] Add state persistence for debugging
32. [ ] Create state recovery mechanisms for interrupted streams

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
33. [ ] Test configuration loading and validation
34. [ ] Test model mapping resolution
35. [ ] Test each streaming component in isolation
36. [ ] Test error handling scenarios
37. [ ] Test thinking flag validation logic

### 5.2 Integration Tests
38. [ ] Test full request transformation pipeline
39. [ ] Test streaming response handling end-to-end
40. [ ] Test error propagation through the system
41. [ ] Test configuration hot-reload

### 5.3 Mock Infrastructure
42. [ ] Create OpenRouter API mocks for testing
43. [ ] Mock streaming response scenarios
44. [ ] Mock various error conditions
45. [ ] Create test fixtures for different model responses

## 6. Additional Improvements

### 6.1 Observability
46. [ ] Add structured metrics collection
47. [ ] Implement request tracing with correlation IDs
48. [ ] Add health check endpoints
49. [ ] Performance monitoring and alerting

### 6.2 Security & Reliability
50. [ ] Add request rate limiting per API key
51. [ ] Implement request size limits
52. [ ] Add timeout configurations
53. [ ] Input sanitization and validation
54. [ ] Secure API key handling

### 6.3 Documentation
55. [ ] API documentation with OpenAPI spec
56. [ ] Configuration guide with examples
57. [ ] Deployment guide
58. [ ] Troubleshooting guide

## Implementation Priority

### Phase 1: Foundation (Weeks 1-2)
59. Configuration system with JSON support
60. TypeScript migration
61. Basic type definitions

### Phase 2: Core Logic (Weeks 3-4)
62. Model mapping system
63. Thinking flag separation
64. Enhanced streaming architecture

### Phase 3: Quality & Testing (Weeks 5-6)
65. Comprehensive testing suite
66. Unit tests for all components
67. Integration tests

### Phase 4: Production Readiness (Week 7)
68. Observability and monitoring
69. Security enhancements
70. Documentation

## Notes
- Each component should be designed with testability in mind
- All configuration should be externalized and validated
- Error handling should provide clear, actionable messages
- The system should gracefully degrade when models are unavailable
- Performance should be measured and optimized throughout