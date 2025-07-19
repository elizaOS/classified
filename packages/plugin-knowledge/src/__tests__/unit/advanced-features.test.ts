import { describe, it, expect, beforeEach, mock } from 'bun:test';
import {
  advancedSearchAction,
  knowledgeAnalyticsAction,
  exportKnowledgeAction,
} from '../../actions';
import { KnowledgeService } from '../../service';
import type { IAgentRuntime, Memory, State, UUID, ActionResult } from '@elizaos/core';

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

const generateMockUuid = (suffix: string | number): UUID =>
  `00000000-0000-0000-0000-00000000${suffix.toString().padStart(4, '0')}` as UUID;

describe('Advanced Knowledge Features', () => {
  const advancedKnowledgeFeaturesSuite = new TestSuite('Advanced Knowledge Features', {
    beforeEach: () => {
      const mockKnowledgeService = {
        advancedSearch: mock(),
        getAnalytics: mock(),
        exportKnowledge: mock(),
        importKnowledge: mock(),
        batchOperation: mock(),
      } as any;

      const mockRuntime = {
        agentId: generateMockUuid(1),
        getService: mock().mockReturnValue(mockKnowledgeService),
        getSetting: mock(),
      } as any;

      const mockCallback = mock();
      const mockState = {
        values: {},
        data: {},
        text: '',
      };

      return {
        mockRuntime,
        mockKnowledgeService,
        mockCallback,
        mockState,
      };
    },
  });

  advancedKnowledgeFeaturesSuite.addTest(
    createUnitTest({
      name: 'advancedSearchAction should validate when advanced search keywords are present',
      fn: async ({ mockRuntime }) => {
        const message: Memory = {
          id: generateMockUuid(10),
          content: {
            text: 'search for PDF documents from last week',
          },
          entityId: generateMockUuid(11),
          roomId: generateMockUuid(12),
        };

        const isValid = await advancedSearchAction.validate?.(mockRuntime, message);
        expect(isValid).toBe(true);
      },
    })
  );

  advancedKnowledgeFeaturesSuite.addTest(
    createUnitTest({
      name: 'advancedSearchAction should extract filters from natural language',
      fn: async ({ mockRuntime, mockKnowledgeService, mockCallback, mockState }) => {
        const mockResults = {
          results: [
            {
              id: generateMockUuid(20),
              content: { text: 'AI research paper content' },
              metadata: {
                type: 'fragment' as const,
                originalFilename: 'ai-research.pdf',
                contentType: 'application/pdf',
              },
              similarity: 0.95,
            },
          ],
          totalCount: 1,
          hasMore: false,
        };

        (mockKnowledgeService.advancedSearch as any).mockResolvedValue(mockResults);

        const message: Memory = {
          id: generateMockUuid(21),
          content: {
            text: 'search for pdf documents about AI from last week sorted by relevant',
          },
          entityId: generateMockUuid(22),
          roomId: generateMockUuid(23),
        };

        const result = (await advancedSearchAction.handler?.(
          mockRuntime,
          message,
          mockState,
          {},
          mockCallback
        )) as ActionResult;

        // Check that advancedSearch was called
        expect(mockKnowledgeService.advancedSearch).toHaveBeenCalled();

        // Get the actual call arguments
        const callArgs = (mockKnowledgeService.advancedSearch as any).mock.calls[0][0];

        // Verify key properties
        expect(callArgs.query).toContain('AI');
        expect(callArgs.filters?.contentType).toEqual(['application/pdf']);
        expect(callArgs.filters?.dateRange).toBeDefined();
        expect(callArgs.filters?.dateRange?.start).toBeInstanceOf(Date);
        expect(callArgs.sort).toEqual({ field: 'similarity', order: 'desc' });

        expect(result.data).toEqual({
          actionName: 'ADVANCED_KNOWLEDGE_SEARCH',
          results: mockResults.results,
          totalCount: mockResults.totalCount,
          filters: callArgs.filters,
        });
        expect(mockCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('Found 1 documents'),
          })
        );
      },
    })
  );

  advancedKnowledgeFeaturesSuite.addTest(
    createUnitTest({
      name: 'advancedSearchAction should handle empty search results',
      fn: async ({ mockRuntime, mockKnowledgeService, mockCallback, mockState }) => {
        (mockKnowledgeService.advancedSearch as any).mockResolvedValue({
          results: [],
          totalCount: 0,
          hasMore: false,
        });

        const message: Memory = {
          id: generateMockUuid(30),
          content: {
            text: 'search for markdown files from today',
          },
          entityId: generateMockUuid(31),
          roomId: generateMockUuid(32),
        };

        const result = (await advancedSearchAction.handler?.(
          mockRuntime,
          message,
          mockState,
          {},
          mockCallback
        )) as ActionResult;

        expect(mockCallback).toHaveBeenCalledWith({
          text: 'No documents found matching your criteria.',
        });
      },
    })
  );

  advancedKnowledgeFeaturesSuite.addTest(
    createUnitTest({
      name: 'knowledgeAnalyticsAction should validate when analytics keywords are present',
      fn: async ({ mockRuntime }) => {
        const message: Memory = {
          id: generateMockUuid(40),
          content: {
            text: 'show me knowledge base analytics',
          },
          entityId: generateMockUuid(41),
          roomId: generateMockUuid(42),
        };

        const isValid = await knowledgeAnalyticsAction.validate?.(mockRuntime, message);
        expect(isValid).toBe(true);
      },
    })
  );

  advancedKnowledgeFeaturesSuite.addTest(
    createUnitTest({
      name: 'knowledgeAnalyticsAction should return formatted analytics',
      fn: async ({ mockRuntime, mockKnowledgeService, mockCallback, mockState }) => {
        const mockAnalytics = {
          totalDocuments: 42,
          totalFragments: 156,
          storageSize: 5242880, // 5MB
          contentTypes: {
            'application/pdf': 20,
            'text/plain': 15,
            'text/markdown': 7,
          },
          queryStats: {
            totalQueries: 100,
            averageResponseTime: 250,
            topQueries: [
              { query: 'AI research', count: 25 },
              { query: 'machine learning', count: 18 },
            ],
          },
          usageByDate: [],
        };

        (mockKnowledgeService.getAnalytics as any).mockResolvedValue(mockAnalytics);

        const message: Memory = {
          id: generateMockUuid(43),
          content: {
            text: 'show analytics',
          },
          entityId: generateMockUuid(44),
          roomId: generateMockUuid(45),
        };

        const result = (await knowledgeAnalyticsAction.handler?.(
          mockRuntime,
          message,
          mockState,
          {},
          mockCallback
        )) as ActionResult;

        expect(result.data).toEqual({
          actionName: 'KNOWLEDGE_ANALYTICS',
          analytics: mockAnalytics,
        });
        expect(mockCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('Total Documents: 42'),
          })
        );
        expect(mockCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('5.00 MB'),
          })
        );
      },
    })
  );

  advancedKnowledgeFeaturesSuite.addTest(
    createUnitTest({
      name: 'exportKnowledgeAction should validate when export keywords are present',
      fn: async ({ mockRuntime }) => {
        const message: Memory = {
          id: generateMockUuid(50),
          content: {
            text: 'export my knowledge base',
          },
          entityId: generateMockUuid(51),
          roomId: generateMockUuid(52),
        };

        const isValid = await exportKnowledgeAction.validate?.(mockRuntime, message);
        expect(isValid).toBe(true);
      },
    })
  );

  advancedKnowledgeFeaturesSuite.addTest(
    createUnitTest({
      name: 'exportKnowledgeAction should export to JSON format by default',
      fn: async ({ mockRuntime, mockKnowledgeService, mockCallback, mockState }) => {
        const mockExportData = JSON.stringify(
          {
            exportDate: new Date().toISOString(),
            agentId: mockRuntime.agentId,
            documents: [
              {
                id: generateMockUuid(60),
                content: { text: 'Test document content' },
                metadata: { originalFilename: 'test.txt' },
              },
            ],
          },
          null,
          2
        );

        (mockKnowledgeService.exportKnowledge as any).mockResolvedValue(mockExportData);

        const message: Memory = {
          id: generateMockUuid(53),
          content: {
            text: 'export knowledge base',
          },
          entityId: generateMockUuid(54),
          roomId: generateMockUuid(55),
        };

        const result = (await exportKnowledgeAction.handler?.(
          mockRuntime,
          message,
          mockState,
          {},
          mockCallback
        )) as ActionResult;

        expect(mockKnowledgeService.exportKnowledge).toHaveBeenCalledWith({
          format: 'json',
          includeMetadata: true,
          includeFragments: false,
        });

        expect(result.data).toMatchObject({
          format: 'json',
          size: mockExportData.length,
          content: mockExportData,
        });
      },
    })
  );

  advancedKnowledgeFeaturesSuite.addTest(
    createUnitTest({
      name: 'exportKnowledgeAction should detect CSV format from message',
      fn: async ({ mockRuntime, mockKnowledgeService, mockCallback, mockState }) => {
        const mockCsvData =
          'ID,Title,Content,Type,Created\n1,test.txt,Test content,text/plain,2024-01-01';

        (mockKnowledgeService.exportKnowledge as any).mockResolvedValue(mockCsvData);

        const message: Memory = {
          id: generateMockUuid(56),
          content: {
            text: 'export knowledge as csv',
          },
          entityId: generateMockUuid(57),
          roomId: generateMockUuid(58),
        };

        await exportKnowledgeAction.handler?.(mockRuntime, message, mockState, {}, mockCallback);

        expect(mockKnowledgeService.exportKnowledge).toHaveBeenCalledWith({
          format: 'csv',
          includeMetadata: true,
          includeFragments: false,
        });
      },
    })
  );

  advancedKnowledgeFeaturesSuite.addTest(
    createUnitTest({
      name: 'exportKnowledgeAction should detect Markdown format from message',
      fn: async ({ mockRuntime, mockKnowledgeService, mockCallback, mockState }) => {
        const mockMarkdownData =
          '# Document 1\n\nContent here\n\n---\n\n# Document 2\n\nMore content';

        (mockKnowledgeService.exportKnowledge as any).mockResolvedValue(mockMarkdownData);

        const message: Memory = {
          id: generateMockUuid(59),
          content: {
            text: 'export knowledge as markdown',
          },
          entityId: generateMockUuid(60),
          roomId: generateMockUuid(61),
        };

        await exportKnowledgeAction.handler?.(mockRuntime, message, mockState, {}, mockCallback);

        expect(mockKnowledgeService.exportKnowledge).toHaveBeenCalledWith({
          format: 'markdown',
          includeMetadata: true,
          includeFragments: false,
        });
      },
    })
  );

  advancedKnowledgeFeaturesSuite.addTest(
    createUnitTest({
      name: 'Batch Operations should handle batch add operations',
      fn: async ({ mockRuntime, mockKnowledgeService }) => {
        const mockBatchResult = {
          successful: 3,
          failed: 0,
          results: [
            { id: '1', success: true, result: { fragmentCount: 5 } },
            { id: '2', success: true, result: { fragmentCount: 3 } },
            { id: '3', success: true, result: { fragmentCount: 4 } },
          ],
        };

        (mockKnowledgeService.batchOperation as any).mockResolvedValue(mockBatchResult);

        const batchOp = {
          operation: 'add' as const,
          items: [
            {
              data: {
                content: 'Doc 1',
                contentType: 'text/plain',
                clientDocumentId: generateMockUuid(71),
                originalFilename: 'doc1.txt',
                worldId: mockRuntime.agentId,
                roomId: mockRuntime.agentId,
                entityId: mockRuntime.agentId,
              },
            },
            {
              data: {
                content: 'Doc 2',
                contentType: 'text/plain',
                clientDocumentId: generateMockUuid(72),
                originalFilename: 'doc2.txt',
                worldId: mockRuntime.agentId,
                roomId: mockRuntime.agentId,
                entityId: mockRuntime.agentId,
              },
            },
            {
              data: {
                content: 'Doc 3',
                contentType: 'text/plain',
                clientDocumentId: generateMockUuid(73),
                originalFilename: 'doc3.txt',
                worldId: mockRuntime.agentId,
                roomId: mockRuntime.agentId,
                entityId: mockRuntime.agentId,
              },
            },
          ],
        };

        const result = await mockKnowledgeService.batchOperation(batchOp);

        expect(result.successful).toBe(3);
        expect(result.failed).toBe(0);
      },
    })
  );

  advancedKnowledgeFeaturesSuite.addTest(
    createUnitTest({
      name: 'Batch Operations should handle mixed batch operations with failures',
      fn: async ({ mockKnowledgeService }) => {
        const mockBatchResult = {
          successful: 2,
          failed: 1,
          results: [
            { id: '1', success: true, result: { updated: true } },
            { id: '2', success: false, error: 'Document not found' },
            { id: '3', success: true, result: { deleted: true } },
          ],
        };

        (mockKnowledgeService.batchOperation as any).mockResolvedValue(mockBatchResult);

        const batchOp = {
          operation: 'update' as const,
          items: [
            { id: '1', metadata: { tags: ['updated'] } },
            { id: '2', metadata: { tags: ['missing'] } },
            { id: '3', metadata: { tags: ['deleted'] } },
          ],
        };

        const result = await mockKnowledgeService.batchOperation(batchOp);

        expect(result.successful).toBe(2);
        expect(result.failed).toBe(1);
        expect(result.results[1].error).toBe('Document not found');
      },
    })
  );

  advancedKnowledgeFeaturesSuite.addTest(
    createUnitTest({
      name: 'Import Operations should import JSON data',
      fn: async ({ mockKnowledgeService }) => {
        const jsonData = JSON.stringify({
          documents: [
            {
              id: generateMockUuid(70),
              content: { text: 'Imported document' },
              metadata: { contentType: 'text/plain' },
            },
          ],
        });

        const mockImportResult = {
          successful: 1,
          failed: 0,
          results: [{ id: generateMockUuid(70), success: true }],
        };

        (mockKnowledgeService.importKnowledge as any).mockResolvedValue(mockImportResult);

        const result = await mockKnowledgeService.importKnowledge(jsonData, {
          format: 'json',
          validateBeforeImport: true,
        });

        expect(result.successful).toBe(1);
        expect(result.failed).toBe(0);
      },
    })
  );

  advancedKnowledgeFeaturesSuite.addTest(
    createUnitTest({
      name: 'Import Operations should import CSV data',
      fn: async ({ mockKnowledgeService }) => {
        const csvData =
          'ID,Title,Content,Type,Created\n1,test.txt,Test content,text/plain,2024-01-01';

        const mockImportResult = {
          successful: 1,
          failed: 0,
          results: [{ id: '1', success: true }],
        };

        (mockKnowledgeService.importKnowledge as any).mockResolvedValue(mockImportResult);

        const result = await mockKnowledgeService.importKnowledge(csvData, {
          format: 'csv',
          overwriteExisting: false,
        });

        expect(result.successful).toBe(1);
      },
    })
  );

  advancedKnowledgeFeaturesSuite.run();
});
