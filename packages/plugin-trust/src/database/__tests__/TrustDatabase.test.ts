import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { TrustDatabase } from '../TrustDatabase';
import { createMockRuntime } from '../../__tests__/test-utils';
import type { IAgentRuntime } from '@elizaos/core';
import type { UUID } from '@elizaos/core';
import type { TrustProfile, TrustEvidence } from '../../types/trust';
import { TrustEvidenceType } from '../../types/trust';

// Create an in-memory database mock
class InMemoryDatabase {
  private tables: Map<string, any[]> = new Map();

  constructor() {
    // Initialize tables
    this.tables.set('trust_profiles', []);
    this.tables.set('trust_evidence', []);
    this.tables.set('trust_comments', []);
    this.tables.set('permission_delegations', []);
  }

  async execute(sql: string, params?: any[]): Promise<any> {
    const trimmedSql = sql.trim().toUpperCase();

    // Handle CREATE TABLE
    if (trimmedSql.startsWith('CREATE TABLE') || trimmedSql.startsWith('CREATE INDEX')) {
      return { changes: 0 };
    }

    // Handle INSERT OR REPLACE for trust_profiles
    if (trimmedSql.includes('INSERT OR REPLACE INTO TRUST_PROFILES')) {
      const profiles = this.tables.get('trust_profiles') || [];
      const existingIndex = profiles.findIndex((p) => p.entity_id === params?.[0]);

      const profile = {
        entity_id: params?.[0],
        overall_trust: params?.[1],
        reliability: params?.[2],
        competence: params?.[3],
        integrity: params?.[4],
        benevolence: params?.[5],
        transparency: params?.[6],
        confidence: params?.[7],
        interaction_count: params?.[8],
        last_calculated: params?.[9],
        created_at: params?.[10],
        updated_at: params?.[11],
        evidence: params?.[12],
      };

      if (existingIndex >= 0) {
        profiles[existingIndex] = profile;
      } else {
        profiles.push(profile);
      }

      this.tables.set('trust_profiles', profiles);
      return { changes: 1 };
    }

    // Handle SELECT from trust_profiles
    if (trimmedSql.includes('SELECT * FROM TRUST_PROFILES')) {
      const profiles = this.tables.get('trust_profiles') || [];

      if (trimmedSql.includes('WHERE ENTITY_ID = ?')) {
        const filtered = profiles.filter((p) => p.entity_id === params?.[0]);
        return { rows: filtered };
      }

      return { rows: profiles };
    }

    // Handle INSERT INTO trust_evidence
    if (trimmedSql.includes('INSERT INTO TRUST_EVIDENCE')) {
      const evidence = this.tables.get('trust_evidence') || [];
      evidence.push({
        id: params?.[0],
        entity_id: params?.[1],
        type: params?.[2],
        impact: params?.[3],
        weight: params?.[4],
        description: params?.[5],
        timestamp: params?.[6],
        verified: params?.[7],
        reported_by: params?.[8],
        context: params?.[9],
        metadata: params?.[10],
      });
      this.tables.set('trust_evidence', evidence);
      return { changes: 1 };
    }

    // Handle SELECT from trust_evidence
    if (trimmedSql.includes('SELECT * FROM TRUST_EVIDENCE')) {
      const evidence = this.tables.get('trust_evidence') || [];
      const filtered = evidence.filter((e) => e.entity_id === params?.[0]);
      // Sort by timestamp DESC
      filtered.sort((a, b) => b.timestamp - a.timestamp);
      return { rows: filtered };
    }

    // Handle INSERT INTO trust_comments
    if (trimmedSql.includes('INSERT INTO TRUST_COMMENTS')) {
      const comments = this.tables.get('trust_comments') || [];
      comments.push({
        id: params?.[0],
        entity_id: params?.[1],
        evaluator_id: params?.[2],
        trust_score: params?.[3],
        trust_change: params?.[4],
        comment: params?.[5],
        timestamp: params?.[6],
        metadata: params?.[7],
      });
      this.tables.set('trust_comments', comments);
      return { changes: 1 };
    }

    // Handle SELECT from trust_comments
    if (trimmedSql.includes('SELECT * FROM TRUST_COMMENTS')) {
      const comments = this.tables.get('trust_comments') || [];
      let filtered = comments.filter(
        (c) => c.entity_id === params?.[0] && c.evaluator_id === params?.[1]
      );
      // Sort by timestamp DESC
      filtered.sort((a, b) => b.timestamp - a.timestamp);

      // Handle LIMIT
      if (trimmedSql.includes('LIMIT ?') && params?.[2]) {
        filtered = filtered.slice(0, params[2]);
      }

      return { rows: filtered };
    }

    // Handle INSERT OR REPLACE for permission_delegations
    if (trimmedSql.includes('INSERT OR REPLACE INTO PERMISSION_DELEGATIONS')) {
      const delegations = this.tables.get('permission_delegations') || [];
      const existingIndex = delegations.findIndex((d) => d.id === params?.[0]);

      const delegation = {
        id: params?.[0],
        delegator_id: params?.[1],
        delegatee_id: params?.[2],
        permission: params?.[3],
        resource: params?.[4],
        granted_at: params?.[5],
        expires_at: params?.[6],
        active: params?.[7],
        conditions: params?.[8],
      };

      if (existingIndex >= 0) {
        delegations[existingIndex] = delegation;
      } else {
        delegations.push(delegation);
      }

      this.tables.set('permission_delegations', delegations);
      return { changes: 1 };
    }

    // Handle SELECT from permission_delegations
    if (trimmedSql.includes('SELECT * FROM PERMISSION_DELEGATIONS')) {
      const delegations = this.tables.get('permission_delegations') || [];
      const now = params?.[1] || Date.now();
      const filtered = delegations.filter(
        (d) =>
          d.delegator_id === params?.[0] && d.active === 1 && (!d.expires_at || d.expires_at > now)
      );
      return { rows: filtered };
    }

    // Default: return empty result
    return { rows: [] };
  }
}

