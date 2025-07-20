import { Database } from 'bun:sqlite';
import { logger, stringToUuid } from '@elizaos/core';
import { asUUID, type UUID, type IAgentRuntime } from '@elizaos/core';
import type { EntityProfile, FollowUp, TrustEvent } from '../types';
import type { Task, Relationship } from '@elizaos/core';
import { DatabaseAdapter } from './adapter';

export class SQLiteAdapter extends DatabaseAdapter {
  private db: Database;
  private dbPath: string;

  constructor(runtime: IAgentRuntime, dbPath?: string) {
    super(runtime);
    this.dbPath = dbPath || ':memory:';
    this.db = new Database(this.dbPath);
    this.initializeSchema();
  }

  private initializeSchema() {
    // Enable foreign keys
    this.db.exec('PRAGMA foreign_keys = ON');

    // Create entities table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        entity_id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        type TEXT NOT NULL,
        names TEXT NOT NULL, -- JSON array
        summary TEXT,
        tags TEXT, -- JSON array
        platforms TEXT, -- JSON object
        metadata TEXT, -- JSON object
        trust_score REAL DEFAULT 0.5,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // Create relationships table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relationships (
        id TEXT PRIMARY KEY,
        source_entity_id TEXT NOT NULL,
        target_entity_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        type TEXT NOT NULL,
        tags TEXT, -- JSON array
        metadata TEXT, -- JSON object
        FOREIGN KEY (source_entity_id) REFERENCES entities(entity_id),
        FOREIGN KEY (target_entity_id) REFERENCES entities(entity_id)
      )
    `);

    // Create follow_ups table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS follow_ups (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        message TEXT NOT NULL,
        scheduled_for TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        metadata TEXT, -- JSON object
        created_at TEXT NOT NULL,
        FOREIGN KEY (entity_id) REFERENCES entities(entity_id)
      )
    `);

    // Create trust_events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trust_events (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        impact REAL NOT NULL,
        reason TEXT,
        metadata TEXT, -- JSON object
        created_at TEXT NOT NULL,
        FOREIGN KEY (entity_id) REFERENCES entities(entity_id)
      )
    `);

    // Create tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        entity_id TEXT,
        room_id TEXT,
        world_id TEXT,
        tags TEXT, -- JSON array
        metadata TEXT, -- JSON object
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (entity_id) REFERENCES entities(entity_id)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_entities_agent ON entities(agent_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_entity_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_entity_id);
      CREATE INDEX IF NOT EXISTS idx_follow_ups_entity ON follow_ups(entity_id);
      CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON follow_ups(scheduled_for);
      CREATE INDEX IF NOT EXISTS idx_trust_events_entity ON trust_events(entity_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_entity ON tasks(entity_id);
    `);

    logger.info('[SQLiteAdapter] Database schema initialized');
  }

  // Entity operations
  async createEntity(profile: EntityProfile): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO entities (
        entity_id, agent_id, type, names, summary, tags, 
        platforms, metadata, trust_score, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      profile.entityId,
      profile.agentId,
      profile.type,
      JSON.stringify(profile.names),
      profile.summary,
      JSON.stringify(profile.tags),
      JSON.stringify(profile.platforms),
      JSON.stringify(profile.metadata),
      profile.trustScore || 0.5,
      profile.createdAt,
      profile.updatedAt
    );
  }

  async getEntity(entityId: UUID): Promise<EntityProfile | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM entities WHERE entity_id = ?
    `);

    const row = stmt.get(entityId) as any;
    if (!row) {
      return null;
    }

    return {
      entityId: asUUID(row.entity_id),
      agentId: asUUID(row.agent_id),
      type: row.type,
      names: JSON.parse(row.names),
      summary: row.summary,
      tags: JSON.parse(row.tags),
      platforms: JSON.parse(row.platforms),
      metadata: JSON.parse(row.metadata),
      trustScore: row.trust_score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async updateEntity(profile: EntityProfile): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE entities SET
        type = ?, names = ?, summary = ?, tags = ?,
        platforms = ?, metadata = ?, trust_score = ?, updated_at = ?
      WHERE entity_id = ?
    `);

    stmt.run(
      profile.type,
      JSON.stringify(profile.names),
      profile.summary,
      JSON.stringify(profile.tags),
      JSON.stringify(profile.platforms),
      JSON.stringify(profile.metadata),
      profile.trustScore || 0.5,
      profile.updatedAt,
      profile.entityId
    );
  }

  async searchEntities(criteria: {
    type?: string;
    minTrust?: number;
    limit?: number;
    offset?: number;
  }): Promise<EntityProfile[]> {
    let query = 'SELECT * FROM entities WHERE 1=1';
    const params: any[] = [];

    if (criteria.type) {
      query += ' AND type = ?';
      params.push(criteria.type);
    }

    if (criteria.minTrust !== undefined) {
      query += ' AND trust_score >= ?';
      params.push(criteria.minTrust);
    }

    query += ' ORDER BY updated_at DESC';

    if (criteria.limit) {
      query += ' LIMIT ?';
      params.push(criteria.limit);
    }

    if (criteria.offset) {
      query += ' OFFSET ?';
      params.push(criteria.offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map((row) => ({
      entityId: asUUID(row.entity_id),
      agentId: asUUID(row.agent_id),
      type: row.type,
      names: JSON.parse(row.names),
      summary: row.summary,
      tags: JSON.parse(row.tags),
      platforms: JSON.parse(row.platforms),
      metadata: JSON.parse(row.metadata),
      trustScore: row.trust_score,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  // Relationship operations
  async createRelationship(relationship: Relationship): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO relationships (
        id, source_entity_id, target_entity_id, agent_id,
        type, tags, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      relationship.id,
      relationship.sourceEntityId,
      relationship.targetEntityId,
      relationship.agentId,
      (relationship.metadata as any)?.relationshipType || 'unknown',
      JSON.stringify(relationship.tags || []),
      JSON.stringify(relationship.metadata || {})
    );
  }

  async getRelationship(sourceId: UUID, targetId: UUID): Promise<Relationship | undefined> {
    const stmt = this.db.prepare(`
      SELECT * FROM relationships 
      WHERE source_entity_id = ? AND target_entity_id = ?
    `);

    const row = stmt.get(sourceId, targetId) as any;
    if (!row) {
      return undefined;
    }

    const metadata = JSON.parse(row.metadata || '{}');
    metadata.relationshipType = row.type;
    
    return {
      id: asUUID(row.id),
      sourceEntityId: asUUID(row.source_entity_id),
      targetEntityId: asUUID(row.target_entity_id),
      agentId: asUUID(row.agent_id),
      tags: JSON.parse(row.tags),
      metadata: metadata,
    };
  }

  async updateRelationship(relationship: Relationship): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE relationships SET
        type = ?, tags = ?, metadata = ?
      WHERE id = ?
    `);

    stmt.run(
      (relationship.metadata as any)?.relationshipType || 'unknown',
      JSON.stringify(relationship.tags || []),
      JSON.stringify(relationship.metadata || {}),
      relationship.id
    );
  }

  async getEntityRelationships(
    entityId: UUID,
    options?: { type?: string; minStrength?: number }
  ): Promise<Relationship[]> {
    let query = `
      SELECT * FROM relationships 
      WHERE (source_entity_id = ? OR target_entity_id = ?)
    `;
    const params: any[] = [entityId, entityId];

    if (options?.type) {
      query += ' AND type = ?';
      params.push(options.type);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    const relationships = rows.map((row) => ({
      id: asUUID(row.id),
      sourceEntityId: asUUID(row.source_entity_id),
      targetEntityId: asUUID(row.target_entity_id),
      agentId: asUUID(row.agent_id),
      type: row.type,
      tags: JSON.parse(row.tags),
      metadata: JSON.parse(row.metadata),
    }));

    // Filter by strength if specified
    if (options?.minStrength !== undefined) {
      return relationships.filter((rel) => {
        const strength = rel.metadata?.strength || 0;
        return strength >= options.minStrength!;
      });
    }

    return relationships;
  }

  // Follow-up operations
  async createFollowUp(followUp: FollowUp): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO follow_ups (
        id, entity_id, message, scheduled_for, completed, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      followUp.id,
      followUp.entityId,
      followUp.message || 'Follow-up',
      followUp.scheduledFor,
      followUp.completed ? 1 : 0,
      JSON.stringify(followUp.metadata || {}),
      new Date().toISOString()
    );
  }

  async getFollowUps(criteria: {
    entityId?: UUID;
    completed?: boolean;
    before?: Date;
    limit?: number;
  }): Promise<FollowUp[]> {
    let query = 'SELECT * FROM follow_ups WHERE 1=1';
    const params: any[] = [];

    if (criteria.entityId) {
      query += ' AND entity_id = ?';
      params.push(criteria.entityId);
    }

    if (criteria.completed !== undefined) {
      query += ' AND completed = ?';
      params.push(criteria.completed ? 1 : 0);
    }

    if (criteria.before) {
      query += ' AND scheduled_for <= ?';
      params.push(criteria.before.toISOString());
    }

    query += ' ORDER BY scheduled_for ASC';

    if (criteria.limit) {
      query += ' LIMIT ?';
      params.push(criteria.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map((row) => ({
      id: asUUID(row.id),
      entityId: asUUID(row.entity_id),
      message: row.message,
      reason: row.message, // For compatibility
      scheduledFor: row.scheduled_for,
      completed: row.completed === 1,
      metadata: JSON.parse(row.metadata),
      createdAt: row.created_at,
    }));
  }

  async updateFollowUp(id: UUID, updates: Partial<FollowUp>): Promise<void> {
    const fields: string[] = [];
    const params: any[] = [];

    if (updates.completed !== undefined) {
      fields.push('completed = ?');
      params.push(updates.completed ? 1 : 0);
    }

    if (updates.metadata) {
      fields.push('metadata = ?');
      params.push(JSON.stringify(updates.metadata));
    }

    if (fields.length === 0) {
      return;
    }

    params.push(id);
    const query = `UPDATE follow_ups SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(query);
    stmt.run(...params);
  }

  // Trust event operations
  async createTrustEvent(event: TrustEvent): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO trust_events (
        id, entity_id, event_type, impact, reason, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.id || asUUID(stringToUuid(`trust-${Date.now()}`)),
      event.entityId!,
      event.eventType,
      event.impact,
      event.reason || '',
      JSON.stringify(event.metadata || {}),
      event.createdAt || new Date().toISOString()
    );
  }

  async getTrustEvents(
    entityId: UUID,
    options?: { limit?: number; after?: Date }
  ): Promise<TrustEvent[]> {
    let query = 'SELECT * FROM trust_events WHERE entity_id = ?';
    const params: any[] = [entityId];

    if (options?.after) {
      query += ' AND created_at > ?';
      params.push(options.after.toISOString());
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map((row) => ({
      id: asUUID(row.id),
      entityId: asUUID(row.entity_id),
      eventType: row.event_type,
      impact: row.impact,
      reason: row.reason,
      details: row.reason, // For compatibility
      timestamp: row.created_at,
      metadata: JSON.parse(row.metadata),
      createdAt: row.created_at,
    }));
  }

  // Task operations
  async createTask(task: Task): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, name, description, entity_id, room_id, world_id,
        tags, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      task.id || asUUID(stringToUuid(`task-${Date.now()}`)),
      task.name,
      task.description,
      task.entityId || null,
      task.roomId || null,
      task.worldId || null,
      JSON.stringify(task.tags || []),
      JSON.stringify(task.metadata || {}),
      new Date().toISOString(),
      task.updatedAt || new Date().toISOString()
    );
  }

  // Cleanup
  close() {
    this.db.close();
  }
}
