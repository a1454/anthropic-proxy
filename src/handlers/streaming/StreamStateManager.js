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
};

export class StreamStateManager {
  constructor() {
    this.state = StreamingStates.INITIALIZING;
    this.isSucceeded = false;
  }

  /**
   * Transition to streaming state
   */
  startStreaming() {
    if (this.isSucceeded) return false;
    this.isSucceeded = true;
    this.state = StreamingStates.STREAMING;
    return true;
  }

  /**
   * Transition to finalizing state
   */
  startFinalizing() {
    this.state = StreamingStates.FINALIZING;
  }

  /**
   * Transition to completed state
   */
  complete() {
    this.state = StreamingStates.COMPLETED;
  }

  /**
   * Transition to error state
   */
  setError() {
    this.state = StreamingStates.ERROR;
  }

  /**
   * Check if in a specific state
   * @param {string} state - State to check
   * @returns {boolean}
   */
  isInState(state) {
    return this.state === state;
  }

  /**
   * Check if streaming is active
   * @returns {boolean}
   */
  isStreaming() {
    return this.state === StreamingStates.STREAMING;
  }

  /**
   * Check if stream is completed
   * @returns {boolean}
   */
  isCompleted() {
    return this.state === StreamingStates.COMPLETED;
  }

  /**
   * Check if stream has error
   * @returns {boolean}
   */
  hasError() {
    return this.state === StreamingStates.ERROR;
  }

  /**
   * Get current state
   * @returns {string}
   */
  getState() {
    return this.state;
  }
}