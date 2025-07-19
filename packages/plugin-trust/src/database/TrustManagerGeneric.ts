import { IDatabaseAdapter, UUID } from '@elizaos/core';
import { PluginTableService } from './plugin-table.service';
import type {
  TrustDimensions,
  TrustEvidence as TrustEvidenceInterface,
  TrustScore,
  TrustContext,
} from '../types/trust';

// Database table interfaces matching the schema
interface TrustProfileDB {
  id: UUID;
  entityId: UUID;
  evaluatorId: UUID;
  overallTrust: number;
  confidence: number;
  interactionCount: number;
  trendDirection: string;
  trendChangeRate: number;
  dimensions: TrustDimensions;
  lastCalculated: Date;
}

interface TrustEvidenceDB {
  id: UUID;
  targetEntityId: UUID;
  sourceEntityId: UUID;
  evaluatorId: UUID;
  type: string;
  timestamp: Date;
  impact: number;
  weight: number;
  description: string | null;
  verified: boolean;
  context: any;
}

/**
 * Trust Manager using the generic table API
 * This implementation leverages the PluginTableService for database operations
 */
export class TrustManagerGeneric {
  private readonly tables: PluginTableService;
  private readonly profiles;
  private readonly evidence;

  constructor(
    private db: IDatabaseAdapter,
    private evaluatorId: UUID
  ) {
    this.tables = new PluginTableService(db, 'trust');
    this.profiles = this.tables.table<TrustProfileDB>('profiles');
    this.evidence = this.tables.table<TrustEvidenceDB>('evidence');
  }

  /**
   * Get or create a trust profile for an entity
   */
  async getOrCreateProfile(entityId: UUID): Promise<TrustProfileDB> {
    // Try to find existing profile for this evaluator-entity pair
    let profile = await this.profiles.findOne({
      entityId,
      evaluatorId: this.evaluatorId,
    });

    if (!profile) {
      // Create new profile with default trust score
      const [newProfile] = await this.profiles.insert({
        entityId,
        evaluatorId: this.evaluatorId,
        overallTrust: 50, // Default neutral trust
        confidence: 50,
        interactionCount: 0,
        trendDirection: 'stable',
        trendChangeRate: 0,
        dimensions: {
          reliability: 50,
          competence: 50,
          integrity: 50,
          benevolence: 50,
          transparency: 50,
        },
        lastCalculated: new Date(),
      });
      profile = newProfile;
    }

    return profile;
  }

  /**
   * Update trust profile
   */
  async updateProfile(
    profileId: UUID,
    updates: Partial<TrustProfileDB>
  ): Promise<TrustProfileDB | null> {
    return this.profiles.updateById(profileId, {
      ...updates,
      lastCalculated: new Date(),
    });
  }

  /**
   * Record trust evidence
   */
  async recordEvidence(
    evidence: Omit<TrustEvidenceDB, 'id' | 'timestamp'>
  ): Promise<TrustEvidenceDB> {
    const [created] = await this.evidence.insert({
      ...evidence,
      timestamp: new Date(),
    });
    return created;
  }

  /**
   * Get evidence for an entity
   */
  async getEvidence(targetEntityId: UUID, limit?: number): Promise<TrustEvidenceDB[]> {
    return this.evidence.find({
      where: { targetEntityId, evaluatorId: this.evaluatorId },
      orderBy: [{ column: 'timestamp', direction: 'desc' }],
      limit,
    });
  }

