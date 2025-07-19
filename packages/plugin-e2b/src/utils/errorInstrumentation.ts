import { elizaLogger } from '@elizaos/core';

export interface ErrorContext {
  service: string;
  operation: string;
  metadata?: Record<string, any>;
  timestamp: number;
  correlationId?: string;
}

export interface InstrumentedError extends Error {
  context: ErrorContext;
  originalError?: Error;
  retryCount?: number;
  recoverable?: boolean;
}

export class ErrorInstrumentation {
  private static correlationCounter = 0;

  static generateCorrelationId(): string {
    return `e2b-${Date.now()}-${++this.correlationCounter}`;
  }

  static instrumentError(
    error: Error | unknown,
    context: Omit<ErrorContext, 'timestamp'>
  ): InstrumentedError {
    const timestamp = Date.now();
    const correlationId = this.generateCorrelationId();

    const instrumentedError = new Error(
      error instanceof Error ? error.message : String(error)
    ) as InstrumentedError;

    instrumentedError.context = {
      ...context,
      timestamp,
      correlationId,
    };

    if (error instanceof Error) {
      instrumentedError.originalError = error;
      instrumentedError.stack = error.stack;
    }

    // Log the error with full context
    this.logError(instrumentedError);

    return instrumentedError;
  }

  static logError(error: InstrumentedError): void {
    const { service, operation, metadata, timestamp, correlationId } = error.context;

    elizaLogger.error('E2B Plugin Error', {
      correlationId,
      service,
      operation,
      message: error.message,
      timestamp: new Date(timestamp).toISOString(),
      metadata,
      stack: error.stack?.split('\n').slice(0, 10), // First 10 lines of stack
      originalError: error.originalError?.message,
      retryCount: error.retryCount,
      recoverable: error.recoverable,
    });
  }

  static async withInstrumentation<T>(
    operation: () => Promise<T>,
    context: Omit<ErrorContext, 'timestamp'>
  ): Promise<T> {
    const startTime = Date.now();
    const correlationId = this.generateCorrelationId();

    elizaLogger.info('E2B Operation Starting', {
      correlationId,
      service: context.service,
      operation: context.operation,
      metadata: context.metadata,
    });

    try {
      const result = await operation();

      const duration = Date.now() - startTime;
      elizaLogger.info('E2B Operation Completed', {
        correlationId,
        service: context.service,
        operation: context.operation,
        duration,
        success: true,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const instrumentedError = this.instrumentError(error, {
        ...context,
        metadata: {
          ...context.metadata,
          duration,
          correlationId,
        },
      });

      elizaLogger.error('E2B Operation Failed', {
        correlationId,
        service: context.service,
        operation: context.operation,
        duration,
        success: false,
        error: instrumentedError.message,
      });

      throw instrumentedError;
    }
  }

  static classifyError(error: Error): {
    type: 'network' | 'authentication' | 'validation' | 'timeout' | 'resource' | 'unknown';
    recoverable: boolean;
    suggestedRetryDelay?: number;
  } {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // Network errors
    if (
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      stack.includes('network')
    ) {
      return {
        type: 'network',
        recoverable: true,
        suggestedRetryDelay: 1000,
      };
    }

    // Authentication errors
    if (
      message.includes('unauthorized') ||
      message.includes('authentication') ||
      message.includes('api key') ||
      message.includes('401') ||
      message.includes('forbidden') ||
      message.includes('403')
    ) {
      return {
        type: 'authentication',
        recoverable: false,
      };
    }

    // Validation errors
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('malformed') ||
      message.includes('400') ||
      message.includes('bad request')
    ) {
      return {
        type: 'validation',
        recoverable: false,
      };
    }

    // Timeout errors
    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('deadline') ||
      message.includes('408')
    ) {
      return {
        type: 'timeout',
        recoverable: true,
        suggestedRetryDelay: 2000,
      };
    }

    // Resource errors
    if (
      message.includes('quota') ||
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('429') ||
      message.includes('resource') ||
      message.includes('capacity')
    ) {
      return {
        type: 'resource',
        recoverable: true,
        suggestedRetryDelay: 5000,
      };
    }

    return {
      type: 'unknown',
      recoverable: false,
    };
  }

  static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    context: Omit<ErrorContext, 'timestamp'>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: InstrumentedError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.withInstrumentation(operation, {
          ...context,
          metadata: {
            ...context.metadata,
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
          },
        });
      } catch (error) {
        const instrumentedError =
          error instanceof Error && 'context' in error
            ? (error as InstrumentedError)
            : this.instrumentError(error, context);

        instrumentedError.retryCount = attempt;
        lastError = instrumentedError;

        const classification = this.classifyError(instrumentedError);
        instrumentedError.recoverable = classification.recoverable;

        if (attempt === maxRetries || !classification.recoverable) {
          elizaLogger.error('E2B Operation Failed After All Retries', {
            correlationId: instrumentedError.context.correlationId,
            service: context.service,
            operation: context.operation,
            totalAttempts: attempt + 1,
            finalError: instrumentedError.message,
            errorType: classification.type,
            recoverable: classification.recoverable,
          });
          throw instrumentedError;
        }

        const delay = classification.suggestedRetryDelay || Math.pow(2, attempt) * baseDelay;

        elizaLogger.warn('E2B Operation Failed, Retrying', {
          correlationId: instrumentedError.context.correlationId,
          service: context.service,
          operation: context.operation,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          error: instrumentedError.message,
          retryDelay: delay,
          errorType: classification.type,
        });

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error(`Operation failed after ${maxRetries + 1} attempts: ${lastError!.message}`);
  }

  static createMetricsSnapshot(service: string): {
    service: string;
    timestamp: number;
    metrics: Record<string, any>;
  } {
    return {
      service,
      timestamp: Date.now(),
      metrics: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };
  }

  static logMetrics(service: string, operation: string, metrics: Record<string, any>): void {
    elizaLogger.info('E2B Metrics', {
      service,
      operation,
      timestamp: new Date().toISOString(),
      metrics,
    });
  }
}

// Helper decorators for method instrumentation
export function instrumented(service: string, operation?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const operationName = operation || propertyKey;

    descriptor.value = async function (this: any, ...args: any[]) {
      return ErrorInstrumentation.withInstrumentation(() => originalMethod.apply(this, args), {
        service,
        operation: operationName,
        metadata: {
          method: propertyKey,
          argsCount: args.length,
        },
      });
    };

    return descriptor;
  };
}

export function retryable(service: string, maxRetries = 3, baseDelay = 1000, operation?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const operationName = operation || propertyKey;

    descriptor.value = async function (this: any, ...args: any[]) {
      return ErrorInstrumentation.retryWithBackoff(
        () => originalMethod.apply(this, args),
        {
          service,
          operation: operationName,
          metadata: {
            method: propertyKey,
            argsCount: args.length,
          },
        },
        maxRetries,
        baseDelay
      );
    };

    return descriptor;
  };
}
