/**
 * Enhanced error handling middleware with comprehensive type safety
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import type { ApiError, HttpStatusCode, ErrorCode } from '@/lib/types/api';

// ============================================================================
// Error Types and Interfaces
// ============================================================================

export class TypedApiError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: HttpStatusCode = 500,
    code: ErrorCode = 'INTERNAL_ERROR',
    details?: Record<string, unknown>,
    isOperational = true,
  ) {
    super(message);
    this.name = 'TypedApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    // Maintains proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TypedApiError);
    }
  }
}

export class ValidationError extends TypedApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends TypedApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends TypedApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends TypedApiError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends TypedApiError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends TypedApiError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class InsufficientCreditsError extends TypedApiError {
  constructor(required: number, available: number) {
    super(
      `Insufficient credits. Required: ${required}, Available: ${available}`,
      402,
      'INSUFFICIENT_CREDITS',
      { required, available },
    );
  }
}

// ============================================================================
// Error Response Formatters
// ============================================================================

function formatErrorResponse(error: unknown, requestId?: string): ApiError {
  const timestamp = new Date().toISOString();

  if (error instanceof TypedApiError) {
    return {
      message: error.message,
      code: error.code,
      details: error.details,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof z.ZodError) {
    return {
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details: {
        issues: error.errors.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
    };
  }

  if (error instanceof Error) {
    // Log unexpected errors
    logger.error('Unexpected error', error, {
      requestId,
    });

    return {
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : error.message,
      code: 'INTERNAL_ERROR',
      statusCode: 500,
    };
  }

  // Fallback for unknown error types
  logger.error(
    'Unknown error type',
    error instanceof Error ? error : new Error(String(error)),
    { requestId },
  );

  return {
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    statusCode: 500,
  };
}

// ============================================================================
// Error Handler Middleware
// ============================================================================

export function createErrorHandler() {
  return async (
    error: unknown,
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ): Promise<NextResponse<any>> => {
    const requestId =
      request.headers.get('x-request-id') || crypto.randomUUID();

    const errorResponse = formatErrorResponse(error, requestId);

    // Add request context to logs
    logger.error('API Error', new Error(errorResponse.message), {
      errorResponse,
      url: request.url,
      method: request.method,
      userAgent: request.headers.get('user-agent'),
      requestId,
      params: context?.params,
    });

    // Add security headers
    const response = NextResponse.json(
      {
        success: false,
        error: errorResponse,
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: errorResponse.statusCode },
    );

    // Add CORS headers if needed
    if (request.headers.get('origin')) {
      response.headers.set(
        'Access-Control-Allow-Origin',
        process.env.CORS_ORIGIN || '*',
      );
    }

    return response;
  };
}

// ============================================================================
// Async Handler Wrapper
// ============================================================================

type AsyncHandler<T = unknown> = (
  request: NextRequest,
  context?: { params?: Record<string, string> },
) => Promise<NextResponse<T>>;

export function withErrorHandling<T = unknown>(
  handler: AsyncHandler<T>,
): AsyncHandler<T> {
  const errorHandler = createErrorHandler();

  return async (
    request: NextRequest,
    context?: { params?: Record<string, string> },
  ): Promise<NextResponse<T>> => {
    try {
      return await handler(request, context);
    } catch (error) {
      return (await errorHandler(error, request, context)) as NextResponse<T>;
    }
  };
}

// ============================================================================
// Validation Wrapper
// ============================================================================

export function withValidation<T extends z.ZodType>(
  schema: T,
  handler: (
    request: NextRequest,
    validatedData: z.infer<T>,
    context?: { params?: Record<string, string> },
  ) => Promise<NextResponse>,
) {
  return withErrorHandling(async (request: NextRequest, context) => {
    let data: unknown;

    // Parse JSON body for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        data = await request.json();
      } catch {
        throw new ValidationError('Invalid JSON in request body');
      }
    } else {
      // For GET/DELETE, validate query parameters
      const searchParams = new URL(request.url).searchParams;
      data = Object.fromEntries(searchParams.entries());
    }

    const validatedData = schema.parse(data);
    return handler(request, validatedData, context);
  });
}

// ============================================================================
// Request Size Limiter
// ============================================================================

export function withSizeLimit(maxSizeBytes: number = 1024 * 1024) {
  return function <T>(handler: AsyncHandler<T>): AsyncHandler<T> {
    return withErrorHandling(
      async (request: NextRequest, context): Promise<NextResponse<T>> => {
        const contentLength = request.headers.get('content-length');

        if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
          throw new ValidationError(
            `Request too large. Maximum size: ${maxSizeBytes} bytes`,
            { maxSize: maxSizeBytes, actualSize: parseInt(contentLength, 10) },
          );
        }

        return handler(request, context);
      },
    );
  };
}

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: NextRequest) => string;
}

export function withRateLimit(config: RateLimitConfig) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return function <T>(handler: AsyncHandler<T>): AsyncHandler<T> {
    return withErrorHandling(
      async (request: NextRequest, context): Promise<NextResponse<T>> => {
        const key =
          config.keyGenerator?.(request) ||
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          'anonymous';

        const now = Date.now();
        const clientData = requests.get(key);

        if (!clientData || now > clientData.resetTime) {
          requests.set(key, {
            count: 1,
            resetTime: now + config.windowMs,
          });
        } else if (clientData.count >= config.maxRequests) {
          throw new RateLimitError(
            `Rate limit exceeded. Try again in ${Math.ceil((clientData.resetTime - now) / 1000)} seconds`,
          );
        } else {
          clientData.count++;
        }

        return handler(request, context);
      },
    );
  };
}

// ============================================================================
// Type Guards
// ============================================================================

export function isTypedApiError(error: unknown): error is TypedApiError {
  return error instanceof TypedApiError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isZodError(error: unknown): error is z.ZodError {
  return error instanceof z.ZodError;
}

// ============================================================================
// Utility Functions
// ============================================================================

export function createSuccessResponse<T>(
  data: T,
  status: HttpStatusCode = 200,
  message?: string,
): NextResponse<{
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}> {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}

export function createErrorResponse(
  message: string,
  statusCode: HttpStatusCode = 500,
  code: ErrorCode = 'INTERNAL_ERROR',
  details?: Record<string, unknown>,
): NextResponse<{ success: false; error: ApiError; timestamp: string }> {
  return NextResponse.json(
    {
      success: false,
      error: {
        message,
        code,
        statusCode,
        details,
      },
      timestamp: new Date().toISOString(),
    },
    { status: statusCode },
  );
}
