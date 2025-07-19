import { and, eq } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { UUID } from '@elizaos/core';
import { documentsTable } from '../schema.ts';
import { Document } from '../types.ts';

export class DocumentRepository {
  constructor(private readonly db: PostgresJsDatabase<{ documents: typeof documentsTable }>) {}

  /**
   * Create a new document
   */
  async create(doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<Document> {
    const [created] = await this.db
      .insert(documentsTable)
      .values({
        ...doc,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return this.mapToDocument(created);
  }

  /**
   * Find a document by ID
   */
  async findById(id: UUID): Promise<Document | null> {
    const result = await this.db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.id, id))
      .limit(1);

    return result.length > 0 ? this.mapToDocument(result[0]) : null;
  }

  /**
   * Find all documents for an agent
   */
  async findByAgent(agentId: UUID, limit = 100, offset = 0): Promise<Document[]> {
    const results = await this.db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.agentId, agentId))
      .orderBy(documentsTable.createdAt)
      .limit(limit)
      .offset(offset);

    return results.map(this.mapToDocument);
  }

  /**
   * Find documents by room
   */
  async findByRoom(roomId: UUID, limit = 100, offset = 0): Promise<Document[]> {
    const results = await this.db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.roomId, roomId))
      .orderBy(documentsTable.createdAt)
      .limit(limit)
      .offset(offset);

    return results.map(this.mapToDocument);
  }

  /**
   * Update a document
   */
  async update(
    id: UUID,
    updates: Partial<Omit<Document, 'id' | 'createdAt'>>
  ): Promise<Document | null> {
    const [updated] = await this.db
      .update(documentsTable)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(documentsTable.id, id))
      .returning();

    return updated ? this.mapToDocument(updated) : null;
  }

  /**
   * Delete a document (cascade delete will remove fragments)
   */
  async delete(id: UUID): Promise<boolean> {
    const result = await this.db
      .delete(documentsTable)
      .where(eq(documentsTable.id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Check if a document exists
   */
  async exists(id: UUID): Promise<boolean> {
    const result = await this.db
      .select({ id: documentsTable.id })
      .from(documentsTable)
      .where(eq(documentsTable.id, id))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Find documents by source URL
   */
  async findBySourceUrl(sourceUrl: string, agentId: UUID): Promise<Document | null> {
    const result = await this.db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.sourceUrl, sourceUrl), eq(documentsTable.agentId, agentId)))
      .limit(1);

    return result.length > 0 ? this.mapToDocument(result[0]) : null;
  }

  /**
   * Map database row to Document type
   */
  private mapToDocument(row: any): Document {
    return {
      id: row.id as UUID,
      agentId: row.agentId || row.agent_id,
      worldId: row.worldId || row.world_id,
      roomId: row.roomId || row.room_id,
      entityId: row.entityId || row.entity_id,
      originalFilename: row.originalFilename || row.original_filename,
      contentType: row.contentType || row.content_type,
      content: row.content,
      fileSize: row.fileSize || row.file_size,
      title: row.title,
      sourceUrl: row.sourceUrl || row.source_url,
      createdAt: row.createdAt || row.created_at,
      updatedAt: row.updatedAt || row.updated_at,
      metadata: row.metadata || {},
    };
  }
}
