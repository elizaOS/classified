import { logger } from '@elizaos/core';
import type { IAgentRuntime } from '@elizaos/core';
import type { UUID } from '@elizaos/core';
import type { TrustProfile, TrustEvidence } from '../types/trust';
import type { PermissionDelegation, Permission } from '../types/permissions';

export interface ITrustDatabase {
  initialize(runtime: IAgentRuntime, db?: any): Promise<void>;
  stop(): Promise<void>;
  runMigrations(): Promise<void>;
  db: any;

  // Trust Profile Methods
  saveTrustProfile(profile: TrustProfile): Promise<void>;
  getTrustProfile(entityId: UUID): Promise<TrustProfile | null>;
  getAllTrustProfiles(): Promise<TrustProfile[]>;
  deleteTrustProfile(entityId: UUID): Promise<void>;

  // Trust Evidence Methods
  addTrustEvidence(evidence: TrustEvidence): Promise<void>;
  getTrustEvidence(entityId: UUID): Promise<TrustEvidence[]>;

  // Trust Comment Methods
  saveTrustComment(comment: {
    entityId: UUID;
    evaluatorId: UUID;
    trustScore: number;
    trustChange: number;
    comment: string;
    metadata?: any;
  }): Promise<void>;
  getLatestTrustComment(
    entityId: UUID,
    evaluatorId: UUID
  ): Promise<{
    id: string;
    entityId: UUID;
    evaluatorId: UUID;
    trustScore: number;
    trustChange: number;
    comment: string;
    timestamp: number;
    metadata: any;
  } | null>;
  getTrustCommentHistory(
    entityId: UUID,
    evaluatorId: UUID,
    limit?: number
  ): Promise<
    Array<{
      id: string;
      entityId: UUID;
      evaluatorId: UUID;
      trustScore: number;
      trustChange: number;
      comment: string;
      timestamp: number;
      metadata: any;
    }>
  >;

  // Permission Delegation
  savePermissionDelegation(delegation: PermissionDelegation): Promise<void>;
  getPermissionDelegations(delegatorId: UUID): Promise<PermissionDelegation[]>;
}

export class TrustDatabase implements ITrustDatabase {
  public db: any;
  private runtime?: IAgentRuntime;

  async initialize(runtime: IAgentRuntime, db?: any): Promise<void> {
    this.runtime = runtime;
    this.db = db || runtime.db;

    // Skip migrations if we're in a test environment or if the DB isn't ready
    const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
    const isE2ETest = process.env.ELIZAOS_TEST === 'true' || runtime.character?.name === 'Eliza';

    if (!isTestEnvironment && !isE2ETest) {
      try {
        await this.runMigrations();
      } catch (error) {
        // Log but don't fail initialization - the tables might already exist
        logger.warn('Failed to run migrations, tables may already exist:', error);
      }
    } else {
      logger.info('Skipping trust database migrations in test environment');
    }
  }

  async stop(): Promise<void> {
    // Clean up any resources if needed
  }

  /**
   * Execute SQL with compatibility for different database adapters
   */
  private async executeSQL(sql: string, params?: any[]): Promise<any> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Try execute method first (most common)
    if (typeof this.db.execute === 'function') {
      try {
        const result = await this.db.execute(sql, params);
        // Some adapters return { rows } while others return the rows directly
        // For SELECT queries, ensure we always return an array
        if (sql.trim().toUpperCase().startsWith('SELECT')) {
          return result.rows || result || [];
        }
        return result;
      } catch (error) {
        // If execute fails, try other methods
        logger.debug('Execute failed, trying other methods:', error);
      }
    }

