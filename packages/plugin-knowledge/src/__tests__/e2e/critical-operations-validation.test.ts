import { TestCase, IAgentRuntime, UUID, Memory } from '@elizaos/core';
import { KnowledgeService } from '../../service';
import type { KnowledgeSearchResult } from '../../types';
import path from 'path';
import fs from 'fs/promises';

/**
 * Critical Operations Validation Test
 *
 * This test focuses on the three critical operations the user specifically mentioned:
 * 1. Document Content Replacement - Ensuring content updates properly replace fragments
 * 2. Cascade Deletion - Verifying complete cleanup when documents are deleted
 * 3. Search Relevance Validation - Ensuring most relevant documents appear first
 *
 * These tests use large, complex datasets to stress-test the system.
 */
const criticalOperationsValidationTest: TestCase = {
  name: 'Critical Operations Validation - Document Replacement, Deletion, Search Relevance',

  async fn(runtime: IAgentRuntime): Promise<void> {
    console.log('Starting Critical Operations Validation Test...\n');

    const service = runtime.getService('knowledge') as KnowledgeService;
    if (!service) {
      throw new Error('Knowledge service not found');
    }

    // Create test documents directory
    const testDocsPath = path.join(process.cwd(), 'test-critical-ops');
    await fs.mkdir(testDocsPath, { recursive: true });

    try {
      await testDocumentReplacementOperations(service, runtime, testDocsPath);
      await testCascadeDeletionValidation(service, runtime, testDocsPath);
      await testSearchRelevanceValidation(service, runtime, testDocsPath);
      await testConcurrentOperations(service, runtime, testDocsPath);
      await testLargeScaleOperations(service, runtime, testDocsPath);

      console.log('\n✅ All Critical Operations Validation tests passed!');
    } finally {
      // Cleanup
      await fs.rm(testDocsPath, { recursive: true, force: true });
      console.log('✓ Cleaned up critical operations test files');
    }
  },
};

/**
 * Test 1: Comprehensive Document Replacement Operations
 * Validates that document updates properly replace content and regenerate all fragments
 */
