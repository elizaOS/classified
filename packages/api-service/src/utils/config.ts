/**
 * API Service Configuration
 */

import type { APIServiceConfig } from '../types/index.js';

// Helper to get required env var
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getAPIServiceConfig(): APIServiceConfig {
  const requiredEnvVars = [
    'PLATFORM_URL',
    'JWT_SECRET',
    'DATABASE_URL',
    'REDIS_URL',
    'OPENAI_API_KEY',
  ];

  // Check for required environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    port: parseInt(process.env.API_SERVICE_PORT || '8001', 10),
    host: process.env.API_SERVICE_HOST || '0.0.0.0',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    jwtSecret: getRequiredEnv('JWT_SECRET'),
    platformUrl: getRequiredEnv('PLATFORM_URL'),

    database: {
      url: getRequiredEnv('DATABASE_URL'),
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
    },

    redis: {
      url: getRequiredEnv('REDIS_URL'),
    },

    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10),
    },

    providers: {
      openai: {
        apiKey: getRequiredEnv('OPENAI_API_KEY'),
        baseURL: process.env.OPENAI_BASE_URL,
        maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10),
        timeout: parseInt(process.env.OPENAI_TIMEOUT || '60000', 10),
        enabled: process.env.OPENAI_ENABLED !== 'false',
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        baseURL: process.env.ANTHROPIC_BASE_URL,
        maxRetries: parseInt(process.env.ANTHROPIC_MAX_RETRIES || '3', 10),
        timeout: parseInt(process.env.ANTHROPIC_TIMEOUT || '60000', 10),
        enabled:
          process.env.ANTHROPIC_ENABLED === 'true' &&
          !!process.env.ANTHROPIC_API_KEY,
      },
      google: {
        apiKey: process.env.GOOGLE_API_KEY || '',
        baseURL: process.env.GOOGLE_BASE_URL,
        maxRetries: parseInt(process.env.GOOGLE_MAX_RETRIES || '3', 10),
        timeout: parseInt(process.env.GOOGLE_TIMEOUT || '60000', 10),
        enabled:
          process.env.GOOGLE_ENABLED === 'true' && !!process.env.GOOGLE_API_KEY,
      },
      xai: {
        apiKey: process.env.XAI_API_KEY || '',
        baseURL: process.env.XAI_BASE_URL,
        maxRetries: parseInt(process.env.XAI_MAX_RETRIES || '3', 10),
        timeout: parseInt(process.env.XAI_TIMEOUT || '60000', 10),
        enabled:
          process.env.XAI_ENABLED === 'true' && !!process.env.XAI_API_KEY,
      },
    },
  };
}

export function validateAPIServiceConfig(config: APIServiceConfig): void {
  // Validate platform URL
  try {
    new URL(config.platformUrl);
  } catch {
    throw new Error('Invalid PLATFORM_URL format');
  }

  // Validate JWT secret length
  if (config.jwtSecret.length < 32) {
    throw new Error('JWT secret must be at least 32 characters long');
  }

  // Validate database URL
  if (
    !config.database.url.startsWith('postgres://') &&
    !config.database.url.startsWith('postgresql://')
  ) {
    throw new Error(
      'Database URL must be a valid PostgreSQL connection string'
    );
  }

  // Validate Redis URL
  if (
    !config.redis.url.startsWith('redis://') &&
    !config.redis.url.startsWith('rediss://')
  ) {
    throw new Error('Redis URL must be a valid Redis connection string');
  }

  // Check that at least one provider is enabled
  const enabledProviders = Object.values(config.providers).filter(
    (p) => p.enabled
  );
  if (enabledProviders.length === 0) {
    throw new Error('At least one AI provider must be enabled');
  }

  // Validate API keys for enabled providers
  Object.entries(config.providers).forEach(([name, provider]) => {
    if (provider.enabled && !provider.apiKey) {
      throw new Error(`API key required for enabled provider: ${name}`);
    }
  });

  console.log('✅ API Service configuration validated successfully');
  console.log(`📍 Enabled providers: ${enabledProviders.length}`);
  console.log(`🔗 Platform URL: ${config.platformUrl}`);
}
