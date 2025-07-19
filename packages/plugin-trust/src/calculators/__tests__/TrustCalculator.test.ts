import { describe, it, expect, beforeEach } from 'bun:test';
import { TrustCalculator } from '../TrustCalculator';
import type {
  TrustCalculationConfig,
  TrustProfile,
  TrustEvidence,
  TrustDimensions,
  TrustEvidenceType,
} from '../../types/trust';
import type { UUID } from '@elizaos/core';

describe('TrustCalculator', () => {
  let calculator: TrustCalculator;
  let defaultConfig: TrustCalculationConfig;

  beforeEach(() => {
    defaultConfig = {
      recencyBias: 0.5,
      evidenceDecayRate: 0.01,
      minimumEvidenceCount: 5,
      verificationMultiplier: 1.2,
      dimensionWeights: {
        reliability: 0.2,
        competence: 0.2,
        integrity: 0.2,
        benevolence: 0.2,
        transparency: 0.2,
      },
    };
    calculator = new TrustCalculator(defaultConfig);
  });

  describe('createDefaultProfile', () => {
    it('should create a default trust profile with baseline values', () => {
      const entityId = 'test-entity' as UUID;
      const profile = calculator.createDefaultProfile(entityId);

      expect(profile).toMatchObject({
        entityId,
        overallTrust: 50,
        dimensions: {
          reliability: 50,
          competence: 50,
          integrity: 50,
          benevolence: 50,
          transparency: 50,
        },
        confidence: 0,
        interactionCount: 0,
        evidence: [],
        evaluatorId: 'system',
        calculationMethod: 'default',
        trend: {
          direction: 'stable',
          changeRate: 0,
        },
      });
      expect(profile.lastCalculated).toBeGreaterThan(0);
      expect(profile.trend.lastChangeAt).toBeGreaterThan(0);
    });
  });

  describe('calculateOverallScore', () => {
    it('should calculate weighted average of dimensions', () => {
      const dimensions: TrustDimensions = {
        reliability: 80,
        competence: 70,
        integrity: 60,
        benevolence: 90,
        transparency: 50,
      };

      const score = calculator.calculateOverallScore(dimensions);

      // Expected: (80*0.2 + 70*0.2 + 60*0.2 + 90*0.2 + 50*0.2) = 70
      expect(score).toBe(70);
    });

    it('should handle custom dimension weights', () => {
      const customCalculator = new TrustCalculator({
        ...defaultConfig,
        dimensionWeights: {
          reliability: 0.4,
          competence: 0.3,
          integrity: 0.2,
          benevolence: 0.05,
          transparency: 0.05,
        },
      });

      const dimensions: TrustDimensions = {
        reliability: 100,
        competence: 80,
        integrity: 60,
        benevolence: 40,
        transparency: 20,
      };

      const score = customCalculator.calculateOverallScore(dimensions);

      // Expected: (100*0.4 + 80*0.3 + 60*0.2 + 40*0.05 + 20*0.05) = 79
      expect(score).toBe(79);
    });
  });

  describe('calculateDimensions', () => {
    it('should calculate dimensions from evidence', () => {
      const evidence: TrustEvidence[] = [
        {
          type: 'helpful_action' as TrustEvidenceType,
          timestamp: Date.now() - 86400000, // 1 day old
          impact: 10,
          weight: 1.0,
          description: 'Recent help',
          verified: false,
          targetEntityId: 'entity1' as UUID,
          evaluatorId: 'evaluator1' as UUID,
          reportedBy: 'reporter1' as UUID,
          context: { entityId: 'entity1' as UUID, evaluatorId: 'evaluator1' as UUID },
        },
        {
          type: 'consistent_behavior' as TrustEvidenceType,
          timestamp: Date.now() - 43200000, // 12 hours old
          impact: 5,
          weight: 1.0,
          description: 'Consistent actions',
          verified: false,
          targetEntityId: 'entity1' as UUID,
          evaluatorId: 'evaluator1' as UUID,
          reportedBy: 'reporter1' as UUID,
          context: { entityId: 'entity1' as UUID, evaluatorId: 'evaluator1' as UUID },
        },
      ];

      const dimensions = calculator.calculateDimensions(evidence);

      // Check that dimensions are calculated
      expect(dimensions.reliability).toBeGreaterThanOrEqual(0);
      expect(dimensions.reliability).toBeLessThanOrEqual(100);
      expect(dimensions.competence).toBeGreaterThanOrEqual(0);
      expect(dimensions.competence).toBeLessThanOrEqual(100);
      expect(dimensions.integrity).toBeGreaterThanOrEqual(0);
      expect(dimensions.integrity).toBeLessThanOrEqual(100);
      expect(dimensions.benevolence).toBeGreaterThanOrEqual(0);
      expect(dimensions.benevolence).toBeLessThanOrEqual(100);
      expect(dimensions.transparency).toBeGreaterThanOrEqual(0);
      expect(dimensions.transparency).toBeLessThanOrEqual(100);
    });

    it('should handle empty evidence', () => {
      const dimensions = calculator.calculateDimensions([]);

      // Should return baseline dimensions
      expect(dimensions.reliability).toBe(50);
      expect(dimensions.competence).toBe(50);
      expect(dimensions.integrity).toBe(50);
      expect(dimensions.benevolence).toBe(50);
      expect(dimensions.transparency).toBe(50);
    });
  });

  describe('calculateConfidence', () => {
    it('should return low confidence with few evidence points', () => {
      const evidence: TrustEvidence[] = [
        {
          type: 'helpful_action' as TrustEvidenceType,
          timestamp: Date.now(),
          impact: 10,
          weight: 1.0,
          description: 'Single action',
          verified: false,
          targetEntityId: 'entity1' as UUID,
          evaluatorId: 'evaluator1' as UUID,
          reportedBy: 'reporter1' as UUID,
          context: { entityId: 'entity1' as UUID, evaluatorId: 'evaluator1' as UUID },
        },
      ];

      const confidence = calculator.calculateConfidence(evidence);
      expect(confidence).toBeLessThan(0.5);
    });

    it('should return higher confidence with more evidence', () => {
      const evidence: TrustEvidence[] = Array.from({ length: 10 }, (_, i) => ({
        type: 'helpful_action' as TrustEvidenceType,
        timestamp: Date.now() - i * 86400000,
        impact: 5,
        weight: 1.0,
        description: `Action ${i}`,
        verified: i % 2 === 0,
        targetEntityId: 'entity1' as UUID,
        evaluatorId: 'evaluator1' as UUID,
        reportedBy: 'reporter1' as UUID,
        context: { entityId: 'entity1' as UUID, evaluatorId: 'evaluator1' as UUID },
      }));

      const confidence = calculator.calculateConfidence(evidence);
      expect(confidence).toBeGreaterThan(0.7);
    });

    it('should cap confidence at 1.0', () => {
      const evidence: TrustEvidence[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'helpful_action' as TrustEvidenceType,
        timestamp: Date.now() - i * 3600000,
        impact: 5,
        weight: 1.0,
        description: `Action ${i}`,
        verified: true,
        targetEntityId: 'entity1' as UUID,
        evaluatorId: 'evaluator1' as UUID,
        reportedBy: 'reporter1' as UUID,
        context: { entityId: 'entity1' as UUID, evaluatorId: 'evaluator1' as UUID },
      }));

      const confidence = calculator.calculateConfidence(evidence);
      expect(confidence).toBe(1.0);
    });
  });

  describe('calculateOverallTrust', () => {
    it('should calculate overall trust from dimensions', () => {
      const dimensions: TrustDimensions = {
        reliability: 80,
        competence: 70,
        integrity: 60,
        benevolence: 90,
        transparency: 50,
      };

      const overallTrust = calculator.calculateOverallTrust(dimensions);

      // Expected: (80*0.2 + 70*0.2 + 60*0.2 + 90*0.2 + 50*0.2) = 70
      expect(overallTrust).toBe(70);
    });

    it('should handle zero weights gracefully', () => {
      const zeroWeightCalculator = new TrustCalculator({
        ...defaultConfig,
        dimensionWeights: {
          reliability: 0,
          competence: 0,
          integrity: 0,
          benevolence: 0,
          transparency: 0,
        },
      });

      const dimensions: TrustDimensions = {
        reliability: 80,
        competence: 70,
        integrity: 60,
        benevolence: 90,
        transparency: 50,
      };

      const overallTrust = zeroWeightCalculator.calculateOverallScore(dimensions);

      // Should return default value when all weights are zero
      expect(overallTrust).toBe(50);
    });
  });

  describe('calculateProfileFromEvidence', () => {
    it('should calculate complete trust profile from evidence', () => {
      const entityId = 'test-entity' as UUID;

      const evidence: TrustEvidence[] = [
        {
          type: 'helpful_action' as TrustEvidenceType,
          timestamp: Date.now() - 86400000,
          impact: 15,
          weight: 1.0,
          description: 'Helped community',
          verified: true,
          targetEntityId: entityId,
          evaluatorId: 'evaluator1' as UUID,
          reportedBy: 'reporter1' as UUID,
          context: { entityId, evaluatorId: 'evaluator1' as UUID },
        },
        {
          type: 'consistent_behavior' as TrustEvidenceType,
          timestamp: Date.now() - 43200000,
          impact: 10,
          weight: 1.0,
          description: 'Regular participation',
          verified: false,
          targetEntityId: entityId,
          evaluatorId: 'evaluator1' as UUID,
          reportedBy: 'reporter1' as UUID,
          context: { entityId, evaluatorId: 'evaluator1' as UUID },
        },
        {
          type: 'verified_identity' as TrustEvidenceType,
          timestamp: Date.now(),
          impact: 8,
          weight: 1.0,
          description: 'Identity verified',
          verified: true,
          targetEntityId: entityId,
          evaluatorId: 'evaluator1' as UUID,
          reportedBy: 'reporter1' as UUID,
          context: { entityId, evaluatorId: 'evaluator1' as UUID },
        },
      ];

      const profile = calculator.calculateProfileFromEvidence(entityId, evidence);

      // Check profile structure
      expect(profile.entityId).toBe(entityId);
      expect(profile.overallTrust).toBeGreaterThan(0);
      expect(profile.overallTrust).toBeLessThanOrEqual(100);

      // Check dimensions
      expect(profile.dimensions).toBeDefined();
      expect(profile.dimensions.reliability).toBeGreaterThanOrEqual(0);
      expect(profile.dimensions.reliability).toBeLessThanOrEqual(100);

      // Check metadata
      expect(profile.interactionCount).toBe(3);
      expect(profile.confidence).toBeGreaterThan(0);
      expect(profile.confidence).toBeLessThanOrEqual(1);
      expect(profile.evidence).toHaveLength(3);
      expect(profile.calculationMethod).toBe('weighted_dimensions');

      // Check trend
      expect(profile.trend).toBeDefined();
      expect(['increasing', 'decreasing', 'stable']).toContain(profile.trend.direction);
    });

    it('should handle empty evidence', () => {
      const entityId = 'test-entity' as UUID;

      const profile = calculator.calculateProfileFromEvidence(entityId, []);

      // Should return default profile
      expect(profile.overallTrust).toBe(50);
      expect(profile.confidence).toBeGreaterThanOrEqual(0);
      expect(profile.confidence).toBeLessThanOrEqual(1);
      expect(profile.trend.direction).toBe('stable');
      expect(profile.interactionCount).toBe(0);
      expect(profile.evidence).toHaveLength(0);
    });

    it('should detect increasing trend from recent positive evidence', () => {
      const entityId = 'test-entity' as UUID;

      const evidence: TrustEvidence[] = [
        {
          type: 'helpful_action' as TrustEvidenceType,
          timestamp: Date.now() - 3600000, // 1 hour ago
          impact: 20,
          weight: 1.0,
          description: 'Recent help',
          verified: false,
          targetEntityId: entityId,
          evaluatorId: 'evaluator1' as UUID,
          reportedBy: 'reporter1' as UUID,
          context: { entityId, evaluatorId: 'evaluator1' as UUID },
        },
        {
          type: 'helpful_action' as TrustEvidenceType,
          timestamp: Date.now() - 1800000, // 30 minutes ago
          impact: 15,
          weight: 1.0,
          description: 'More recent help',
          verified: false,
          targetEntityId: entityId,
          evaluatorId: 'evaluator1' as UUID,
          reportedBy: 'reporter1' as UUID,
          context: { entityId, evaluatorId: 'evaluator1' as UUID },
        },
      ];

      const profile = calculator.calculateProfileFromEvidence(entityId, evidence);

      expect(profile.trend.direction).toBe('increasing');
      expect(profile.trend.changeRate).toBeGreaterThan(0);
    });

    it('should detect decreasing trend from recent negative evidence', () => {
      const entityId = 'test-entity' as UUID;

      const evidence: TrustEvidence[] = [
        {
          type: 'harmful_action' as TrustEvidenceType,
          timestamp: Date.now() - 3600000, // 1 hour ago
          impact: -20,
          weight: 1.0,
          description: 'Recent harm',
          verified: false,
          targetEntityId: entityId,
          evaluatorId: 'evaluator1' as UUID,
          reportedBy: 'reporter1' as UUID,
          context: { entityId, evaluatorId: 'evaluator1' as UUID },
        },
        {
          type: 'security_violation' as TrustEvidenceType,
          timestamp: Date.now() - 1800000, // 30 minutes ago
          impact: -15,
          weight: 1.0,
          description: 'Security issue',
          verified: true,
          targetEntityId: entityId,
          evaluatorId: 'evaluator1' as UUID,
          reportedBy: 'reporter1' as UUID,
          context: { entityId, evaluatorId: 'evaluator1' as UUID },
        },
      ];

      const profile = calculator.calculateProfileFromEvidence(entityId, evidence);

      expect(profile.trend.direction).toBe('decreasing');
      expect(profile.trend.changeRate).toBeGreaterThan(0);
    });
  });
});
