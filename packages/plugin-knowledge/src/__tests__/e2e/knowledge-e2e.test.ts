import { TestCase, IAgentRuntime, UUID } from '@elizaos/core';
import { KnowledgeService } from '../../service';
import path from 'path';
import fs from 'fs/promises';

/**
 * E2E test case for the Knowledge plugin
 * Tests document loading, processing, and retrieval
 */
const knowledgeE2ETest: TestCase = {
  name: 'Knowledge Plugin E2E Test',

  async fn(runtime: IAgentRuntime): Promise<void> {
    console.log('Starting Knowledge Plugin E2E Tests...\n');

    // Test 1: Service initialization
    const service = runtime.getService('knowledge') as KnowledgeService;
    if (!service) {
      throw new Error('Knowledge service not found');
    }
    console.log('✓ Knowledge service initialized');

    // Test 2: Create test documents
    const docsPath = path.join(process.cwd(), 'test-docs');
    await fs.mkdir(docsPath, { recursive: true });

    const testDoc = {
      filename: 'test-knowledge.md',
      content: `# Test Knowledge Document
      
This is a test document for the knowledge service.
It contains information about testing.

## Important Section
This section contains critical information that should be retrievable.
The knowledge service should index and chunk this content properly.

## Another Section
Additional test content to ensure proper document processing.`,
    };

    await fs.writeFile(path.join(docsPath, testDoc.filename), testDoc.content);
    console.log('✓ Created test document');

    // Test 3: Load documents
    try {
      // Set the path for document loading
      const originalPath = process.env.KNOWLEDGE_PATH;
      process.env.KNOWLEDGE_PATH = docsPath;

      const { loadDocsFromPath } = await import('../../docs-loader');
      const loadResult = await loadDocsFromPath(service, runtime.agentId);

      if (loadResult.successful === 0) {
        throw new Error('No documents were loaded');
      }
      console.log(`✓ Loaded ${loadResult.successful} document(s)`);

      // Restore original path
      if (originalPath) {
        process.env.KNOWLEDGE_PATH = originalPath;
      } else {
        delete process.env.KNOWLEDGE_PATH;
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
      throw error;
    }

    // Test 4: Verify document in database
    const documents = await service.getMemories({
      tableName: 'documents',
      count: 100,
    });

    const testDocument = documents.find(
      (d) => (d.metadata as any)?.originalFilename === testDoc.filename
    );

    if (!testDocument) {
      throw new Error('Test document not found in database');
    }
    console.log('✓ Document stored in database');

    // Test 5: Verify fragments were created
    const fragments = await service.getMemories({
      tableName: 'knowledge',
      count: 100,
    });

    const documentFragments = fragments.filter(
      (f) => (f.metadata as any)?.documentId === testDocument.id
    );

    if (documentFragments.length === 0) {
      throw new Error('No fragments found for test document');
    }
    console.log(`✓ Created ${documentFragments.length} fragments`);

    // Test 6: Test knowledge retrieval
    const testMessage = {
      id: 'test-msg-1' as UUID,
      content: { text: 'Tell me about the important section' },
      agentId: runtime.agentId,
      roomId: runtime.agentId,
      createdAt: Date.now(),
    };

    const knowledgeItems = await service.getKnowledge(testMessage as any);

    if (knowledgeItems.length === 0) {
      throw new Error('No knowledge items retrieved');
    }
    console.log(`✓ Retrieved ${knowledgeItems.length} knowledge items`);

    // Test 7: Verify relevance
    const relevantItems = knowledgeItems.filter(
      (item) =>
        item.content.text?.toLowerCase().includes('important') ||
        item.content.text?.toLowerCase().includes('critical')
    );

    if (relevantItems.length === 0) {
      throw new Error('Retrieved items are not relevant to query');
    }
    console.log(`✓ Found ${relevantItems.length} relevant items`);

    // Test 8: Test document deletion with cascade
    if (testDocument.id) {
      await service.deleteMemory(testDocument.id);

      // Verify document is deleted
      const remainingDocs = await service.getMemories({
        tableName: 'documents',
        count: 100,
      });

      if (remainingDocs.find((d) => d.id === testDocument.id)) {
        throw new Error('Document was not deleted');
      }
      console.log('✓ Document deleted successfully');

      // Verify fragments are cascade deleted
      const remainingFragments = await service.getMemories({
        tableName: 'knowledge',
        count: 100,
      });

      const orphanedFragments = remainingFragments.filter(
        (f) => (f.metadata as any)?.documentId === testDocument.id
      );

      if (orphanedFragments.length > 0) {
        throw new Error('Fragments were not cascade deleted');
      }
      console.log('✓ Fragments cascade deleted');
    }

    // Cleanup
    await fs.rm(docsPath, { recursive: true, force: true });
    console.log('✓ Cleaned up test files');

    console.log('\n✅ All Knowledge Plugin E2E tests passed!');
  },
};

export default knowledgeE2ETest;
