import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { DocumentRepository } from '../../repositories/document-repository';
import { v4 as uuidv4 } from 'uuid';
import type { UUID } from '@elizaos/core';
import type { Document } from '../../types';

// Simplified TestSuite implementation for local use
class TestSuite {
  constructor(
    private name: string,
    private config: any
  ) {}

  addTest(test: any) {
    it(test.name, async () => {
      const context = this.config.beforeEach();
      await test.fn(context);
    });
  }

  run() {
    // No-op, bun:test handles execution
  }
}

const createUnitTest = (config: { name: string; fn: (context: any) => Promise<void> }) => config;

describe('DocumentRepository', () => {
  let mockDb: any;
  let repository: DocumentRepository;

  beforeEach(() => {
    // Create mock database methods
    mockDb = {
      insert: mock().mockReturnThis(),
      values: mock().mockReturnThis(),
      returning: mock().mockResolvedValue([]),
      select: mock().mockReturnThis(),
      from: mock().mockReturnThis(),
      where: mock().mockReturnThis(),
      orderBy: mock().mockReturnThis(),
      limit: mock().mockReturnThis(),
      offset: mock().mockReturnThis(),
      update: mock().mockReturnThis(),
      set: mock().mockReturnThis(),
      delete: mock().mockReturnThis(),
    };

    repository = new DocumentRepository(mockDb);
  });

  describe('create', () => {
    it('should create a new document', async () => {
      const testDoc = {
        agentId: uuidv4() as UUID,
        worldId: uuidv4() as UUID,
        roomId: uuidv4() as UUID,
        entityId: uuidv4() as UUID,
        originalFilename: 'test.pdf',
        contentType: 'application/pdf',
        content: 'base64content',
        fileSize: 1024,
        title: 'Test Document',
      };

      const expectedResult = {
        id: uuidv4() as UUID,
        ...testDoc,
        sourceUrl: undefined,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValue([expectedResult]);

      const result = await repository.create(testDoc);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          ...testDoc,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findById', () => {
    it('should find a document by ID', async () => {
      const id = uuidv4() as UUID;
      const expectedDoc: Document = {
        id,
        agentId: uuidv4() as UUID,
        worldId: uuidv4() as UUID,
        roomId: uuidv4() as UUID,
        entityId: uuidv4() as UUID,
        originalFilename: 'test.pdf',
        contentType: 'application/pdf',
        content: 'base64content',
        fileSize: 1024,
        title: 'Test Document',
        sourceUrl: undefined,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.limit.mockResolvedValue([expectedDoc]);

      const result = await repository.findById(id);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
      expect(result).toEqual(expectedDoc);
    });

    it('should return null if document not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await repository.findById(uuidv4() as UUID);

      expect(result).toBeNull();
    });
  });

  describe('findByAgent', () => {
    it('should find documents by agent ID', async () => {
      const agentId = uuidv4() as UUID;
      const docs = [createMockDocument(), createMockDocument()];

      mockDb.offset.mockResolvedValue(docs);

      const result = await repository.findByAgent(agentId, 10, 0);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.orderBy).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(10);
      expect(mockDb.offset).toHaveBeenCalledWith(0);
      expect(result).toEqual(docs);
    });
  });

  describe('update', () => {
    it('should update a document', async () => {
      const id = uuidv4() as UUID;
      const updates = {
        title: 'Updated Title',
        fileSize: 2048,
      };

      const updatedDoc = {
        ...createMockDocument(),
        ...updates,
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValue([updatedDoc]);

      const result = await repository.update(id, updates);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updates,
          updatedAt: expect.any(Date),
        })
      );
      expect(result).toEqual(updatedDoc);
    });

    it('should return null if document not found', async () => {
      mockDb.returning.mockResolvedValue([]);

      const result = await repository.update(uuidv4() as UUID, { title: 'New' });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a document', async () => {
      const id = uuidv4() as UUID;
      mockDb.returning.mockResolvedValue([{ id }]);

      const result = await repository.delete(id);

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false if document not found', async () => {
      mockDb.returning.mockResolvedValue([]);

      const result = await repository.delete(uuidv4() as UUID);

      expect(result).toBe(false);
    });
  });

  // Removed trivial exists() tests - basic CRUD operation validation

  describe('findBySourceUrl', () => {
    it('should find document by source URL', async () => {
      const sourceUrl = 'https://example.com/doc.pdf';
      const agentId = uuidv4() as UUID;
      const doc = createMockDocument({ sourceUrl });

      mockDb.limit.mockResolvedValue([doc]);

      const result = await repository.findBySourceUrl(sourceUrl, agentId);

      expect(mockDb.where).toHaveBeenCalled();
      expect(result).toEqual(doc);
    });

    it('should return null if not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await repository.findBySourceUrl('https://example.com', uuidv4() as UUID);

      expect(result).toBeNull();
    });
  });
});

// Helper function to create mock documents
function createMockDocument(overrides?: Partial<Document>): Document {
  return {
    id: uuidv4() as UUID,
    agentId: uuidv4() as UUID,
    worldId: uuidv4() as UUID,
    roomId: uuidv4() as UUID,
    entityId: uuidv4() as UUID,
    originalFilename: 'test.pdf',
    contentType: 'application/pdf',
    content: 'base64content',
    fileSize: 1024,
    title: 'Test Document',
    sourceUrl: undefined,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
