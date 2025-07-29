/**
 * Environment Variable Validation
 * Validates critical environment variables on startup
 */

import { z } from 'zod';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

// Define environment schema
const envSchema = z.object({
  // Database - optional in development, defaults to local SQLite
  DATABASE_URL: z.string().optional(),

  // JWT Secret
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long'),

  // WorkOS (optional for development)
  WORKOS_API_KEY: z.string().optional(),
  WORKOS_CLIENT_ID: z.string().optional(),

  // Stripe (optional)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // Platform URL
  NEXT_PUBLIC_API_URL: z.string().url().optional(),

  // Node environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Port
  PORT: z.string().optional(),
});

// Type for validated environment
export type ValidatedEnv = z.infer<typeof envSchema>;

// Default database URLs
const DEFAULT_SQLITE_URL = './data/elizaos.db';
const DEFAULT_DEV_DATABASE_URL = `pglite://${DEFAULT_SQLITE_URL}`;

// Ensure data directory exists for SQLite
function ensureDataDirectory() {
  const dataDir = './data';
  if (!existsSync(dataDir)) {
    console.log('📁 Creating data directory for SQLite database...');
    mkdirSync(dataDir, { recursive: true });
  }
}

// Validate environment variables
export function validateEnvironment(): ValidatedEnv {
  try {
    const validated = envSchema.parse(process.env);

    // Set default DATABASE_URL for development if not provided
    if (!validated.DATABASE_URL && validated.NODE_ENV !== 'production') {
      console.log('📁 Using default SQLite database for development');
      console.log(`   Location: ${DEFAULT_SQLITE_URL}`);
      ensureDataDirectory();
      validated.DATABASE_URL = DEFAULT_DEV_DATABASE_URL;
    }

    // Additional validation for production
    if (validated.NODE_ENV === 'production') {
      if (!validated.DATABASE_URL) {
        throw new Error('DATABASE_URL is required in production');
      }

      if (!validated.JWT_SECRET || validated.JWT_SECRET.length < 64) {
        throw new Error(
          'JWT_SECRET must be at least 64 characters in production',
        );
      }

      // Only warn if we're actually running in production, not during build
      if (!validated.DATABASE_URL.includes('postgresql://') && 
          !validated.DATABASE_URL.includes('pglite://') &&
          process.env.NEXT_PHASE !== 'phase-production-build') {
        console.warn('Warning: Non-PostgreSQL database detected in production');
      }
    }

    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error('❌ Environment validation error:', error);
    }

    throw new Error('Environment validation failed');
  }
}

// Generate a secure JWT secret if needed (development only)
export function generateJWTSecret(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

// Initialize and validate environment on import
let validatedEnv: ValidatedEnv;

try {
  // If no DATABASE_URL is provided in development, set the default before validation
  if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
    ensureDataDirectory();
    process.env.DATABASE_URL = DEFAULT_DEV_DATABASE_URL;
  }

  validatedEnv = validateEnvironment();
} catch (error) {
  // If validation fails and we're in development without JWT_SECRET, generate one
  if (process.env.NODE_ENV === 'development' && !process.env.JWT_SECRET) {
    const generatedSecret = generateJWTSecret();

    console.log('🔑 Generated JWT_SECRET for development:');
    console.log(`JWT_SECRET=${generatedSecret}`);
    console.log('');
    console.log('📝 Add this to your .env.local file');
    console.log('');

    // Set the generated secret temporarily
    process.env.JWT_SECRET = generatedSecret;

    // Re-validate with the generated secret
    validatedEnv = validateEnvironment();
  } else {
    throw error;
  }
}

export const env = validatedEnv;

// Export specific environment variables for easy access
export const {
  DATABASE_URL = DEFAULT_DEV_DATABASE_URL,
  JWT_SECRET,
  NODE_ENV,
  WORKOS_API_KEY,
  WORKOS_CLIENT_ID,
  STRIPE_SECRET_KEY,
  NEXT_PUBLIC_API_URL,
} = env;
