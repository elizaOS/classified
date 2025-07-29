/**
 * Validation utility functions
 */

import { z } from 'zod';

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate API key format
 */
export function isValidApiKey(key: string): boolean {
  // API keys should start with 'pk_' and be 67 characters total (pk_ + 64 hex chars)
  const apiKeyRegex = /^pk_[a-fA-F0-9]{64}$/;
  return apiKeyRegex.test(key);
}

/**
 * Validate organization slug
 */
export function isValidSlug(slug: string): boolean {
  // Slug should contain only lowercase letters, numbers, and hyphens
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug) && slug.length >= 3 && slug.length <= 50;
}

// Zod schemas for request validation
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(
    z.object({
      resource: z.string(),
      actions: z.array(z.string()),
      conditions: z.record(z.any()).optional(),
    }),
  ),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  avatar: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().refine(isValidSlug, 'Invalid organization slug'),
  domain: z.string().optional(),
  subscriptionTier: z.enum(['free', 'pro', 'premium', 'enterprise']).optional(),
  settings: z
    .object({
      allowCustomDomains: z.boolean().optional(),
      ssoRequired: z.boolean().optional(),
      maxStorageGB: z.number().positive().optional(),
      features: z.array(z.string()).optional(),
      webhookUrl: z.string().url().optional(),
      logoUrl: z.string().url().optional(),
    })
    .optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100).default(20),
  orderBy: z.string().optional(),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
});