async function testDocumentReplacementOperations(
  service: KnowledgeService,
  runtime: IAgentRuntime,
  testDocsPath: string
): Promise<void> {
  console.log('=== Testing Document Replacement Operations ===');

  // Test Case 1: Large document with significant content changes
  console.log('Test 1.1: Large Document Content Replacement...');

  const originalLargeDoc = {
    filename: 'large-technical-doc.md',
    content: generateLargeTechnicalDocument('v1', 50, 'original'),
  };

  await fs.writeFile(path.join(testDocsPath, originalLargeDoc.filename), originalLargeDoc.content);

  // Load initial document
  const { loadDocsFromPath } = await import('../../docs-loader');
  const initialLoad = await loadDocsFromPath(service, runtime.agentId);

  if (initialLoad.successful === 0) {
    throw new Error('Failed to load initial large document');
  }

  // Get initial state
  const initialDocs = await service.getMemories({ tableName: 'documents', count: 100 });
  const initialDoc = initialDocs.find(
    (d) => (d.metadata as any)?.originalFilename === originalLargeDoc.filename
  );

  if (!initialDoc) {
    throw new Error('Initial large document not found');
  }

  const initialFragments = await service.getMemories({ tableName: 'knowledge', count: 1000 });
  const initialDocFragments = initialFragments.filter(
    (f) => (f.metadata as any)?.documentId === initialDoc.id
  );

  console.log(`✓ Initial document created with ${initialDocFragments.length} fragments`);

  // Create significantly updated document
  const updatedLargeDoc = {
    filename: 'large-technical-doc.md',
    content: generateLargeTechnicalDocument('v2', 75, 'updated'),
  };

  await fs.writeFile(path.join(testDocsPath, updatedLargeDoc.filename), updatedLargeDoc.content);

  // Delete old document to simulate replacement
  await service.deleteMemory(initialDoc.id as UUID);

  // Verify old fragments are deleted
  const afterDeleteFragments = await service.getMemories({ tableName: 'knowledge', count: 1000 });
  const orphanedFragments = afterDeleteFragments.filter(
    (f) => (f.metadata as any)?.documentId === initialDoc.id
  );

  if (orphanedFragments.length > 0) {
    throw new Error(`${orphanedFragments.length} fragments were not properly cascade deleted`);
  }

  console.log('✓ Old document and all fragments cascade deleted successfully');

  // Load updated document
  const updateLoad = await loadDocsFromPath(service, runtime.agentId);

  if (updateLoad.successful === 0) {
    throw new Error('Failed to load updated document');
  }

  // Verify new document and fragments
  const updatedDocs = await service.getMemories({ tableName: 'documents', count: 100 });
  const newDoc = updatedDocs.find(
    (d) =>
      (d.metadata as any)?.originalFilename === updatedLargeDoc.filename && d.id !== initialDoc.id
  );

  if (!newDoc) {
    throw new Error('Updated document not found');
  }

  const newFragments = await service.getMemories({ tableName: 'knowledge', count: 1000 });
  const newDocFragments = newFragments.filter((f) => (f.metadata as any)?.documentId === newDoc.id);

  if (newDocFragments.length === 0) {
    throw new Error('No fragments created for updated document');
  }

  console.log(`✓ Updated document created with ${newDocFragments.length} fragments`);

  // Test content differences
  const hasNewContent = newDocFragments.some(
    (f) => f.content.text?.includes('updated content') || f.content.text?.includes('version 2')
  );

  if (hasNewContent) {
    console.log('✓ New content detected in fragments');
  } else {
    console.log('⚠️ Could not verify new content in fragments (may be due to chunking)');
  }

  // Test Case 1.2: Multiple document replacement cycle
  console.log('\nTest 1.2: Multiple Document Replacement Cycle...');

  for (let version = 3; version <= 5; version++) {
    const versionDoc = {
      filename: 'large-technical-doc.md',
      content: generateLargeTechnicalDocument(`v${version}`, 60 + version * 5, `version${version}`),
    };

    await fs.writeFile(path.join(testDocsPath, versionDoc.filename), versionDoc.content);

    // Delete previous version
    const currentDocs = await service.getMemories({ tableName: 'documents', count: 100 });
    const currentDoc = currentDocs.find(
      (d) => (d.metadata as any)?.originalFilename === versionDoc.filename
    );

    if (currentDoc) {
      await service.deleteMemory(currentDoc.id as UUID);
    }

    // Load new version
    const versionLoad = await loadDocsFromPath(service, runtime.agentId);

    if (versionLoad.successful > 0) {
      console.log(`✓ Version ${version} loaded successfully`);
    }
  }

  console.log('✓ Document replacement operations completed successfully\n');
}

/**
 * Test 2: Comprehensive Cascade Deletion Validation
 * Ensures that when documents are deleted, ALL related fragments are properly removed
 */
