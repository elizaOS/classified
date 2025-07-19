import type { UUID } from '@elizaos/core';
import { BaseRepository } from './BaseRepository';

export interface TrustEvidence {
  id: UUID;
  targetEntityId: UUID;
  sourceEntityId: UUID;
  evaluatorId: UUID;
  type: 'behavioral' | 'interaction' | 'reputation' | 'verification' | 'anomaly';
  timestamp: Date;
  impact: number; // -100 to 100
  weight: number; // 0 to 1
  description?: string;
  verified: boolean;
  context?: Record<string, any>;
}

export class TrustEvidenceRepository extends BaseRepository {
  /**
   * Create new trust evidence
   */
  async createEvidence(evidence: Omit<TrustEvidence, 'id'>): Promise<UUID> {
    const id = await this.generateId();
    const tableName = this.getTableName('trust_evidence');

    const sql = `
      INSERT INTO ${tableName} (
        id,
        target_entity_id,
        source_entity_id,
        evaluator_id,
        type,
        timestamp,
        impact,
        weight,
        description,
        verified,
        context
      ) VALUES (?, ?, ?, ?, ?, ${this.getCurrentTimestamp()}, ?, ?, ?, ?, ?)
    `;

    const params = [
      id,
      evidence.targetEntityId,
      evidence.sourceEntityId,
      evidence.evaluatorId,
      evidence.type,
      evidence.impact,
      evidence.weight || 1,
      evidence.description || null,
      evidence.verified || false,
      evidence.context ? JSON.stringify(evidence.context) : null,
    ];

    await this.execute(sql, params);
    return id;
  }

  /**
   * Get evidence by ID
   */
  async getEvidenceById(id: UUID): Promise<TrustEvidence | null> {
    const tableName = this.getTableName('trust_evidence');
    const sql = `
      SELECT 
        id,
        target_entity_id as "targetEntityId",
        source_entity_id as "sourceEntityId",
        evaluator_id as "evaluatorId",
        type,
        timestamp,
        impact,
        weight,
        description,
        verified,
        context
      FROM ${tableName}
      WHERE id = ?
    `;

    const result = await this.queryOne<any>(sql, [id]);

    if (!result) {
      return null;
    }

    return this.mapResultToEvidence(result);
  }

  /**
   * Get all evidence for a target entity
   */
  async getEvidenceForEntity(
    targetEntityId: UUID,
    options?: {
      evaluatorId?: UUID;
      type?: TrustEvidence['type'];
      verified?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<TrustEvidence[]> {
    const tableName = this.getTableName('trust_evidence');
    const conditions: string[] = ['target_entity_id = ?'];
    const params: any[] = [targetEntityId];

    if (options?.evaluatorId) {
      conditions.push('evaluator_id = ?');
      params.push(options.evaluatorId);
    }

    if (options?.type) {
      conditions.push('type = ?');
      params.push(options.type);
    }

    if (options?.verified !== undefined) {
      conditions.push('verified = ?');
      params.push(options.verified);
    }

    let sql = `
      SELECT 
        id,
        target_entity_id as "targetEntityId",
        source_entity_id as "sourceEntityId",
        evaluator_id as "evaluatorId",
        type,
        timestamp,
        impact,
        weight,
        description,
        verified,
        context
      FROM ${tableName}
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp DESC
    `;

    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
      if (options.offset) {
        sql += ` OFFSET ${options.offset}`;
      }
    }

    const results = await this.query<any>(sql, params);
    return results.map((result) => this.mapResultToEvidence(result));
  }

  /**
   * Get evidence within a time range
   */
  async getEvidenceInTimeRange(
    targetEntityId: UUID,
    startTime: Date,
    endTime: Date
  ): Promise<TrustEvidence[]> {
    const tableName = this.getTableName('trust_evidence');
    const sql = `
      SELECT 
        id,
        target_entity_id as "targetEntityId",
        source_entity_id as "sourceEntityId",
        evaluator_id as "evaluatorId",
        type,
        timestamp,
        impact,
        weight,
        description,
        verified,
        context
      FROM ${tableName}
      WHERE target_entity_id = ?
        AND timestamp >= ?
        AND timestamp <= ?
      ORDER BY timestamp DESC
    `;

    const params = [targetEntityId, startTime.toISOString(), endTime.toISOString()];

    const results = await this.query<any>(sql, params);
    return results.map((result) => this.mapResultToEvidence(result));
  }

  /**
   * Calculate weighted trust impact for an entity
   */
  async calculateWeightedImpact(targetEntityId: UUID, evaluatorId?: UUID): Promise<number> {
    const tableName = this.getTableName('trust_evidence');
    let sql = `
      SELECT SUM(impact * weight) / SUM(weight) as weighted_impact
      FROM ${tableName}
      WHERE target_entity_id = ?
    `;
    const params: any[] = [targetEntityId];

    if (evaluatorId) {
      sql += ' AND evaluator_id = ?';
      params.push(evaluatorId);
    }

    const result = await this.queryOne<{ weighted_impact: number }>(sql, params);
    return result?.weighted_impact || 0;
  }

  /**
   * Mark evidence as verified
   */
  async verifyEvidence(id: UUID): Promise<boolean> {
    const tableName = this.getTableName('trust_evidence');
    const sql = `
      UPDATE ${tableName}
      SET verified = ?
      WHERE id = ?
    `;

    const affectedRows = await this.execute(sql, [true, id]);
    return affectedRows > 0;
  }

  /**
   * Delete evidence
   */
  async deleteEvidence(id: UUID): Promise<boolean> {
    const tableName = this.getTableName('trust_evidence');
    const sql = `
      DELETE FROM ${tableName}
      WHERE id = ?
    `;

    const affectedRows = await this.execute(sql, [id]);
    return affectedRows > 0;
  }

  /**
   * Get evidence statistics for an entity
   */
  async getEvidenceStats(targetEntityId: UUID): Promise<{
    totalCount: number;
    verifiedCount: number;
    positiveCount: number;
    negativeCount: number;
    averageImpact: number;
  }> {
    const tableName = this.getTableName('trust_evidence');
    const sql = `
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN verified = ${this.isPostgreSQL() ? 'true' : '1'} THEN 1 END) as verified_count,
        COUNT(CASE WHEN impact > 0 THEN 1 END) as positive_count,
        COUNT(CASE WHEN impact < 0 THEN 1 END) as negative_count,
        AVG(impact) as average_impact
      FROM ${tableName}
      WHERE target_entity_id = ?
    `;

    const result = await this.queryOne<any>(sql, [targetEntityId]);

    return {
      totalCount: result?.total_count || 0,
      verifiedCount: result?.verified_count || 0,
      positiveCount: result?.positive_count || 0,
      negativeCount: result?.negative_count || 0,
      averageImpact: result?.average_impact || 0,
    };
  }

  /**
   * Helper to map database result to TrustEvidence object
   */
  private mapResultToEvidence(result: any): TrustEvidence {
    return {
      id: result.id,
      targetEntityId: result.targetEntityId,
      sourceEntityId: result.sourceEntityId,
      evaluatorId: result.evaluatorId,
      type: result.type,
      timestamp: new Date(result.timestamp),
      impact: result.impact,
      weight: result.weight,
      description: result.description,
      verified: this.isPostgreSQL() ? result.verified : result.verified === 1,
      context: result.context
        ? typeof result.context === 'string'
          ? JSON.parse(result.context)
          : result.context
        : undefined,
    };
  }
}
