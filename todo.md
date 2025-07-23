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

### 2.1 Foundation Setup ✅ COMPLETED
1. [x] Convert project infrastructure to TypeScript
2. [x] Set up proper tsconfig.json with strict type checking
3. [x] Install necessary type dependencies (@types/node, etc.)
4. [x] Create comprehensive type definitions
5. [x] Migrate utility files (errorHandler, logger, sseUtils, requestLogger, schemaUtils)
6. [x] Migrate configuration files (config, configLoader)
7. [x] Migrate transformer files (messageTransformer, requestTransformer)

### 2.2 Remaining File Migration ✅ COMPLETED
8. [x] Migrate `index.js` to `index.ts` - Entry point
9. [x] Migrate `src/handlers/requestHandler.js` - Main request orchestration
10. [x] Migrate `src/handlers/streamingHandler.js` - Streaming entry point
11. [x] Migrate `src/handlers/nonStreamingHandler.js` - Non-streaming responses
12. [x] Migrate remaining streaming components:
   - [x] `src/handlers/streaming/ContentProcessor.js`
   - [x] `src/handlers/streaming/StreamStateManager.js` 
   - [x] `src/handlers/streaming/StreamingResponseHandler.js`
   - [x] `src/handlers/streaming/index.js`
13. [x] Migrate `src/transformers/responseTransformer.js`

### 2.3 Build & Quality Assurance ✅ COMPLETED
14. [x] Fix all TypeScript compilation errors
15. [x] Fix type import/export issues (FastifyReply, etc.)
16. [x] Resolve exactOptionalPropertyTypes violations
17. [x] Remove unused type imports and variables
18. [x] Verify `npm run build` compiles successfully
19. [x] Verify `npm run typecheck` passes with no errors
21. [x] Test that compiled application runs correctly

### 2.4 Cleanup & Maintenance ✅ COMPLETED  
22. [x] Remove all unused `.js` files after successful migration
23. [x] Update import statements to reference `.ts` files correctly
25. [x] Verify all dependencies still work with TypeScript build

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

## Notes
- Each component should be designed with testability in mind
- All configuration should be externalized and validated
- Error handling should provide clear, actionable messages
- The system should gracefully degrade when models are unavailable
- Performance should be measured and optimized throughout