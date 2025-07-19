/**
 * Retry utility for handling flaky browser operations
 */

import { logger } from '@elizaos/core';

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  timeout?: number;
  retryableErrors?: string[];
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
  retryableErrors: [
    'net::ERR_CONNECTION_REFUSED',
    'net::ERR_CONNECTION_RESET',
    'net::ERR_CONNECTION_TIMED_OUT',
    'net::ERR_NETWORK_CHANGED',
    'Navigation timeout',
    'Timeout',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
  ],
};

/**
 * Check if an error is retryable
 */
function isRetryableError(error: Error, retryableErrors: string[]): boolean {
  const errorMessage = error.message.toLowerCase();
  return retryableErrors.some((retryable) => errorMessage.includes(retryable.toLowerCase()));
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = Math.min(
    config.initialDelay * Math.pow(config.backoffFactor, attempt - 1),
    config.maxDelay
  );
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  operationName: string = 'operation'
): Promise<T> {
  const finalConfig = { ...defaultRetryConfig, ...config };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      logger.info(`Attempting ${operationName} (attempt ${attempt}/${finalConfig.maxRetries})`);

      // If timeout is specified, race against timeout
      if (finalConfig.timeout) {
        return await Promise.race([
          fn(),
          new Promise<T>((_, reject) =>
            setTimeout(
              () => reject(new Error(`${operationName} timed out after ${finalConfig.timeout}ms`)),
              finalConfig.timeout
            )
          ),
        ]);
      } else {
        return await fn();
      }
    } catch (error) {
      lastError = error as Error;
      logger.warn(`${operationName} failed (attempt ${attempt}/${finalConfig.maxRetries}):`, error);

      // Check if error is retryable
      if (!isRetryableError(lastError, finalConfig.retryableErrors || [])) {
        logger.error(`${operationName} failed with non-retryable error:`, error);
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === finalConfig.maxRetries) {
        logger.error(`${operationName} failed after ${finalConfig.maxRetries} attempts`);
        throw error;
      }

      // Calculate and apply backoff delay
      const delay = calculateDelay(attempt, finalConfig);
      logger.info(`Retrying ${operationName} after ${Math.round(delay)}ms...`);
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error(`${operationName} failed`);
}

/**
 * Retry decorator for class methods
 */
export function Retry(config: Partial<RetryConfig> = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return retryWithBackoff(() => originalMethod.apply(this, args), config, propertyKey);
    };

    return descriptor;
  };
}

/**
 * Browser-specific retry configurations
 */
export const browserRetryConfigs = {
  navigation: {
    maxRetries: 3,
    initialDelay: 2000,
    maxDelay: 10000,
    backoffFactor: 2,
    timeout: 30000,
  } as RetryConfig,

  action: {
    maxRetries: 2,
    initialDelay: 1000,
    maxDelay: 5000,
    backoffFactor: 2,
    timeout: 15000,
  } as RetryConfig,

  extraction: {
    maxRetries: 2,
    initialDelay: 500,
    maxDelay: 3000,
    backoffFactor: 1.5,
    timeout: 10000,
  } as RetryConfig,
};
