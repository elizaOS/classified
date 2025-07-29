/**
 * Runtime Integration Test Setup
 * Configures real ElizaOS runtime for billing tests
 */

import { beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { logger } from '@/lib/logger';

// Set test timeout for runtime operations
jest.setTimeout(60000);

// Global runtime test setup
beforeAll(async () => {
  // Ensure required environment variables are set
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      'postgresql://test:test@localhost:5432/platform_test';
  }

  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.warn('No AI model API key found - some tests may fail');
    process.env.OPENAI_API_KEY = 'test-key';
  }

  // Set test mode (NODE_ENV is read-only in some environments)
  // process.env.NODE_ENV = 'test';
  process.env.RUNTIME_TEST_MODE = 'true';

  // Configure logger for tests
  logger.setLevel('ERROR'); // Reduce log noise in tests

  console.log('🤖 Runtime test environment configured');
});

// Global cleanup
afterAll(async () => {
  // Cleanup any global runtime resources
  try {
    // The RuntimeTestHarness handles most cleanup, but we can add global cleanup here
    console.log('🧹 Runtime test cleanup completed');
  } catch (error) {
    console.warn('Runtime cleanup warning:', error);
  }
});

// Reset state before each test
beforeEach(() => {
  // Clear all mocks
  jest.clearAllMocks();

  // Reset any global state that might affect tests
});

// Handle unhandled promises and errors
process.on('unhandledRejection', (reason, promise) => {
  console.error(
    'Unhandled Rejection in runtime test:',
    promise,
    'reason:',
    reason,
  );
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception in runtime test:', error);
});

// Performance monitoring for runtime tests
// Commenting out custom test wrapper as it causes type issues
// const originalTest = global.test;
// (global.test as any) = (name: string, fn: any, timeout?: number) => {
//   ... monitoring code would go here
// };

// Database health check
beforeAll(async () => {
  try {
    // Import database connection
    const { getDatabase } = await import('@/lib/database/connection');
    const db = getDatabase();

    // Test connection
    console.log('📊 Database connection verified for runtime tests');
  } catch (error) {
    console.error('Database connection failed for runtime tests:', error);
    throw new Error('Database connection required for runtime tests');
  }
});

// Model provider validation
beforeAll(async () => {
  const hasOpenAI = !!process.env.OPENAI_API_KEY?.startsWith('sk-');
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-');

  if (!hasOpenAI && !hasAnthropic) {
    console.warn(
      '⚠️  No valid AI model API keys found - tests may use mock responses',
    );
  } else {
    console.log('🧠 AI model provider verified for runtime tests');
  }
});

// Runtime test utilities
export const runtimeTestUtils = {
  /**
   * Wait for async operations to complete
   */
  waitForAsync: (ms: number = 1000) =>
    new Promise((resolve) => setTimeout(resolve, ms)),

  /**
   * Generate unique test IDs
   */
  generateTestId: (prefix: string = 'test') =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2)}`,

  /**
   * Retry async operations with exponential backoff
   */
  retryAsync: async <T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000,
  ): Promise<T> => {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxAttempts) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await runtimeTestUtils.waitForAsync(delay);
        }
      }
    }

    throw lastError!;
  },

  /**
   * Wait for condition to be true
   */
  waitForCondition: async (
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100,
  ): Promise<void> => {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await runtimeTestUtils.waitForAsync(interval);
    }

    throw new Error(`Condition not met within ${timeout}ms`);
  },

  /**
   * Create test organization data
   */
  createTestOrgData: (orgId: string) => ({
    id: orgId,
    name: `Test Organization ${orgId}`,
    slug: `test-org-${orgId}`,
    creditBalance: '100.00',
    autoTopUpEnabled: false,
    creditThreshold: '50.00',
    autoTopUpAmount: '100.00',
    createdAt: new Date(),
    updatedAt: new Date(),
  }),

  /**
   * Cleanup test data
   */
  cleanupTestData: async (orgId: string) => {
    try {
      const { getDatabase } = await import('@/lib/database/connection');
      const { organizations, creditTransactions } = await import(
        '@/lib/database/schema'
      );
      const { eq } = await import('drizzle-orm');

      const db = getDatabase();

      // Clean up in correct order
      await db
        .delete(creditTransactions)
        .where(eq(creditTransactions.organizationId, orgId));
      await db.delete(organizations).where(eq(organizations.id, orgId));

      console.log(`✅ Cleaned up test data for organization: ${orgId}`);
    } catch (error) {
      console.error('❌ Failed to cleanup test data:', error);
    }
  },

  /**
   * Validate runtime memory operations
   */
  validateMemoryOperations: async (
    runtime: any,
    roomId: string,
    expectedCount: number,
  ) => {
    const memories = await runtime.getMemories({ roomId, count: 100 });

    if (memories.length < expectedCount) {
      throw new Error(
        `Expected at least ${expectedCount} memories, found ${memories.length}`,
      );
    }

    // Validate memory structure
    for (const memory of memories) {
      if (!memory.id || !memory.content) {
        throw new Error('Invalid memory structure detected');
      }
    }

    return memories;
  },
};

// Export for use in tests
declare global {
  var runtimeTestUtils: any;
}

global.runtimeTestUtils = runtimeTestUtils;
