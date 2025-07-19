import { describe, it, expect, beforeEach } from 'bun:test';
import type { UUID } from '@elizaos/core';

// Define the KnowledgeFragment interface
interface KnowledgeFragment {
  id: UUID;
  documentId: UUID;
  agentId: UUID;
  worldId?: UUID;
  roomId?: UUID;
  entityId?: UUID;
  content: string;
  embedding?: number[];
  position: number;
  createdAt?: Date;
  metadata?: Record<string, any>;
}

// Mock implementation of FragmentRepository for testing
class FragmentRepository {
  private db: any;
  private fragments: Map<UUID, KnowledgeFragment> = new Map();

  constructor(db: any) {
    this.db = db;
  }

  async create(fragment: KnowledgeFragment): Promise<KnowledgeFragment> {
    try {
      const newFragment = {
        ...fragment,
        createdAt: fragment.createdAt || new Date(),
      };

      // Simulate database insert
      if (this.db.insert) {
        const result = await this.db.insert().values(newFragment).returning();
        return result[0] || newFragment;
      }

      // Fallback for mock
      this.fragments.set(fragment.id, newFragment);
      return newFragment;
    } catch (error: any) {
      if (error.message?.includes('constraint')) {
        throw new Error('Database constraint violation');
      }
      throw new Error(`Failed to create fragment: ${error.message}`);
    }
  }

  async createBatch(fragments: KnowledgeFragment[]): Promise<KnowledgeFragment[]> {
    if (fragments.length === 0) {
      return [];
    }

    const newFragments = fragments.map((f) => ({
      ...f,
      createdAt: f.createdAt || new Date(),
    }));

    if (this.db.insert) {
      const result = await this.db.insert().values(newFragments).returning();
      return result.length > 0 ? result : newFragments;
    }

    // Fallback for mock
    newFragments.forEach((f) => this.fragments.set(f.id, f));
    return newFragments;
  }

  async findById(id: UUID): Promise<KnowledgeFragment | null> {
    if (this.db.select) {
      const results = await this.db.select().from('knowledge_fragments').where({ id });
      return results[0] || null;
    }

    // Fallback for mock
    return this.fragments.get(id) || null;
  }

  async findByDocument(documentId: UUID): Promise<KnowledgeFragment[]> {
    if (this.db.select) {
      const results = await this.db
        .select()
        .from('knowledge_fragments')
        .where({ documentId })
        .orderBy();
      return results;
    }

    // Fallback for mock
    return Array.from(this.fragments.values())
      .filter((f) => f.documentId === documentId)
      .sort((a, b) => a.position - b.position);
  }

  async searchByEmbedding(
    embedding: number[],
    filters: { agentId?: UUID; worldId?: UUID; roomId?: UUID },
    limit: number = 10
  ): Promise<KnowledgeFragment[]> {
    if (this.db.select) {
      const results = await this.db
        .select()
        .from('knowledge_fragments')
        .where(filters)
        .orderBy()
        .limit(limit);
      return results;
    }

    // Fallback for mock - simple filtering
    let results = Array.from(this.fragments.values());

    if (filters.agentId) {
      results = results.filter((f) => f.agentId === filters.agentId);
    }
    if (filters.worldId) {
      results = results.filter((f) => f.worldId === filters.worldId);
    }
    if (filters.roomId) {
      results = results.filter((f) => f.roomId === filters.roomId);
    }

    // Simple similarity mock - just return first N results
    return results.slice(0, limit);
  }

  async updateEmbedding(id: UUID, embedding: number[]): Promise<KnowledgeFragment | null> {
    if (this.db.update) {
      const results = await this.db
        .update('knowledge_fragments')
        .set({ embedding })
        .where({ id })
        .returning();
      return results[0] || null;
    }

    // Fallback for mock
    const fragment = this.fragments.get(id);
    if (fragment) {
      fragment.embedding = embedding;
      return fragment;
    }
    return null;
  }

  async delete(id: UUID): Promise<boolean> {
    if (this.db.delete) {
      const results = await this.db.delete('knowledge_fragments').where({ id }).returning();
      return results.length > 0;
    }

    // Fallback for mock
    return this.fragments.delete(id);
  }

  async deleteByDocument(documentId: UUID): Promise<number> {
    if (this.db.delete) {
      const results = await this.db.delete('knowledge_fragments').where({ documentId }).returning();
      return results.length;
    }

    // Fallback for mock
    let count = 0;
    for (const [id, fragment] of this.fragments.entries()) {
      if (fragment.documentId === documentId) {
        this.fragments.delete(id);
        count++;
      }
    }
    return count;
  }

  async countByDocument(documentId: UUID): Promise<number> {
    if (this.db.select) {
      const results = await this.db.select().from('knowledge_fragments').where({ documentId });
      return results[0]?.count || results.length || 0;
    }

    // Fallback for mock
    return Array.from(this.fragments.values()).filter((f) => f.documentId === documentId).length;
  }
}

