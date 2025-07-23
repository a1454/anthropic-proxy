/**
 * Debug logging utilities for the Anthropic proxy server
 */

import { config } from '../config/config.js';

/**
 * Debug logging function
 * @param {...any} args - Arguments to log
 */
export function debug(...args) {
  if (!config.logging.enableDebug) return;
  console.log(...args);
}