import { describe, it, expect, beforeEach } from 'bun:test';
import type { IAgentRuntime, Memory, State } from '@elizaos/core';
import type { UUID } from '@elizaos/core';
import { mock } from '@elizaos/core/test-utils';

interface MockFunction<T = any> {
  (...args: any[]): T;
  mockReturnValue: (value: T) => MockFunction<T>;
  mockResolvedValue: (value: T) => MockFunction<T>;
  mockRejectedValue: (error: any) => MockFunction<T>;
  mockImplementation: (fn: (...args: any[]) => T) => MockFunction<T>;
  calls: any[][];
  mock: {
    calls: any[][];
    results: any[];
  };
}
import { trustProfileProvider } from '../trustProfile';
import type { TrustProfile } from '../../types/trust';
import { createMockRuntime, createMockMemory, createMockState } from '../../__tests__/test-utils';

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

describe('trustProfileProvider', () => {
  let runtime: IAgentRuntime;
  let trustEngine: any;
  const testEntityId = 'entity-1' as UUID;

  beforeEach(() => {
    trustEngine = {
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
      getLatestTrustComment: mock().mockResolvedValue({
        comment: 'User has been helpful and reliable',
        timestamp: Date.now(),
      }),
      getRecentInteractions: mock().mockResolvedValue([
        { impact: 5, type: 'HELPFUL_ACTION' },
        { impact: -2, type: 'MINOR_VIOLATION' },
        { impact: 3, type: 'COMMUNITY_CONTRIBUTION' },
      ]),
    };

    runtime = createMockRuntime({
      getService: mock().mockImplementation((name: string) => {
        if (name === 'trust') {
          return trustEngine;
        }
        return null;
      }),
    });
  });

  it('should provide trust profile information', async () => {
    const memory = createMockMemory('test', testEntityId);
    const state = {
      values: {},
      data: {},
      text: '',
    } as State;

    const result = await trustProfileProvider.get(runtime, memory, state);

    expect(result).toBeDefined();
    expect(result.text).toContain('The user has good trust (75/100)');
    expect(result.text).toContain('stable trust trend');
    expect(result.values).toMatchObject({
      trustScore: 75,
      trustLevel: 'good trust',
      trustTrend: 'stable',
      reliability: 80,
      competence: 75,
      integrity: 70,
      benevolence: 78,
      transparency: 72,
      hasNarrativeAssessment: true,
    });
  });

  it('should categorize trust levels correctly', async () => {
    const testCases = [
      { score: 85, level: 'high trust' },
      { score: 65, level: 'good trust' },
      { score: 45, level: 'moderate trust' },
      { score: 25, level: 'low trust' },
      { score: 10, level: 'very low trust' },
    ];

    for (const { score, level } of testCases) {
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

      const memory = createMockMemory('test', testEntityId);
      const state = {
        values: {},
        data: {},
        text: '',
      } as State;

      const result = await trustProfileProvider.get(runtime, memory, state);

      expect(result.values?.trustLevel).toBe(level);
    }
  });

  it('should handle missing trust engine', async () => {
    // Create a new runtime instance with no trust service
    const runtimeNoService = createMockRuntime({
      getService: mock().mockReturnValue(null),
    });

    const memory = createMockMemory('test', testEntityId);
    const state = {
      values: {},
      data: {},
      text: '',
    } as State;

    const result = await trustProfileProvider.get(runtimeNoService, memory, state);

    expect(result.text).toContain('Trust service not available');
  });

  it('should handle errors gracefully', async () => {
    trustEngine.getTrustScore.mockRejectedValue(new Error('Database error'));

    const memory = createMockMemory('test', testEntityId);
    const state = {
      values: {},
      data: {},
      text: '',
    } as State;

    const result = await trustProfileProvider.get(runtime, memory, state);

    expect(result.text).toContain('Unable to fetch trust profile');
  });
});
