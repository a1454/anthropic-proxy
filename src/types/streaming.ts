/**
 * Streaming-related type definitions
 */

export enum StreamingStates {
  INITIALIZING = 'INITIALIZING',
  STREAMING = 'STREAMING',
  FINALIZING = 'FINALIZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface StreamingContext {
  requestId: string;
  model: string;
  thinking: boolean;
  startTime: number;
  contentBlocks: ContentBlockInfo[];
  toolCalls: Map<string, ToolCallInfo>;
  usage: TokenUsageAccumulator;
}

export interface ContentBlockInfo {
  index: number;
  type: 'text' | 'tool_use';
  id?: string;
  name?: string;
  content: string;
  isComplete: boolean;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  arguments: string;
  isComplete: boolean;
}

export interface TokenUsageAccumulator {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
}

export interface StreamBuffer {
  lineBuffer: string;
  jsonBuffer: string;
}

export interface SSEMessage {
  event?: string;
  data: string;
  id?: string;
  retry?: number;
}

export interface StreamingEventData {
  type: string;
  data: unknown;
  timestamp: number;
}

export interface ContentDelta {
  type: 'text' | 'tool_call' | 'reasoning';
  content?: string;
  toolCall?: {
    id: string;
    name?: string;
    arguments?: string;
  };
  reasoning?: string;
}

export interface StreamStateTransition {
  from: StreamingStates;
  to: StreamingStates;
  timestamp: number;
  reason?: string;
}

export interface StreamingMetrics {
  totalEvents: number;
  contentEvents: number;
  toolCallEvents: number;
  reasoningEvents: number;
  errorEvents: number;
  duration: number;
  avgEventSize: number;
}

export interface StreamingError {
  type: 'parse_error' | 'network_error' | 'api_error' | 'timeout_error';
  message: string;
  details?: unknown;
  recoverable: boolean;
  timestamp: number;
}

export interface StreamingResponse {
  headers: Record<string, string>;
  statusCode: number;
  body: NodeJS.ReadableStream;
}

export interface IStreamStateManager {
  getCurrentState(): StreamingStates;
  canTransition(to: StreamingStates): boolean;
  transition(to: StreamingStates, reason?: string): boolean;
  getTransitionHistory(): StreamStateTransition[];
  reset(): void;
}

export interface IBufferManager {
  addChunk(chunk: string): void;
  getLines(): string[];
  hasCompleteMessage(): boolean;
  clear(): void;
}

export interface IContentProcessor {
  processContent(delta: ContentDelta): void;
  processToolCall(toolCall: ToolCallInfo): void;
  processReasoning(reasoning: string): void;
  getAccumulatedContent(): ContentBlockInfo[];
  reset(): void;
}

export interface ISSEMessageBuilder {
  sendMessageStart(): void;
  sendContentBlockStart(index: number, type: string): void;
  sendContentBlockDelta(index: number, delta: ContentDelta): void;
  sendContentBlockStop(index: number): void;
  sendMessageDelta(usage?: Partial<TokenUsageAccumulator>): void;
  sendMessageStop(): void;
  sendError(error: StreamingError): void;
}