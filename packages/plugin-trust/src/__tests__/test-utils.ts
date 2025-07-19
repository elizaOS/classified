import type { IAgentRuntime, Memory, State, UUID } from '@elizaos/core';
import {
  createMockRuntime as createCoreMockRuntime,
  createMockMemory as createCoreMockMemory,
  createMockState as createCoreMockState,
} from '@elizaos/core/test-utils';

/**
 * Create a mock runtime for trust plugin tests
 */
export function createMockRuntime(overrides: Partial<IAgentRuntime> = {}): IAgentRuntime {
  const mockTrustProfile = {
    entityId: 'entity-1',
    evaluatorId: 'test-agent',
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

  // Use the unified mock runtime from core with trust-specific overrides
  return createCoreMockRuntime({
    character: {
      id: 'test-agent' as UUID,
      name: 'TestAgent',
      bio: ['Test bio for trust plugin'],
      system: 'Test system prompt for trust evaluation',
    },

    // Trust-specific settings
    getSetting: (key: string) => {
      const settings: Record<string, string> = {
        API_KEY: 'test-api-key',
        SECRET_KEY: 'test-secret',
        ...(overrides as any)?.settings,
      };
      return settings[key];
    },

    // Trust-specific services
    getService: (name: string) => {
      const services: Record<string, any> = {
        'trust-engine': {
          evaluateTrust: async () => mockTrustProfile,
          calculateTrust: async () => mockTrustProfile,
          getTrustScore: async () => ({
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
          updateTrust: async () => true,
          checkPermission: async () => ({ allowed: true }),
          detectThreats: async () => ({ isThreat: false, threats: [] }),
          getRole: async () => 'user',
          updateRole: async () => true,
          recordInteraction: async () => ({ success: true }),
        },
        trust: {
          evaluateTrust: async () => mockTrustProfile,
          calculateTrust: async () => mockTrustProfile,
          getTrustScore: async () => ({
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
          updateTrust: async () => true,
          checkPermission: async () => ({ allowed: true }),
          detectThreats: async () => ({ isThreat: false, threats: [] }),
          getRole: async () => 'user',
          updateRole: async () => true,
          recordInteraction: async () => ({ success: true }),
          getLatestTrustComment: async () => ({
            comment: 'User has been helpful and reliable',
            timestamp: Date.now(),
          }),
          analyzeTrustEvidence: async () => ({
            evidenceType: 'HELPFUL_ACTION',
            impact: 5,
            description: 'Helpful interaction',
            sentiment: 'positive',
            affectedDimensions: ['benevolence', 'reliability'],
            analysisConfidence: 0.8,
          }),
        },
        ...(overrides as any)?.services,
      };
      return services[name];
    },

    ...overrides,
  }) as unknown as IAgentRuntime;
}

/**
 * Create a mock memory for trust plugin tests
 */
export function createMockMemory(
  text: string,
  entityId: UUID,
  overrides: Partial<Memory> = {}
): Memory {
  return createCoreMockMemory({
    entityId,
    content: {
      text,
      source: 'trust-test',
    },
    ...overrides,
  }) as Memory;
}

/**
 * Create a mock state for trust plugin tests
 */
export function createMockState(overrides: Partial<State> = {}): State {
  return createCoreMockState({
    values: {
      trustContext: 'test-context',
    },
    text: 'Trust evaluation context',
    ...overrides,
  }) as State;
}
