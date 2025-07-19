import {
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  boolean,
  jsonb,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Core entity storage table converted from raw SQL to Drizzle ORM
 */
export const entities = pgTable(
  'entities',
  {
    id: uuid('id').primaryKey(),
    agentId: uuid('agent_id').notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    names: text('names').array().notNull(),
    summary: text('summary'),
    trustScore: decimal('trust_score', { precision: 3, scale: 2 }).default('0.50').notNull(),
    tags: text('tags').array(),
    metadata: jsonb('metadata').default('{}'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    agentIdx: index('idx_entities_agent').on(table.agentId),
    typeIdx: index('idx_entities_type').on(table.type),
    trustIdx: index('idx_entities_trust').on(table.trustScore),
    // Note: GIN indexes for arrays not supported in drizzle-orm, but PostgreSQL will use them
  })
);

/**
 * Platform identities table
 */
export const entityPlatforms = pgTable(
  'entity_platforms',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 50 }).notNull(),
    handle: varchar('handle', { length: 255 }).notNull(),
    verified: boolean('verified').default(false),
    metadata: jsonb('metadata').default('{}'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    entityIdx: index('idx_platforms_entity').on(table.entityId),
    platformIdx: index('idx_platforms_platform').on(table.platform),
    uniqueConstraint: unique('entity_platform_handle_unique').on(
      table.entityId,
      table.platform,
      table.handle
    ),
  })
);

/**
 * Relationships with bidirectional support
 */
export const relationships = pgTable(
  'relationships',
  {
    id: uuid('id').primaryKey(),
    sourceEntityId: uuid('source_entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    targetEntityId: uuid('target_entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(),
    strength: decimal('strength', { precision: 3, scale: 2 }).default('0.50').notNull(),
    sentiment: decimal('sentiment', { precision: 3, scale: 2 }).default('0.00').notNull(),
    trustImpact: decimal('trust_impact', { precision: 3, scale: 2 }).default('0.00'),
    metadata: jsonb('metadata').default('{}'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: index('idx_relationships_source').on(table.sourceEntityId),
    targetIdx: index('idx_relationships_target').on(table.targetEntityId),
    strengthIdx: index('idx_relationships_strength').on(table.strength),
    typeIdx: index('idx_relationships_type').on(table.type),
    uniqueConstraint: unique('relationships_unique').on(table.sourceEntityId, table.targetEntityId),
  })
);

/**
 * Interaction history for relationship analysis
 */
export const interactions = pgTable(
  'interactions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sourceEntityId: uuid('source_entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    targetEntityId: uuid('target_entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    roomId: uuid('room_id').notNull(),
    messageId: uuid('message_id'),
    type: varchar('type', { length: 50 }).notNull(),
    content: text('content'),
    sentiment: decimal('sentiment', { precision: 3, scale: 2 }),
    metadata: jsonb('metadata').default('{}'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    entitiesIdx: index('idx_interactions_entities').on(table.sourceEntityId, table.targetEntityId),
    timeIdx: index('idx_interactions_time').on(table.createdAt),
    roomIdx: index('idx_interactions_room').on(table.roomId),
  })
);

/**
 * Follow-up tasks
 */
export const followUps = pgTable(
  'follow_ups',
  {
    id: uuid('id').primaryKey(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').notNull(),
    message: text('message').notNull(),
    scheduledFor: timestamp('scheduled_for').notNull(),
    completed: boolean('completed').default(false),
    completedAt: timestamp('completed_at'),
    priority: varchar('priority', { length: 20 }).default('medium'),
    metadata: jsonb('metadata').default('{}'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    entityIdx: index('idx_followups_entity').on(table.entityId),
    scheduledIdx: index('idx_followups_scheduled').on(table.scheduledFor),
    completedIdx: index('idx_followups_completed').on(table.completed),
    agentIdx: index('idx_followups_agent').on(table.agentId),
  })
);

/**
 * Trust events for audit trail
 */
export const trustEvents = pgTable(
  'trust_events',
  {
    id: uuid('id').primaryKey(),
    entityId: uuid('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    impact: decimal('impact', { precision: 3, scale: 2 }).notNull(),
    reason: text('reason'),
    metadata: jsonb('metadata').default('{}'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    entityIdx: index('idx_trust_entity').on(table.entityId),
    timeIdx: index('idx_trust_time').on(table.createdAt),
    typeIdx: index('idx_trust_type').on(table.eventType),
  })
);

// TypeScript types for use in application
export type DbEntity = typeof entities.$inferSelect;
export type NewDbEntity = typeof entities.$inferInsert;

export type DbEntityPlatform = typeof entityPlatforms.$inferSelect;
export type NewDbEntityPlatform = typeof entityPlatforms.$inferInsert;

export type DbRelationship = typeof relationships.$inferSelect;
export type NewDbRelationship = typeof relationships.$inferInsert;

export type DbInteraction = typeof interactions.$inferSelect;
export type NewDbInteraction = typeof interactions.$inferInsert;

export type DbFollowUp = typeof followUps.$inferSelect;
export type NewDbFollowUp = typeof followUps.$inferInsert;

export type DbTrustEvent = typeof trustEvents.$inferSelect;
export type NewDbTrustEvent = typeof trustEvents.$inferInsert;

// Export schema object for plugin registration
export const rolodexSchema = {
  entities,
  entityPlatforms,
  relationships,
  interactions,
  followUps,
  trustEvents,
};

// Also export individual tables for backward compatibility
export {
  entities as rolodexEntities,
  entityPlatforms as rolodexEntityPlatforms,
  relationships as rolodexRelationships,
  interactions as rolodexInteractions,
  followUps as rolodexFollowUps,
  trustEvents as rolodexTrustEvents,
};
