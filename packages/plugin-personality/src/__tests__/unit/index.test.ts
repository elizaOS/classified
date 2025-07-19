import { describe, it, expect } from 'bun:test';
import selfModificationPlugin from '../../index';
import { CharacterFileManager } from '../../services/character-file-manager';

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

describe('Self Modification Plugin', () => {
  const selfModificationPluginSuite = new TestSuite('Self Modification Plugin', {});

  selfModificationPluginSuite.addTest(
    createUnitTest({
      name: 'should export a valid plugin object',
      fn: () => {
        expect(selfModificationPlugin).toBeDefined();
        expect(selfModificationPlugin.name).toBe('@elizaos/plugin-personality');
        expect(selfModificationPlugin.description).toBeDefined();
      },
    })
  );

  selfModificationPluginSuite.addTest(
    createUnitTest({
      name: 'should have actions array',
      fn: () => {
        expect(selfModificationPlugin.actions).toBeDefined();
        expect(Array.isArray(selfModificationPlugin.actions)).toBe(true);
        expect(selfModificationPlugin.actions!.length).toBeGreaterThan(0);
      },
    })
  );

  selfModificationPluginSuite.addTest(
    createUnitTest({
      name: 'should have evaluators array',
      fn: () => {
        expect(selfModificationPlugin.evaluators).toBeDefined();
        expect(Array.isArray(selfModificationPlugin.evaluators)).toBe(true);
        expect(selfModificationPlugin.evaluators!.length).toBeGreaterThan(0);
      },
    })
  );

  selfModificationPluginSuite.addTest(
    createUnitTest({
      name: 'should have providers array',
      fn: () => {
        expect(selfModificationPlugin.providers).toBeDefined();
        expect(Array.isArray(selfModificationPlugin.providers)).toBe(true);
        expect(selfModificationPlugin.providers!.length).toBeGreaterThan(0);
      },
    })
  );

  selfModificationPluginSuite.addTest(
    createUnitTest({
      name: 'should have services array',
      fn: () => {
        expect(selfModificationPlugin.services).toBeDefined();
        expect(Array.isArray(selfModificationPlugin.services)).toBe(true);
        expect(selfModificationPlugin.services!.length).toBeGreaterThan(0);
      },
    })
  );

  selfModificationPluginSuite.addTest(
    createUnitTest({
      name: 'should contain MODIFY_CHARACTER action',
      fn: () => {
        const modifyAction = selfModificationPlugin.actions?.find(
          (action) => action.name === 'MODIFY_CHARACTER'
        );
        expect(modifyAction).toBeDefined();
        expect(modifyAction?.description).toBeDefined();
        expect(modifyAction?.validate).toBeDefined();
        expect(modifyAction?.handler).toBeDefined();
      },
    })
  );

  selfModificationPluginSuite.addTest(
    createUnitTest({
      name: 'should contain RESTORE_CHARACTER action',
      fn: () => {
        const restoreAction = selfModificationPlugin.actions?.find(
          (action) => action.name === 'RESTORE_CHARACTER'
        );
        expect(restoreAction).toBeDefined();
        expect(restoreAction?.description).toBeDefined();
        expect(restoreAction?.validate).toBeDefined();
        expect(restoreAction?.handler).toBeDefined();
      },
    })
  );

  selfModificationPluginSuite.addTest(
    createUnitTest({
      name: 'should contain CHARACTER_EVOLUTION evaluator',
      fn: () => {
        const evaluator = selfModificationPlugin.evaluators?.find(
          (evaluatorItem) => evaluatorItem.name === 'CHARACTER_EVOLUTION'
        );
        expect(evaluator).toBeDefined();
        expect(evaluator?.description).toBeDefined();
        expect(evaluator?.validate).toBeDefined();
        expect(evaluator?.handler).toBeDefined();
      },
    })
  );

  selfModificationPluginSuite.addTest(
    createUnitTest({
      name: 'should contain CHARACTER_EVOLUTION provider',
      fn: () => {
        const provider = selfModificationPlugin.providers?.find(
          (prov) => prov.name === 'CHARACTER_EVOLUTION'
        );
        expect(provider).toBeDefined();
        expect(provider?.description).toBeDefined();
        expect(provider?.get).toBeDefined();
      },
    })
  );

  selfModificationPluginSuite.addTest(
    createUnitTest({
      name: 'should contain character-file-manager service',
      fn: () => {
        const service = selfModificationPlugin.services?.find(
          (svc) =>
            svc === CharacterFileManager ||
            svc.serviceName === 'character-file-manager' ||
            svc.name === 'character-file-manager'
        );
        expect(service).toBeDefined();
      },
    })
  );

  selfModificationPluginSuite.addTest(
    createUnitTest({
      name: 'should have proper plugin metadata',
      fn: () => {
        expect(selfModificationPlugin.name).toBe('@elizaos/plugin-personality');
        expect(selfModificationPlugin.description).toContain('self-modification');
      },
    })
  );

  selfModificationPluginSuite.run();
});
