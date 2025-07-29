/**
 * Standardized API Error Handling
 * Provides consistent error responses across all API endpoints
 */

import { NextResponse } from 'next/server';

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp?: string;
  requestId?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: {
    timestamp: string;
    requestId?: string;
    version?: string;
  };
}

export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // Validation
  INVALID_REQUEST = 'INVALID_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Billing & Payments
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  PAYMENT_METHOD_REQUIRED = 'PAYMENT_METHOD_REQUIRED',
  BILLING_CONFIGURATION_ERROR = 'BILLING_CONFIGURATION_ERROR',
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',

  // External Services
  STRIPE_ERROR = 'STRIPE_ERROR',
  ALCHEMY_ERROR = 'ALCHEMY_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',

  // Database & System
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMITED = 'RATE_LIMITED',

  // Resources
  NOT_FOUND = 'NOT_FOUND',
  ORGANIZATION_NOT_FOUND = 'ORGANIZATION_NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
}

export const HTTP_STATUS_CODES = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.SESSION_EXPIRED]: 401,
  [ErrorCode.INVALID_REQUEST]: 400,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.PAYMENT_FAILED]: 402,
  [ErrorCode.INSUFFICIENT_FUNDS]: 402,
  [ErrorCode.PAYMENT_METHOD_REQUIRED]: 402,
  [ErrorCode.BILLING_CONFIGURATION_ERROR]: 500,
  [ErrorCode.SUBSCRIPTION_REQUIRED]: 402,
  [ErrorCode.STRIPE_ERROR]: 502,
  [ErrorCode.ALCHEMY_ERROR]: 502,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ORGANIZATION_NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_CONFLICT]: 409,
} as const;

export class ApiErrorHandler {
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Create a success response
   */
  static success<T>(
    data: T,
    metadata?: Record<string, any>,
  ): NextResponse<ApiResponse<T>> {
    const response: ApiResponse<T> = {
      success: true,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
        ...metadata,
      },
    };

    return NextResponse.json(response);
  }

  /**
   * Create an error response with proper error handling
   */
  static error(
    code: ErrorCode,
    message: string,
    details?: Record<string, any>,
    statusOverride?: number,
  ): NextResponse<ApiResponse> {
    // Sanitize error details for security
    const sanitizedDetails = this.sanitizeErrorDetails(details);

    const error: ApiError = {
      code,
      message: this.sanitizeErrorMessage(message),
      details: sanitizedDetails,
      timestamp: new Date().toISOString(),
      requestId: this.generateRequestId(),
    };

    const response: ApiResponse = {
      success: false,
      error,
      metadata: {
        timestamp: error.timestamp || new Date().toISOString(),
        requestId: error.requestId || this.generateRequestId(),
      },
    };

    const statusCode = statusOverride || HTTP_STATUS_CODES[code] || 500;

    // Log error for monitoring
    this.logError(error, statusCode);

    return NextResponse.json(response, { status: statusCode });
  }

  /**
   * Handle common error types automatically
   */
  static fromError(error: unknown): NextResponse<ApiResponse> {
    if (error instanceof Error) {
      // Stripe errors
      if (
        error.message.includes('Stripe') ||
        error.message.includes('stripe')
      ) {
        return this.error(ErrorCode.STRIPE_ERROR, 'Payment processing error');
      }

      // Database errors
      if (
        error.message.includes('database') ||
        error.message.includes('connection')
      ) {
        return this.error(
          ErrorCode.DATABASE_ERROR,
          'Database operation failed',
        );
      }

      // Authentication errors
      if (
        error.message.includes('Unauthorized') ||
        error.message.includes('authentication')
      ) {
        return this.error(ErrorCode.UNAUTHORIZED, 'Authentication required');
      }

      // Configuration errors
      if (
        error.message.includes('not configured') ||
        error.message.includes('missing')
      ) {
        return this.error(
          ErrorCode.BILLING_CONFIGURATION_ERROR,
          'Service configuration error',
        );
      }

      // Validation errors
      if (
        error.message.includes('Invalid') ||
        error.message.includes('validation')
      ) {
        return this.error(
          ErrorCode.VALIDATION_ERROR,
          'Request validation failed',
        );
      }

      // Not found errors
      if (
        error.message.includes('not found') ||
        error.message.includes('Not found')
      ) {
        return this.error(ErrorCode.NOT_FOUND, 'Resource not found');
      }

      // Generic error
      return this.error(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'An unexpected error occurred',
      );
    }

    // Non-Error objects
    return this.error(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'An unexpected error occurred',
    );
  }

  /**
   * Sanitize error message to prevent information leakage
   */
  private static sanitizeErrorMessage(message: string): string {
    // Remove potentially sensitive information
    const sanitized = message
      .replace(/password[s]?[:=]\s*\S+/gi, 'password: [REDACTED]')
      .replace(/token[s]?[:=]\s*\S+/gi, 'token: [REDACTED]')
      .replace(/key[s]?[:=]\s*\S+/gi, 'key: [REDACTED]')
      .replace(/secret[s]?[:=]\s*\S+/gi, 'secret: [REDACTED]')
      .replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        '[EMAIL_REDACTED]',
      )
      .replace(
        /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
        '[CARD_NUMBER_REDACTED]',
      );

    return sanitized;
  }

  /**
   * Sanitize error details to prevent sensitive data exposure
   */
  private static sanitizeErrorDetails(
    details?: Record<string, any>,
  ): Record<string, any> | undefined {
    if (!details) {
      return undefined;
    }

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(details)) {
      // Skip sensitive keys
      if (
        ['password', 'token', 'secret', 'key', 'apiKey', 'privateKey'].includes(
          key.toLowerCase(),
        )
      ) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Sanitize string values
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeErrorMessage(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeErrorDetails(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Log error for monitoring and debugging
   */
  private static logError(error: ApiError, statusCode: number): void {
    // In production, this would integrate with logging service (e.g., DataDog, CloudWatch)
    console.error(`API Error [${error.requestId}] ${statusCode}:`, {
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: error.timestamp,
    });
  }

  /**
   * Validate request data and return standardized validation error
   */
  static validateRequest(
    data: Record<string, any>,
    requiredFields: string[],
  ): NextResponse<ApiResponse> | null {
    const missingFields = requiredFields.filter((field) => !data[field]);

    if (missingFields.length > 0) {
      return this.error(
        ErrorCode.MISSING_REQUIRED_FIELD,
        'Required fields are missing',
        { missingFields },
      );
    }

    return null;
  }

  /**
   * Handle async operation with proper error handling
   */
  static async handleAsync<T>(
    operation: () => Promise<T>,
  ): Promise<NextResponse<ApiResponse<T>>> {
    try {
      const result = await operation();
      return this.success(result);
    } catch (error) {
      return this.fromError(error);
    }
  }
}

/**
 * Utility function for wrapping API route handlers
 */
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse<ApiResponse<R>>>,
) {
  return async (...args: T): Promise<NextResponse<ApiResponse<R>>> => {
    try {
      return await handler(...args);
    } catch (error) {
      return ApiErrorHandler.fromError(error);
    }
  };
}
