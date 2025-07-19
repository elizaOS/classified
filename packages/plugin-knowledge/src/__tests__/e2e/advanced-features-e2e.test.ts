import type { TestCase, IAgentRuntime, Memory, UUID } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { KnowledgeService } from '../../service';
import type { KnowledgeSearchOptions } from '../../types';

export const advancedFeaturesE2ETest: TestCase = {
  name: 'Advanced Knowledge Features E2E Test',
  fn: async (runtime: IAgentRuntime) => {
    console.log('Starting advanced knowledge features E2E test...');

    // Get the knowledge service
    const service = runtime.getService('knowledge') as KnowledgeService;
    if (!service) {
      throw new Error('Knowledge service not found');
    }
    console.log('✓ Knowledge service initialized');

    // Test 1: Add multiple documents for testing advanced features
    console.log('\nTest 1: Adding test documents...');

    const testDocuments = [
      {
        clientDocumentId: uuidv4() as UUID,
        contentType: 'text/plain',
        originalFilename: 'ai-research-2024.txt',
        worldId: runtime.agentId,
        content:
          'This is a comprehensive research paper about artificial intelligence and machine learning techniques published in 2024.',
        roomId: runtime.agentId,
        entityId: runtime.agentId,
        metadata: {
          tags: ['ai', 'research', 'machine-learning'],
          author: 'Dr. Smith',
          year: 2024,
        },
      },
      {
        clientDocumentId: uuidv4() as UUID,
        contentType: 'text/markdown',
        originalFilename: 'quantum-computing-guide.md',
        worldId: runtime.agentId,
        content:
          '# Quantum Computing Guide\n\nThis guide explains the basics of quantum computing and quantum algorithms.',
        roomId: runtime.agentId,
        entityId: runtime.agentId,
        metadata: {
          tags: ['quantum', 'computing', 'guide'],
          author: 'Prof. Johnson',
          year: 2023,
        },
      },
      {
        clientDocumentId: uuidv4() as UUID,
        contentType: 'text/plain',
        originalFilename: 'blockchain-notes.txt',
        worldId: runtime.agentId,
        content:
          'Notes on blockchain technology, cryptocurrencies, and distributed ledger systems.',
        roomId: runtime.agentId,
        entityId: runtime.agentId,
        metadata: {
          tags: ['blockchain', 'crypto', 'distributed'],
          author: 'Anonymous',
          year: 2023,
        },
      },
    ];

    for (const doc of testDocuments) {
      const result = await service.addKnowledge(doc);
      console.log(`✓ Added ${doc.originalFilename} with ${result.fragmentCount} fragments`);
    }

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test 2: Advanced search with filters
    console.log('\nTest 2: Testing advanced search with filters...');

    const searchResults = await service.advancedSearch({
      query: 'computing',
      filters: {
        contentType: ['text/markdown', 'text/plain'],
        tags: ['computing', 'blockchain'],
      },
      sort: {
        field: 'similarity',
        order: 'desc',
      },
      limit: 5,
    });

    if (searchResults.results.length === 0) {
      throw new Error('Advanced search returned no results');
    }
    console.log(`✓ Advanced search found ${searchResults.results.length} results`);

    // Test 3: Get analytics
    console.log('\nTest 3: Testing knowledge analytics...');

    const analytics = await service.getAnalytics();

    if (analytics.totalDocuments < testDocuments.length) {
      throw new Error(
        `Expected at least ${testDocuments.length} documents, found ${analytics.totalDocuments}`
      );
    }

    console.log(`✓ Analytics shows ${analytics.totalDocuments} documents`);
    console.log(`  - Total fragments: ${analytics.totalFragments}`);
    console.log(`  - Storage size: ${(analytics.storageSize / 1024).toFixed(2)} KB`);
    console.log(
      '  - Content types:',
      Object.entries(analytics.contentTypes)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ')
    );

    // Test 4: Export knowledge
    console.log('\nTest 4: Testing knowledge export...');

    const exportData = await service.exportKnowledge({
      format: 'json',
      includeMetadata: true,
    });

    const exportedDocs = JSON.parse(exportData);
    if (!exportedDocs.documents || exportedDocs.documents.length === 0) {
      throw new Error('Export returned no documents');
    }

    console.log(`✓ Exported ${exportedDocs.documents.length} documents as JSON`);

    // Test 5: Batch operations
    console.log('\nTest 5: Testing batch operations...');

    const batchResult = await service.batchOperation({
      operation: 'add',
      items: [
        {
          data: {
            clientDocumentId: uuidv4() as UUID,
            contentType: 'text/plain',
            originalFilename: 'batch-doc-1.txt',
            worldId: runtime.agentId,
            content: 'First batch document content',
            roomId: runtime.agentId,
            entityId: runtime.agentId,
          },
        },
        {
          data: {
            clientDocumentId: uuidv4() as UUID,
            contentType: 'text/plain',
            originalFilename: 'batch-doc-2.txt',
            worldId: runtime.agentId,
            content: 'Second batch document content',
            roomId: runtime.agentId,
            entityId: runtime.agentId,
          },
        },
      ],
    });

    if (batchResult.successful !== 2) {
      throw new Error(`Expected 2 successful batch operations, got ${batchResult.successful}`);
    }

    console.log(
      `✓ Batch operation completed: ${batchResult.successful} successful, ${batchResult.failed} failed`
    );

    // Test 6: Import knowledge
    console.log('\nTest 6: Testing knowledge import...');

    const importData = JSON.stringify({
      documents: [
        {
          content: { text: 'Imported document about neural networks' },
          metadata: {
            contentType: 'text/plain',
            originalFilename: 'neural-networks.txt',
            tags: ['ai', 'neural-networks'],
          },
        },
      ],
    });

    const importResult = await service.importKnowledge(importData, {
      format: 'json',
      validateBeforeImport: true,
    });

    if (importResult.successful !== 1) {
      throw new Error(`Expected 1 successful import, got ${importResult.successful}`);
    }

    console.log(`✓ Import completed: ${importResult.successful} documents imported`);

    // Test 7: Advanced search with date range
    console.log('\nTest 7: Testing date range filtering...');

    const recentDocs = await service.advancedSearch({
      query: '',
      filters: {
        dateRange: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      limit: 100,
    });

    // Should find all documents we just added
    if (recentDocs.results.length < testDocuments.length) {
      console.log(
        `⚠️ Date range filter found ${recentDocs.results.length} documents, expected at least ${testDocuments.length}`
      );
    } else {
      console.log(`✓ Date range filter found ${recentDocs.results.length} recent documents`);
    }

    // Clean up - delete test documents
    console.log('\nCleaning up test documents...');
    const allDocs = await service.getMemories({
      tableName: 'documents',
      count: 1000,
    });

    const testDocIds = allDocs
      .filter(
        (doc) =>
          (doc.metadata as any)?.originalFilename?.includes('test') ||
          (doc.metadata as any)?.originalFilename?.includes('batch') ||
          testDocuments.some(
            (td) => td.originalFilename === (doc.metadata as any)?.originalFilename
          )
      )
      .map((doc) => doc.id!)
      .filter((id) => id !== undefined);

    if (testDocIds.length > 0) {
      const deleteResult = await service.batchOperation({
        operation: 'delete',
        items: testDocIds.map((id) => ({ id })),
      });
      console.log(`✓ Cleaned up ${deleteResult.successful} test documents`);
    }

    console.log('\n✅ Advanced knowledge features E2E test completed successfully!');
  },
};

export default advancedFeaturesE2ETest;
