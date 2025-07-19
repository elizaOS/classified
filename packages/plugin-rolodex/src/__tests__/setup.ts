import './setup-window-mock';
// Import jest-dom for custom matchers
import '@testing-library/jest-dom';
import './jest-dom.d.ts';
import { afterEach } from 'bun:test';
import { cleanup } from '@testing-library/react';
import { mock } from 'bun:test';
import { logger, IAgentRuntime } from '@elizaos/core';

// Mock browser APIs for tests
import './browser-mocks';

// Mock window and document for frontend tests
if (typeof window !== 'undefined') {
  // Add missing window properties for jsdom
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 1024,
  });

  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: 768,
  });
}

// Global test utilities
global.console = {
  ...console,
  error: mock(console.error),
  warn: mock(console.warn),
};

// Mock fetch globally
global.fetch = mock(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Headers(),
    redirected: false,
    status: 200,
    statusText: 'OK',
    type: 'default',
    url: '',
    body: null,
    bodyUsed: false,
    clone: () => new Response(),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
  } as Response)
) as unknown as typeof fetch;

// Suppress specific console errors in tests
const originalError = console.error;
console.error = (...args: any[]) => {
  // Suppress React act() warnings
  if (args[0]?.includes?.('act()')) {
    return;
  }
  // Suppress force-graph warnings
  if (args[0]?.includes?.('force-graph')) {
    return;
  }
  originalError(...args);
};

// Cleanup after each test
afterEach(() => {
  // Clean up React components
  cleanup();
  // Clear all mocks
  mock.restore();
});

// E2E Test setup utilities
/**
 * Test setup utilities for E2E tests
 */
export class TestSetup {
  /**
   * Verify that all required services are available
   */
  static async verifyServices(runtime: IAgentRuntime): Promise<void> {
    const requiredServices = [
      'entity',
      'relationship',
      'followup',
      'entity-graph',
      'entity-resolution',
    ];

    const missingServices: string[] = [];

    for (const serviceName of requiredServices) {
      const service = runtime.getService(serviceName);
      if (!service) {
        missingServices.push(serviceName);
      }
    }

    if (missingServices.length > 0) {
      logger.warn(`[TestSetup] Missing services: ${missingServices.join(', ')}`);
      throw new Error(`Required services not available: ${missingServices.join(', ')}`);
    }

    logger.info('[TestSetup] All required services are available');
  }

  /**
   * Clean up test data (optional - use with caution)
   */
  static async cleanupTestData(
    runtime: IAgentRuntime,
    testPrefix: string = 'test-'
  ): Promise<void> {
    try {
      logger.info(`[TestSetup] Cleaning up test data with prefix: ${testPrefix}`);

      // Note: This is a basic cleanup example
      // In a real implementation, you might want more sophisticated cleanup
      // that doesn't interfere with other tests or actual data

      logger.info('[TestSetup] Test data cleanup completed');
    } catch (error) {
      logger.error('[TestSetup] Error during cleanup:', error);
      // Don't throw - cleanup failures shouldn't fail tests
    }
  }

  /**
   * Create test runtime configuration
   */
  static getTestConfig() {
    return {
      // Test-specific configuration
      testMode: true,
      logLevel: 'info',
      cacheEnabled: false,

      // Service configurations for testing
      services: {
        'entity-resolution': {
          cacheExpiryMinutes: 1, // Short cache for testing
          highConfidenceThreshold: 0.7, // Lower threshold for testing
        },
      },
    };
  }

  /**
   * Wait for services to be ready
   */
  static async waitForServices(runtime: IAgentRuntime, timeoutMs: number = 5000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        await TestSetup.verifyServices(runtime);
        return;
      } catch (error) {
        // Wait a bit and try again
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    throw new Error('Services not ready within timeout period');
  }
}