describe('TrustDatabase', () => {
  let trustDatabase: TrustDatabase;
  let mockRuntime: IAgentRuntime;
  let mockDb: InMemoryDatabase;

  beforeEach(() => {
    mock.restore();
    mockDb = new InMemoryDatabase();
    mockRuntime = createMockRuntime({
      db: {
        execute: mock((sql, params) => mockDb.execute(sql, params)),
        query: mock().mockResolvedValue([]),
        getWorlds: mock().mockResolvedValue([]),
        getWorld: mock().mockResolvedValue(null),
      },
    });
    trustDatabase = new TrustDatabase();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await trustDatabase.initialize(mockRuntime);
      expect(trustDatabase).toBeDefined();
    });
  });

  describe('trust profile operations', () => {
    beforeEach(async () => {
      await trustDatabase.initialize(mockRuntime);
    });

    it('should save and retrieve trust profile', async () => {
      const profile: TrustProfile = {
        entityId: 'entity-123' as UUID,
        evaluatorId: mockRuntime.agentId,
        overallTrust: 75,
        dimensions: {
          reliability: 80,
          competence: 75,
          integrity: 70,
          benevolence: 75,
          transparency: 80,
        },
        confidence: 0.85,
        interactionCount: 10,
        evidence: [],
        lastCalculated: Date.now(),
        calculationMethod: 'weighted_average',
        trend: {
          direction: 'increasing',
          changeRate: 5,
          lastChangeAt: Date.now(),
        },
      };

      await trustDatabase.saveTrustProfile(profile);
      const retrieved = await trustDatabase.getTrustProfile(profile.entityId);

      expect(retrieved).toMatchObject({
        entityId: profile.entityId,
        overallTrust: profile.overallTrust,
        dimensions: profile.dimensions,
        confidence: profile.confidence,
        interactionCount: profile.interactionCount,
      });
    });

    it('should return null for non-existent profile', async () => {
      const result = await trustDatabase.getTrustProfile('non-existent' as UUID);
      expect(result).toBeNull();
    });

    it('should update existing profile', async () => {
      const entityId = 'entity-123' as UUID;
      const initialProfile: TrustProfile = {
        entityId,
        evaluatorId: mockRuntime.agentId,
        overallTrust: 50,
        dimensions: {
          reliability: 50,
          competence: 50,
          integrity: 50,
          benevolence: 50,
          transparency: 50,
        },
        confidence: 0.5,
        interactionCount: 1,
        evidence: [],
        lastCalculated: Date.now() - 3600000,
        calculationMethod: 'default',
        trend: {
          direction: 'stable',
          changeRate: 0,
          lastChangeAt: Date.now() - 3600000,
        },
      };

      await trustDatabase.saveTrustProfile(initialProfile);

      const updatedProfile: TrustProfile = {
        ...initialProfile,
        overallTrust: 75,
        confidence: 0.8,
        interactionCount: 5,
        lastCalculated: Date.now(),
      };

      await trustDatabase.saveTrustProfile(updatedProfile);
      const retrieved = await trustDatabase.getTrustProfile(entityId);

      expect(retrieved?.overallTrust).toBe(75);
      expect(retrieved?.confidence).toBe(0.8);
      expect(retrieved?.interactionCount).toBe(5);
    });
  });

  describe('trust evidence operations', () => {
    beforeEach(async () => {
      await trustDatabase.initialize(mockRuntime);
    });

    it('should save and retrieve trust evidence', async () => {
      const entityId = 'entity-123' as UUID;
      const evidence: TrustEvidence = {
        targetEntityId: entityId,
        evaluatorId: mockRuntime.agentId,
        type: TrustEvidenceType.HELPFUL_ACTION,
        impact: 10,
        weight: 1.0,
        description: 'Provided assistance',
        timestamp: Date.now(),
        verified: true,
        reportedBy: mockRuntime.agentId,
        context: { entityId, evaluatorId: mockRuntime.agentId },
        metadata: {},
      };

      await trustDatabase.addTrustEvidence(evidence);
      const retrievedEvidence = await trustDatabase.getTrustEvidence(entityId);

      expect(retrievedEvidence).toHaveLength(1);
      expect(retrievedEvidence[0]).toMatchObject({
        targetEntityId: entityId,
        type: TrustEvidenceType.HELPFUL_ACTION,
        impact: 10,
      });
    });

    it('should handle multiple evidence entries', async () => {
      const entityId = 'entity-123' as UUID;
      const now = Date.now();

      // Add multiple evidence entries
      const evidence1: TrustEvidence = {
        targetEntityId: entityId,
        evaluatorId: mockRuntime.agentId,
        type: TrustEvidenceType.PROMISE_BROKEN,
        impact: -15,
        weight: 1.0,
        description: 'Broke promise',
        timestamp: now - 86400000, // 1 day ago
        verified: true,
        reportedBy: mockRuntime.agentId,
        context: { entityId, evaluatorId: mockRuntime.agentId },
        metadata: {},
      };

      const evidence2: TrustEvidence = {
        targetEntityId: entityId,
        evaluatorId: mockRuntime.agentId,
        type: TrustEvidenceType.PROMISE_KEPT,
        impact: 15,
        weight: 1.0,
        description: 'Kept promise',
        timestamp: now,
        verified: true,
        reportedBy: mockRuntime.agentId,
        context: { entityId, evaluatorId: mockRuntime.agentId },
        metadata: {},
      };

      await trustDatabase.addTrustEvidence(evidence1);
      await trustDatabase.addTrustEvidence(evidence2);

      const allEvidence = await trustDatabase.getTrustEvidence(entityId);
      expect(allEvidence).toHaveLength(2);
      // Should be ordered by timestamp DESC
      expect(allEvidence[0].type).toBe(TrustEvidenceType.PROMISE_KEPT);
      expect(allEvidence[1].type).toBe(TrustEvidenceType.PROMISE_BROKEN);
    });
  });

  describe('trust comments', () => {
    beforeEach(async () => {
      await trustDatabase.initialize(mockRuntime);
    });

    it('should save and retrieve trust comments', async () => {
      const entityId = 'entity-123' as UUID;
      const evaluatorId = mockRuntime.agentId;

      await trustDatabase.saveTrustComment({
        entityId,
        evaluatorId,
        trustScore: 75,
        trustChange: 10,
        comment: 'Showed improvement in reliability',
        metadata: { reason: 'consistent_behavior' },
      });

      const latestComment = await trustDatabase.getLatestTrustComment(entityId, evaluatorId);

      expect(latestComment).toBeDefined();
      expect(latestComment?.trustScore).toBe(75);
      expect(latestComment?.trustChange).toBe(10);
      expect(latestComment?.comment).toBe('Showed improvement in reliability');
    });

    it('should retrieve comment history', async () => {
      const entityId = 'entity-123' as UUID;
      const evaluatorId = mockRuntime.agentId;

      // Add multiple comments
      for (let i = 0; i < 5; i++) {
        await trustDatabase.saveTrustComment({
          entityId,
          evaluatorId,
          trustScore: 50 + i * 10,
          trustChange: 10,
          comment: `Comment ${i}`,
          metadata: {},
        });
        // Add small delay to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const history = await trustDatabase.getTrustCommentHistory(entityId, evaluatorId, 3);

      expect(history).toHaveLength(3);
      // Should be ordered by timestamp DESC
      expect(history[0].comment).toBe('Comment 4');
      expect(history[1].comment).toBe('Comment 3');
      expect(history[2].comment).toBe('Comment 2');
    });
  });

  describe('permission delegations', () => {
    beforeEach(async () => {
      await trustDatabase.initialize(mockRuntime);
    });

    it('should save and retrieve permission delegations', async () => {
      const delegatorId = 'delegator-123' as UUID;
      const delegation = {
        id: 'delegation-1' as UUID,
        delegatorId,
        delegateeId: 'delegatee-456' as UUID,
        permissions: [
          {
            action: 'read' as UUID,
            resource: 'documents' as UUID,
          },
        ],
        context: {
          timestamp: Date.now(),
          platform: 'test' as UUID,
        },
        createdAt: Date.now(),
      };

      await trustDatabase.savePermissionDelegation(delegation);
      const delegations = await trustDatabase.getPermissionDelegations(delegatorId);

      expect(delegations).toHaveLength(1);
      expect(delegations[0].delegatorId).toBe(delegatorId);
      expect(delegations[0].delegateeId).toBe(delegation.delegateeId);
    });
  });

  describe('stop', () => {
    it('should clean up resources', async () => {
      await trustDatabase.initialize(mockRuntime);

      // Should not throw
      await trustDatabase.stop();
      // Test passes if no error is thrown
    });
  });
});
