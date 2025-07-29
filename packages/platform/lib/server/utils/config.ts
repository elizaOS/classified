/**
 * Configuration management
 */

import type { PlatformConfig } from '../types';
import { getBillingConfig } from '../../billing/config';

/**
 * Load and validate platform configuration from environment variables
 */
export function loadConfig(): PlatformConfig {
  // Load billing configuration for Stripe price IDs
  const billingConfig = getBillingConfig();

  const config: PlatformConfig = {
    port: parseInt(process.env.PORT || '3333', 10),
    host: process.env.HOST || 'localhost',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3333',
    ],
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',

    workos: {
      apiKey: process.env.WORKOS_API_KEY || '',
      clientId: process.env.WORKOS_CLIENT_ID || '',
      redirectUri:
        process.env.WORKOS_REDIRECT_URI ||
        'http://localhost:3333/api/v1/auth/callback',
      environment:
        (process.env.WORKOS_ENVIRONMENT as 'staging' | 'production') ||
        'staging',
    },

    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      priceIds: {
        basic: billingConfig.subscriptionTiers.basic.priceId,
        pro: billingConfig.subscriptionTiers.pro.priceId,
        premium: billingConfig.subscriptionTiers.premium.priceId,
        enterprise: billingConfig.subscriptionTiers.enterprise.priceId,
      },
    },

    database: {
      url: process.env.DATABASE_URL || 'postgresql://localhost:5432/elizaos',
      maxConnections: parseInt(
        process.env.DATABASE_MAX_CONNECTIONS || '10',
        10,
      ),
    },

    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    },

    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    },
  };

  // Validate required configuration
  if (process.env.NODE_ENV === 'production') {
    if (
      !config.jwtSecret ||
      config.jwtSecret === 'dev-secret-change-in-production'
    ) {
      console.warn(
        'Warning: JWT_SECRET should be set in production. Using default (not secure).',
      );
    }

    if (!config.workos.apiKey || !config.workos.clientId) {
      console.warn(
        'Warning: WorkOS configuration is missing. Authentication features will be limited.',
      );
    }

    if (!config.stripe.secretKey || !config.stripe.publishableKey) {
      console.warn(
        'Warning: Stripe configuration is missing. Billing features will be disabled.',
      );
    }
  }

  return config;
}
