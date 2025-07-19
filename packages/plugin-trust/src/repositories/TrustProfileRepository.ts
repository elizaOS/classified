import type { UUID } from '@elizaos/core';
import { BaseRepository } from './BaseRepository';

export interface TrustProfile {
  id: UUID;
  entityId: UUID;
  evaluatorId: UUID;
  overallTrust: number;
  confidence: number;
  interactionCount: number;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  trendChangeRate: number;
  dimensions: {
    reliability: number;
    consistency: number;
    helpfulness: number;
    knowledgeability: number;
    empathy: number;
  };
  lastCalculated: Date;
}

export class TrustProfileRepository extends BaseRepository {
  /**
   * Get a trust profile by entity and evaluator IDs
   */
  async getTrustProfile(entityId: UUID, evaluatorId: UUID): Promise<TrustProfile | null> {
    const tableName = this.getTableName('trust_profiles');
    const sql = `
      SELECT 
        id,
        entity_id as "entityId",
        evaluator_id as "evaluatorId",
        overall_trust as "overallTrust",
        confidence,
        interaction_count as "interactionCount",
        trend_direction as "trendDirection",
        trend_change_rate as "trendChangeRate",
        dimensions,
        last_calculated as "lastCalculated"
      FROM ${tableName}
      WHERE entity_id = ? AND evaluator_id = ?
    `;

    const result = await this.queryOne<any>(sql, [entityId, evaluatorId]);

    if (!result) {
      return null;
    }

    return {
      ...result,
      dimensions:
        typeof result.dimensions === 'string' ? JSON.parse(result.dimensions) : result.dimensions,
      lastCalculated: new Date(result.lastCalculated),
    };
  }

  /**
   * Create a new trust profile
   */
  async createTrustProfile(profile: Omit<TrustProfile, 'id'>): Promise<UUID> {
    const id = await this.generateId();
    const tableName = this.getTableName('trust_profiles');

    const sql = `
      INSERT INTO ${tableName} (
        id,
        entity_id,
        evaluator_id,
        overall_trust,
        confidence,
        interaction_count,
        trend_direction,
        trend_change_rate,
        dimensions,
        last_calculated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${this.getCurrentTimestamp()})
    `;

    const params = [
      id,
      profile.entityId,
      profile.evaluatorId,
      profile.overallTrust,
      profile.confidence,
      profile.interactionCount,
      profile.trendDirection,
      profile.trendChangeRate,
      JSON.stringify(profile.dimensions),
    ];

    await this.execute(sql, params);
    return id;
  }

  /**
   * Update an existing trust profile
   */
  async updateTrustProfile(
    entityId: UUID,
    evaluatorId: UUID,
    updates: Partial<Omit<TrustProfile, 'id' | 'entityId' | 'evaluatorId'>>
  ): Promise<boolean> {
    const tableName = this.getTableName('trust_profiles');
    const setClauses: string[] = [];
    const params: any[] = [];

    if (updates.overallTrust !== undefined) {
      setClauses.push('overall_trust = ?');
      params.push(updates.overallTrust);
    }

    if (updates.confidence !== undefined) {
      setClauses.push('confidence = ?');
      params.push(updates.confidence);
    }

    if (updates.interactionCount !== undefined) {
      setClauses.push('interaction_count = ?');
      params.push(updates.interactionCount);
    }

    if (updates.trendDirection !== undefined) {
      setClauses.push('trend_direction = ?');
      params.push(updates.trendDirection);
    }

    if (updates.trendChangeRate !== undefined) {
      setClauses.push('trend_change_rate = ?');
      params.push(updates.trendChangeRate);
    }

    if (updates.dimensions !== undefined) {
      setClauses.push('dimensions = ?');
      params.push(JSON.stringify(updates.dimensions));
    }

    // Always update last_calculated
    setClauses.push(`last_calculated = ${this.getCurrentTimestamp()}`);

    params.push(entityId, evaluatorId);

    const sql = `
      UPDATE ${tableName}
      SET ${setClauses.join(', ')}
      WHERE entity_id = ? AND evaluator_id = ?
    `;

    const affectedRows = await this.execute(sql, params);
    return affectedRows > 0;
  }

  /**
   * Get all trust profiles for an entity
   */
  async getTrustProfilesForEntity(entityId: UUID): Promise<TrustProfile[]> {
    const tableName = this.getTableName('trust_profiles');
    const sql = `
      SELECT 
        id,
        entity_id as "entityId",
        evaluator_id as "evaluatorId",
        overall_trust as "overallTrust",
        confidence,
        interaction_count as "interactionCount",
        trend_direction as "trendDirection",
        trend_change_rate as "trendChangeRate",
        dimensions,
        last_calculated as "lastCalculated"
      FROM ${tableName}
      WHERE entity_id = ?
      ORDER BY last_calculated DESC
    `;

    const results = await this.query<any>(sql, [entityId]);

    return results.map((result) => ({
      ...result,
      dimensions:
        typeof result.dimensions === 'string' ? JSON.parse(result.dimensions) : result.dimensions,
      lastCalculated: new Date(result.lastCalculated),
    }));
  }

  /**
   * Get average trust score for an entity across all evaluators
   */
  async getAverageTrustScore(entityId: UUID): Promise<number> {
    const tableName = this.getTableName('trust_profiles');
    const sql = `
      SELECT AVG(overall_trust) as avg_trust
      FROM ${tableName}
      WHERE entity_id = ?
    `;

    const result = await this.queryOne<{ avg_trust: number }>(sql, [entityId]);
    return result?.avg_trust || 50; // Default trust score
  }

  /**
   * Delete a trust profile
   */
  async deleteTrustProfile(entityId: UUID, evaluatorId: UUID): Promise<boolean> {
    const tableName = this.getTableName('trust_profiles');
    const sql = `
      DELETE FROM ${tableName}
      WHERE entity_id = ? AND evaluator_id = ?
    `;

    const affectedRows = await this.execute(sql, [entityId, evaluatorId]);
    return affectedRows > 0;
  }

  /**
   * Check if a trust profile exists
   */
  async trustProfileExists(entityId: UUID, evaluatorId: UUID): Promise<boolean> {
    const tableName = this.getTableName('trust_profiles');
    const sql = `
      SELECT 1
      FROM ${tableName}
      WHERE entity_id = ? AND evaluator_id = ?
      LIMIT 1
    `;

    const result = await this.queryOne(sql, [entityId, evaluatorId]);
    return result !== null;
  }
}
