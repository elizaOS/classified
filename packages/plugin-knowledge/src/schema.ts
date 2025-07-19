import { relations, sql as _sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  vector,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Documents table - stores the main document metadata and content
 */
export const documentsTable = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentId: uuid('agent_id').notNull(),
    worldId: uuid('world_id').notNull(),
    roomId: uuid('room_id').notNull(),
    entityId: uuid('entity_id').notNull(),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    contentType: varchar('content_type', { length: 100 }).notNull(),
    content: text('content').notNull(), // Base64 for PDFs, plain text for others
    fileSize: integer('file_size').notNull(),
    title: varchar('title', { length: 255 }),
    sourceUrl: varchar('source_url', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
  },
  (table) => [
    index('idx_documents_agent').on(table.agentId),
    index('idx_documents_world').on(table.worldId),
    index('idx_documents_room').on(table.roomId),
    index('idx_documents_entity').on(table.entityId),
    index('idx_documents_created_at').on(table.createdAt),
  ]
);

/**
 * Knowledge fragments table - stores chunked document content with embeddings
 */
export const knowledgeFragmentsTable = pgTable(
  'knowledge_fragments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .references(() => documentsTable.id, {
        onDelete: 'cascade',
      })
      .notNull(),
    agentId: uuid('agent_id').notNull(),
    worldId: uuid('world_id').notNull(),
    roomId: uuid('room_id').notNull(),
    entityId: uuid('entity_id').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }), // Adjust based on model
    position: integer('position').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
  },
  (table) => [
    index('idx_fragments_document').on(table.documentId),
    index('idx_fragments_agent').on(table.agentId),
    index('idx_fragments_world').on(table.worldId),
    index('idx_fragments_room').on(table.roomId),
    index('idx_fragments_entity').on(table.entityId),
    index('idx_fragments_position').on(table.documentId, table.position),
    index('idx_fragments_embedding').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ]
);

/**
 * Relations
 */
export const documentsRelations = relations(documentsTable, ({ many }) => ({
  fragments: many(knowledgeFragmentsTable),
}));

export const knowledgeFragmentsRelations = relations(knowledgeFragmentsTable, ({ one }) => ({
  document: one(documentsTable, {
    fields: [knowledgeFragmentsTable.documentId],
    references: [documentsTable.id],
  }),
}));

/**
 * Export the complete schema
 * Note: We export tables and relations separately to avoid circular reference issues
 */
export const knowledgeSchema = {
  tables: {
    documentsTable,
    knowledgeFragmentsTable,
  },
  relations: {
    documentsRelations,
    knowledgeFragmentsRelations,
  },
};

export default knowledgeSchema;
