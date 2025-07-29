/**
 * Retry Utility with Exponential Backoff
 * Provides robust retry logic for critical operations like payments
 */

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBase: number;
  jitterMs?: number;
  shouldRetry?: (error: Error) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDelayMs: number;
}

export class RetryService {
  private static readonly DEFAULT_OPTIONS: RetryOptions = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    exponentialBase: 2,
    jitterMs: 100,
    shouldRetry: (error: Error) => {
      // Don't retry configuration or validation errors
      if (
        error.message.includes('not configured') ||
        error.message.includes('Invalid') ||
        error.message.includes('not found')
      ) {
        return false;
      }
      return true;
    },
  };

  /**
   * Execute operation with retry logic
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
  ): Promise<RetryResult<T>> {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    let lastError: Error | undefined;
    let totalDelayMs = 0;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await operation();
        return {
          success: true,
          result,
          attempts: attempt,
          totalDelayMs,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry if shouldRetry returns false
        if (!config.shouldRetry!(lastError)) {
          return {
            success: false,
            error: lastError,
            attempts: attempt,
            totalDelayMs,
          };
        }

        // Don't delay on the last attempt
        if (attempt < config.maxAttempts) {
          const delay = this.calculateDelay(attempt, config);
          totalDelayMs += delay;
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: config.maxAttempts,
      totalDelayMs,
    };
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private static calculateDelay(
    attempt: number,
    options: RetryOptions,
  ): number {
    const exponentialDelay =
      options.baseDelayMs * Math.pow(options.exponentialBase, attempt - 1);
    const jitter = options.jitterMs ? Math.random() * options.jitterMs : 0;
    const totalDelay = exponentialDelay + jitter;

    return Math.min(totalDelay, options.maxDelayMs);
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Circuit Breaker for Auto Top-up
 * Prevents repeated failures from overwhelming the system
 */
export class AutoTopUpCircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  private readonly maxFailures = 5;
  private readonly resetTimeoutMs = 300000; // 5 minutes
  private readonly halfOpenMaxAttempts = 3;

  constructor(private organizationId: string) {}

  /**
   * Check if auto top-up is allowed for this organization
   */
  canAttemptTopUp(): boolean {
    const now = Date.now();

    switch (this.state) {
      case 'closed':
        return true;

      case 'open':
        // Check if we should transition to half-open
        if (now - this.lastFailureTime > this.resetTimeoutMs) {
          this.state = 'half-open';
          this.failureCount = 0;
          return true;
        }
        return false;

      case 'half-open':
        return this.failureCount < this.halfOpenMaxAttempts;

      default:
        return false;
    }
  }

  /**
   * Record successful auto top-up
   */
  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }

  /**
   * Record failed auto top-up attempt
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'closed' && this.failureCount >= this.maxFailures) {
      this.state = 'open';
    } else if (this.state === 'half-open') {
      this.state = 'open';
    }
  }

  /**
   * Get current circuit breaker status
   */
  getStatus(): {
    state: string;
    failureCount: number;
    lastFailureTime: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

/**
 * Global circuit breaker registry for organizations
 */
class CircuitBreakerRegistry {
  private circuitBreakers = new Map<string, AutoTopUpCircuitBreaker>();

  getCircuitBreaker(organizationId: string): AutoTopUpCircuitBreaker {
    if (!this.circuitBreakers.has(organizationId)) {
      this.circuitBreakers.set(
        organizationId,
        new AutoTopUpCircuitBreaker(organizationId),
      );
    }
    return this.circuitBreakers.get(organizationId)!;
  }

  removeCircuitBreaker(organizationId: string): void {
    this.circuitBreakers.delete(organizationId);
  }

  getAllStatuses(): Record<
    string,
    { state: string; failureCount: number; lastFailureTime: number }
  > {
    const statuses: Record<string, any> = {};
    this.circuitBreakers.forEach((breaker, orgId) => {
      statuses[orgId] = breaker.getStatus();
    });
    return statuses;
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();
