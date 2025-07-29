/**
 * Comprehensive Error Handling System
 * Provides consistent error handling across the platform
 */

import { NextResponse } from 'next/server';

// Base error classes
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date();

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
export class AuthenticationError extends AppError {
  constructor(
    message: string = 'Authentication failed',
    code: string = 'AUTH_FAILED',
  ) {
    super(message, 401, code);
  }
}

export class AuthorizationError extends AppError {
  constructor(
    message: string = 'Insufficient permissions',
    code: string = 'UNAUTHORIZED',
  ) {
    super(message, 403, code);
  }
}

export class ValidationError extends AppError {
  public readonly fields: Record<string, string[]>;

  constructor(
    message: string = 'Validation failed',
    fields: Record<string, string[]> = {},
    code: string = 'VALIDATION_ERROR',
  ) {
    super(message, 400, code);
    this.fields = fields;
  }
}

export class NotFoundError extends AppError {
  constructor(
    message: string = 'Resource not found',
    code: string = 'NOT_FOUND',
  ) {
    super(message, 404, code);
  }
}

export class ConflictError extends AppError {
  constructor(
    message: string = 'Resource conflict',
    code: string = 'CONFLICT',
  ) {
    super(message, 409, code);
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(
    message: string = 'Rate limit exceeded',
    retryAfter: number = 60,
    code: string = 'RATE_LIMIT_EXCEEDED',
  ) {
    super(message, 429, code);
    this.retryAfter = retryAfter;
  }
}

export class DatabaseError extends AppError {
  constructor(
    message: string = 'Database operation failed',
    code: string = 'DATABASE_ERROR',
  ) {
    super(message, 500, code);
  }
}

export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(
    service: string,
    message: string = 'External service error',
    code: string = 'EXTERNAL_SERVICE_ERROR',
  ) {
    super(message, 502, code);
    this.service = service;
  }
}

// Error response interface
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    timestamp: string;
    fields?: Record<string, string[]>;
    retryAfter?: number;
    service?: string;
  };
  requestId?: string;
}

// Create standardized error response
export function createErrorResponse(
  error: AppError | Error,
  requestId?: string,
): ErrorResponse {
  if (error instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        timestamp: error.timestamp.toISOString(),
      },
    };

    // Add specific error properties
    if (
      error instanceof ValidationError &&
      Object.keys(error.fields).length > 0
    ) {
      response.error.fields = error.fields;
    }

    if (error instanceof RateLimitError) {
      response.error.retryAfter = error.retryAfter;
    }

    if (error instanceof ExternalServiceError) {
      response.error.service = error.service;
    }

    if (requestId) {
      response.requestId = requestId;
    }

    return response;
  }

  // Handle generic errors
  return {
    success: false,
    error: {
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : error.message,
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    },
    ...(requestId && { requestId }),
  };
}

// Error handler for Next.js API routes
export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);

  if (error instanceof AppError) {
    return NextResponse.json(createErrorResponse(error), {
      status: error.statusCode,
    });
  }

  // Handle specific known error types
  if (error instanceof Error) {
    // JWT errors
    if (error.name === 'JWSInvalid' || error.name === 'JWTExpired') {
      return NextResponse.json(
        createErrorResponse(
          new AuthenticationError('Invalid or expired token', 'TOKEN_INVALID'),
        ),
        { status: 401 },
      );
    }

    // Database errors
    if (
      error.message.includes('database') ||
      error.message.includes('connection')
    ) {
      return NextResponse.json(
        createErrorResponse(new DatabaseError('Database connection failed')),
        { status: 500 },
      );
    }
  }

  // Generic error handler
  const genericError = new AppError(
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error instanceof Error
        ? error.message
        : 'Unknown error',
  );

  return NextResponse.json(createErrorResponse(genericError), { status: 500 });
}

// Async error wrapper for API routes
export function asyncHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw error; // Re-throw to be handled by the error boundary
    }
  };
}

// Check if error should be retried
export function isRetryableError(error: AppError): boolean {
  // Only retry on temporary failures
  return [500, 502, 503, 504].includes(error.statusCode) && error.isOperational;
}

// Get error severity level
export function getErrorSeverity(
  error: AppError,
): 'low' | 'medium' | 'high' | 'critical' {
  if (error.statusCode >= 500) {
    return 'critical';
  }
  if (error.statusCode >= 400) {
    return 'medium';
  }
  return 'low';
}
