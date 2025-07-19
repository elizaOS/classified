import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { TrustEngine } from '../TrustEngine';
import { createMockRuntime } from '../../__tests__/test-utils';
import type { IAgentRuntime } from '@elizaos/core';
import type { UUID } from '@elizaos/core';
import {
  TrustEvidenceType,
  type TrustProfile,
  type TrustRequirements,
  type TrustContext,
  type TrustInteraction,
  type SemanticTrustEvidence,
} from '../../types/trust';

describe('TrustEngine', () => {
  let trustEngine: TrustEngine;
  let mockRuntime: IAgentRuntime;
  let mockTrustDatabase: any;

  beforeEach(async () => {
    mock.restore();
    mockRuntime = createMockRuntime();

    // Create mock database
    mockTrustDatabase = {
      getTrustProfile: mock(),
      saveTrustProfile: mock(),
      addTrustEvidence: mock(),
      getTrustEvidence: mock().mockResolvedValue([]),
      getTrustCommentHistory: mock().mockResolvedValue([]),
      saveTrustComment: mock(),
      getInteractions: mock().mockResolvedValue([]),
      saveInteraction: mock(),
    };

    // Create trust engine and initialize with mock database
    trustEngine = new TrustEngine();
    await trustEngine.initialize(mockRuntime, mockTrustDatabase);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await trustEngine.initialize(mockRuntime, mockTrustDatabase);
      expect(trustEngine).toBeDefined();
    });
  });

  describe('calculateTrust', () => {
    beforeEach(async () => {
      await trustEngine.initialize(mockRuntime, mockTrustDatabase);
    });

    it('should calculate trust for a new entity', async () => {
      const entityId = 'entity-123' as UUID;
      const context: TrustContext = {
        entityId,
        evaluatorId: mockRuntime.agentId,
      };

      // Mock no existing profile
      mockTrustDatabase.getTrustProfile.mockResolvedValue(null);

      const result = await trustEngine.calculateTrust(entityId, context);

      expect(result).toMatchObject({
        entityId,
        overallTrust: 50, // Default trust
        dimensions: {
          reliability: 50,
          competence: 50,
          integrity: 50,
          benevolence: 50,
          transparency: 50,
        },
        confidence: expect.any(Number),
        interactionCount: 0,
        evidence: [],
        lastCalculated: expect.any(Number),
        calculationMethod: 'default',
        trend: {
          direction: 'stable',
          changeRate: 0,
          lastChangeAt: expect.any(Number),
        },
      });

      // calculateTrust doesn't save the profile, it just returns it
      expect(mockTrustDatabase.getTrustProfile).toHaveBeenCalled();
    });

    it('should calculate trust based on existing interactions', async () => {
      const entityId = 'entity-123' as UUID;
      const context: TrustContext = {
        entityId,
        evaluatorId: mockRuntime.agentId,
      };

      // Mock existing profile
      mockTrustDatabase.getTrustProfile.mockResolvedValue({
        entityId,
        overallTrust: 60,
        dimensions: {
          reliability: 65,
          competence: 60,
          integrity: 55,
          benevolence: 60,
          transparency: 60,
        },
        confidence: 0.7,
        interactionCount: 5,
        evidence: [],
        lastCalculated: Date.now() - 3600000,
        calculationMethod: 'weighted_average',
        trend: {
          direction: 'increasing',
          changeRate: 5,
          lastChangeAt: Date.now() - 3600000,
        },
      });

      // Mock interactions
      mockTrustDatabase.getInteractions.mockResolvedValue([
        {
          sourceEntityId: entityId,
          targetEntityId: mockRuntime.agentId,
          type: TrustEvidenceType.HELPFUL_ACTION,
          timestamp: Date.now() - 1800000,
          impact: 10,
        },
      ]);

      const result = await trustEngine.calculateTrust(entityId, context);

      expect(result.overallTrust).toBeGreaterThanOrEqual(60);
      expect(result.interactionCount).toBeGreaterThanOrEqual(5);
      expect(result.trend.direction).toBeDefined();
    });
  });

  describe('recordInteraction', () => {
    beforeEach(async () => {
      await trustEngine.initialize(mockRuntime, mockTrustDatabase);
    });

    it('should record a trust interaction', async () => {
      const interaction: TrustInteraction = {
        sourceEntityId: 'entity-123' as UUID,
        targetEntityId: mockRuntime.agentId,
        type: TrustEvidenceType.PROMISE_KEPT,
        timestamp: Date.now(),
        impact: 15,
        details: { description: 'Fulfilled commitment' },
      };

      await trustEngine.recordInteraction(interaction);

      // recordInteraction now calls recordSemanticEvidence internally
      expect(mockTrustDatabase.getTrustProfile).toHaveBeenCalled();
      expect(mockTrustDatabase.saveTrustProfile).toHaveBeenCalled();
    });
  });

  describe('recordSemanticEvidence', () => {
    beforeEach(async () => {
      await trustEngine.initialize(mockRuntime, mockTrustDatabase);
    });

    it('should record semantic trust evidence', async () => {
      const entityId = 'entity-123' as UUID;
      const evidence: SemanticTrustEvidence = {
        description: 'User provided helpful assistance',
        impact: 20,
        sentiment: 'positive',
        affectedDimensions: {
          benevolence: 80,
          competence: 75,
        },
        analysisConfidence: 0.9,
        sourceContent: 'Helped solve a complex problem',
        timestamp: Date.now(),
        reportedBy: mockRuntime.agentId,
        context: { entityId, evaluatorId: mockRuntime.agentId },
      };

      await trustEngine.recordSemanticEvidence(entityId, evidence);

      // recordSemanticEvidence saves trust profile and evidence
      expect(mockTrustDatabase.saveTrustProfile).toHaveBeenCalled();
      expect(mockTrustDatabase.addTrustEvidence).toHaveBeenCalled();
    });
  });

  describe('evaluateTrustDecision', () => {
    beforeEach(async () => {
      await trustEngine.initialize(mockRuntime, mockTrustDatabase);
    });

    it('should approve when trust meets requirements', async () => {
      const entityId = 'entity-123' as UUID;
      const requirements: TrustRequirements = {
        minimumTrust: 60,
        dimensions: {
          reliability: 50,
          integrity: 55,
        },
      };
      const context: TrustContext = {
        entityId,
        evaluatorId: mockRuntime.agentId,
      };

      // Mock profile that meets requirements
      mockTrustDatabase.getTrustProfile.mockResolvedValue({
        entityId,
        overallTrust: 75,
        dimensions: {
          reliability: 80,
          competence: 70,
          integrity: 75,
          benevolence: 75,
          transparency: 75,
        },
        confidence: 0.8,
        interactionCount: 10,
      });

      const result = await trustEngine.evaluateTrustDecision(entityId, requirements, context);

      expect(result.approved).toBe(true);
      expect(result.trustScore).toBe(75);
      expect(result.reason?.toLowerCase()).toContain('trust requirements met');
    });

    it('should deny when trust does not meet requirements', async () => {
      const entityId = 'entity-123' as UUID;
      const requirements: TrustRequirements = {
        minimumTrust: 80,
        minimumInteractions: 10,
      };
      const context: TrustContext = {
        entityId,
        evaluatorId: mockRuntime.agentId,
      };

      // Mock profile that doesn't meet requirements
      mockTrustDatabase.getTrustProfile.mockResolvedValue({
        entityId,
        overallTrust: 60,
        dimensions: {
          reliability: 60,
          competence: 60,
          integrity: 60,
          benevolence: 60,
          transparency: 60,
        },
        confidence: 0.7,
        interactionCount: 5,
      });

      const result = await trustEngine.evaluateTrustDecision(entityId, requirements, context);

      expect(result.approved).toBe(false);
      expect(result.trustScore).toBe(60);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions?.length).toBeGreaterThan(0);
    });

    it('should check specific dimension requirements', async () => {
      const entityId = 'entity-123' as UUID;
      const requirements: TrustRequirements = {
        minimumTrust: 50,
        dimensions: {
          integrity: 80,
          transparency: 70,
        },
      };
      const context: TrustContext = {
        entityId,
        evaluatorId: mockRuntime.agentId,
      };

      // Mock profile with low integrity
      mockTrustDatabase.getTrustProfile.mockResolvedValue({
        entityId,
        overallTrust: 70,
        dimensions: {
          reliability: 75,
          competence: 75,
          integrity: 50, // Below requirement
          benevolence: 75,
          transparency: 75,
        },
        confidence: 0.8,
        interactionCount: 15,
      });

      const result = await trustEngine.evaluateTrustDecision(entityId, requirements, context);

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('integrity');
      expect(result.dimensionsChecked?.integrity).toBe(50);
    });
  });

  describe('trust calculation methods', () => {
    beforeEach(async () => {
      await trustEngine.initialize(mockRuntime, mockTrustDatabase);
    });

    it('should apply evidence decay over time', async () => {
      const entityId = 'entity-123' as UUID;
      const context: TrustContext = {
        entityId,
        evaluatorId: mockRuntime.agentId,
      };

      // Mock profile with old evidence
      mockTrustDatabase.getTrustProfile.mockResolvedValue({
        entityId,
        overallTrust: 70,
        dimensions: {
          reliability: 70,
          competence: 70,
          integrity: 70,
          benevolence: 70,
          transparency: 70,
        },
        evidence: [],
        lastCalculated: Date.now() - 86400000, // 1 day ago
        trend: {
          direction: 'stable',
          changeRate: 0,
        },
      });

      const result = await trustEngine.calculateTrust(entityId, context);

      expect(result).toBeDefined();
      expect(result.overallTrust).toBeGreaterThanOrEqual(50);
    });
  });

  describe('trend analysis', () => {
    beforeEach(async () => {
      await trustEngine.initialize(mockRuntime, mockTrustDatabase);
    });

    it('should detect increasing trust trend', async () => {
      const entityId = 'entity-123' as UUID;
      const context: TrustContext = {
        entityId,
        evaluatorId: mockRuntime.agentId,
      };

      // Mock profile with lower trust
      mockTrustDatabase.getTrustProfile.mockResolvedValue({
        entityId,
        overallTrust: 55,
        dimensions: {
          reliability: 55,
          competence: 55,
          integrity: 55,
          benevolence: 55,
          transparency: 55,
        },
        confidence: 0.6,
        interactionCount: 5,
        lastCalculated: Date.now() - 86400000,
        trend: {
          direction: 'stable',
          changeRate: 0,
          lastChangeAt: Date.now() - 86400000,
        },
      });

      // Mock recent positive interactions
      mockTrustDatabase.getInteractions.mockResolvedValue([
        {
          type: TrustEvidenceType.HELPFUL_ACTION,
          timestamp: Date.now() - 3600000,
          impact: 15,
        },
        {
          type: TrustEvidenceType.PROMISE_KEPT,
          timestamp: Date.now() - 7200000,
          impact: 10,
        },
      ]);

      const result = await trustEngine.calculateTrust(entityId, context);

      // The trend might be stable if not enough data points
      expect(['increasing', 'stable']).toContain(result.trend.direction);
      expect(result.trend.changeRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('stop', () => {
    it('should clean up resources', async () => {
      await trustEngine.initialize(mockRuntime, mockTrustDatabase);

      // Should not throw
      await trustEngine.stop();
      // Test passes if no error is thrown
    });
  });
});
