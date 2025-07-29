/**
 * Environment Setup for Tests
 * Configures environment variables and test-specific settings
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.test if it exists
const testEnvPath = resolve(__dirname, '../../.env.test');
config({ path: testEnvPath });

// Load environment variables from .env.local as fallback
const localEnvPath = resolve(__dirname, '../../.env.local');
config({ path: localEnvPath });

// Set default test environment variables
const testDefaults = {
  NODE_ENV: 'test',

  // Authentication
  JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing',
  WORKOS_API_KEY: process.env.WORKOS_API_KEY || 'test-workos-api-key',

  // Database
  DATABASE_URL:
    process.env.DATABASE_URL ||
    'postgresql://test:test@localhost:5432/platform_test',

  // Stripe (use test keys)
  STRIPE_SECRET_KEY:
    process.env.STRIPE_TEST_SECRET_KEY ||
    process.env.STRIPE_SECRET_KEY ||
    'sk_test_mock_key',
  STRIPE_PUBLISHABLE_KEY:
    process.env.STRIPE_TEST_PUBLISHABLE_KEY ||
    process.env.STRIPE_PUBLISHABLE_KEY ||
    'pk_test_mock_key',
  STRIPE_WEBHOOK_SECRET:
    process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_webhook_secret',

  // Alchemy (for crypto tests)
  ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY || 'test_alchemy_key',

  // App configuration
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'test-nextauth-secret',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',

  // Logging
  LOG_LEVEL: 'error', // Suppress logs during tests

  // Test-specific settings
  JEST_TIMEOUT: '30000',
  TEST_PARALLEL: 'false', // Run integration tests sequentially
};

// Apply defaults only if not already set
Object.entries(testDefaults).forEach(([key, value]) => {
  if (!process.env[key]) {
    process.env[key] = value;
  }
});

// Validate critical environment variables for integration tests
const requiredVars = ['DATABASE_URL'];
const missingVars = requiredVars.filter((key) => !process.env[key]);

if (missingVars.length > 0) {
  console.error(
    'Missing required environment variables for integration tests:',
  );
  missingVars.forEach((key) => console.error(`  - ${key}`));
  console.error(
    '\nPlease create a .env.test file with the required variables.',
  );
  process.exit(1);
}

// Warn about using production keys in tests
if (
  process.env.STRIPE_SECRET_KEY &&
  !process.env.STRIPE_SECRET_KEY.includes('test')
) {
  console.warn('⚠️  WARNING: Using production Stripe key in tests');
}

if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('prod')) {
  console.error('❌ ERROR: Production database URL detected in tests');
  process.exit(1);
}

// Configure test-specific behavior
if (process.env.NODE_ENV === 'test') {
  // Suppress unnecessary console output during tests
  const originalConsole = { ...console };

  console.log = (...args) => {
    if (process.env.VERBOSE_TESTS === 'true') {
      originalConsole.log(...args);
    }
  };

  console.info = (...args) => {
    if (process.env.VERBOSE_TESTS === 'true') {
      originalConsole.info(...args);
    }
  };

  // Always show warnings and errors
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
}

// Export configuration for test utilities
export const testConfig = {
  database: {
    url: process.env.DATABASE_URL!,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  },
  alchemy: {
    apiKey: process.env.ALCHEMY_API_KEY!,
  },
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL!,
  },
  test: {
    timeout: parseInt(process.env.JEST_TIMEOUT || '30000', 10),
    parallel: process.env.TEST_PARALLEL === 'true',
    verbose: process.env.VERBOSE_TESTS === 'true',
  },
};

console.log('🧪 Test environment configured');
if (testConfig.test.verbose) {
  console.log('Environment variables loaded:');
  console.log(
    '  - Database:',
    testConfig.database.url.replace(/\/\/.*@/, '//***:***@'),
  );
  console.log(
    '  - Stripe:',
    testConfig.stripe.secretKey.substring(0, 12) + '...',
  );
  console.log('  - App URL:', testConfig.app.url);
}