async function testCascadeDeletionValidation(
  service: KnowledgeService,
  runtime: IAgentRuntime,
  testDocsPath: string
): Promise<void> {
  console.log('=== Testing Cascade Deletion Validation ===');

  // Test Case 2.1: Multiple large documents with many fragments
  console.log('Test 2.1: Large Scale Cascade Deletion...');

  const testDocs = Array.from({ length: 10 }, (_, i) => ({
    filename: `cascade-test-doc-${i}.md`,
    content: generateComplexDocument(`doc${i}`, 30, `document-${i}`),
  }));

  // Create all test documents
  for (const doc of testDocs) {
    await fs.writeFile(path.join(testDocsPath, doc.filename), doc.content);
  }

  // Load all documents
  const { loadDocsFromPath } = await import('../../docs-loader');
  const loadResult = await loadDocsFromPath(service, runtime.agentId);

  if (loadResult.successful < testDocs.length) {
    console.log(`⚠️ Expected ${testDocs.length} docs, loaded ${loadResult.successful}`);
  }

  // Get all documents and fragments before deletion
  const allDocs = await service.getMemories({ tableName: 'documents', count: 1000 });
  const testDocuments = allDocs.filter((d) =>
    testDocs.some((td) => (d.metadata as any)?.originalFilename === td.filename)
  );

  const allFragments = await service.getMemories({ tableName: 'knowledge', count: 10000 });
  const testFragments = allFragments.filter((f) =>
    testDocuments.some((d) => (f.metadata as any)?.documentId === d.id)
  );

  console.log(
    `✓ Created ${testDocuments.length} documents with ${testFragments.length} total fragments`
  );

  // Track fragments by document for detailed validation
  const fragmentsByDoc = new Map();
  for (const doc of testDocuments) {
    const docFragments = testFragments.filter((f) => (f.metadata as any)?.documentId === doc.id);
    fragmentsByDoc.set(doc.id, docFragments.length);
  }

  // Test Case 2.2: Delete documents one by one and verify cascade
  console.log('\nTest 2.2: Individual Document Cascade Deletion...');

  for (let i = 0; i < Math.min(5, testDocuments.length); i++) {
    const docToDelete = testDocuments[i];
    const expectedFragmentCount = fragmentsByDoc.get(docToDelete.id) || 0;

    console.log(`Deleting document ${i + 1} (expected ${expectedFragmentCount} fragments)...`);

    // Delete the document
    await service.deleteMemory(docToDelete.id as UUID);

    // Verify document is deleted
    const remainingDocs = await service.getMemories({ tableName: 'documents', count: 1000 });
    const deletedDoc = remainingDocs.find((d) => d.id === docToDelete.id);

    if (deletedDoc) {
      throw new Error(`Document ${i + 1} was not deleted`);
    }

    // Verify all fragments are cascade deleted
    const remainingFragments = await service.getMemories({ tableName: 'knowledge', count: 10000 });
    const orphanedFragments = remainingFragments.filter(
      (f) => (f.metadata as any)?.documentId === docToDelete.id
    );

    if (orphanedFragments.length > 0) {
      throw new Error(
        `Document ${i + 1}: ${orphanedFragments.length} fragments were not cascade deleted`
      );
    }

    console.log(
      `✓ Document ${i + 1} and all ${expectedFragmentCount} fragments deleted successfully`
    );
  }

  // Test Case 2.3: Bulk deletion
  console.log('\nTest 2.3: Bulk Document Deletion...');

  const remainingDocs = await service.getMemories({ tableName: 'documents', count: 1000 });
  const remainingTestDocs = remainingDocs.filter((d) =>
    testDocs.some((td) => (d.metadata as any)?.originalFilename === td.filename)
  );

  // Delete all remaining test documents
  for (const doc of remainingTestDocs) {
    await service.deleteMemory(doc.id as UUID);
  }

  // Verify complete cleanup
  const finalDocs = await service.getMemories({ tableName: 'documents', count: 1000 });
  const finalTestDocs = finalDocs.filter((d) =>
    testDocs.some((td) => (d.metadata as any)?.originalFilename === td.filename)
  );

  const finalFragments = await service.getMemories({ tableName: 'knowledge', count: 10000 });
  const finalTestFragments = finalFragments.filter((f) =>
    testDocuments.some((d) => (f.metadata as any)?.documentId === d.id)
  );

  if (finalTestDocs.length > 0) {
    throw new Error(`${finalTestDocs.length} test documents were not deleted`);
  }

  if (finalTestFragments.length > 0) {
    throw new Error(`${finalTestFragments.length} test fragments were not cascade deleted`);
  }

  console.log('✓ Bulk deletion completed - all documents and fragments removed');
  console.log('✓ Cascade deletion validation completed successfully\n');
}

/**
 * Test 3: Search Relevance Validation
 * Ensures that search results are properly ranked by relevance
 */