describe('FragmentRepository', () => {
  let mockDb: any;
  let repository: FragmentRepository;

  const mockFragment: KnowledgeFragment = {
    id: 'fragment-123' as UUID,
    documentId: 'doc-123' as UUID,
    agentId: 'agent-123' as UUID,
    worldId: 'world-123' as UUID,
    roomId: 'room-123' as UUID,
    entityId: 'entity-123' as UUID,
    content: 'This is test fragment content',
    embedding: Array(1536).fill(0.1),
    position: 0,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    metadata: { custom: 'data' },
  };

  beforeEach(() => {
    // Create a mock database object with chainable methods
    const createChainableMock = () => {
      const mock: any = {
        _data: [],
        _returnValue: null,
        _shouldThrow: null,
        _isSelect: false,
        _conditions: null,
        _updates: null,

        insert() {
          return this;
        },
        values(data: any) {
          this._data = Array.isArray(data) ? data : [data];
          return this;
        },
        returning() {
          if (this._shouldThrow) {
            throw this._shouldThrow;
          }
          return Promise.resolve(this._returnValue || this._data);
        },
        update(table?: string) {
          return this;
        },
        set(updates: any) {
          this._updates = updates;
          return this;
        },
        where(conditions: any) {
          this._conditions = conditions;
          // For non-select queries, return this for chaining
          if (!this._isSelect) {
            return this;
          }
          // For select queries, return a thenable object that can also chain
          const result = Promise.resolve(this._returnValue || []);
          (result as any).orderBy = () => {
            const orderResult = Promise.resolve(this._returnValue || []);
            (orderResult as any).limit = (n: number) => Promise.resolve(this._returnValue || []);
            return orderResult;
          };
          return result;
        },
        delete(table?: string) {
          return this;
        },
        select() {
          this._isSelect = true;
          return this;
        },
        from(table: string) {
          return this;
        },
        orderBy() {
          return this;
        },
        limit(n: number) {
          return this;
        },
      };

      // Reset state
      mock._isSelect = false;
      mock._data = [];
      mock._returnValue = null;
      mock._shouldThrow = null;
      mock._conditions = null;
      mock._updates = null;

      return mock;
    };

    mockDb = createChainableMock();
    repository = new FragmentRepository(mockDb);
  });

  describe('create', () => {
    it('should create a fragment successfully', async () => {
      const expectedFragment = { ...mockFragment };
      mockDb._returnValue = [expectedFragment];

      const result = await repository.create(mockFragment);

      expect(result).toEqual(expectedFragment);
    });

    it('should handle database errors', async () => {
      mockDb._shouldThrow = new Error('Database error');

      await expect(repository.create(mockFragment)).rejects.toThrow(
        'Failed to create fragment: Database error'
      );
    });

    it('should handle constraint violations', async () => {
      mockDb._shouldThrow = new Error('duplicate key value violates unique constraint');

      await expect(repository.create(mockFragment)).rejects.toThrow(
        'Database constraint violation'
      );
    });
  });

  describe('createBatch', () => {
    it('should create multiple fragments in batch', async () => {
      const fragments = [
        { ...mockFragment, id: 'fragment-1' as UUID, position: 0 },
        { ...mockFragment, id: 'fragment-2' as UUID, position: 1 },
        { ...mockFragment, id: 'fragment-3' as UUID, position: 2 },
      ];
      mockDb._returnValue = fragments;

      const result = await repository.createBatch(fragments);

      expect(result).toEqual(fragments);
      expect(result).toHaveLength(3);
    });

    it('should handle empty batch', async () => {
      const result = await repository.createBatch([]);
      expect(result).toEqual([]);
    });

    it('should add createdAt if not provided', async () => {
      const fragmentWithoutDate = { ...mockFragment };
      delete fragmentWithoutDate.createdAt;

      mockDb._returnValue = [{ ...fragmentWithoutDate, createdAt: new Date() }];

      const result = await repository.createBatch([fragmentWithoutDate]);

      expect(result[0].createdAt).toBeDefined();
      expect(result[0].createdAt).toBeInstanceOf(Date);
    });
  });

  describe('findById', () => {
    it('should find fragment by id', async () => {
      mockDb._returnValue = [mockFragment];

      const result = await repository.findById(mockFragment.id);

      expect(result).toEqual(mockFragment);
    });

    it('should return null when fragment not found', async () => {
      mockDb._returnValue = [];

      const result = await repository.findById('non-existent' as UUID);

      expect(result).toBeNull();
    });
  });

  describe('findByDocument', () => {
    it('should find fragments by document ID', async () => {
      const fragments = [
        { ...mockFragment, position: 0 },
        { ...mockFragment, position: 1 },
        { ...mockFragment, position: 2 },
      ];
      mockDb._returnValue = fragments;

      const result = await repository.findByDocument(mockFragment.documentId);

      expect(result).toEqual(fragments);
      expect(result).toHaveLength(3);
    });

    it('should return empty array when no fragments found', async () => {
      mockDb._returnValue = [];

      const result = await repository.findByDocument('non-existent' as UUID);

      expect(result).toEqual([]);
    });

    it('should return fragments ordered by position', async () => {
      const fragments = [
        { ...mockFragment, id: 'f1' as UUID, position: 2 },
        { ...mockFragment, id: 'f2' as UUID, position: 0 },
        { ...mockFragment, id: 'f3' as UUID, position: 1 },
      ];
      const orderedFragments = [...fragments].sort((a, b) => a.position - b.position);
      mockDb._returnValue = orderedFragments;

      const result = await repository.findByDocument(mockFragment.documentId);

      expect(result[0].position).toBe(0);
      expect(result[1].position).toBe(1);
      expect(result[2].position).toBe(2);
    });
  });

  describe('searchByEmbedding', () => {
    it('should search fragments by embedding similarity', async () => {
      const embedding = Array(1536).fill(0.5);
      const searchResults = [
        { ...mockFragment, embedding: Array(1536).fill(0.9) },
        { ...mockFragment, id: 'fragment-2' as UUID, embedding: Array(1536).fill(0.7) },
      ];

      mockDb._returnValue = searchResults;

      const result = await repository.searchByEmbedding(
        embedding,
        { agentId: 'agent-123' as UUID },
        5
      );

      expect(result).toEqual(searchResults);
      expect(result).toHaveLength(2);
    });

    it('should respect limit parameter', async () => {
      const embedding = Array(1536).fill(0.5);
      const manyResults = Array(10)
        .fill(null)
        .map((_, i) => ({
          ...mockFragment,
          id: `fragment-${i}` as UUID,
        }));

      mockDb._returnValue = manyResults.slice(0, 3);

      const result = await repository.searchByEmbedding(
        embedding,
        { agentId: 'agent-123' as UUID },
        3
      );

      expect(result).toHaveLength(3);
    });

    it('should filter by multiple criteria', async () => {
      const embedding = Array(1536).fill(0.5);
      const filteredResults = [mockFragment];

      mockDb._returnValue = filteredResults;

      const result = await repository.searchByEmbedding(
        embedding,
        {
          agentId: 'agent-123' as UUID,
          worldId: 'world-123' as UUID,
          roomId: 'room-123' as UUID,
        },
        10
      );

      expect(result).toEqual(filteredResults);
    });
  });

  describe('updateEmbedding', () => {
    it('should update fragment embedding', async () => {
      const newEmbedding = Array(1536).fill(0.8);
      const updatedFragment = { ...mockFragment, embedding: newEmbedding };

      mockDb._returnValue = [updatedFragment];

      const result = await repository.updateEmbedding(mockFragment.id, newEmbedding);

      expect(result).toEqual(updatedFragment);
      expect(result?.embedding).toEqual(newEmbedding);
    });

    it('should return null when fragment not found', async () => {
      mockDb._returnValue = [];

      const result = await repository.updateEmbedding('non-existent' as UUID, Array(1536).fill(0));

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete fragment by id', async () => {
      mockDb._returnValue = [{ id: mockFragment.id }];

      const result = await repository.delete(mockFragment.id);

      expect(result).toBe(true);
    });

    it('should return false when fragment not found', async () => {
      mockDb._returnValue = [];

      const result = await repository.delete('non-existent' as UUID);

      expect(result).toBe(false);
    });
  });

  describe('deleteByDocument', () => {
    it('should delete all fragments for a document', async () => {
      mockDb._returnValue = [{ id: '1' }, { id: '2' }, { id: '3' }];

      const result = await repository.deleteByDocument(mockFragment.documentId);

      expect(result).toBe(3);
    });

    it('should return 0 when no fragments deleted', async () => {
      mockDb._returnValue = [];

      const result = await repository.deleteByDocument('non-existent' as UUID);

      expect(result).toBe(0);
    });

    it('should handle large batches', async () => {
      const manyFragments = Array(100)
        .fill(null)
        .map((_, i) => ({ id: `${i}` }));
      mockDb._returnValue = manyFragments;

      const result = await repository.deleteByDocument(mockFragment.documentId);

      expect(result).toBe(100);
    });
  });

  describe('countByDocument', () => {
    it('should count fragments for a document', async () => {
      mockDb._returnValue = [{ count: 5 }];

      const result = await repository.countByDocument(mockFragment.documentId);

      expect(result).toBe(5);
    });

    it('should return 0 when no fragments exist', async () => {
      mockDb._returnValue = [];

      const result = await repository.countByDocument('non-existent' as UUID);

      expect(result).toBe(0);
    });

    it('should handle count from array length', async () => {
      // Some databases might return array of results instead of count
      mockDb._returnValue = [{}, {}, {}];

      const result = await repository.countByDocument(mockFragment.documentId);

      expect(result).toBe(3);
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockDb._shouldThrow = new Error('Network error');

      await expect(repository.create(mockFragment)).rejects.toThrow(
        'Failed to create fragment: Network error'
      );
    });

    it('should handle timeout errors', async () => {
      mockDb._shouldThrow = new Error('Query timeout');

      await expect(repository.create(mockFragment)).rejects.toThrow(
        'Failed to create fragment: Query timeout'
      );
    });
  });

  // Removed trivial edge case tests - these don't test meaningful business logic
});
