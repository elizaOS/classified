/**
 * Input Sanitization and Validation Utilities
 * Prevents XSS, injection attacks, and validates user input
 */

import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitize plain text input
 */
export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove any HTML tags and decode HTML entities
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
}

/**
 * Validate and sanitize email addresses
 */
export function sanitizeEmail(input: string): string {
  const sanitized = sanitizeText(input).toLowerCase().trim();
  const emailSchema = z.string().email();

  try {
    return emailSchema.parse(sanitized);
  } catch {
    throw new Error('Invalid email format');
  }
}

/**
 * Validate and sanitize UUID
 */
export function sanitizeUUID(input: string): string {
  const sanitized = sanitizeText(input).toLowerCase().trim();
  const uuidSchema = z.string().uuid();

  try {
    return uuidSchema.parse(sanitized);
  } catch {
    throw new Error('Invalid UUID format');
  }
}

/**
 * Sanitize and validate numeric input
 */
export function sanitizeNumber(
  input: any,
  options: { min?: number; max?: number } = {},
): number {
  const num = Number(input);

  if (isNaN(num) || !isFinite(num)) {
    throw new Error('Invalid number format');
  }

  if (options.min !== undefined && num < options.min) {
    throw new Error(`Number must be at least ${options.min}`);
  }

  if (options.max !== undefined && num > options.max) {
    throw new Error(`Number must be at most ${options.max}`);
  }

  return num;
}

/**
 * Sanitize slug/URL-safe strings
 */
export function sanitizeSlug(input: string): string {
  const sanitized = sanitizeText(input).toLowerCase().trim();

  // Convert to URL-safe slug
  return sanitized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50); // Limit length
}

/**
 * Sanitize JSON input
 */
export function sanitizeJSON(input: any): any {
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch {
      throw new Error('Invalid JSON format');
    }
  }

  // Recursively sanitize JSON object
  return sanitizeObjectValues(input);
}

/**
 * Recursively sanitize object values
 */
function sanitizeObjectValues(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeText(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObjectValues);
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key names too
      const sanitizedKey = sanitizeText(key);
      sanitized[sanitizedKey] = sanitizeObjectValues(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Agent character validation schema
 */
export const agentCharacterSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .transform(sanitizeText),
  bio: z
    .string()
    .min(1, 'Bio is required')
    .max(1000, 'Bio too long')
    .transform(sanitizeHtml),
  messageExamples: z.array(z.array(z.any())).optional(),
  postExamples: z.array(z.string().max(500).transform(sanitizeText)).optional(),
  topics: z.array(z.string().max(50).transform(sanitizeText)).optional(),
  style: z
    .object({
      all: z.array(z.string().max(200).transform(sanitizeText)).optional(),
      chat: z.array(z.string().max(200).transform(sanitizeText)).optional(),
      post: z.array(z.string().max(200).transform(sanitizeText)).optional(),
    })
    .optional(),
});

/**
 * Agent creation request schema
 */
export const createAgentSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .transform(sanitizeText),
  description: z
    .string()
    .max(500, 'Description too long')
    .transform(sanitizeText)
    .optional(),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(50, 'Slug too long')
    .transform(sanitizeSlug),
  character: agentCharacterSchema,
  plugins: z.array(z.string().max(50).transform(sanitizeText)),
  runtimeConfig: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).max(10000).optional(),
    models: z.record(z.string().transform(sanitizeText)).optional(),
    providers: z.array(z.string().transform(sanitizeText)).optional(),
    environment: z.record(z.string().transform(sanitizeText)).optional(),
  }),
  visibility: z.enum(['private', 'organization', 'public']),
});

/**
 * User registration schema
 */
export const userRegistrationSchema = z.object({
  email: z.string().email('Invalid email').transform(sanitizeEmail),
  firstName: z
    .string()
    .min(1, 'First name required')
    .max(50, 'First name too long')
    .transform(sanitizeText),
  lastName: z
    .string()
    .min(1, 'Last name required')
    .max(50, 'Last name too long')
    .transform(sanitizeText),
  organizationName: z
    .string()
    .min(1, 'Organization name required')
    .max(100, 'Organization name too long')
    .transform(sanitizeText),
});

/**
 * Credit transaction schema
 */
export const creditTransactionSchema = z.object({
  amount: z
    .number()
    .min(0.0001, 'Amount must be positive')
    .max(10000, 'Amount too large'),
  description: z
    .string()
    .min(1, 'Description required')
    .max(200, 'Description too long')
    .transform(sanitizeText),
  type: z.enum(['purchase', 'usage', 'refund', 'adjustment', 'auto_topup']),
});

/**
 * API request sanitization middleware
 */
export function sanitizeRequestBody(body: any): any {
  if (!body) {
    return body;
  }

  try {
    return sanitizeJSON(body);
  } catch (error) {
    throw new Error('Invalid request body format');
  }
}

/**
 * File upload validation
 */
export function validateFileUpload(
  file: File,
  options: {
    maxSize?: number;
    allowedTypes?: string[];
  } = {},
): void {
  const maxSize = options.maxSize || 5 * 1024 * 1024; // 5MB default
  const allowedTypes = options.allowedTypes || [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  if (file.size > maxSize) {
    throw new Error(
      `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`,
    );
  }

  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      `File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    );
  }

  // Additional filename validation
  const sanitizedName = sanitizeText(file.name);
  if (
    sanitizedName.length === 0 ||
    sanitizedName.includes('..') ||
    sanitizedName.includes('/')
  ) {
    throw new Error('Invalid filename');
  }
}
