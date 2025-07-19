import { describe, it, expect } from 'bun:test';
import { stringToUuid } from '@elizaos/core';

// Simplified TestSuite implementation for local use
class TestSuite {
  constructor(
    private name: string,
    private config: any
  ) {}

  addTest(test: any) {
    it(test.name, async () => {
      const context = this.config.beforeEach ? this.config.beforeEach() : {};
      await test.fn(context);
    });
  }

  run() {
    // No-op, bun:test handles execution
  }
}

const createUnitTest = (config: { name: string; fn: (context?: any) => Promise<void> | void }) =>
  config;

describe('Infrastructure Test', () => {
  const infrastructureSuite = new TestSuite('Infrastructure Test', {});

  infrastructureSuite.addTest(
    createUnitTest({
      name: 'should have access to ElizaOS core functions',
      fn: () => {
        const uuid = stringToUuid('test');
        expect(uuid).toBeDefined();
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      },
    })
  );

  infrastructureSuite.addTest(
    createUnitTest({
      name: 'should be able to import types',
      fn: () => {
        const testData = {
          id: stringToUuid('test'),
          name: 'Test Entity',
        };
        expect(testData).toBeDefined();
        expect(testData.name).toBe('Test Entity');
      },
    })
  );

  infrastructureSuite.run();
});
