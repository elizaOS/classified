import { describe, it, expect, beforeEach } from 'bun:test';
import type { IAgentRuntime, Memory, State } from '@elizaos/core';
import { Role, ChannelType } from '@elizaos/core';
import type { UUID } from '@elizaos/core';
import { mock } from '@elizaos/core/test-utils';
import { evaluateTrustAction } from '../evaluateTrust';
import type { TrustProfile } from '../../types/trust';

import { createMockRuntime, createMockMemory } from '../../__tests__/test-utils';

// Simplified TestSuite implementation for local use
class TestSuite {
  constructor(
    private name: string,
    private config: any
  ) {}

  addTest(test: any) {
    it(test.name, async () => {
      const context = this.config.beforeEach ? await this.config.beforeEach() : {};
      try {
        await test.fn(context);
      } finally {
        if (this.config.afterEach) {
          await this.config.afterEach(context);
        }
      }
    });
  }

  run() {
    // No-op, bun:test handles execution
  }
}

const createUnitTest = (config: { name: string; fn: (context?: any) => Promise<void> | void }) =>
  config;

const mockTrustProfile: TrustProfile = {
  entityId: 'entity-1' as UUID,
  evaluatorId: 'test-agent' as UUID,
  overallTrust: 75,
  confidence: 0.8,
  dimensions: {
    reliability: 80,
    competence: 75,
    integrity: 70,
    benevolence: 78,
    transparency: 72,
  },
  evidence: [],
  lastCalculated: Date.now(),
  calculationMethod: 'weighted_average',
  trend: {
    direction: 'stable',
    changeRate: 0,
    lastChangeAt: Date.now(),
  },
  interactionCount: 25,
};

