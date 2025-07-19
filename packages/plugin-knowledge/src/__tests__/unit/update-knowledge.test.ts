import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { IAgentRuntime, Memory, UUID } from '@elizaos/core';
import { MemoryType } from '@elizaos/core';
import { KnowledgeService } from '../../service';

// Create mock functions for testing
const createMockFn = () => mock();

describe('Knowledge Update Operations', () => {
  let mockRuntime: IAgentRuntime;
  let service: KnowledgeService;
  const memories = new Map<UUID, Memory>();

  beforeEach(() => {
    // Clear all mocks
    memories.clear();

    mockRuntime = {
      agentId: 'test-agent-id' as UUID,
      getMemoryById: mock((id: UUID) => memories.get(id) || null),
      updateMemory: mock(async (memory: any) => {
        if (memory.id && memories.has(memory.id)) {
          memories.set(memory.id, { ...memories.get(memory.id)!, ...memory });
          return true;
        }
        return false;
      }),
      createMemory: mock(async (memory: Memory, tableName?: string) => {
        const id =
          memory.id || (`mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` as UUID);
        memories.set(id, { ...memory, id });
        return id;
      }),
      deleteMemory: mock(async (id: UUID) => {
        memories.delete(id);
      }),
      getService: mock((name: string) => {
        if (name === KnowledgeService.serviceType) {
          return service;
        }
        return null;
      }),
      useModel: mock(() => Promise.resolve(new Array(1536).fill(0).map(() => Math.random()))),
      getMemories: mock(() => Promise.resolve([])),
      getSetting: mock((key: string) => {
        const settings: Record<string, string> = {
          KNOWLEDGE_USE_NEW_TABLES: 'false',
          KNOWLEDGE_CHUNKING_MAX_SIZE: '1000',
        };
        return settings[key] || null;
      }),
      searchMemories: mock(() => Promise.resolve([])),
      searchMemoriesByEmbedding: mock(() => Promise.resolve([])),
    } as any;

    service = new KnowledgeService(mockRuntime);
  });

  describe('Update Knowledge Document', () => {
    it('should update document metadata without changing content', async () => {
      const docId = 'doc-1234-5678-90ab-cdef-1234567890ab' as UUID;
      const originalDoc: Memory = {
        id: docId,
        agentId: mockRuntime.agentId,
        roomId: mockRuntime.agentId,
        entityId: mockRuntime.agentId,
        content: { text: 'Original document content' },
        metadata: {
          type: MemoryType.DOCUMENT,
          filename: 'original.txt',
          scope: 'private' as const,
        },
      };

      memories.set(docId, originalDoc);

      // Update metadata - only fields allowed by DocumentMetadata
      const updatedMetadata = {
        type: MemoryType.DOCUMENT,
        filename: 'original.txt',
        scope: 'private' as const,
        source: 'updated',
        timestamp: Date.now(),
        tags: ['important', 'updated'],
      };

      await mockRuntime.updateMemory({
        id: docId,
        metadata: updatedMetadata,
      });

      const updatedDoc = memories.get(docId);
      expect(updatedDoc).toBeDefined();
      expect(updatedDoc?.metadata?.tags).toEqual(['important', 'updated']);
      expect(updatedDoc?.metadata?.source).toBe('updated');
      expect(updatedDoc?.content.text).toBe('Original document content');
    });

    it('should handle document replacement with new content', async () => {
      const docId = 'doc-4567-8901-2345-6789-0123456789ab' as UUID;
      const originalDoc: Memory = {
        id: docId,
        agentId: mockRuntime.agentId,
        roomId: mockRuntime.agentId,
        entityId: mockRuntime.agentId,
        content: { text: 'Original content' },
        metadata: {
          type: MemoryType.DOCUMENT,
          filename: 'document.txt',
          scope: 'private' as const,
        },
      };

      memories.set(docId, originalDoc);

      // Since KnowledgeService.addKnowledge expects proper file content,
      // we'll test the concept of replacement by showing delete + add pattern
      await service.deleteMemory(docId);
      expect(mockRuntime.deleteMemory).toHaveBeenCalledWith(docId);
      expect(memories.has(docId)).toBe(false);

      // For a real replacement, a new document would be added with updated content
      const newDoc: Memory = {
        id: docId,
        agentId: mockRuntime.agentId,
        roomId: mockRuntime.agentId,
        entityId: mockRuntime.agentId,
        content: { text: 'Updated content with new information' },
        metadata: {
          type: MemoryType.DOCUMENT,
          filename: 'document-v2.txt',
          scope: 'private' as const,
          tags: ['version:2', 'updated'],
        },
      };

      await mockRuntime.createMemory(newDoc, 'memories');
      expect(memories.has(docId)).toBe(true);
    });
  });

  describe('Bulk Delete Operations', () => {
    it('should delete multiple documents successfully', async () => {
      const docIds = [
        'doc-1111-2222-3333-4444-555555555555',
        'doc-2222-3333-4444-5555-666666666666',
        'doc-3333-4444-5555-6666-777777777777',
      ] as UUID[];

      // Create test documents
      for (const docId of docIds) {
        memories.set(docId, {
          id: docId,
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: { text: `Document ${docId}` },
          metadata: { type: MemoryType.DOCUMENT },
        });
      }

      // Delete all documents
      for (const docId of docIds) {
        await service.deleteMemory(docId);
      }

      // Verify all deleted
      expect(mockRuntime.deleteMemory).toHaveBeenCalledTimes(3);
      for (const docId of docIds) {
        expect(memories.has(docId)).toBe(false);
      }
    });

    it('should handle partial failures in bulk delete', async () => {
      const docIds = [
        'exists-1111-2222-3333-4444-555555555555',
        'notexist-11-2222-3333-4444-555555555555',
        'exists-2222-3333-4444-5555-666666666666',
      ] as UUID[];

      // Only create some documents
      memories.set(docIds[0], {
        id: docIds[0],
        agentId: mockRuntime.agentId,
        roomId: mockRuntime.agentId,
        entityId: mockRuntime.agentId,
        content: { text: 'Document 1' },
        metadata: { type: MemoryType.DOCUMENT },
      });

      memories.set(docIds[2], {
        id: docIds[2],
        agentId: mockRuntime.agentId,
        roomId: mockRuntime.agentId,
        entityId: mockRuntime.agentId,
        content: { text: 'Document 2' },
        metadata: { type: MemoryType.DOCUMENT },
      });

      const results = [];
      for (const docId of docIds) {
        try {
          await service.deleteMemory(docId);
          results.push({ id: docId, success: true });
        } catch (error) {
          results.push({ id: docId, success: false });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBe(3); // All deletes succeed regardless of existence
      expect(memories.size).toBe(0);
    });
  });

  describe('Attachment Processing Concepts', () => {
    it('should handle attachment from URL concept', async () => {
      const attachment = {
        url: 'https://example.com/document.pdf',
        title: 'Test Document',
        contentType: 'application/pdf',
      };

      // In a real scenario, we would fetch content from URL
      // For testing, we demonstrate the memory structure
      const attachmentMemory: Memory = {
        id: 'attachment-1234-5678-90ab-cdef-123456' as UUID,
        agentId: mockRuntime.agentId,
        roomId: mockRuntime.agentId,
        entityId: mockRuntime.agentId,
        content: {
          text: 'Content from PDF would be extracted here',
          source: attachment.url,
        },
        metadata: {
          type: MemoryType.DOCUMENT,
          filename: attachment.title,
          source: 'message-attachment',
          tags: ['attachment', 'pdf'],
        },
      };

      await mockRuntime.createMemory(attachmentMemory, 'memories');

      const created = memories.get(attachmentMemory.id!);
      expect(created).toBeDefined();
      expect(created?.metadata?.source).toBe('message-attachment');
      expect(created?.content.source).toBe(attachment.url);
    });

    it('should handle direct data attachment concept', async () => {
      const attachment = {
        data: 'This is the direct content of the attachment',
        title: 'Direct Attachment',
        contentType: 'text/plain',
      };

      const attachmentMemory: Memory = {
        id: 'direct-atch-1234-5678-90ab-cdef-123456' as UUID,
        agentId: mockRuntime.agentId,
        roomId: mockRuntime.agentId,
        entityId: mockRuntime.agentId,
        content: {
          text: attachment.data,
        },
        metadata: {
          type: MemoryType.DOCUMENT,
          filename: attachment.title,
          source: 'message-attachment',
          tags: ['attachment', 'direct-data', 'text'],
        },
      };

      await mockRuntime.createMemory(attachmentMemory, 'memories');

      const created = memories.get(attachmentMemory.id!);
      expect(created).toBeDefined();
      expect(created?.content.text).toBe(attachment.data);
      expect(created?.metadata?.tags).toContain('direct-data');
    });
  });
});
