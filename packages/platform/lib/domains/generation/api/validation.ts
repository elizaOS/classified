/**
 * Generation API Validation
 * Request validation schemas and helpers
 */

import { z } from 'zod';
import {
  generationRequestSchema as baseGenerationSchema,
  batchGenerationSchema as baseBatchSchema,
  GenerationType,
  GenerationProvider,
  GenerationStatus,
} from '../types';

// Enhanced validation schema for API endpoints
export const generationRequestSchema = z.object({
  // Basic generation fields
  type: z.nativeEnum(GenerationType),
  prompt: z.string().min(1),
  provider: z.nativeEnum(GenerationProvider).optional(),

  // API-specific fields
  webhook_url: z.string().url().optional(),
  client_id: z.string().optional(),
  idempotency_key: z.string().optional(),

  // Server-set fields
  organizationId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),

  // Optional fields
  model_name: z.string().optional(),
  quality: z.enum(['draft', 'standard', 'high']).optional(),
  callback_url: z.string().url().optional(),
});

export const batchGenerationSchema = baseBatchSchema.extend({
  webhook_url: z.string().url().optional(),
  idempotency_key: z.string().optional(),
});

// Query parameter schemas
export const listGenerationsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  type: z.nativeEnum(GenerationType).optional(),
  provider: z.nativeEnum(GenerationProvider).optional(),
  status: z.nativeEnum(GenerationStatus).optional(),
  project_id: z.string().uuid().optional(),
  sort_by: z
    .enum(['created_at', 'updated_at', 'completed_at', 'cost'])
    .default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  created_after: z.coerce.date().optional(),
  created_before: z.coerce.date().optional(),
});

export const analyticsQuerySchema = z.object({
  period: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  type: z.nativeEnum(GenerationType).optional(),
  provider: z.nativeEnum(GenerationProvider).optional(),
});

// Cost estimation schema
export const estimateCostSchema = z.object({
  generations: z.array(generationRequestSchema).min(1).max(10),
});

// Webhook payload schema
export const webhookPayloadSchema = z.object({
  event: z.enum([
    'generation.queued',
    'generation.processing',
    'generation.completed',
    'generation.failed',
    'generation.cancelled',
  ]),
  data: z.object({
    id: z.string(),
    type: z.nativeEnum(GenerationType),
    status: z.enum([
      'queued',
      'processing',
      'completed',
      'failed',
      'cancelled',
    ]),
    organizationId: z.string().uuid(),
    userId: z.string().uuid(),
    createdAt: z.date(),
    updatedAt: z.date(),
    completedAt: z.date().optional(),
    error: z.string().optional(),
    outputs: z
      .array(
        z.object({
          id: z.string(),
          url: z.string().url(),
          format: z.string(),
          size: z.number(),
          metadata: z.record(z.any()).optional(),
        }),
      )
      .optional(),
  }),
  timestamp: z.date(),
  webhook_id: z.string(),
});

// Validation helper functions
export function validateGenerationRequest(data: unknown) {
  const result = generationRequestSchema.safeParse(data);

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
    };
  }

  return {
    valid: true,
    data: result.data,
  };
}

export function validateBatchRequest(data: unknown) {
  const result = batchGenerationSchema.safeParse(data);

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
    };
  }

  return {
    valid: true,
    data: result.data,
  };
}

export function validateListQuery(query: Record<string, any>) {
  const result = listGenerationsSchema.safeParse(query);

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
    };
  }

  return {
    valid: true,
    data: result.data,
  };
}

export function validateAnalyticsQuery(query: Record<string, any>) {
  const result = analyticsQuerySchema.safeParse(query);

  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
    };
  }

  return {
    valid: true,
    data: result.data,
  };
}

// Content type validation
export function validateContentType(contentType: string | null): boolean {
  const allowedTypes = [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
  ];

  if (!contentType) {
    return false;
  }

  return allowedTypes.some((type) => contentType.includes(type));
}

// File upload validation
export const fileUploadSchema = z.object({
  file: z.instanceof(File),
  type: z.enum(['reference_image', 'seed_image', 'style_reference']),
  metadata: z.record(z.any()).optional(),
});

export function validateFileUpload(file: File): {
  valid: boolean;
  errors?: string[];
} {
  const errors: string[] = [];

  // Check file size (10MB max)
  if (file.size > 10 * 1024 * 1024) {
    errors.push('File size must be less than 10MB');
  }

  // Check file type
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
  ];

  if (!allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} not supported`);
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Rate limiting validation
export function validateRateLimit(
  userId: string,
  requestCount: number,
  timeWindow: number,
): { allowed: boolean; resetTime?: number } {
  const maxRequests = 100; // requests per hour
  const windowMs = 60 * 60 * 1000; // 1 hour

  if (requestCount >= maxRequests) {
    return {
      allowed: false,
      resetTime: Date.now() + windowMs,
    };
  }

  return { allowed: true };
}

// Provider-specific validation
export function validateProviderSupport(
  type: GenerationType,
  provider: GenerationProvider,
): { supported: boolean; message?: string } {
  const providerSupport: Record<GenerationProvider, GenerationType[]> = {
    [GenerationProvider.OPENAI]: [
      GenerationType.TEXT,
      GenerationType.IMAGE,
      GenerationType.AUDIO,
      GenerationType.CODE,
    ],
    [GenerationProvider.ANTHROPIC]: [GenerationType.TEXT, GenerationType.CODE],
    [GenerationProvider.ELEVENLABS]: [
      GenerationType.AUDIO,
      GenerationType.SPEECH,
    ],
    [GenerationProvider.GOOGLE_VEO]: [GenerationType.VIDEO],
    [GenerationProvider.STABLE_DIFFUSION]: [GenerationType.IMAGE],
    [GenerationProvider.FAL]: [
      GenerationType.IMAGE,
      GenerationType.VIDEO,
      GenerationType.THREE_D,
      GenerationType.MUSIC,
    ],
    [GenerationProvider.MIDJOURNEY]: [GenerationType.IMAGE],
    [GenerationProvider.RUNWAYML]: [GenerationType.VIDEO],
    [GenerationProvider.REPLICATE]: [
      GenerationType.IMAGE,
      GenerationType.VIDEO,
      GenerationType.AUDIO,
    ],
    [GenerationProvider.READY_PLAYER_ME]: [GenerationType.AVATAR],
    [GenerationProvider.CUSTOM]: [], // All types allowed for custom providers
  };

  const supportedTypes = providerSupport[provider] || [];

  if (provider === GenerationProvider.CUSTOM || supportedTypes.includes(type)) {
    return { supported: true };
  }

  return {
    supported: false,
    message: `Provider ${provider} does not support generation type ${type}`,
  };
}