describe('evaluateTrustAction', () => {
  const evaluateTrustSuite = new TestSuite('evaluateTrustAction', {
    beforeEach: () => {
      const testEntityId = 'entity-1' as UUID;
      const trustEngine = {
        evaluateTrust: mock().mockResolvedValue(mockTrustProfile),
        calculateTrust: mock().mockResolvedValue(mockTrustProfile),
        getTrustScore: mock().mockResolvedValue({
          overall: 75,
          confidence: 0.8,
          dimensions: {
            reliability: 80,
            competence: 75,
            integrity: 70,
            benevolence: 78,
            transparency: 72,
          },
          trend: 'stable',
          lastUpdated: Date.now(),
        }),
      };

      const runtime = createMockRuntime({
        getService: mock().mockImplementation((name: string) => {
          if (name === 'trust') {
            return trustEngine;
          }
          return null;
        }),
      });

      return { runtime, trustEngine, testEntityId };
    },
  });

  evaluateTrustSuite.addTest(
    createUnitTest({
      name: 'should return a simple trust level for the message sender',
      fn: async ({ runtime, trustEngine, testEntityId }) => {
        const memory = createMockMemory('What is my trust score?', testEntityId);
        const result = await evaluateTrustAction.handler(runtime, memory);

        expect(trustEngine.getTrustScore.calls.length).toBeGreaterThan(0);
        expect(trustEngine.getTrustScore.calls[0][0]).toBe(testEntityId);

        expect(result).toBeDefined();
        expect((result as any).text).toContain('Trust Level: Good (75/100)');
      },
    })
  );

  evaluateTrustSuite.addTest(
    createUnitTest({
      name: 'should return a detailed trust profile when requested',
      fn: async ({ runtime, testEntityId }) => {
        const memory = createMockMemory('{"detailed": true}', testEntityId);
        const result = await evaluateTrustAction.handler(runtime, memory);

        expect(result).toBeDefined();
        expect((result as any).text).toContain('Trust Profile');
        expect((result as any).text).toContain('Overall Trust: 75/100');
        expect((result as any).text).toContain('Confidence: 80%');
        expect((result as any).text).toContain('reliability: 80/100');
      },
    })
  );

  evaluateTrustSuite.addTest(
    createUnitTest({
      name: 'should evaluate a specific entity if entityId is provided',
      fn: async ({ runtime, trustEngine, testEntityId }) => {
        const memory = createMockMemory(
          '{"entityId": "specific-entity", "detailed": false}',
          testEntityId
        );
        const result = await evaluateTrustAction.handler(runtime, memory);

        expect(trustEngine.getTrustScore.calls.length).toBeGreaterThan(0);
        expect(trustEngine.getTrustScore.calls[0][0]).toBe('specific-entity');
        expect(result).toBeDefined();
      },
    })
  );

  evaluateTrustSuite.addTest(
    createUnitTest({
      name: 'should return an error if the trust engine service is not available',
      fn: async ({ testEntityId }) => {
        const runtimeWithoutService = createMockRuntime({
          getService: mock().mockReturnValue(null),
        });

        const memory = createMockMemory('What is my trust score?', testEntityId);

        await expect(evaluateTrustAction.handler(runtimeWithoutService, memory)).rejects.toThrow(
          'Trust service not available'
        );
      },
    })
  );

  evaluateTrustSuite.addTest(
    createUnitTest({
      name: 'should handle trust evaluation with specific context',
      fn: async ({ runtime, trustEngine, testEntityId }) => {
        const memory = createMockMemory('What is my trust score?', testEntityId);
        const result = await evaluateTrustAction.handler(runtime, memory);

        expect(trustEngine.getTrustScore.calls.length).toBeGreaterThan(0);
        expect(trustEngine.getTrustScore.calls[0][0]).toBe(testEntityId);
        expect(result).toBeDefined();
      },
    })
  );

  evaluateTrustSuite.addTest(
    createUnitTest({
      name: 'should format trust profile with all dimensions',
      fn: async ({ runtime, testEntityId }) => {
        const memory = createMockMemory('{"detailed": true}', testEntityId);

        const result = await evaluateTrustAction.handler(runtime, memory);

        expect(result).toBeDefined();
        expect((result as any).text).toContain('Trust Profile');
        expect((result as any).text).toContain('reliability');
        expect((result as any).text).toContain('competence');
        expect((result as any).text).toContain('integrity');
        expect((result as any).text).toContain('benevolence');
        expect((result as any).text).toContain('transparency');
      },
    })
  );

  evaluateTrustSuite.addTest(
    createUnitTest({
      name: 'should include trust level descriptions',
      fn: async ({ runtime, trustEngine, testEntityId }) => {
        // Test different trust levels
        const levels = [
          { score: 85, expected: 'High' },
          { score: 65, expected: 'Good' },
          { score: 45, expected: 'Moderate' },
          { score: 25, expected: 'Low' },
          { score: 10, expected: 'Very Low' },
        ];

        for (const { score, expected } of levels) {
          trustEngine.getTrustScore.mockResolvedValue({
            overall: score,
            confidence: 0.8,
            dimensions: {
              reliability: 80,
              competence: 75,
              integrity: 70,
              benevolence: 78,
              transparency: 72,
            },
            trend: 'stable',
            lastUpdated: Date.now(),
          });

          const memory = createMockMemory('What is my trust score?', testEntityId);
          const result = await evaluateTrustAction.handler(runtime, memory);

          expect((result as any).text).toContain(`Trust Level: ${expected}`);
        }
      },
    })
  );

  evaluateTrustSuite.addTest(
    createUnitTest({
      name: 'should validate the action correctly',
      fn: async ({ runtime, testEntityId }) => {
        const memory = createMockMemory('What is my trust score?', testEntityId);
        const state = {} as State;

        // Should validate when trust service is available
        expect(await evaluateTrustAction.validate(runtime, memory, state)).toBe(true);

        // Test with no service available
        const runtimeWithoutService = createMockRuntime({
          getService: mock().mockReturnValue(null),
        });
        expect(await evaluateTrustAction.validate(runtimeWithoutService, memory, state)).toBe(
          false
        );
      },
    })
  );

  evaluateTrustSuite.addTest(
    createUnitTest({
      name: 'should handle errors gracefully',
      fn: async ({ runtime, trustEngine, testEntityId }) => {
        trustEngine.getTrustScore.mockRejectedValue(new Error('Database error'));

        const memory = createMockMemory('What is my trust score?', testEntityId);
        const result = await evaluateTrustAction.handler(runtime, memory);

        expect((result as any).text).toContain('Failed to evaluate trust');
        expect((result as any).data?.error).toBeDefined();
      },
    })
  );

  evaluateTrustSuite.addTest(
    createUnitTest({
      name: 'should handle entity name resolution request',
      fn: async ({ runtime, testEntityId }) => {
        const memory = createMockMemory('{"entityName": "Alice"}', testEntityId);
        const result = await evaluateTrustAction.handler(runtime, memory);

        expect((result as any).text).toContain('Could not find entity with name "Alice"');
        expect((result as any).data?.error).toBeDefined();
      },
    })
  );

  evaluateTrustSuite.run();
});