    // Try other methods
    if (typeof this.db.rawQuery === 'function') {
      const result = await this.db.rawQuery(sql, params);
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return result || [];
      }
      return result;
    } else if (typeof this.db.run === 'function') {
      const result = await this.db.run(sql, params);
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return result || [];
      }
      return result;
    } else {
      throw new Error('No SQL execution method available on database adapter');
    }
  }

  async runMigrations(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Detect if database is PostgreSQL
      const isPostgres = this.isPostgreSQL(this.db);

      if (isPostgres) {
        // PostgreSQL migrations
        await this.executeSQL(`
          CREATE TABLE IF NOT EXISTS trust_profiles (
            entity_id UUID PRIMARY KEY,
            overall_trust NUMERIC NOT NULL DEFAULT 50,
            reliability NUMERIC NOT NULL DEFAULT 50,
            competence NUMERIC NOT NULL DEFAULT 50,
            integrity NUMERIC NOT NULL DEFAULT 50,
            benevolence NUMERIC NOT NULL DEFAULT 50,
            transparency NUMERIC NOT NULL DEFAULT 50,
            confidence NUMERIC NOT NULL DEFAULT 0.5,
            interaction_count INTEGER NOT NULL DEFAULT 0,
            last_calculated BIGINT NOT NULL DEFAULT 0,
            created_at BIGINT NOT NULL DEFAULT 0,
            updated_at BIGINT NOT NULL DEFAULT 0,
            evidence JSONB
          )
        `);

        await this.executeSQL(`
          CREATE TABLE IF NOT EXISTS trust_evidence (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            entity_id UUID NOT NULL,
            type VARCHAR(255) NOT NULL,
            impact NUMERIC NOT NULL,
            weight NUMERIC NOT NULL DEFAULT 1.0,
            description TEXT,
            timestamp BIGINT NOT NULL,
            verified BOOLEAN NOT NULL DEFAULT false,
            reported_by UUID,
            context JSONB,
            metadata JSONB
          )
        `);

        await this.executeSQL(`
          CREATE TABLE IF NOT EXISTS trust_comments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            entity_id UUID NOT NULL,
            evaluator_id UUID NOT NULL,
            trust_score NUMERIC NOT NULL,
            trust_change NUMERIC NOT NULL,
            comment TEXT NOT NULL,
            timestamp BIGINT NOT NULL,
            metadata JSONB
          )
        `);

        await this.executeSQL(`
          CREATE TABLE IF NOT EXISTS permission_delegations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            delegator_id UUID NOT NULL,
            delegatee_id UUID NOT NULL,
            permission VARCHAR(255) NOT NULL,
            resource VARCHAR(255),
            granted_at BIGINT NOT NULL,
            expires_at BIGINT,
            active BOOLEAN NOT NULL DEFAULT true,
            conditions JSONB
          )
        `);

        // Create cache table with proper primary key for PostgreSQL
        await this.executeSQL(`
          CREATE TABLE IF NOT EXISTS "cache" (
            "key" TEXT NOT NULL,
            "value" JSONB,
            "expiresAt" TIMESTAMP,
            PRIMARY KEY ("key")
          )
        `);
      } else {
        // SQLite migrations (original)
        await this.executeSQL(`
        CREATE TABLE IF NOT EXISTS trust_profiles (
          entity_id TEXT PRIMARY KEY,
          overall_trust REAL NOT NULL DEFAULT 50,
          reliability REAL NOT NULL DEFAULT 50,
          competence REAL NOT NULL DEFAULT 50,
          integrity REAL NOT NULL DEFAULT 50,
          benevolence REAL NOT NULL DEFAULT 50,
          transparency REAL NOT NULL DEFAULT 50,
          confidence REAL NOT NULL DEFAULT 0.5,
          interaction_count INTEGER NOT NULL DEFAULT 0,
          last_calculated INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL DEFAULT 0,
          evidence TEXT -- JSON array of evidence
        )
      `);

        await this.executeSQL(`
        CREATE TABLE IF NOT EXISTS trust_evidence (
          id TEXT PRIMARY KEY,
          entity_id TEXT NOT NULL,
          type TEXT NOT NULL,
          impact REAL NOT NULL,
          weight REAL NOT NULL DEFAULT 1.0,
          description TEXT,
          timestamp INTEGER NOT NULL,
          verified BOOLEAN NOT NULL DEFAULT 0,
          reported_by TEXT,
          context TEXT, -- JSON object
          metadata TEXT -- JSON object
        )
      `);

        await this.executeSQL(`
        CREATE TABLE IF NOT EXISTS trust_comments (
          id TEXT PRIMARY KEY,
          entity_id TEXT NOT NULL,
          evaluator_id TEXT NOT NULL,
          trust_score REAL NOT NULL,
          trust_change REAL NOT NULL,
          comment TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          metadata TEXT -- JSON object
        )
      `);

        await this.executeSQL(`
        CREATE TABLE IF NOT EXISTS permission_delegations (
          id TEXT PRIMARY KEY,
          delegator_id TEXT NOT NULL,
          delegatee_id TEXT NOT NULL,
          permission TEXT NOT NULL,
          resource TEXT,
          granted_at INTEGER NOT NULL,
          expires_at INTEGER,
          active BOOLEAN NOT NULL DEFAULT 1,
          conditions TEXT -- JSON object
        )
      `);
      }

      // Create indexes (same for both)
      await this.executeSQL(
        'CREATE INDEX IF NOT EXISTS idx_trust_evidence_entity ON trust_evidence(entity_id)'
      );
      await this.executeSQL(
        'CREATE INDEX IF NOT EXISTS idx_trust_evidence_timestamp ON trust_evidence(timestamp)'
      );
      await this.executeSQL(
        'CREATE INDEX IF NOT EXISTS idx_trust_comments_entity ON trust_comments(entity_id, evaluator_id)'
      );
      await this.executeSQL(
        'CREATE INDEX IF NOT EXISTS idx_trust_comments_timestamp ON trust_comments(timestamp)'
      );
      await this.executeSQL(
        'CREATE INDEX IF NOT EXISTS idx_delegations_delegator ON permission_delegations(delegator_id)'
      );
    } catch (error) {
      logger.error('Failed to run trust database migrations:', error);
      throw error;
    }
  }

  async saveTrustProfile(profile: TrustProfile): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const now = Date.now();
      await this.executeSQL(
        `
        INSERT OR REPLACE INTO trust_profiles (
          entity_id, overall_trust, reliability, competence, integrity,
          benevolence, transparency, confidence, interaction_count,
          last_calculated, created_at, updated_at, evidence
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          profile.entityId,
          profile.overallTrust,
          profile.dimensions.reliability,
          profile.dimensions.competence,
          profile.dimensions.integrity,
          profile.dimensions.benevolence,
          profile.dimensions.transparency,
          profile.confidence,
          profile.interactionCount,
          profile.lastCalculated,
          now, // created_at - use now for new profiles
          now,
          JSON.stringify(profile.evidence || []),
        ]
      );
    } catch (error) {
      logger.error('Failed to save trust profile:', error);
      throw error;
    }
  }

  async getTrustProfile(entityId: UUID): Promise<TrustProfile | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const rows = await this.executeSQL(
        `
        SELECT * FROM trust_profiles WHERE entity_id = ?
      `,
        [entityId]
      );

      if (!rows || rows.length === 0) {
        return null;
      }

      const row = rows[0];
      if (!row) {
        return null;
      }
      return {
        entityId: row.entity_id,
        overallTrust: row.overall_trust,
        dimensions: {
          reliability: row.reliability,
          competence: row.competence,
          integrity: row.integrity,
          benevolence: row.benevolence,
          transparency: row.transparency,
        },
        confidence: row.confidence,
        interactionCount: row.interaction_count,
        lastCalculated: row.last_calculated,
        evidence: JSON.parse(row.evidence || '[]'),
        evaluatorId: this.runtime?.agentId || ('system' as UUID),
        calculationMethod: 'weighted_dimensions',
        trend: {
          direction: 'stable',
          changeRate: 0,
          lastChangeAt: row.updated_at,
        },
      };
    } catch (error) {
      logger.error('Failed to get trust profile:', error);
      throw error;
    }
  }

  async getAllTrustProfiles(): Promise<TrustProfile[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const rows = await this.executeSQL(`
        SELECT * FROM trust_profiles ORDER BY overall_trust DESC
      `);

      return (rows || []).map((row: any) => ({
        entityId: row.entity_id,
        overallTrust: row.overall_trust,
        dimensions: {
          reliability: row.reliability,
          competence: row.competence,
          integrity: row.integrity,
          benevolence: row.benevolence,
          transparency: row.transparency,
        },
        confidence: row.confidence,
        interactionCount: row.interaction_count,
        lastCalculated: row.last_calculated,
        evidence: JSON.parse(row.evidence || '[]'),
        evaluatorId: this.runtime?.agentId || ('system' as UUID),
        calculationMethod: 'weighted_dimensions',
        trend: {
          direction: 'stable',
          changeRate: 0,
          lastChangeAt: row.updated_at,
        },
      }));
    } catch (error) {
      logger.error('Failed to get all trust profiles:', error);
      throw error;
    }
  }

  async deleteTrustProfile(entityId: UUID): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.executeSQL('DELETE FROM trust_profiles WHERE entity_id = ?', [entityId]);
      await this.executeSQL('DELETE FROM trust_evidence WHERE entity_id = ?', [entityId]);
    } catch (error) {
      logger.error('Failed to delete trust profile:', error);
      throw error;
    }
  }

  async addTrustEvidence(evidence: TrustEvidence): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const id = `evidence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await this.executeSQL(
        `
        INSERT INTO trust_evidence (
          id, entity_id, type, impact, weight, description,
          timestamp, verified, reported_by, context, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          id,
          evidence.targetEntityId,
          evidence.type,
          evidence.impact,
          evidence.weight,
          evidence.description,
          evidence.timestamp,
          evidence.verified ? 1 : 0,
          evidence.reportedBy,
          JSON.stringify(evidence.context || {}),
          JSON.stringify(evidence.metadata || {}),
        ]
      );
    } catch (error) {
      logger.error('Failed to add trust evidence:', error);
      throw error;
    }
  }

  async getTrustEvidence(entityId: UUID): Promise<TrustEvidence[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const rows = await this.executeSQL(
        `
        SELECT * FROM trust_evidence 
        WHERE entity_id = ? 
        ORDER BY timestamp DESC
      `,
        [entityId]
      );

      return (rows || []).map((row: any) => ({
        id: row.id,
        targetEntityId: row.entity_id,
        evaluatorId: this.runtime?.agentId || ('system' as UUID),
        type: row.type,
        impact: row.impact,
        weight: row.weight,
        description: row.description,
        timestamp: row.timestamp,
        verified: Boolean(row.verified),
        reportedBy: row.reported_by,
        context: JSON.parse(row.context || '{}'),
        metadata: JSON.parse(row.metadata || '{}'),
      }));
    } catch (error) {
      logger.error('Failed to get trust evidence:', error);
      throw error;
    }
  }

  async saveTrustComment(comment: {
    entityId: UUID;
    evaluatorId: UUID;
    trustScore: number;
    trustChange: number;
    comment: string;
    metadata?: any;
  }): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const now = Date.now();
      await this.executeSQL(
        `
        INSERT INTO trust_comments (
          id, entity_id, evaluator_id, trust_score, trust_change, comment, timestamp, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          comment.entityId,
          comment.evaluatorId,
          comment.trustScore,
          comment.trustChange,
          comment.comment,
          now,
          JSON.stringify(comment.metadata || {}),
        ]
      );
    } catch (error) {
      logger.error('Failed to save trust comment:', error);
      throw error;
    }
  }

  async getLatestTrustComment(
    entityId: UUID,
    evaluatorId: UUID
  ): Promise<{
    id: string;
    entityId: UUID;
    evaluatorId: UUID;
    trustScore: number;
    trustChange: number;
    comment: string;
    timestamp: number;
    metadata: any;
  } | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const rows = await this.executeSQL(
        `
        SELECT * FROM trust_comments 
        WHERE entity_id = ? AND evaluator_id = ?
        ORDER BY timestamp DESC
      `,
        [entityId, evaluatorId]
      );

      if (!rows || rows.length === 0) {
        return null;
      }

      const row = rows[0];
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        entityId: row.entity_id,
        evaluatorId: row.evaluator_id,
        trustScore: row.trust_score,
        trustChange: row.trust_change,
        comment: row.comment,
        timestamp: row.timestamp,
        metadata: JSON.parse(row.metadata || '{}'),
      };
    } catch (error) {
      logger.error('Failed to get latest trust comment:', error);
      throw error;
    }
  }

  async getTrustCommentHistory(
    entityId: UUID,
    evaluatorId: UUID,
    limit?: number
  ): Promise<
    Array<{
      id: string;
      entityId: UUID;
      evaluatorId: UUID;
      trustScore: number;
      trustChange: number;
      comment: string;
      timestamp: number;
      metadata: any;
    }>
  > {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const sql = limit
        ? 'SELECT * FROM trust_comments WHERE entity_id = ? AND evaluator_id = ? ORDER BY timestamp DESC LIMIT ?'
        : 'SELECT * FROM trust_comments WHERE entity_id = ? AND evaluator_id = ? ORDER BY timestamp DESC';
      const params = limit ? [entityId, evaluatorId, limit] : [entityId, evaluatorId];
      const rows = await this.executeSQL(sql, params);

      return (rows || []).map((row: any) => ({
        id: row.id,
        entityId: row.entity_id,
        evaluatorId: row.evaluator_id,
        trustScore: row.trust_score,
        trustChange: row.trust_change,
        comment: row.comment,
        timestamp: row.timestamp,
        metadata: JSON.parse(row.metadata || '{}'),
      }));
    } catch (error) {
      logger.error('Failed to get trust comment history:', error);
      throw error;
    }
  }

  async savePermissionDelegation(delegation: PermissionDelegation): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const id =
        delegation.id || `delegation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await this.executeSQL(
        `
          INSERT OR REPLACE INTO permission_delegations (
            id, delegator_id, delegatee_id, permission, resource,
            granted_at, expires_at, active, conditions
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          delegation.delegatorId,
          delegation.delegateeId,
          JSON.stringify(delegation.permissions),
          JSON.stringify(delegation.context),
          delegation.createdAt,
          delegation.expiresAt || null,
          !delegation.revoked ? 1 : 0,
          JSON.stringify(delegation.conditions || []),
        ]
      );
    } catch (error) {
      logger.error('Failed to save permission delegation:', error);
      throw error;
    }
  }

  async getPermissionDelegations(delegatorId: UUID): Promise<PermissionDelegation[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const rows = await this.executeSQL(
        `
        SELECT * FROM permission_delegations 
        WHERE delegator_id = ? AND active = 1
        AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY granted_at DESC
      `,
        [delegatorId, Date.now()]
      );

      return (rows || []).map((row: any) => ({
        id: row.id,
        delegatorId: row.delegator_id,
        delegateeId: row.delegatee_id,
        permissions: JSON.parse(row.permission),
        context: JSON.parse(row.resource || '{}'),
        createdAt: row.granted_at,
        expiresAt: row.expires_at,
        revoked: !row.active,
        conditions: JSON.parse(row.conditions || '[]'),
      }));
    } catch (error) {
      logger.error('Failed to get permission delegations:', error);
      throw error;
    }
  }

  private isPostgreSQL(db: any): boolean {
    // Check for common PostgreSQL indicators
    if (db.constructor?.name?.toLowerCase().includes('pg')) return true;
    if (db.adapter?.name?.toLowerCase().includes('pg')) return true;
    if (db.dialect === 'postgresql' || db.dialect === 'postgres') return true;
    if (typeof db.executeSQL === 'function' && db.executeSQL.toString().includes('RETURNING'))
      return true;

    // Check if it's PGLite
    if (db.constructor?.name === 'PGlite') return true;

    return false;
  }
}
