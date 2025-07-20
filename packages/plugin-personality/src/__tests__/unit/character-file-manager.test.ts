import { describe, it, expect, beforeEach } from 'bun:test';
import { CharacterFileManager } from '../../services/character-file-manager';
import type { IAgentRuntime } from '@elizaos/core';

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

const createUnitTest = (config: { name: string; fn: (context: any) => Promise<void> | void }) =>
  config;

describe('CharacterFileManager', () => {
  const characterFileManagerSuite = new TestSuite('CharacterFileManager', {
    beforeEach: () => {
      const mockRuntime = {
        getSetting: () => null,
        character: {
          bio: ['Original bio'],
          topics: ['topic1', 'topic2'],
          name: 'TestAgent',
        },
        agentId: 'test-agent-id',
      } as any;
      const fileManager = new CharacterFileManager(mockRuntime);

      return { fileManager, mockRuntime };
    },
  });

  characterFileManagerSuite.addTest(
    createUnitTest({
      name: 'validateModification should validate valid modifications',
      fn: ({ fileManager }) => {
        const modification = {
          bio: ['New bio line'],
          topics: ['new topic'],
        };

        const result = fileManager.validateModification(modification);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      },
    })
  );

  characterFileManagerSuite.addTest(
    createUnitTest({
      name: 'validateModification should reject modifications with XSS attempts',
      fn: ({ fileManager }) => {
        const modification = {
          bio: ['<script>alert("xss")</script>'],
          topics: ['javascript:void(0)'],
        };

        const result = fileManager.validateModification(modification);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid bio: failed validation rules');
      },
    })
  );

  characterFileManagerSuite.addTest(
    createUnitTest({
      name: 'validateModification should reject modifications exceeding limits',
      fn: ({ fileManager }) => {
        const modification = {
          bio: new Array(21).fill('Too many bio elements'),
          topics: new Array(51).fill('Too many topics'),
        };

        const result = fileManager.validateModification(modification);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Too many bio elements - maximum 20 allowed');
        expect(result.errors).toContain('Too many topics - maximum 50 allowed');
      },
    })
  );

  characterFileManagerSuite.addTest(
    createUnitTest({
      name: 'validateModification should reject empty string values',
      fn: ({ fileManager }) => {
        const modification = {
          bio: ['', 'Valid bio'],
          topics: ['valid topic', ''],
        };

        const result = fileManager.validateModification(modification);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid bio: failed validation rules');
      },
    })
  );

  characterFileManagerSuite.addTest(
    createUnitTest({
      name: 'validateModification should accept edge case of maximum allowed elements',
      fn: ({ fileManager }) => {
        const modification = {
          bio: new Array(20).fill('Valid bio element'),
          topics: new Array(50).fill('validtopic'),
        };

        const result = fileManager.validateModification(modification);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      },
    })
  );

  characterFileManagerSuite.addTest(
    createUnitTest({
      name: 'validateModification should validate system prompt modifications',
      fn: ({ fileManager }) => {
        const validSystem = {
          system: 'You are a helpful assistant that provides accurate information.',
        };

        const invalidSystem = {
          system: '<script>alert("xss")</script>',
        };

        const shortSystem = {
          system: 'Too short',
        };

        expect(fileManager.validateModification(validSystem).valid).toBe(true);
        expect(fileManager.validateModification(invalidSystem).valid).toBe(false);
        expect(fileManager.validateModification(shortSystem).valid).toBe(false);
      },
    })
  );

  characterFileManagerSuite.run();

  // Static methods tests - using traditional describe/it for static tests
  const staticMethodsSuite = new TestSuite('CharacterFileManager static methods', {});

  staticMethodsSuite.addTest(
    createUnitTest({
      name: 'should have correct service name and type',
      fn: () => {
        expect(CharacterFileManager.serviceType).toBe('character_management');
        expect(CharacterFileManager.serviceType).toBe('character_management');
      },
    })
  );

  staticMethodsSuite.run();
});
