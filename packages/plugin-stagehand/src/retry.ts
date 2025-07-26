/**
 * Retry utility for handling flaky browser operations
 */

import { logger } from '@elizaos/core';

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export const browserRetryConfigs = {
  navigation: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 5000,
    backoffMultiplier: 2,
  },
  action: {
    maxAttempts: 2,
    initialDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 1.5,
  },
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  operation: string
): Promise<T> {
  let lastError: Error;
  let delay = config.initialDelay;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      logger.debug(`Attempting ${operation} (attempt ${attempt}/${config.maxAttempts})`);
      return await fn();
    } catch (error) {
      lastError = error as Error;
      logger.warn(`${operation} failed (attempt ${attempt}/${config.maxAttempts}):`, error);

      if (attempt < config.maxAttempts) {
        logger.debug(`Retrying ${operation} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
      }
    }
  }

  throw lastError!;
}