  /**
   * Calculate trust score based on evidence
   */
  async calculateTrustScore(entityId: UUID): Promise<TrustScore> {
    // Get recent evidence
    const recentEvidence = await this.getEvidence(entityId, 100);

    // Calculate dimensions based on evidence
    const dimensions: TrustDimensions = {
      reliability: this.calculateDimension(recentEvidence, 'reliability'),
      competence: this.calculateDimension(recentEvidence, 'competence'),
      integrity: this.calculateDimension(recentEvidence, 'integrity'),
      benevolence: this.calculateDimension(recentEvidence, 'benevolence'),
      transparency: this.calculateDimension(recentEvidence, 'transparency'),
    };

    // Calculate overall score (weighted average)
    const weights = {
      reliability: 0.25,
      competence: 0.2,
      integrity: 0.25,
      benevolence: 0.15,
      transparency: 0.15,
    };

    const overallScore = Object.entries(dimensions).reduce((sum, [key, value]) => {
      return sum + value * (weights[key as keyof TrustDimensions] || 0);
    }, 0);

    // Update profile
    const profile = await this.getOrCreateProfile(entityId);

    // Determine trend
    const previousScore = profile.overallTrust;
    const changeRate = overallScore - previousScore;
    const trend = changeRate > 0.5 ? 'improving' : changeRate < -0.5 ? 'declining' : 'stable';

    await this.updateProfile(profile.id, {
      overallTrust: Math.round(overallScore),
      dimensions,
      trendDirection: trend,
      trendChangeRate: Math.round(changeRate),
      confidence: Math.min(100, 50 + recentEvidence.length),
      interactionCount: profile.interactionCount + recentEvidence.length,
    });

    // Determine reputation
    let reputation: TrustScore['reputation'];
    if (overallScore >= 90) reputation = 'exceptional';
    else if (overallScore >= 80) reputation = 'excellent';
    else if (overallScore >= 70) reputation = 'good';
    else if (overallScore >= 50) reputation = 'fair';
    else if (overallScore >= 30) reputation = 'poor';
    else reputation = 'untrusted';

    return {
      overall: overallScore,
      dimensions,
      confidence: Math.min(100, 50 + recentEvidence.length) / 100,
      lastUpdated: Date.now(),
      trend,
      reputation,
    };
  }

  /**
   * Get trust relationships
   */
  async getTrustRelationships(
    entityId: UUID
  ): Promise<Array<{ entityId: UUID; trustScore: number }>> {
    // Get all profiles for this evaluator
    const allProfiles = await this.profiles.find({
      where: { evaluatorId: this.evaluatorId },
      orderBy: [{ column: 'overallTrust', direction: 'desc' }],
      limit: 10,
    });

    return allProfiles
      .filter((p: TrustProfileDB) => p.entityId !== entityId)
      .map((p: TrustProfileDB) => ({
        entityId: p.entityId,
        trustScore: p.overallTrust,
      }));
  }

  /**
   * Clean up old evidence
   */
  async cleanupOldEvidence(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    // Get old evidence for this evaluator
    const allEvidence = await this.evidence.find({
      where: { evaluatorId: this.evaluatorId },
    });

    // Delete old evidence
    let deletedCount = 0;
    for (const evidence of allEvidence) {
      if (evidence.timestamp < cutoffDate) {
        await this.evidence.deleteById(evidence.id);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Helper to calculate individual dimensions from evidence
   */
  private calculateDimension(
    evidence: TrustEvidenceDB[],
    dimension: keyof TrustDimensions
  ): number {
    const relevantEvidence = evidence.filter(
      (e) =>
        e.type.toLowerCase().includes(dimension) || e.description?.toLowerCase().includes(dimension)
    );

    if (relevantEvidence.length === 0) return 50; // Default neutral

    // Calculate weighted average based on impact and weight
    const totalWeight = relevantEvidence.reduce((sum, e) => sum + e.weight, 0);
    const weightedSum = relevantEvidence.reduce((sum, e) => {
      // Normalize impact from -100 to 100 to 0-100 scale
      const normalizedImpact = (e.impact + 100) / 2;
      return sum + normalizedImpact * e.weight;
    }, 0);

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;
  }

  /**
   * Get all trust profiles for this evaluator
   */
  async getAllProfiles(): Promise<TrustProfileDB[]> {
    return this.profiles.find({
      where: { evaluatorId: this.evaluatorId },
      orderBy: [{ column: 'overallTrust', direction: 'desc' }],
    });
  }

  /**
   * Delete a trust profile and its evidence
   */
  async deleteProfile(entityId: UUID): Promise<boolean> {
    // Delete evidence first
    const evidence = await this.getEvidence(entityId);
    for (const e of evidence) {
      await this.evidence.deleteById(e.id);
    }

    // Delete profile
    const profile = await this.profiles.findOne({
      entityId,
      evaluatorId: this.evaluatorId,
    });
    if (profile) {
      return this.profiles.deleteById(profile.id);
    }

    return false;
  }

  /**
   * Convert evidence from interface to database format
   */
  async recordTrustEvidence(evidence: TrustEvidenceInterface): Promise<TrustEvidenceDB> {
    return this.recordEvidence({
      targetEntityId: evidence.targetEntityId,
      sourceEntityId: evidence.reportedBy,
      evaluatorId: evidence.evaluatorId || this.evaluatorId,
      type: evidence.type,
      impact: evidence.impact,
      weight: Math.round(evidence.weight * 100), // Convert 0-1 to 0-100
      description: evidence.description,
      verified: evidence.verified,
      context: evidence.context,
    });
  }
}
