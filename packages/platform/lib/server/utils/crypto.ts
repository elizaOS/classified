/**
 * Cryptographic utility functions
 */

import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Generate a secure random API key
 */
export function generateApiKey(): {
  key: string;
  hash: string;
  prefix: string;
} {
  // Generate 32 bytes of random data
  const keyBytes = randomBytes(32);
  const keyHex = keyBytes.toString('hex');

  // Create the full key with prefix
  const key = `pk_${keyHex}`;

  // Hash the key for storage
  const hash = createHash('sha256').update(key).digest('hex') as string;

  // Create preview (first 8 and last 4 characters)
  const prefix = `pk_${'*'.repeat(8)}...${'*'.repeat(4)}`;

  return { key, hash, prefix };
}

/**
 * Hash an API key for comparison
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex') as string;
}

/**
 * Generate OAuth state parameter
 */
export function generateOAuthState(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Create API key preview for display
 */
export function createApiKeyPreview(key: string): string {
  if (!key.startsWith('pk_')) {
    return 'invalid_key';
  }

  // Show first 8 characters of the key (after prefix) and last 4
  const keyWithoutPrefix = key.substring(3);
  if (keyWithoutPrefix.length < 12) {
    return 'pk_****...****';
  }

  const first8 = keyWithoutPrefix.substring(0, 8);
  const last4 = keyWithoutPrefix.substring(keyWithoutPrefix.length - 4);

  return `pk_${first8}...${last4}`;
}
