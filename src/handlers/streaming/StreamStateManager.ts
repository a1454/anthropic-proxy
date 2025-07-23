/**
 * Stream state management
 */

/**
 * Streaming state machine states
 */
export const StreamingStates = {
  INITIALIZING: 'initializing',
  STREAMING: 'streaming',
  FINALIZING: 'finalizing',
  COMPLETED: 'completed',
  ERROR: 'error'
} as const;

export type StreamingState = typeof StreamingStates[keyof typeof StreamingStates];

export class StreamStateManager {
  private state: StreamingState = StreamingStates.INITIALIZING;
  private isSucceeded: boolean = false;

  /**
   * Transition to streaming state
   */
  startStreaming(): boolean {
    if (this.isSucceeded) return false;
    this.isSucceeded = true;
    this.state = StreamingStates.STREAMING;
    return true;
  }

  /**
   * Transition to finalizing state
   */
  startFinalizing(): void {
    this.state = StreamingStates.FINALIZING;
  }

  /**
   * Transition to completed state
   */
  complete(): void {
    this.state = StreamingStates.COMPLETED;
  }

  /**
   * Transition to error state
   */
  setError(): void {
    this.state = StreamingStates.ERROR;
  }

  /**
   * Check if in a specific state
   */
  isInState(state: StreamingState): boolean {
    return this.state === state;
  }

  /**
   * Check if streaming is active
   */
  isStreaming(): boolean {
    return this.state === StreamingStates.STREAMING;
  }

  /**
   * Check if stream is completed
   */
  isCompleted(): boolean {
    return this.state === StreamingStates.COMPLETED;
  }

  /**
   * Check if stream has error
   */
  hasError(): boolean {
    return this.state === StreamingStates.ERROR;
  }

  /**
   * Get current state
   */
  getState(): StreamingState {
    return this.state;
  }
}