/**
 * Runtime Environment Configuration
 * Sets up environment variables for runtime integration tests
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment variables
const testEnvPath = resolve(__dirname, '../../.env.test');
config({ path: testEnvPath });

// Load development environment as fallback
const devEnvPath = resolve(__dirname, '../../.env.local');
config({ path: devEnvPath });

// Runtime test environment defaults
const runtimeTestDefaults = {
  NODE_ENV: 'test',
  RUNTIME_TEST_MODE: 'true',

  // Authentication
  JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing',
  WORKOS_API_KEY: process.env.WORKOS_API_KEY || 'test-workos-api-key',

  // Database
  DATABASE_URL:
    process.env.DATABASE_URL ||
    'postgresql://test:test@localhost:5432/platform_test',

  // AI Model APIs
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-openai-key',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || 'test-anthropic-key',

  // Billing (use test keys for runtime tests)
  STRIPE_SECRET_KEY:
    process.env.STRIPE_TEST_SECRET_KEY ||
    process.env.STRIPE_SECRET_KEY ||
    'sk_test_mock',
  STRIPE_PUBLISHABLE_KEY:
    process.env.STRIPE_TEST_PUBLISHABLE_KEY ||
    process.env.STRIPE_PUBLISHABLE_KEY ||
    'pk_test_mock',
  STRIPE_WEBHOOK_SECRET:
    process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret',

  // Crypto payments (optional for runtime tests)
  ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY || undefined,

  // App configuration
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'test-nextauth-secret',

  // Logging and debugging
  LOG_LEVEL: process.env.LOG_LEVEL || 'error',
  DEBUG: process.env.DEBUG || '',

  // Test configuration
  JEST_TIMEOUT: '60000',
  TEST_PARALLEL: 'false',
  RUNTIME_ISOLATION: 'true',

  // ElizaOS specific
  ELIZAOS_LOG_LEVEL: 'error',
  ELIZAOS_PLUGIN_PATH: process.cwd(),
};

// Apply defaults only if not already set
Object.entries(runtimeTestDefaults).forEach(([key, value]) => {
  if (value !== undefined && !process.env[key]) {
    process.env[key] = value;
  }
});

// Validate critical environment variables
const criticalVars = ['DATABASE_URL'];
const missingCritical = criticalVars.filter((key) => !process.env[key]);

if (missingCritical.length > 0) {
  console.error('❌ Missing critical environment variables for runtime tests:');
  missingCritical.forEach((key) => console.error(`  - ${key}`));
  console.error(
    '\nPlease create a .env.test file with the required variables.',
  );
  process.exit(1);
}

// Warn about missing optional variables
const optionalVars = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];
const missingOptional = optionalVars.filter(
  (key) => !process.env[key] || process.env[key]?.startsWith('test-'),
);

if (missingOptional.length > 0) {
  console.warn(
    '⚠️  Missing optional environment variables (tests may use mocks):',
  );
  missingOptional.forEach((key) => console.warn(`  - ${key}`));
}

// Security warnings
if (
  process.env.STRIPE_SECRET_KEY &&
  !process.env.STRIPE_SECRET_KEY.includes('test')
) {
  console.warn('⚠️  WARNING: Using production Stripe key in runtime tests');
}

if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('prod')) {
  console.error('❌ ERROR: Production database URL detected in runtime tests');
  process.exit(1);
}

// Configure test-specific behavior
if (process.env.NODE_ENV === 'test') {
  // Suppress console output unless verbose mode
  const originalConsole = { ...console };

  if (process.env.VERBOSE_TESTS !== 'true') {
    console.log = () => {};
    console.info = () => {};
    console.debug = () => {};
  }

  // Always show warnings and errors
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
}

// Export runtime test configuration
export const runtimeTestConfig = {
  database: {
    url: process.env.DATABASE_URL!,
  },
  aiModels: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
      available: !!process.env.OPENAI_API_KEY?.startsWith('sk-'),
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY!,
      available: !!process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-'),
    },
  },
  billing: {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY!,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      isTestMode: process.env.STRIPE_SECRET_KEY?.includes('test') || false,
    },
    alchemy: {
      apiKey: process.env.ALCHEMY_API_KEY,
      available: !!process.env.ALCHEMY_API_KEY,
    },
  },
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL!,
  },
  test: {
    timeout: parseInt(process.env.JEST_TIMEOUT || '60000', 10),
    parallel: process.env.TEST_PARALLEL === 'true',
    verbose: process.env.VERBOSE_TESTS === 'true',
    isolation: process.env.RUNTIME_ISOLATION === 'true',
  },
};

// Log configuration summary
console.log('🧪 Runtime test environment configured');
if (runtimeTestConfig.test.verbose) {
  console.log('Configuration summary:');
  console.log(
    '  - Database:',
    runtimeTestConfig.database.url.replace(/\/\/.*@/, '//***:***@'),
  );
  console.log(
    '  - OpenAI available:',
    runtimeTestConfig.aiModels.openai.available,
  );
  console.log(
    '  - Anthropic available:',
    runtimeTestConfig.aiModels.anthropic.available,
  );
  console.log(
    '  - Stripe test mode:',
    runtimeTestConfig.billing.stripe.isTestMode,
  );
  console.log(
    '  - Alchemy available:',
    runtimeTestConfig.billing.alchemy.available,
  );
}
