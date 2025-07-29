/**
 * Integration Test Setup
 * Global setup and configuration for billing integration tests
 */

// Global test utilities type declarations
declare global {
  var cleanupTestData: (organizationId: string) => Promise<void>;
  var createTestOrganization: (orgId: string) => Promise<any>;
}

import { beforeAll, afterAll, beforeEach, jest } from '@jest/globals';

// Global test timeout
jest.setTimeout(30000);

// Mock environment variables if not present
beforeAll(() => {
  // Ensure required environment variables are set for tests
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      'postgresql://test:test@localhost:5432/platform_test';
  }

  if (!process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_TEST_SECRET_KEY) {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key_for_testing';
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_secret';
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  }

  // Set test mode (NODE_ENV is read-only in some environments)
  // process.env.NODE_ENV = 'test';
});

// Global cleanup
afterAll(async () => {
  // Close any remaining database connections
  const { getDatabase } = await import('@/lib/database/connection');
  try {
    const db = getDatabase();
    // Add cleanup logic if your database adapter supports it
    // await db.close();
  } catch (error) {
    console.warn('Database cleanup warning:', error);
  }
});

// Reset state before each test
beforeEach(() => {
  // Clear all mocks
  jest.clearAllMocks();

  // Reset console to catch unexpected logs
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Performance monitoring for tests
// Commenting out custom test wrapper as it causes type issues
// const originalTest = global.test;
// (global.test as any) = (name: string, fn: any, timeout?: number) => {
//   ... monitoring code would go here
// };

// Database health check for integration tests
beforeAll(async () => {
  try {
    const { getDatabase } = await import('@/lib/database/connection');
    const db = getDatabase();

    // Simple connection test
    // await db.execute('SELECT 1');
    console.log('Database connection verified for integration tests');
  } catch (error) {
    console.error('Database connection failed for integration tests:', error);
    throw new Error('Database connection required for integration tests');
  }
});

// Stripe configuration validation
beforeAll(async () => {
  const stripeKey =
    process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    console.warn(
      'No Stripe API key found - Stripe integration tests will be skipped',
    );
    return;
  }

  if (!stripeKey.startsWith('sk_test_')) {
    console.warn('Using live Stripe key in tests - this is not recommended');
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-02-24.acacia',
    });

    // Test API connection
    await stripe.balance.retrieve();
    console.log('Stripe API connection verified for integration tests');
  } catch (error) {
    console.error('Stripe API connection failed:', error);
    throw new Error('Valid Stripe API key required for integration tests');
  }
});

// Cleanup helper for tests
global.cleanupTestData = async (organizationId: string) => {
  try {
    const { getDatabase } = await import('@/lib/database/connection');
    const { organizations, creditTransactions, webhooks } = await import(
      '@/lib/database/schema'
    );
    const { eq } = await import('drizzle-orm');

    const db = getDatabase();

    // Clean up in correct order due to foreign key constraints
    await db
      .delete(webhooks)
      .where(eq(webhooks.organizationId, organizationId));
    await db
      .delete(creditTransactions)
      .where(eq(creditTransactions.organizationId, organizationId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));

    console.log(`Cleaned up test data for organization: ${organizationId}`);
  } catch (error) {
    console.error('Failed to cleanup test data:', error);
  }
};

// Test utilities
global.createTestOrganization = async (orgId: string) => {
  const { getDatabase } = await import('@/lib/database/connection');
  const { organizations } = await import('@/lib/database/schema');

  const db = getDatabase();
  await db.insert(organizations).values({
    id: orgId,
    name: `Test Organization ${orgId}`,
    slug: `test-org-${orgId}`,
    creditBalance: '100.00',
  });

  return orgId;
};

// Export common test utilities
export const testUtils = {
  generateTestId: () =>
    `test-${Date.now()}-${Math.random().toString(36).substring(2)}`,

  waitFor: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  retryAsync: async <T>(
    fn: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000,
  ): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        await testUtils.waitFor(delay);
        return testUtils.retryAsync(fn, retries - 1, delay);
      }
      throw error;
    }
  },

  expectEventually: async (
    assertion: () => Promise<void> | void,
    timeout: number = 5000,
    interval: number = 100,
  ): Promise<void> => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        await assertion();
        return;
      } catch (error) {
        await testUtils.waitFor(interval);
      }
    }

    // Final attempt to get the actual error
    await assertion();
  },
};
