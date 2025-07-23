# CLAUDE.md - Anthropic Proxy Server

## Project Overview
This is a Node.js proxy server that converts Anthropic Claude API requests to OpenAI format and forwards them to OpenRouter.ai. The server handles both streaming and non-streaming requests with comprehensive logging and error handling.

## Architecture
The codebase follows a modular architecture with clear separation of concerns:

- **index.js**: Minimal Fastify server setup (29 lines)
- **src/handlers/**: Request orchestration and response handling
- **src/transformers/**: Message and request format conversion
- **src/utils/**: Logging, error handling, and utility functions
- **src/config/**: Configuration management

## Key Components

### Request Flow
1. Client sends Anthropic-format request to `/v1/messages`
2. `requestHandler.js` generates unique request ID and creates per-request logger
3. `messageTransformer.js` converts Anthropic messages to OpenAI format
4. `requestTransformer.js` transforms full request payload
5. Request forwarded to OpenRouter.ai
6. Response handled by streaming or non-streaming handler
7. Per-request log file closed and resources cleaned up

### Critical Architecture Patterns

#### Per-Request Logging System
- Each request gets unique ID: `req-YYYYMMDD-HHMMSS-SEQ`
- Creates directory structure: `log/requests/YYYY-MM-DD/`
- Individual log file per request for complete lifecycle tracking
- Logger automatically closed in finally block

#### Tool Call/Result Sequencing
The `messageTransformer.js` contains critical logic for proper tool call/result pairing:
- Uses `toolCallTracker` Set to track valid tool call IDs
- Only includes tool results that have corresponding tool calls
- Prevents OpenRouter errors about mismatched function calls/results

#### State Machine Streaming Handler
`streamingHandler.js` uses state machine pattern:
- States: INITIALIZING, STREAMING, FINALIZING, COMPLETED, ERROR
- Handles SSE conversion from OpenRouter to Anthropic format
- Accumulates content and reasoning deltas

#### Structured Error Handling
- `ProxyError` class with contextual information
- Centralized error logging in `handleRouteError()`
- Rich error context through `withContext()` method

## Development Commands

### Required Commands (add to package.json if missing)
```bash
npm run lint    # ESLint for code quality
npm run typecheck  # TypeScript checking (if applicable)
npm test       # Run test suite
```

### Server Operations
```bash
npm start      # Start production server
```

## Configuration
Environment variables in `src/config/config.js`:
- `PORT`: Server port (default: 3000)
- `ANTHROPIC_PROXY_BASE_URL`: OpenRouter base URL
- `OPENROUTER_API_KEY`: Required for OpenRouter authentication
- `REASONING_MODEL`: Model for thinking/reasoning requests
- `COMPLETION_MODEL`: Model for standard completions
- `DEBUG`: Enable debug logging

## Critical Implementation Details

### Message Transformation
Tool call/result validation is essential. The `transformMessages()` function:
1. Tracks tool call IDs in a Set during assistant message processing
2. Only includes tool results that match tracked call IDs
3. Removes handled tool calls from tracker to prevent reuse

### Streaming Response Handling
The streaming handler converts OpenRouter's OpenAI-format SSE to Anthropic format:
- Handles `content_block_start`, `content_block_delta`, `content_block_stop` events
- Supports both text content and tool calls in streaming
- Manages thinking/reasoning deltas for reasoning models

### Error Handling Strategy
- All handlers throw `ProxyError` instances with rich context
- `handleRouteError()` provides centralized error logging and response
- Errors include accumulated state, model info, and request context

## File Structure Reference
```
/
├── index.js                           # Server entry point
├── src/
│   ├── config/config.js              # Configuration management
│   ├── handlers/
│   │   ├── requestHandler.js         # Main request orchestration
│   │   ├── streamingHandler.js       # SSE streaming with state machine
│   │   └── nonStreamingHandler.js    # Non-streaming response handling
│   ├── transformers/
│   │   ├── messageTransformer.js     # Message format conversion (critical)
│   │   └── requestTransformer.js     # Request payload transformation
│   └── utils/
│       ├── requestLogger.js          # Per-request logging system
│       ├── errorHandler.js           # Structured error handling
│       ├── sseUtils.js              # Server-sent events utilities
│       └── schemaUtils.js           # JSON schema transformation
└── log/                              # Per-request log files (gitignored)
```

## Testing and Validation
Always run linting and type checking after code changes:
```bash
npm run lint && npm run typecheck
```