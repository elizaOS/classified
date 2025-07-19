import { describe, it, expect, beforeEach } from 'bun:test';
import { MockDatabaseAdapter } from '@elizaos/plugin-dummy-services/src/database/adapter';
import { TrustManagerGeneric } from '../database/TrustManagerGeneric';
import { TrustEvidenceType } from '../types/trust';
import type { UUID } from '@elizaos/core';

describe('TrustManagerGeneric', () => {
  let db: MockDatabaseAdapter;
  let trustManager: TrustManagerGeneric;
  const evaluatorId = 'evaluator-123' as UUID;
  const entityId = 'entity-456' as UUID;

  beforeEach(() => {
    db = new MockDatabaseAdapter();
    trustManager = new TrustManagerGeneric(db, evaluatorId);
  });

  describe('Profile Management', () => {
    it('should create a new trust profile with default values', async () => {
      const profile = await trustManager.getOrCreateProfile(entityId);

      expect(profile).toBeDefined();
      expect(profile.entityId).toBe(entityId);
      expect(profile.evaluatorId).toBe(evaluatorId);
      expect(profile.overallTrust).toBe(50);
      expect(profile.confidence).toBe(50);
      expect(profile.interactionCount).toBe(0);
      expect(profile.trendDirection).toBe('stable');
      expect(profile.dimensions).toEqual({
        reliability: 50,
        competence: 50,
        integrity: 50,
        benevolence: 50,
        transparency: 50,
      });
    });

    it('should retrieve existing profile instead of creating duplicate', async () => {
      const profile1 = await trustManager.getOrCreateProfile(entityId);
      const profile2 = await trustManager.getOrCreateProfile(entityId);

      expect(profile1.id).toBe(profile2.id);
    });

    it('should update trust profile', async () => {
      const profile = await trustManager.getOrCreateProfile(entityId);

      const updated = await trustManager.updateProfile(profile.id, {
        overallTrust: 75,
        confidence: 80,
      });

      expect(updated).toBeDefined();
      expect(updated?.overallTrust).toBe(75);
      expect(updated?.confidence).toBe(80);
    });
  });

  describe('Evidence Management', () => {
    it('should record trust evidence', async () => {
      const evidence = await trustManager.recordEvidence({
        targetEntityId: entityId,
        sourceEntityId: 'source-123' as UUID,
        evaluatorId,
        type: TrustEvidenceType.HELPFUL_ACTION,
        impact: 30,
        weight: 100,
        description: 'Helped another user',
        verified: true,
        context: { roomId: 'room-123' },
      });

      expect(evidence).toBeDefined();
      expect(evidence.targetEntityId).toBe(entityId);
      expect(evidence.impact).toBe(30);
      expect(evidence.type).toBe(TrustEvidenceType.HELPFUL_ACTION);
    });

    it('should retrieve evidence for an entity', async () => {
      await trustManager.recordEvidence({
        targetEntityId: entityId,
        sourceEntityId: 'source-1' as UUID,
        evaluatorId,
        type: TrustEvidenceType.PROMISE_KEPT,
        impact: 20,
        weight: 100,
        description: 'Kept a promise',
        verified: true,
        context: {},
      });

      await trustManager.recordEvidence({
        targetEntityId: entityId,
        sourceEntityId: 'source-2' as UUID,
        evaluatorId,
        type: TrustEvidenceType.HARMFUL_ACTION,
        impact: -30,
        weight: 100,
        description: 'Harmful action',
        verified: false,
        context: {},
      });

      const evidence = await trustManager.getEvidence(entityId);
      expect(evidence).toHaveLength(2);
      // Check that both types are present (order may vary in mock)
      const types = evidence.map((e) => e.type);
      expect(types).toContain(TrustEvidenceType.HARMFUL_ACTION);
      expect(types).toContain(TrustEvidenceType.PROMISE_KEPT);
    });
  });

  describe('Trust Score Calculation', () => {
    it('should calculate trust score based on evidence', async () => {
      await trustManager.recordEvidence({
        targetEntityId: entityId,
        sourceEntityId: 'source-1' as UUID,
        evaluatorId,
        type: 'reliability_positive',
        impact: 50,
        weight: 100,
        description: 'Consistently delivered on promises',
        verified: true,
        context: {},
      });

      await trustManager.recordEvidence({
        targetEntityId: entityId,
        sourceEntityId: 'source-2' as UUID,
        evaluatorId,
        type: 'competence_positive',
        impact: 40,
        weight: 80,
        description: 'Demonstrated high competence',
        verified: true,
        context: {},
      });

      const trustScore = await trustManager.calculateTrustScore(entityId);

      expect(trustScore).toBeDefined();
      expect(trustScore.overall).toBeGreaterThan(50);
      expect(trustScore.dimensions.reliability).toBeGreaterThan(50);
      expect(trustScore.dimensions.competence).toBeGreaterThan(50);
      expect(trustScore.confidence).toBeGreaterThan(0.5);
      expect(['improving', 'declining', 'stable']).toContain(trustScore.trend);
      expect(['untrusted', 'poor', 'fair', 'good', 'excellent', 'exceptional']).toContain(
        trustScore.reputation
      );
    });
  });

  describe('Trust Relationships', () => {
    it('should get trust relationships for an entity', async () => {
      const entity1 = 'entity-1' as UUID;
      const entity2 = 'entity-2' as UUID;
      const entity3 = 'entity-3' as UUID;

      await trustManager.getOrCreateProfile(entity1);
      await trustManager.getOrCreateProfile(entity2);
      await trustManager.getOrCreateProfile(entity3);

      const profile1 = await trustManager.getOrCreateProfile(entity1);
      const profile2 = await trustManager.getOrCreateProfile(entity2);
      const profile3 = await trustManager.getOrCreateProfile(entity3);

      await trustManager.updateProfile(profile1.id, { overallTrust: 80 });
      await trustManager.updateProfile(profile2.id, { overallTrust: 60 });
      await trustManager.updateProfile(profile3.id, { overallTrust: 40 });

      const relationships = await trustManager.getTrustRelationships(entity1);

      expect(relationships).toHaveLength(2);
      expect(relationships[0].trustScore).toBe(60);
      expect(relationships[1].trustScore).toBe(40);
    });
  });
});