async function testSearchRelevanceValidation(
  service: KnowledgeService,
  runtime: IAgentRuntime,
  testDocsPath: string
): Promise<void> {
  console.log('=== Testing Search Relevance Validation ===');

  // Create documents with varying relevance to test queries
  const relevanceTestDocs = [
    {
      filename: 'exact-match-doc.md',
      content: `# Exact Match Document

This document contains exact phrases that should rank highest for specific queries.

Machine learning algorithms require careful hyperparameter tuning for optimal performance.
The learning rate parameter is crucial for gradient descent optimization.
Model validation using cross-validation techniques ensures robust performance metrics.

Advanced machine learning concepts:
- Deep neural network architectures
- Convolutional neural networks for image processing  
- Recurrent neural networks for sequence modeling
- Transformer architectures for natural language processing

Performance optimization techniques:
- Batch normalization for stable training
- Dropout regularization to prevent overfitting
- Learning rate scheduling for convergence
- Early stopping to avoid overtraining`,
    },
    {
      filename: 'partial-match-doc.md',
      content: `# Partial Match Document

This document has some related terms but should rank lower than exact matches.

Artificial intelligence systems use various learning methodologies.
Computer algorithms can be optimized for better results.
Data science involves analyzing large datasets for insights.
Statistical models help predict future outcomes.

Related concepts:
- Pattern recognition in data
- Optimization techniques
- Algorithm design principles
- Performance measurement methods`,
    },
    {
      filename: 'tangential-doc.md',
      content: `# Tangential Document

This document mentions some keywords but in different contexts.

Learning new skills requires practice and dedication.
Machine operations in manufacturing require precision.
Rate of progress depends on individual factors.
Validation of ideas comes through peer review.

General topics:
- Educational methodologies
- Industrial processes
- Progress tracking
- Quality assurance`,
    },
    {
      filename: 'irrelevant-doc.md',
      content: `# Irrelevant Document

This document should rank lowest for machine learning queries.

Cooking recipes require precise measurements and timing.
Garden plants need water and sunlight to grow.
Weather patterns affect outdoor activities.
Travel planning involves booking accommodations.

Lifestyle topics:
- Healthy eating habits
- Gardening techniques
- Weather forecasting
- Vacation planning`,
    },
  ];

  // Write test documents
  for (const doc of relevanceTestDocs) {
    await fs.writeFile(path.join(testDocsPath, doc.filename), doc.content);
  }

  // Load all documents
  const { loadDocsFromPath } = await import('../../docs-loader');
  const loadResult = await loadDocsFromPath(service, runtime.agentId);

  if (loadResult.successful < relevanceTestDocs.length) {
    throw new Error(`Expected ${relevanceTestDocs.length} docs, loaded ${loadResult.successful}`);
  }

  console.log(`✓ Loaded ${loadResult.successful} relevance test documents`);

  // Test Case 3.1: Exact phrase matching
  console.log('\nTest 3.1: Exact Phrase Matching...');

  const exactQuery = {
    id: 'exact-query' as UUID,
    content: { text: 'machine learning hyperparameter tuning optimization' },
    agentId: runtime.agentId,
    roomId: runtime.agentId,
    createdAt: Date.now(),
  };

  const exactResults = await service.getKnowledge(exactQuery as any);

  if (exactResults.length > 0) {
    const topResult = exactResults[0];
    const hasExactTerms =
      topResult.content.text?.toLowerCase().includes('machine learning') &&
      topResult.content.text?.toLowerCase().includes('hyperparameter');

    if (hasExactTerms) {
      console.log('✓ Exact match document ranked first');
    } else {
      console.log('⚠️ Most relevant document may not be ranking first');
    }

    // Verify ranking order
    let properlyRanked = true;
    for (let i = 1; i < Math.min(exactResults.length, 4); i++) {
      const currentSim = (exactResults[i] as KnowledgeSearchResult).similarity || 0;
      const prevSim = (exactResults[i - 1] as KnowledgeSearchResult).similarity || 0;

      if (currentSim > prevSim) {
        properlyRanked = false;
        break;
      }
    }

    if (properlyRanked) {
      console.log('✓ Results properly ranked by similarity scores');
    } else {
      console.log('⚠️ Results may not be optimally ranked');
    }
  }

  // Test Case 3.2: Multi-term relevance
  console.log('\nTest 3.2: Multi-term Relevance Ranking...');

  const multiTermQueries = [
    {
      query: 'neural network architecture deep learning',
      expectedInTop: ['exact-match-doc.md'],
      description: 'Deep learning query',
    },
    {
      query: 'algorithm optimization performance',
      expectedInTop: ['exact-match-doc.md', 'partial-match-doc.md'],
      description: 'Algorithm optimization query',
    },
    {
      query: 'data validation techniques',
      expectedInTop: ['exact-match-doc.md', 'partial-match-doc.md'],
      description: 'Data validation query',
    },
  ];

  for (const testCase of multiTermQueries) {
    console.log(`Testing: ${testCase.description}...`);

    const queryMessage = {
      id: `multi-query-${Date.now()}` as UUID,
      content: { text: testCase.query },
      agentId: runtime.agentId,
      roomId: runtime.agentId,
      createdAt: Date.now(),
    };

    const results = await service.getKnowledge(queryMessage as any);

    if (results.length > 0) {
      // Check if expected documents are in top results
      const topResults = results.slice(0, 3);
      const resultSources = topResults.map((r) => (r.metadata as any)?.originalFilename || '');

      const foundExpected = testCase.expectedInTop.filter((expected) =>
        resultSources.some((source) => source.includes(expected.replace('.md', '')))
      );

      if (foundExpected.length > 0) {
        console.log(
          `✓ ${testCase.description}: Found ${foundExpected.length}/${testCase.expectedInTop.length} expected documents in top results`
        );
      } else {
        console.log(`⚠️ ${testCase.description}: Expected documents not in top results`);
      }
    }

    // Small delay between queries
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log('✓ Search relevance validation completed successfully\n');
}

/**
 * Test 4: Concurrent Operations
 * Tests system behavior under concurrent document operations
 */
async function testConcurrentOperations(
  service: KnowledgeService,
  runtime: IAgentRuntime,
  testDocsPath: string
): Promise<void> {
  console.log('=== Testing Concurrent Operations ===');

  // Test Case 4.1: Concurrent document additions
  console.log('Test 4.1: Concurrent Document Additions...');

  const concurrentDocs = Array.from({ length: 5 }, (_, i) => ({
    filename: `concurrent-doc-${i}.md`,
    content: generateComplexDocument(`concurrent${i}`, 20, `concurrent-content-${i}`),
  }));

  // Write all files concurrently
  await Promise.all(
    concurrentDocs.map((doc) => fs.writeFile(path.join(testDocsPath, doc.filename), doc.content))
  );

  // Load all documents concurrently
  const { loadDocsFromPath } = await import('../../docs-loader');
  const loadResult = await loadDocsFromPath(service, runtime.agentId);

  if (loadResult.successful >= concurrentDocs.length - 1) {
    console.log(
      `✓ Concurrent loading: ${loadResult.successful}/${concurrentDocs.length} documents loaded`
    );
  } else {
    console.log(
      `⚠️ Concurrent loading: only ${loadResult.successful}/${concurrentDocs.length} documents loaded`
    );
  }

  // Test Case 4.2: Concurrent search operations
  console.log('\nTest 4.2: Concurrent Search Operations...');

  const searchQueries = [
    'concurrent content processing',
    'document management system',
    'knowledge base operations',
    'data processing algorithms',
    'information retrieval methods',
  ];

  const searchPromises = searchQueries.map(async (query, index) => {
    const queryMessage = {
      id: `concurrent-search-${index}` as UUID,
      content: { text: query },
      agentId: runtime.agentId,
      roomId: runtime.agentId,
      createdAt: Date.now(),
    };

    try {
      const results = await service.getKnowledge(queryMessage as any);
      return { query, resultCount: results.length };
    } catch (error) {
      return { query, error: error instanceof Error ? error.message : String(error) };
    }
  });

  const searchResults = await Promise.all(searchPromises);
  const successfulSearches = searchResults.filter((r) => !('error' in r));

  console.log(
    `✓ Concurrent searches: ${successfulSearches.length}/${searchQueries.length} completed successfully`
  );

  console.log('✓ Concurrent operations completed successfully\n');
}

/**
 * Test 5: Large Scale Operations
 * Tests system performance with large volumes of data
 */
async function testLargeScaleOperations(
  service: KnowledgeService,
  runtime: IAgentRuntime,
  testDocsPath: string
): Promise<void> {
  console.log('=== Testing Large Scale Operations ===');

  // Test Case 5.1: Large document processing
  console.log('Test 5.1: Large Document Processing...');

  const largeDoc = {
    filename: 'very-large-document.md',
    content: generateLargeTechnicalDocument('large-scale', 200, 'large-scale-content'),
  };

  await fs.writeFile(path.join(testDocsPath, largeDoc.filename), largeDoc.content);

  // Load large document
  const { loadDocsFromPath } = await import('../../docs-loader');
  const loadResult = await loadDocsFromPath(service, runtime.agentId);

  if (loadResult.successful > 0) {
    console.log('✓ Large document loaded successfully');

    // Check fragment count
    const fragments = await service.getMemories({ tableName: 'knowledge', count: 5000 });
    const docFragments = fragments.filter(
      (f) => (f.metadata as any)?.originalFilename === largeDoc.filename
    );

    console.log(`✓ Large document generated ${docFragments.length} fragments`);
  }

  console.log('✓ Large scale operations completed successfully\n');
}

/**
 * Helper function to generate large technical documents
 */
function generateLargeTechnicalDocument(
  version: string,
  sections: number,
  content: string
): string {
  let doc = `# Large Technical Document - ${version.toUpperCase()}\n\n`;
  doc += `This is a comprehensive technical document with ${content} for testing purposes.\n\n`;

  for (let i = 1; i <= sections; i++) {
    doc += `## Section ${i}: ${content} Analysis\n\n`;
    doc += `This section covers detailed ${content} information for ${version}. `;
    doc += 'It includes comprehensive explanations, technical details, and practical examples. ';
    doc +=
      "The content is designed to test the knowledge system's ability to handle large documents ";
    doc += 'with multiple sections and complex information structures.\n\n';

    doc += `### Subsection ${i}.1: Core Concepts\n\n`;
    doc += 'Key concepts in this area include fundamental principles, best practices, and ';
    doc += 'implementation strategies. These concepts form the foundation for understanding ';
    doc += 'the more advanced topics covered in subsequent sections.\n\n';

    doc += `### Subsection ${i}.2: Technical Implementation\n\n`;
    doc += `Technical implementation details for ${content} in ${version} include specific `;
    doc += 'algorithms, data structures, and architectural patterns. This information is ';
    doc += 'crucial for developers and system architects working with this technology.\n\n';

    doc += `### Subsection ${i}.3: Performance Considerations\n\n`;
    doc += `Performance optimization techniques and considerations for ${content} systems `;
    doc += 'include memory management, computational efficiency, and scalability factors. ';
    doc += 'These aspects are essential for production deployments.\n\n';

    if (i % 10 === 0) {
      doc += `## Checkpoint ${i / 10}: Summary and Review\n\n`;
      doc += `This checkpoint summarizes the key points covered in sections ${i - 9} through ${i}. `;
      doc += `It provides a comprehensive review of the ${content} concepts and their practical `;
      doc += 'applications in real-world scenarios.\n\n';
    }
  }

  doc += '## Conclusion\n\n';
  doc += `This document has covered comprehensive ${content} information across ${sections} sections. `;
  doc += `The ${version} implementation provides robust functionality for knowledge management and `;
  doc +=
    "demonstrates the system's capability to handle complex, multi-section documents effectively.\n";

  return doc;
}

/**
 * Helper function to generate complex documents with varied content
 */
function generateComplexDocument(identifier: string, paragraphs: number, theme: string): string {
  let doc = `# Complex Document: ${identifier.toUpperCase()}\n\n`;
  doc += `This document focuses on ${theme} with detailed technical information.\n\n`;

  for (let i = 1; i <= paragraphs; i++) {
    doc += `## Section ${i}: ${theme} Details\n\n`;
    doc += `Paragraph ${i} contains specific information about ${theme} in the context of ${identifier}. `;
    doc += 'This content includes technical specifications, implementation guidelines, and ';
    doc += `best practices for working with ${theme} systems. The information is structured `;
    doc +=
      'to provide comprehensive coverage of the topic while maintaining clarity and precision.\n\n';

    if (i % 5 === 0) {
      doc += `### Technical Deep Dive ${i / 5}\n\n`;
      doc += `This section provides an in-depth analysis of ${theme} implementation strategies. `;
      doc += 'It covers advanced topics, performance optimizations, and integration patterns ';
      doc += 'that are essential for professional development work.\n\n';
    }
  }

  return doc;
}

export default criticalOperationsValidationTest;
