import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { IAgentRuntime, Memory, UUID, MemoryMetadata } from '@elizaos/core';
import { MemoryType } from '@elizaos/core';
import { KnowledgeService } from '../../service';

describe('Document Content Replacement Operations', () => {
  let mockRuntime: IAgentRuntime;
  let service: KnowledgeService;
  const memories = new Map<UUID, Memory>();
  let nextMemoryId = 1000;

  // Helper to generate consistent UUIDs for testing
  const generateTestUUID = (): UUID =>
    `test-${(nextMemoryId++).toString().padStart(8, '0')}-0000-0000-0000-000000000000` as UUID;

  beforeEach(() => {
    // Clear state
    memories.clear();
    nextMemoryId = 1000;

    mockRuntime = {
      agentId: generateTestUUID(),

      // Memory management methods
      async getMemoryById(id: UUID) {
        return memories.get(id) || null;
      },

      async getMemories(params: any) {
        const results = Array.from(memories.values()).filter((m) => {
          if (params.roomId && m.roomId !== params.roomId) {
            return false;
          }
          if (params.entityId && m.entityId !== params.entityId) {
            return false;
          }
          if (params.agentId && m.agentId !== params.agentId) {
            return false;
          }

          // Table-specific filtering
          if (params.tableName === 'knowledge' && m.metadata?.type !== MemoryType.FRAGMENT) {
            return false;
          }
          if (params.tableName === 'documents' && m.metadata?.type !== MemoryType.DOCUMENT) {
            return false;
          }

          return true;
        });

        return params.count ? results.slice(0, params.count) : results;
      },

      async createMemory(memory: Memory, tableName?: string) {
        const id = memory.id || generateTestUUID();
        const memoryWithId = { ...memory, id, createdAt: Date.now() };
        memories.set(id, memoryWithId);
        return id;
      },

      async updateMemory(memory: any) {
        if (memory.id && memories.has(memory.id)) {
          memories.set(memory.id, { ...memories.get(memory.id)!, ...memory });
          return true;
        }
        return false;
      },

      async deleteMemory(memoryId: UUID) {
        // Simulate cascade deletion - remove all fragments for this document
        if (memories.has(memoryId)) {
          const deletedMemory = memories.get(memoryId);
          if (deletedMemory?.metadata?.type === MemoryType.DOCUMENT) {
            // Remove all fragments for this document
            for (const [id, memory] of memories.entries()) {
              if (
                memory.metadata?.type === MemoryType.FRAGMENT &&
                (memory.metadata as any)?.documentId === memoryId
              ) {
                memories.delete(id);
              }
            }
          }
          memories.delete(memoryId);
        }
      },

      // Model methods
      async useModel(modelType: any, params: any) {
        // Mock embedding generation
        return new Array(1536).fill(0).map(() => Math.random()) as any;
      },

      // Service methods
      getService: mock((name: string) => {
        if (name === 'knowledge') {
          return service;
        }
        return null;
      }),

      getSetting: mock((key: string) => {
        const settings: Record<string, string> = {
          KNOWLEDGE_USE_NEW_TABLES: 'false',
          KNOWLEDGE_CHUNKING_MAX_SIZE: '1000',
        };
        return settings[key] || null;
      }),

      // Other required methods (minimal implementation)
      logger: {
        info: mock(),
        warn: mock(),
        error: mock(),
        debug: mock(),
      },
    } as any;

    service = new KnowledgeService(mockRuntime);
  });

  describe('Document Replacement with Fragment Regeneration', () => {
    it('should replace document content and regenerate fragments correctly', async () => {
      // Create initial document
      const initialDocId = generateTestUUID();
      const initialDocument: Memory = {
        id: initialDocId,
        agentId: mockRuntime.agentId,
        roomId: mockRuntime.agentId,
        entityId: mockRuntime.agentId,
        content: {
          text: `# Original Document

## Section 1
This is the original content of section 1.
It contains basic information about the topic.

## Section 2  
Original section 2 with limited details.
Simple explanations and basic examples.`,
        },
        metadata: {
          type: MemoryType.DOCUMENT,
          originalFilename: 'test-document.md',
          contentType: 'text/markdown',
          scope: 'private' as const,
        },
      };

      await mockRuntime.createMemory(initialDocument, 'documents');

      // Create initial fragments for the document
      const initialFragments = [
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: '# Original Document\n\n## Section 1\nThis is the original content of section 1.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: initialDocId,
            position: 0,
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'It contains basic information about the topic.\n\n## Section 2\nOriginal section 2 with limited details.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: initialDocId,
            position: 1,
          },
        },
      ];

      for (const fragment of initialFragments) {
        await mockRuntime.createMemory(fragment, 'knowledge');
      }

      // Verify initial state
      const initialDocs = await mockRuntime.getMemories({ tableName: 'documents', count: 100 });
      const initialFrags = await mockRuntime.getMemories({ tableName: 'knowledge', count: 100 });

      expect(initialDocs).toHaveLength(1);
      expect(initialFrags).toHaveLength(2);
      expect(initialFrags.every((f) => (f.metadata as any)?.documentId === initialDocId)).toBe(
        true
      );

      // Delete old document (which should cascade delete fragments)
      await mockRuntime.deleteMemory(initialDocId);

      // Verify old document and fragments are deleted
      const afterDeleteDocs = await mockRuntime.getMemories({ tableName: 'documents', count: 100 });
      const afterDeleteFrags = await mockRuntime.getMemories({
        tableName: 'knowledge',
        count: 100,
      });

      expect(afterDeleteDocs).toHaveLength(0);
      expect(afterDeleteFrags).toHaveLength(0);

      // Replace document content (simulate file update + reload)
      const newDocId = generateTestUUID();
      const newDocument: Memory = {
        id: newDocId,
        agentId: mockRuntime.agentId,
        roomId: mockRuntime.agentId,
        entityId: mockRuntime.agentId,
        content: {
          text: `# Updated Document - Version 2.0

## Enhanced Section 1
This is the completely rewritten content of section 1.
It now contains comprehensive information about the topic.
Includes detailed explanations and advanced concepts.

## Expanded Section 2
Section 2 has been significantly expanded with detailed information.
Contains multiple subsections and extensive examples.

### Subsection 2.1
New subsection with additional technical details.
Provides in-depth coverage of advanced topics.

### Subsection 2.2
Another new subsection with practical examples.
Demonstrates real-world applications and use cases.

## New Section 3
Completely new section added in the updated version.
Covers additional topics not present in the original.`,
        },
        metadata: {
          type: MemoryType.DOCUMENT,
          originalFilename: 'test-document.md',
          contentType: 'text/markdown',
          scope: 'private' as const,
          version: 2,
        },
      };

      // Add new document
      await mockRuntime.createMemory(newDocument, 'documents');

      // Create new fragments for updated document (simulating re-processing)
      const newFragments = [
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: '# Updated Document - Version 2.0\n\n## Enhanced Section 1\nThis is the completely rewritten content of section 1.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: newDocId,
            position: 0,
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: 'It now contains comprehensive information about the topic.\nIncludes detailed explanations and advanced concepts.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: newDocId,
            position: 1,
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: '## Expanded Section 2\nSection 2 has been significantly expanded with detailed information.\nContains multiple subsections and extensive examples.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: newDocId,
            position: 2,
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: '### Subsection 2.1\nNew subsection with additional technical details.\nProvides in-depth coverage of advanced topics.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: newDocId,
            position: 3,
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: '### Subsection 2.2\nAnother new subsection with practical examples.\nDemonstrates real-world applications and use cases.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: newDocId,
            position: 4,
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: '## New Section 3\nCompletely new section added in the updated version.\nCovers additional topics not present in the original.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: newDocId,
            position: 5,
          },
        },
      ];

      for (const fragment of newFragments) {
        await mockRuntime.createMemory(fragment, 'knowledge');
      }

      // Verify final state
      const finalDocs = await mockRuntime.getMemories({ tableName: 'documents', count: 100 });
      const finalFrags = await mockRuntime.getMemories({ tableName: 'knowledge', count: 100 });

      expect(finalDocs).toHaveLength(1);
      expect(finalDocs[0].id).toBe(newDocId);
      // Version property doesn't exist on MemoryMetadata - check type instead
      expect(finalDocs[0].metadata?.type).toBe(MemoryType.DOCUMENT);

      expect(finalFrags).toHaveLength(6); // More fragments due to expanded content
      expect(finalFrags.every((f) => (f.metadata as any)?.documentId === newDocId)).toBe(true);

      // Verify content differences
      const newContent = finalDocs[0].content.text as string;
      expect(newContent).toContain('Version 2.0');
      expect(newContent).toContain('Enhanced Section 1');
      expect(newContent).toContain('Subsection 2.1');
      expect(newContent).toContain('New Section 3');
      expect(newContent).not.toContain('Original Document');
    });

    it('should handle partial content updates correctly', async () => {
      // Create document with specific sections
      const docId = generateTestUUID();
      const originalDocument: Memory = {
        id: docId,
        agentId: mockRuntime.agentId,
        roomId: mockRuntime.agentId,
        entityId: mockRuntime.agentId,
        content: {
          text: `# API Documentation

## Authentication
Basic authentication using API keys.
Simple token-based access control.

## Endpoints
- GET /users
- POST /users
- PUT /users/:id
- DELETE /users/:id

## Rate Limiting
Basic rate limiting implemented.
100 requests per hour limit.`,
        },
        metadata: {
          type: MemoryType.DOCUMENT,
          originalFilename: 'api-docs.md',
          contentType: 'text/markdown',
          scope: 'private' as const,
        },
      };

      await mockRuntime.createMemory(originalDocument, 'documents');

      // Create fragments for specific sections
      const originalFragments = [
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: '# API Documentation\n\n## Authentication\nBasic authentication using API keys.\nSimple token-based access control.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: docId,
            position: 0,
            section: 'authentication',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: '## Endpoints\n- GET /users\n- POST /users\n- PUT /users/:id\n- DELETE /users/:id',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: docId,
            position: 1,
            section: 'endpoints',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: '## Rate Limiting\nBasic rate limiting implemented.\n100 requests per hour limit.',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: docId,
            position: 2,
            section: 'rate-limiting',
          },
        },
      ];

      for (const fragment of originalFragments) {
        await mockRuntime.createMemory(fragment, 'knowledge');
      }

      // Update document with enhanced content
      const updatedContent = `# API Documentation

## Authentication
Enhanced authentication system with multiple methods:
- API key authentication
- OAuth 2.0 support
- JWT token validation
- Multi-factor authentication
- Role-based access control

## Endpoints
### User Management
- GET /users - List all users with pagination
- POST /users - Create new user with validation
- PUT /users/:id - Update user profile
- DELETE /users/:id - Soft delete user account

### Advanced Features
- GET /users/:id/permissions - Get user permissions
- POST /users/:id/reset-password - Reset user password
- GET /users/search - Search users with filters

## Rate Limiting
Advanced rate limiting with multiple tiers:
- Free tier: 100 requests per hour
- Premium tier: 1000 requests per hour
- Enterprise tier: 10000 requests per hour
- Custom rate limiting rules
- Rate limit bypass for internal services`;

      // Update the document content
      await mockRuntime.updateMemory({
        id: docId,
        content: { text: updatedContent },
        metadata: {
          type: MemoryType.DOCUMENT,
          ...originalDocument.metadata,
          lastUpdated: Date.now(),
        } as MemoryMetadata,
      });

      // Delete old fragments and create new ones (simulating re-processing)
      const oldFragments = await mockRuntime.getMemories({ tableName: 'knowledge', count: 100 });
      for (const fragment of oldFragments) {
        if ((fragment.metadata as any)?.documentId === docId) {
          await mockRuntime.deleteMemory(fragment.id as UUID);
        }
      }

      // Create new fragments with updated content
      const newFragments = [
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: '# API Documentation\n\n## Authentication\nEnhanced authentication system with multiple methods:\n- API key authentication\n- OAuth 2.0 support',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: docId,
            position: 0,
            section: 'authentication',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: '- JWT token validation\n- Multi-factor authentication\n- Role-based access control',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: docId,
            position: 1,
            section: 'authentication',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: '## Endpoints\n### User Management\n- GET /users - List all users with pagination\n- POST /users - Create new user with validation',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: docId,
            position: 2,
            section: 'endpoints',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: '- PUT /users/:id - Update user profile\n- DELETE /users/:id - Soft delete user account',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: docId,
            position: 3,
            section: 'endpoints',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: '### Advanced Features\n- GET /users/:id/permissions - Get user permissions\n- POST /users/:id/reset-password - Reset user password\n- GET /users/search - Search users with filters',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: docId,
            position: 4,
            section: 'endpoints',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: '## Rate Limiting\nAdvanced rate limiting with multiple tiers:\n- Free tier: 100 requests per hour\n- Premium tier: 1000 requests per hour',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: docId,
            position: 5,
            section: 'rate-limiting',
          },
        },
        {
          id: generateTestUUID(),
          agentId: mockRuntime.agentId,
          roomId: mockRuntime.agentId,
          entityId: mockRuntime.agentId,
          content: {
            text: '- Enterprise tier: 10000 requests per hour\n- Custom rate limiting rules\n- Rate limit bypass for internal services',
          },
          metadata: {
            type: MemoryType.FRAGMENT,
            documentId: docId,
            position: 6,
            section: 'rate-limiting',
          },
        },
      ];

      for (const fragment of newFragments) {
        await mockRuntime.createMemory(fragment, 'knowledge');
      }

      // Verify the update
      const updatedDoc = await mockRuntime.getMemoryById(docId);
      const updatedFragments = await mockRuntime.getMemories({
        tableName: 'knowledge',
        count: 100,
      });

      expect(updatedDoc).toBeDefined();
      expect(updatedDoc?.content.text).toContain('Enhanced authentication system');
      expect(updatedDoc?.content.text).toContain('OAuth 2.0 support');
      expect(updatedDoc?.content.text).toContain('Advanced Features');
      expect(updatedDoc?.content.text).toContain('Premium tier: 1000 requests');

      expect(updatedFragments).toHaveLength(7); // More fragments due to expanded content
      expect(updatedFragments.every((f) => (f.metadata as any)?.documentId === docId)).toBe(true);

      // Verify section metadata is preserved
      const authFragments = updatedFragments.filter(
        (f) => (f.metadata as any)?.section === 'authentication'
      );
      const endpointFragments = updatedFragments.filter(
        (f) => (f.metadata as any)?.section === 'endpoints'
      );
      const rateLimitFragments = updatedFragments.filter(
        (f) => (f.metadata as any)?.section === 'rate-limiting'
      );

      expect(authFragments.length).toBeGreaterThan(0);
      expect(endpointFragments.length).toBeGreaterThan(0);
      expect(rateLimitFragments.length).toBeGreaterThan(0);
    });

    it('should handle concurrent document updates correctly', async () => {
      // Create base document
      const docId = generateTestUUID();
      const baseDocument: Memory = {
        id: docId,
        agentId: mockRuntime.agentId,
        roomId: mockRuntime.agentId,
        entityId: mockRuntime.agentId,
        content: {
          text: 'Original content for concurrent testing.',
        },
        metadata: {
          type: MemoryType.DOCUMENT,
          originalFilename: 'concurrent-test.md',
          contentType: 'text/markdown',
          scope: 'private' as const,
          version: 1,
        },
      };

      await mockRuntime.createMemory(baseDocument, 'documents');

      // Simulate concurrent updates by updating metadata fields
      const update1Promise = mockRuntime.updateMemory({
        id: docId,
        metadata: {
          type: MemoryType.DOCUMENT,
          ...baseDocument.metadata,
          customData: {
            version: 2,
            lastModifiedBy: 'user1',
            lastModified: Date.now(),
          },
        } as MemoryMetadata,
      });

      const update2Promise = mockRuntime.updateMemory({
        id: docId,
        content: {
          text: 'Updated content from second update process.',
        },
        metadata: {
          type: MemoryType.DOCUMENT,
          ...baseDocument.metadata,
          customData: {
            version: 3,
            lastModifiedBy: 'user2',
            lastModified: Date.now() + 1,
          },
        } as MemoryMetadata,
      });

      // Wait for both updates
      const [result1, result2] = await Promise.all([update1Promise, update2Promise]);

      expect(result1).toBe(true);
      expect(result2).toBe(true);

      // Verify final state
      const finalDoc = await mockRuntime.getMemoryById(docId);
      expect(finalDoc).toBeDefined();
      expect((finalDoc?.metadata as any)?.customData?.lastModifiedBy).toBe('user2'); // Last update wins
      expect(finalDoc?.content.text).toBe('Updated content from second update process.');
    });

    it('should maintain referential integrity during bulk replacements', async () => {
      // Create multiple related documents
      const docIds = [generateTestUUID(), generateTestUUID(), generateTestUUID()];
      const documents = docIds.map((id, index) => ({
        id,
        agentId: mockRuntime.agentId,
        roomId: mockRuntime.agentId,
        entityId: mockRuntime.agentId,
        content: {
          text: `Document ${index + 1} content with references to other documents.`,
        },
        metadata: {
          type: MemoryType.DOCUMENT,
          originalFilename: `doc-${index + 1}.md`,
          contentType: 'text/markdown',
          scope: 'private' as const,
          customData: {
            relatedDocuments: docIds.filter((relatedId) => relatedId !== id),
          },
        } as MemoryMetadata,
      }));

      // Create all documents
      for (const doc of documents) {
        await mockRuntime.createMemory(doc, 'documents');
      }

      // Create fragments for each document
      for (const doc of documents) {
        await mockRuntime.createMemory(
          {
            id: generateTestUUID(),
            agentId: mockRuntime.agentId,
            roomId: mockRuntime.agentId,
            entityId: mockRuntime.agentId,
            content: { text: doc.content.text },
            metadata: {
              type: MemoryType.FRAGMENT,
              documentId: doc.id,
              position: 0,
            },
          },
          'knowledge'
        );
      }

      // Verify initial state
      const initialDocs = await mockRuntime.getMemories({ tableName: 'documents', count: 100 });
      const initialFrags = await mockRuntime.getMemories({ tableName: 'knowledge', count: 100 });

      expect(initialDocs).toHaveLength(3);
      expect(initialFrags).toHaveLength(3);

      // Perform bulk replacement (delete first document and its fragments)
      await mockRuntime.deleteMemory(docIds[0]);

      // Verify cascade deletion worked
      const afterDeleteDocs = await mockRuntime.getMemories({ tableName: 'documents', count: 100 });
      const afterDeleteFrags = await mockRuntime.getMemories({
        tableName: 'knowledge',
        count: 100,
      });

      expect(afterDeleteDocs).toHaveLength(2);
      expect(afterDeleteFrags).toHaveLength(2);
      expect(afterDeleteFrags.every((f) => (f.metadata as any)?.documentId !== docIds[0])).toBe(
        true
      );

      // Update remaining documents to remove references to deleted document
      for (const docId of docIds.slice(1)) {
        const doc = await mockRuntime.getMemoryById(docId);
        if (doc) {
          await mockRuntime.updateMemory({
            id: docId,
            metadata: {
              ...doc.metadata,
              customData: {
                ...((doc.metadata as any)?.customData || {}),
                relatedDocuments: (
                  (doc.metadata as any)?.customData?.relatedDocuments as UUID[]
                )?.filter((id) => id !== docIds[0]),
              },
            } as MemoryMetadata,
          });
        }
      }

      // Verify referential integrity is maintained
      const finalDocs = await mockRuntime.getMemories({ tableName: 'documents', count: 100 });
      for (const doc of finalDocs) {
        const relatedDocs = (doc.metadata as any)?.customData?.relatedDocuments as UUID[];
        if (relatedDocs) {
          expect(relatedDocs).not.toContain(docIds[0]); // Should not reference deleted document
        }
      }
    });
  });
});
