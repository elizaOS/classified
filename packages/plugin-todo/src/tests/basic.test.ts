import { describe, it, expect } from 'bun:test';
import { TodoPlugin } from '../index';

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

describe('TodoPlugin Basic Tests', () => {
  const todoPluginSuite = new TestSuite('TodoPlugin Basic Tests', {});

  todoPluginSuite.addTest(
    createUnitTest({
      name: 'should have the correct plugin name',
      fn: () => {
        expect(TodoPlugin.name).toBe('todo');
      },
    })
  );

  todoPluginSuite.addTest(
    createUnitTest({
      name: 'should have the correct description',
      fn: () => {
        expect(TodoPlugin.description).toContain('task management');
      },
    })
  );

  todoPluginSuite.addTest(
    createUnitTest({
      name: 'should export two services',
      fn: () => {
        expect(TodoPlugin.services).toHaveLength(2);
      },
    })
  );

  todoPluginSuite.addTest(
    createUnitTest({
      name: 'should have all required actions',
      fn: () => {
        expect(TodoPlugin.actions).toHaveLength(5);
        const actionNames = TodoPlugin.actions?.map((action) => action.name) || [];
        expect(actionNames).toContain('CREATE_TODO');
        expect(actionNames).toContain('COMPLETE_TODO');
        expect(actionNames).toContain('CONFIRM_TODO');
        expect(actionNames).toContain('UPDATE_TODO');
        expect(actionNames).toContain('CANCEL_TODO');
      },
    })
  );

  todoPluginSuite.addTest(
    createUnitTest({
      name: 'should have the todos provider',
      fn: () => {
        expect(TodoPlugin.providers).toHaveLength(1);
      },
    })
  );

  todoPluginSuite.addTest(
    createUnitTest({
      name: 'should have the correct test dependencies',
      fn: () => {
        expect(TodoPlugin.testDependencies).toContain('@elizaos/plugin-sql');
      },
    })
  );

  todoPluginSuite.run();
});
