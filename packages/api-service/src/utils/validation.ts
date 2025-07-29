/**
 * Request validation utilities
 */

import { z } from 'zod';
import type { CompletionRequest, EmbeddingRequest } from '../types/index.js';

// Chat completion request schema
const chatCompletionSchema = z.object({
  model: z.string().min(1, 'Model is required'),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant', 'tool']),
        content: z.union([
          z.string(),
          z.array(
            z.object({
              type: z.enum(['text', 'image_url']),
              text: z.string().optional(),
              image_url: z
                .object({
                  url: z.string().url(),
                  detail: z.enum(['low', 'high', 'auto']).optional(),
                })
                .optional(),
            })
          ),
        ]),
        name: z.string().optional(),
        tool_calls: z
          .array(
            z.object({
              id: z.string(),
              type: z.literal('function'),
              function: z.object({
                name: z.string(),
                arguments: z.string(),
              }),
            })
          )
          .optional(),
        tool_call_id: z.string().optional(),
      })
    )
    .min(1, 'At least one message is required'),
  max_tokens: z.number().int().positive().max(128000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  stream: z.boolean().optional(),
  tools: z
    .array(
      z.object({
        type: z.literal('function'),
        function: z.object({
          name: z.string(),
          description: z.string(),
          parameters: z.object({}).passthrough(),
        }),
      })
    )
    .optional(),
  tool_choice: z.union([z.string(), z.object({}).passthrough()]).optional(),
  user: z.string().optional(),
});

// Embedding request schema
const embeddingSchema = z.object({
  input: z.union([z.string(), z.array(z.string())]).refine((input) => {
    if (Array.isArray(input)) {
      return input.length > 0 && input.length <= 2048;
    }
    return input.length > 0 && input.length <= 8192;
  }, 'Input must be non-empty and within size limits'),
  model: z.string().min(1, 'Model is required'),
  encoding_format: z.enum(['float', 'base64']).optional(),
  dimensions: z.number().int().positive().max(3072).optional(),
  user: z.string().optional(),
});

export const validateRequest = {
  chatCompletion: (data: unknown) => {
    const result = chatCompletionSchema.safeParse(data);
    return {
      success: result.success,
      data: result.success ? result.data : null,
      error: result.success
        ? null
        : {
            message: result.error.errors[0]?.message || 'Validation failed',
            path: result.error.errors[0]?.path,
          },
    };
  },

  embedding: (data: unknown) => {
    const result = embeddingSchema.safeParse(data);
    return {
      success: result.success,
      data: result.success ? result.data : null,
      error: result.success
        ? null
        : {
            message: result.error.errors[0]?.message || 'Validation failed',
            path: result.error.errors[0]?.path,
          },
    };
  },
};

// Model availability validation
export function validateModelAvailability(
  modelId: string,
  availableModels: string[]
): boolean {
  return availableModels.includes(modelId);
}

// Organization limits validation
export function validateOrganizationLimits(
  request: CompletionRequest | EmbeddingRequest,
  limits: {
    maxTokensPerRequest: number;
    allowedModels: string[];
    allowedProviders: string[];
  }
): { valid: boolean; error?: string } {
  // Check model allowlist
  if (
    limits.allowedModels.length > 0 &&
    !limits.allowedModels.includes(request.model)
  ) {
    return {
      valid: false,
      error: `Model '${request.model}' not allowed for your organization`,
    };
  }

  // Check token limits for completion requests
  if (
    'max_tokens' in request &&
    request.max_tokens &&
    request.max_tokens > limits.maxTokensPerRequest
  ) {
    return {
      valid: false,
      error: `Requested tokens (${request.max_tokens}) exceeds limit (${limits.maxTokensPerRequest})`,
    };
  }

  return { valid: true };
}

// Content filtering validation
export function validateContentSafety(content: string): {
  safe: boolean;
  reason?: string;
} {
  // Basic content filtering - in production this would use proper content moderation
  const bannedPatterns = [
    /generate.*harmful.*content/i,
    /create.*malicious.*code/i,
    /hack.*system/i,
  ];

  for (const pattern of bannedPatterns) {
    if (pattern.test(content)) {
      return {
        safe: false,
        reason: 'Content violates safety guidelines',
      };
    }
  }

  return { safe: true };
}

// Rate limiting validation helpers
export function validateRateLimit(
  _userId: string,
  _organizationId: string,
  _limits: { requestsPerMinute: number; requestsPerHour: number }
): Promise<{ allowed: boolean; retryAfter?: number }> {
  // TODO: Implement Redis-based rate limiting
  // For now, always allow
  return Promise.resolve({ allowed: true });
}
