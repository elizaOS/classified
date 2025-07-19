import { and, eq, sql, cosineDistance, desc } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { UUID } from '@elizaos/core';
import { knowledgeFragmentsTable } from '../schema.ts';
import { KnowledgeFragment } from '../types.ts';

export interface SearchOptions {
  agentId?: UUID;
  roomId?: UUID;
  worldId?: UUID;
  entityId?: UUID;
  limit?: number;
  threshold?: number;
}

export interface SearchResult extends KnowledgeFragment {
  similarity: number;
}

export class FragmentRepository {
  constructor(private db: PostgresJsDatabase<any>) {}

  /**
   * Create a new fragment
   */
  async create(fragment: Omit<KnowledgeFragment, 'id' | 'createdAt'>): Promise<KnowledgeFragment> {
    const [created] = await this.db
      .insert(knowledgeFragmentsTable)
      .values({
        ...fragment,
        createdAt: new Date(),
      })
      .returning();

    return this.mapToFragment(created);
  }

  /**
   * Create multiple fragments in a batch
   */
  async createBatch(
    fragments: Omit<KnowledgeFragment, 'id' | 'createdAt'>[]
  ): Promise<KnowledgeFragment[]> {
    const created = await this.db
      .insert(knowledgeFragmentsTable)
      .values(
        fragments.map((f) => ({
          ...f,
          createdAt: new Date(),
        }))
      )
      .returning();

    return created.map(this.mapToFragment);
  }

  /**
   * Find a fragment by ID
   */
  async findById(id: UUID): Promise<KnowledgeFragment | null> {
    const result = await this.db
      .select()
      .from(knowledgeFragmentsTable)
      .where(eq(knowledgeFragmentsTable.id, id))
      .limit(1);

    return result.length > 0 ? this.mapToFragment(result[0]) : null;
  }

  /**
   * Find all fragments for a document
   */
  async findByDocument(documentId: UUID): Promise<KnowledgeFragment[]> {
    const results = await this.db
      .select()
      .from(knowledgeFragmentsTable)
      .where(eq(knowledgeFragmentsTable.documentId, documentId))
      .orderBy(knowledgeFragmentsTable.position);

    return results.map(this.mapToFragment);
  }

  /**
   * Search fragments by embedding similarity
   */
  async searchByEmbedding(
    embedding: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { agentId, roomId, worldId, entityId, limit = 20, threshold = 0.7 } = options;

    // Build WHERE conditions
    const conditions = [];
    if (agentId) {
      conditions.push(eq(knowledgeFragmentsTable.agentId, agentId));
    }
    if (roomId) {
      conditions.push(eq(knowledgeFragmentsTable.roomId, roomId));
    }
    if (worldId) {
      conditions.push(eq(knowledgeFragmentsTable.worldId, worldId));
    }
    if (entityId) {
      conditions.push(eq(knowledgeFragmentsTable.entityId, entityId));
    }

    // Add similarity threshold condition
    conditions.push(
      sql`1 - (${cosineDistance(knowledgeFragmentsTable.embedding, embedding)}) > ${threshold}`
    );

    // Execute query
    const results = await this.db
      .select()
      .from(knowledgeFragmentsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(sql`1 - (${cosineDistance(knowledgeFragmentsTable.embedding, embedding)})`))
      .limit(limit);

    // Map results with similarity calculation
    return results.map((row) => {
      // Calculate similarity manually if needed
      const similarity = row.embedding
        ? this.calculateCosineSimilarity(row.embedding, embedding)
        : 0;
      return {
        ...this.mapToFragment(row),
        similarity,
      };
    });
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private calculateCosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Update fragment embedding
   */
  async updateEmbedding(id: UUID, embedding: number[]): Promise<KnowledgeFragment | null> {
    const [updated] = await this.db
      .update(knowledgeFragmentsTable)
      .set({ embedding })
      .where(eq(knowledgeFragmentsTable.id, id))
      .returning();

    return updated ? this.mapToFragment(updated) : null;
  }

  /**
   * Delete a fragment
   */
  async delete(id: UUID): Promise<boolean> {
    const result = await this.db
      .delete(knowledgeFragmentsTable)
      .where(eq(knowledgeFragmentsTable.id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Delete all fragments for a document
   */
  async deleteByDocument(documentId: UUID): Promise<number> {
    const result = await this.db
      .delete(knowledgeFragmentsTable)
      .where(eq(knowledgeFragmentsTable.documentId, documentId))
      .returning();

    return result.length;
  }

  /**
   * Count fragments for a document
   */
  async countByDocument(documentId: UUID): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(knowledgeFragmentsTable)
      .where(eq(knowledgeFragmentsTable.documentId, documentId));

    return result[0]?.count || 0;
  }

  /**
   * Map database row to KnowledgeFragment type
   */
  private mapToFragment(row: any): KnowledgeFragment {
    return {
      id: row.id as UUID,
      documentId: row.documentId || row.document_id,
      agentId: row.agentId || row.agent_id,
      worldId: row.worldId || row.world_id,
      roomId: row.roomId || row.room_id,
      entityId: row.entityId || row.entity_id,
      content: row.content,
      embedding: row.embedding,
      position: row.position,
      createdAt: row.createdAt || row.created_at,
      metadata: row.metadata || {},
    };
  }
}
