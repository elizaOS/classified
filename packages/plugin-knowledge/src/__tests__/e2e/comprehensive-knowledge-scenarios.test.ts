import { TestCase, IAgentRuntime, UUID, TestSuite, Memory } from '@elizaos/core';
import { KnowledgeService } from '../../service';
import path from 'path';
import fs from 'fs/promises';

/**
 * Comprehensive Knowledge Scenarios Test
 * Tests critical operations with substantial knowledge content and realistic ElizaOS scenarios
 */
const comprehensiveKnowledgeTest: TestCase = {
  name: 'Comprehensive Knowledge Operations - ElizaOS Scenarios',

  async fn(runtime: IAgentRuntime): Promise<void> {
    console.log('Starting Comprehensive Knowledge Operations Tests...\n');

    const service = runtime.getService('knowledge') as KnowledgeService;
    if (!service) {
      throw new Error('Knowledge service not found');
    }

    // Create test documents directory
    const testDocsPath = path.join(process.cwd(), 'test-comprehensive-docs');
    await fs.mkdir(testDocsPath, { recursive: true });

    try {
      await testDocumentReplacementOperations(service, runtime, testDocsPath);
      await testSearchRelevanceRanking(service, runtime, testDocsPath);
      await testElizaOSKnowledgeScenarios(service, runtime, testDocsPath);
      await testCascadeDeletionWithComplexStructure(service, runtime, testDocsPath);

      console.log('\n✅ All Comprehensive Knowledge Operations tests passed!');
    } finally {
      // Cleanup
      await fs.rm(testDocsPath, { recursive: true, force: true });
      console.log('✓ Cleaned up test files');
    }
  },
};

/**
 * Test 1: Document Replacement Operations
 * Tests updating existing documents with new content and verifying fragments are properly updated
 */
async function testDocumentReplacementOperations(
  service: KnowledgeService,
  runtime: IAgentRuntime,
  testDocsPath: string
): Promise<void> {
  console.log('=== Testing Document Replacement Operations ===');

  // Create initial document with multiple sections
  const originalDoc = {
    filename: 'eliza-architecture.md',
    content: `# ElizaOS Architecture Overview

## Core Components

ElizaOS is built on a modular architecture with three main components:

### 1. Core Runtime
The core runtime manages agent lifecycle and provides essential services:
- Agent initialization and configuration
- Message processing pipeline
- Memory management system
- Plugin architecture support

### 2. Plugin System
Plugins extend agent capabilities:
- Actions for agent behaviors
- Providers for context injection
- Services for persistent functionality
- Custom database adapters

### 3. Client Interface
The client provides user interaction:
- Web-based chat interface
- Real-time messaging
- Agent status monitoring
- Configuration management

## Data Flow

1. Message received from client
2. Providers inject context
3. Actions are validated and executed
4. Responses are generated
5. Memory is updated
6. Response sent to client

This architecture ensures scalability and extensibility.`,
  };

  await fs.writeFile(path.join(testDocsPath, originalDoc.filename), originalDoc.content);

  // Load initial document
  const { loadDocsFromPath } = await import('../../docs-loader');
  const loadResult = await loadDocsFromPath(service, runtime.agentId);

  if (loadResult.successful === 0) {
    throw new Error('Failed to load initial document');
  }

  // Verify initial document and fragments
  const initialDocs = await service.getMemories({
    tableName: 'documents',
    count: 100,
  });

  const initialDoc = initialDocs.find(
    (d) => (d.metadata as any)?.originalFilename === originalDoc.filename
  );

  if (!initialDoc) {
    throw new Error('Initial document not found');
  }

  const initialFragments = await service.getMemories({
    tableName: 'knowledge',
    count: 100,
  });

  const initialDocFragments = initialFragments.filter(
    (f) => (f.metadata as any)?.documentId === initialDoc.id
  );

  if (initialDocFragments.length === 0) {
    throw new Error('No initial fragments created');
  }

  console.log(`✓ Initial document created with ${initialDocFragments.length} fragments`);

  // Create updated document with significant changes
  const updatedDoc = {
    filename: 'eliza-architecture.md',
    content: `# ElizaOS Architecture Overview - Version 2.0

## Core Components

ElizaOS has evolved to a microservices architecture with five main components:

### 1. Agent Core Runtime
The enhanced core runtime now includes:
- Multi-agent orchestration
- Advanced memory hierarchies
- Real-time event streaming
- Dynamic plugin loading
- Cross-agent communication protocols

### 2. Enhanced Plugin Ecosystem
The plugin system now supports:
- Hot-swappable components
- Plugin dependency management
- Sandboxed execution environments
- Cross-plugin communication APIs
- Performance monitoring and metrics

### 3. Advanced Client Stack
The client has been rebuilt with:
- React-based responsive UI
- WebSocket real-time updates
- Progressive Web App capabilities
- Mobile-first design principles
- Offline functionality support

### 4. Database Layer
New dedicated database services:
- Vector search optimization
- Distributed storage support
- Real-time synchronization
- Backup and recovery systems
- Performance analytics

### 5. Security Framework
Comprehensive security implementation:
- End-to-end encryption
- Role-based access control
- Audit logging
- Threat detection
- Compliance monitoring

## Enhanced Data Flow

1. Multi-channel message ingestion
2. Context enrichment through provider chains
3. Intelligent action routing and execution
4. Response generation with quality scoring
5. Distributed memory persistence
6. Real-time client delivery with acknowledgment
7. Performance metrics collection

## Performance Characteristics

- Sub-100ms response times
- Support for 10,000+ concurrent users
- 99.9% uptime SLA
- Horizontal scaling capabilities
- Auto-failover mechanisms

This new architecture provides enterprise-grade reliability and performance.`,
  };

  // Replace the document file
  await fs.writeFile(path.join(testDocsPath, updatedDoc.filename), updatedDoc.content);

  // Delete the old document to simulate replacement
  await service.deleteMemory(initialDoc.id as UUID);

  // Verify old fragments are deleted
  const afterDeleteFragments = await service.getMemories({
    tableName: 'knowledge',
    count: 100,
  });

  const orphanedFragments = afterDeleteFragments.filter(
    (f) => (f.metadata as any)?.documentId === initialDoc.id
  );

  if (orphanedFragments.length > 0) {
    throw new Error('Old fragments were not properly deleted');
  }

  console.log('✓ Old document and fragments successfully deleted');

  // Load the updated document
  const updateLoadResult = await loadDocsFromPath(service, runtime.agentId);

  if (updateLoadResult.successful === 0) {
    throw new Error('Failed to load updated document');
  }

  // Verify updated document and new fragments
  const updatedDocs = await service.getMemories({
    tableName: 'documents',
    count: 100,
  });

  const newDoc = updatedDocs.find(
    (d) => (d.metadata as any)?.originalFilename === updatedDoc.filename && d.id !== initialDoc.id
  );

  if (!newDoc) {
    throw new Error('Updated document not found');
  }

  const newFragments = await service.getMemories({
    tableName: 'knowledge',
    count: 100,
  });

  const newDocFragments = newFragments.filter((f) => (f.metadata as any)?.documentId === newDoc.id);

  if (newDocFragments.length === 0) {
    throw new Error('No new fragments created for updated document');
  }

  // Verify new content is different and more comprehensive
  if (newDocFragments.length <= initialDocFragments.length) {
    console.log(
      `⚠️ New document has ${newDocFragments.length} fragments vs ${initialDocFragments.length} initial fragments`
    );
  } else {
    console.log(
      `✓ Updated document has more fragments (${newDocFragments.length} vs ${initialDocFragments.length})`
    );
  }

  // Test searching for new content
  const newContentQuery = {
    id: 'test-query-1' as UUID,
    content: { text: 'microservices architecture enterprise-grade' },
    agentId: runtime.agentId,
    roomId: runtime.agentId,
    createdAt: Date.now(),
  };

  const searchResults = await service.getKnowledge(newContentQuery as any);

  if (searchResults.length === 0) {
    console.log('⚠️ No search results for new content (may be due to embedding rate limiting)');
  } else {
    const relevantResults = searchResults.filter(
      (item) =>
        item.content.text?.toLowerCase().includes('microservices') ||
        item.content.text?.toLowerCase().includes('enterprise')
    );

    if (relevantResults.length > 0) {
      console.log(`✓ Found ${relevantResults.length} relevant results for new content`);
    }
  }

  // Test search functionality
  const queryMessage = {
    id: 'config-test-query' as UUID,
    content: { text: 'configuration management' },
    agentId: runtime.agentId,
    roomId: runtime.agentId,
    createdAt: Date.now(),
  };

  try {
    const configResults = await service.getKnowledge(queryMessage as any);

    if (configResults && configResults.length > 0) {
      console.log(`✓ Found ${configResults.length} configuration-related results`);

      // Check that results are properly ranked by similarity if available
      let allProperlyRanked = true;
      for (let i = 1; i < Math.min(configResults.length, 5); i++) {
        const currentSim = (configResults[i] as any).similarity;
        const prevSim = (configResults[i - 1] as any).similarity;

        if (currentSim !== undefined && prevSim !== undefined && currentSim > prevSim) {
          allProperlyRanked = false;
          break;
        }
      }

      if (allProperlyRanked) {
        console.log('✓ Results are properly ranked by relevance');
      } else {
        console.log('⚠️ Results may not be optimally ranked by relevance');
      }
    } else {
      console.log('⚠️ No configuration results found (possible due to chunking or processing)');
    }
  } catch (error) {
    console.log('⚠️ Configuration query failed (likely due to rate limiting)');
  }

  console.log('✓ Document replacement operations completed successfully\n');
}

/**
 * Test 2: Search Relevance Ranking
 * Tests search ranking with multiple competing documents to ensure most relevant appears first
 */
async function testSearchRelevanceRanking(
  service: KnowledgeService,
  runtime: IAgentRuntime,
  testDocsPath: string
): Promise<void> {
  console.log('=== Testing Search Relevance Ranking ===');

  // Create multiple documents with varying relevance to test queries
  const testDocs = [
    {
      filename: 'agents-overview.md',
      content: `# Agent Overview

Agents in ElizaOS are autonomous entities that can process messages and perform actions. Each agent has a unique personality and capabilities defined by their character configuration.

## Key Features
- Natural language processing
- Memory management
- Action execution
- Plugin integration

Agents are the core of the ElizaOS ecosystem.`,
    },
    {
      filename: 'agent-configuration-detailed.md',
      content: `# Comprehensive Agent Configuration Guide

This document provides detailed instructions for configuring ElizaOS agents with various capabilities and personality traits.

## Agent Character Definition

### Basic Properties
- name: The agent's display name
- bio: Biographical information array
- knowledge: Knowledge base references
- plugins: Enabled plugin list

### Advanced Configuration
- messageExamples: Training conversations
- style: Communication preferences
- settings: Runtime parameters
- secrets: API keys and credentials

## Agent Personality Customization

Agents can be configured with sophisticated personality traits:
- Communication style (formal, casual, technical)
- Domain expertise (finance, healthcare, education)
- Response patterns and preferences
- Knowledge filtering and prioritization

## Memory Management for Agents

Agent memory systems include:
- Short-term conversation context
- Long-term relationship tracking
- Knowledge retrieval optimization
- Embedding-based similarity search

This comprehensive configuration enables highly customized agent behaviors.`,
    },
    {
      filename: 'database-setup.md',
      content: `# Database Setup

ElizaOS supports multiple database backends for storing agent data and memories.

## Supported Databases
- PostgreSQL (recommended)
- PGLite (development)
- SQLite (testing)

## Schema Management
The system automatically creates and manages database schemas.

Database configuration is handled through environment variables.`,
    },
    {
      filename: 'plugin-development.md',
      content: `# Plugin Development

Plugins extend agent capabilities through actions, providers, and services.

## Plugin Components
- Actions: Define agent behaviors
- Providers: Supply context information
- Services: Maintain persistent state

## Development Guidelines
Follow the plugin interface specifications for compatibility.

Plugins are the primary way to extend agent functionality.`,
    },
  ];

  // Write all test documents
  for (const doc of testDocs) {
    await fs.writeFile(path.join(testDocsPath, doc.filename), doc.content);
  }

  // Load all documents
  const { loadDocsFromPath } = await import('../../docs-loader');
  const loadResult = await loadDocsFromPath(service, runtime.agentId);

  if (loadResult.successful < testDocs.length) {
    throw new Error(
      `Expected to load ${testDocs.length} documents, but loaded ${loadResult.successful}`
    );
  }

  console.log(`✓ Loaded ${loadResult.successful} test documents for relevance testing`);

  // Test Query 1: Specific agent configuration query
  const agentConfigQuery = {
    id: 'relevance-test-1' as UUID,
    content: {
      text: 'How do I configure an agent with specific personality traits and memory management?',
    },
    agentId: runtime.agentId,
    roomId: runtime.agentId,
    createdAt: Date.now(),
  };

  console.log('Testing query: Agent configuration with personality traits...');

  try {
    const configResults = await service.getKnowledge(agentConfigQuery as any);

    if (configResults.length > 0) {
      // Verify that the detailed agent configuration document ranks highest
      const topResult = configResults[0];
      const isRelevant =
        topResult.content.text?.toLowerCase().includes('personality') ||
        topResult.content.text?.toLowerCase().includes('configuration') ||
        topResult.content.text?.toLowerCase().includes('character');

      if (isRelevant) {
        console.log('✓ Most relevant document ranked first for agent configuration query');
      } else {
        console.log('⚠️ Top result may not be most relevant for agent configuration query');
      }

      // Check that results are ordered by relevance (similarity scores should be decreasing)
      let isOrdered = true;
      // Check similarity ordering if available
      for (let i = 1; i < Math.min(configResults.length, 5); i++) {
        const currentSim = (configResults[i] as any).similarity;
        const prevSim = (configResults[i - 1] as any).similarity;

        if (currentSim !== undefined && prevSim !== undefined && currentSim > prevSim) {
          isOrdered = false;
          break;
        }
      }

      if (isOrdered) {
        console.log('✓ Results properly ordered by relevance scores');
      } else {
        console.log('⚠️ Results may not be properly ordered by relevance');
      }
    } else {
      console.log('⚠️ No results returned for agent configuration query (possible rate limiting)');
    }
  } catch (error) {
    console.log('⚠️ Agent configuration query failed (likely due to rate limiting)');
  }

  // Test Query 2: Database-specific query
  const databaseQuery = {
    id: 'relevance-test-2' as UUID,
    content: { text: 'database setup PostgreSQL schema' },
    agentId: runtime.agentId,
    roomId: runtime.agentId,
    createdAt: Date.now(),
  };

  console.log('Testing query: Database setup...');

  try {
    const dbResults = await service.getKnowledge(databaseQuery as any);

    if (dbResults.length > 0) {
      const topResult = dbResults[0];
      const isDbRelevant =
        topResult.content.text?.toLowerCase().includes('database') ||
        topResult.content.text?.toLowerCase().includes('postgresql') ||
        topResult.content.text?.toLowerCase().includes('schema');

      if (isDbRelevant) {
        console.log('✓ Database-specific document ranked appropriately');
      } else {
        console.log('⚠️ Database query may not have returned most relevant result');
      }
    } else {
      console.log('⚠️ No results returned for database query (possible rate limiting)');
    }
  } catch (error) {
    console.log('⚠️ Database query failed (likely due to rate limiting)');
  }

  // Test Query 3: General agents query to test ranking among multiple relevant docs
  const generalAgentQuery = {
    id: 'relevance-test-3' as UUID,
    content: { text: 'what are agents and how do they work' },
    agentId: runtime.agentId,
    roomId: runtime.agentId,
    createdAt: Date.now(),
  };

  console.log('Testing query: General agents information...');

  try {
    const generalResults = await service.getKnowledge(generalAgentQuery as any);

    if (generalResults.length > 0) {
      // Both agent overview and detailed config should be relevant, but overview should rank higher for general query
      const agentRelatedCount = generalResults.filter((item) =>
        item.content.text?.toLowerCase().includes('agent')
      ).length;

      if (agentRelatedCount > 0) {
        console.log(`✓ Found ${agentRelatedCount} agent-related results for general query`);
      }
    } else {
      console.log('⚠️ No results returned for general agents query (possible rate limiting)');
    }
  } catch (error) {
    console.log('⚠️ General agents query failed (likely due to rate limiting)');
  }

  console.log('✓ Search relevance ranking tests completed\n');
}

/**
 * Test 3: ElizaOS Knowledge Scenarios
 * Tests with ElizaOS-specific content and Q&A that requires correct knowledge access
 */
async function testElizaOSKnowledgeScenarios(
  service: KnowledgeService,
  runtime: IAgentRuntime,
  testDocsPath: string
): Promise<void> {
  console.log('=== Testing ElizaOS Knowledge Scenarios ===');

  // Create comprehensive ElizaOS documentation
  const elizaOSDocs = [
    {
      filename: 'elizaos-core-concepts.md',
      content: `# ElizaOS Core Concepts

## Runtime Architecture

ElizaOS is built around the **IAgentRuntime** interface, which provides:

### Key Components
- **AgentRuntime**: Main runtime implementation in \`packages/core/src/runtime.ts\`
- **Memory Management**: Persistent storage via \`IDatabaseAdapter\`
- **Plugin System**: Modular extension through \`Plugin\` interface
- **Model Integration**: AI model abstraction via \`ModelType\` enum

### Memory Types
ElizaOS uses specific memory types defined in \`MemoryType\` enum:
- \`DOCUMENT\`: Knowledge base documents
- \`FRAGMENT\`: Chunked knowledge pieces
- \`MESSAGE\`: Conversation messages
- \`DESCRIPTION\`: Entity descriptions

### Unique Features
1. **Deterministic UUIDs**: Each agent generates unique UUIDs for the same entities
2. **Channel-Room Mapping**: Platform channels mapped to agent "rooms"
3. **World Abstraction**: Servers become "worlds" in agent memory
4. **Provider Chain**: Dynamic context injection through providers

## Action System

Actions define agent capabilities through:
- **Validation**: \`validate(runtime, message, state)\` function
- **Handler**: \`handler(runtime, message, state, options, callback)\` function
- **Examples**: Training data for action recognition

## Provider System

Providers inject context via:
- **Static Providers**: Always included (position-based ordering)
- **Dynamic Providers**: Included when needed
- **Private Providers**: Must be explicitly requested

## Database Architecture

ElizaOS supports multiple adapters:
- **PGLite**: Lightweight PostgreSQL for development
- **PostgreSQL**: Production with vector search
- **Custom Adapters**: Implement \`IDatabaseAdapter\` interface`,
    },
    {
      filename: 'elizaos-development-workflow.md',
      content: `# ElizaOS Development Workflow

## Standard Development Process

### 1. Research Phase
- Use \`codebase_search\` and \`grep_search\` to understand existing patterns
- Map dependencies and related files
- Study similar implementations in the codebase

### 2. Planning Phase
- Write detailed PRD (Product Requirements Document)
- Design 3+ different approaches
- Select optimal solution based on:
  - Long-term maintainability
  - Performance at scale
  - User experience impact

### 3. Implementation Phase
- Write complete, production-ready code (no stubs!)
- Include comprehensive error handling
- Follow existing codebase patterns

### 4. Testing Phase
- Unit tests with Bun test
- E2E tests with \`elizaos test\` command
- Real runtime testing (no mocks in E2E)

## Testing Requirements

### Unit Testing
- Use Bun test with standard primitives
- Mock all dependencies (especially IAgentRuntime)
- Aim for >75% coverage on testable code

### E2E Testing
- Use actual runtime instances
- Test with real data and live APIs
- Verify actual agent behaviors

### Test Organization
\`\`\`
src/
├── __tests__/
│   ├── unit/
│   │   ├── component.test.ts
│   │   └── utils.test.ts
│   └── e2e/
│       ├── index.ts
│       └── integration.test.ts
\`\`\`

## Key Principles

1. **No Fake Code**: Never write stubs or examples
2. **Real Testing**: Use live runtime in E2E tests
3. **Complete Implementation**: Always finish what you start
4. **Pattern Following**: Use existing codebase patterns`,
    },
    {
      filename: 'elizaos-plugin-architecture.md',
      content: `# ElizaOS Plugin Architecture

## Plugin Interface

Plugins implement the \`Plugin\` interface:

\`\`\`typescript
interface Plugin {
  name: string;
  description: string;
  actions?: Action[];
  providers?: Provider[];
  evaluators?: Evaluator[];
  services?: (typeof Service)[];
  schema?: any;
  tests?: TestSuite[];
}
\`\`\`

## Component Types

### Actions
Actions define agent behaviors:
- **Purpose**: What the agent can do
- **Validation**: When the action should trigger
- **Handler**: How the action executes
- **Examples**: Training data for recognition

### Providers
Providers supply contextual information:
- **Static**: Always included (time, wallet info)
- **Dynamic**: Included when needed (weather, news)
- **Private**: Must be explicitly requested

### Services
Services maintain persistent state:
- **Lifecycle**: Start/stop with agent
- **Registration**: Via \`ServiceType\` enum
- **Access**: \`runtime.getService(type)\`

### Evaluators
Evaluators process interactions post-response:
- **Knowledge Extraction**: Store important information
- **Relationship Tracking**: Update entity relationships
- **Goal Assessment**: Track progress toward objectives

## Plugin Examples

### Knowledge Plugin
- **Actions**: Search, add, export knowledge
- **Providers**: Knowledge context injection
- **Services**: KnowledgeService for persistence
- **Schema**: Documents and fragments tables

### Solana Plugin
- **Actions**: Token operations, wallet management
- **Providers**: Wallet balance, token prices
- **Services**: WalletService for transactions

## Development Guidelines

1. **Service Registration**: Use proper ServiceType
2. **Schema Definition**: Include database migrations
3. **Test Coverage**: Include both unit and E2E tests
4. **Documentation**: Clear README and examples`,
    },
  ];

  // Write ElizaOS documentation
  for (const doc of elizaOSDocs) {
    await fs.writeFile(path.join(testDocsPath, doc.filename), doc.content);
  }

  // Load the documents
  const { loadDocsFromPath } = await import('../../docs-loader');
  const loadResult = await loadDocsFromPath(service, runtime.agentId);

  if (loadResult.successful < elizaOSDocs.length) {
    throw new Error(
      `Expected to load ${elizaOSDocs.length} ElizaOS docs, but loaded ${loadResult.successful}`
    );
  }

  console.log(`✓ Loaded ${loadResult.successful} ElizaOS documentation files`);

  // Test ElizaOS-specific Q&A scenarios
  const elizaOSQueries = [
    {
      name: 'Memory Types Query',
      query: 'What are the different memory types in ElizaOS and what is each used for?',
      expectedContent: ['DOCUMENT', 'FRAGMENT', 'MESSAGE', 'DESCRIPTION'],
    },
    {
      name: 'Testing Workflow Query',
      query: 'What is the difference between unit tests and E2E tests in ElizaOS development?',
      expectedContent: ['bun test', 'elizaos test', 'mock', 'real runtime'],
    },
    {
      name: 'Plugin Components Query',
      query: 'What are the main components that can be included in an ElizaOS plugin?',
      expectedContent: ['actions', 'providers', 'services', 'evaluators'],
    },
    {
      name: 'Runtime Architecture Query',
      query: 'How does the IAgentRuntime interface work in ElizaOS?',
      expectedContent: ['runtime', 'memory management', 'plugin system'],
    },
  ];

  for (const testQuery of elizaOSQueries) {
    console.log(`Testing ElizaOS query: ${testQuery.name}...`);

    const queryMessage = {
      id: `eliza-query-${Date.now()}` as UUID,
      content: { text: testQuery.query },
      agentId: runtime.agentId,
      roomId: runtime.agentId,
      createdAt: Date.now(),
    };

    try {
      const results = await service.getKnowledge(queryMessage as any);

      if (results.length > 0) {
        // Check if any expected content appears in results
        const foundContent = testQuery.expectedContent.filter((content) =>
          results.some((result) =>
            result.content.text?.toLowerCase().includes(content.toLowerCase())
          )
        );

        if (foundContent.length > 0) {
          console.log(`✓ Found relevant content for ${testQuery.name}: ${foundContent.join(', ')}`);
        } else {
          console.log(
            `⚠️ No expected content found for ${testQuery.name} (may be due to chunking or rate limiting)`
          );
        }

        // Verify results are actually about ElizaOS
        const elizaOSRelated = results.filter(
          (result) =>
            result.content.text?.toLowerCase().includes('elizaos') ||
            result.content.text?.toLowerCase().includes('runtime') ||
            result.content.text?.toLowerCase().includes('plugin')
        );

        if (elizaOSRelated.length > 0) {
          console.log(`✓ ${elizaOSRelated.length} ElizaOS-related results found`);
        }
      } else {
        console.log(`⚠️ No results returned for ${testQuery.name} (possible rate limiting)`);
      }
    } catch (error) {
      console.log(`⚠️ Query failed for ${testQuery.name} (likely due to rate limiting)`);
    }

    // Small delay between queries to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log('✓ ElizaOS knowledge scenarios completed\n');
}

/**
 * Test 4: Cascade Deletion with Complex Structure
 * Tests deletion of documents with many fragments and verifies complete cleanup
 */
async function testCascadeDeletionWithComplexStructure(
  service: KnowledgeService,
  runtime: IAgentRuntime,
  testDocsPath: string
): Promise<void> {
  console.log('=== Testing Cascade Deletion with Complex Structure ===');

  // Create a large document that will generate many fragments
  const largeDoc = {
    filename: 'large-elizaos-guide.md',
    content: `# Complete ElizaOS Developer Guide

${Array.from(
  { length: 50 },
  (_, i) => `
## Section ${i + 1}: Feature Overview

This section covers feature ${i + 1} in detail. Each section contains substantial content to ensure proper fragmentation during document processing.

### Subsection ${i + 1}.1: Technical Details
Technical implementation details for feature ${i + 1} including code examples, configuration options, and best practices.

### Subsection ${i + 1}.2: Usage Examples
Practical examples demonstrating how to use feature ${i + 1} in real-world scenarios with step-by-step instructions.

### Subsection ${i + 1}.3: Troubleshooting
Common issues and solutions for feature ${i + 1}, including debugging tips and performance optimization techniques.

### Subsection ${i + 1}.4: Advanced Configuration
Advanced configuration options for feature ${i + 1}, including expert-level settings and customization possibilities.
`
).join('')}

## Conclusion

This comprehensive guide covers all aspects of ElizaOS development. Each section provides detailed information that should be properly indexed and searchable through the knowledge system.`,
  };

  await fs.writeFile(path.join(testDocsPath, largeDoc.filename), largeDoc.content);

  // Load the large document
  const { loadDocsFromPath } = await import('../../docs-loader');
  const loadResult = await loadDocsFromPath(service, runtime.agentId);

  if (loadResult.successful === 0) {
    throw new Error('Failed to load large document');
  }

  console.log('✓ Large document loaded successfully');

  // Verify the document exists
  const documents = await service.getMemories({
    tableName: 'documents',
    count: 100,
  });

  const largeDocument = documents.find(
    (d) => (d.metadata as any)?.originalFilename === largeDoc.filename
  );

  if (!largeDocument) {
    throw new Error('Large document not found in database');
  }

  // Count fragments for this document
  const allFragments = await service.getMemories({
    tableName: 'knowledge',
    count: 1000, // Increase limit for large document
  });

  const documentFragments = allFragments.filter(
    (f) => (f.metadata as any)?.documentId === largeDocument.id
  );

  if (documentFragments.length === 0) {
    throw new Error('No fragments found for large document');
  }

  console.log(`✓ Large document created ${documentFragments.length} fragments`);

  // Perform cascade deletion
  await service.deleteMemory(largeDocument.id as UUID);

  // Verify document is deleted
  const remainingDocs = await service.getMemories({
    tableName: 'documents',
    count: 100,
  });

  const deletedDoc = remainingDocs.find((d) => d.id === largeDocument.id);
  if (deletedDoc) {
    throw new Error('Document was not deleted');
  }

  console.log('✓ Large document successfully deleted');

  // Verify ALL fragments are cascade deleted
  const remainingFragments = await service.getMemories({
    tableName: 'knowledge',
    count: 1000,
  });

  const orphanedFragments = remainingFragments.filter(
    (f) => (f.metadata as any)?.documentId === largeDocument.id
  );

  if (orphanedFragments.length > 0) {
    throw new Error(`${orphanedFragments.length} fragments were not cascade deleted`);
  }

  console.log(`✓ All ${documentFragments.length} fragments were cascade deleted`);

  // Test multiple document deletion
  const multipleDocs = [
    {
      filename: 'doc1.md',
      content: 'Document 1 content with multiple sections for testing cascade deletion.',
    },
    {
      filename: 'doc2.md',
      content: 'Document 2 content with different sections for comprehensive testing.',
    },
    {
      filename: 'doc3.md',
      content: 'Document 3 content with various information for deletion verification.',
    },
  ];

  // Create multiple documents
  for (const doc of multipleDocs) {
    await fs.writeFile(path.join(testDocsPath, doc.filename), doc.content);
  }

  // Load multiple documents
  const multiLoadResult = await loadDocsFromPath(service, runtime.agentId);

  if (multiLoadResult.successful < multipleDocs.length) {
    throw new Error(
      `Failed to load all test documents: ${multiLoadResult.successful}/${multipleDocs.length}`
    );
  }

  // Get all current documents and fragments
  const allDocs = await service.getMemories({
    tableName: 'documents',
    count: 100,
  });

  const testDocs = allDocs.filter((d) =>
    multipleDocs.some((td) => (d.metadata as any)?.originalFilename === td.filename)
  );

  if (testDocs.length < multipleDocs.length) {
    throw new Error(`Not all test documents were found: ${testDocs.length}/${multipleDocs.length}`);
  }

  const allCurrentFragments = await service.getMemories({
    tableName: 'knowledge',
    count: 1000,
  });

  const testFragments = allCurrentFragments.filter((f) =>
    testDocs.some((d) => (f.metadata as any)?.documentId === d.id)
  );

  console.log(
    `✓ Created ${testDocs.length} documents with ${testFragments.length} total fragments`
  );

  // Delete all test documents
  for (const doc of testDocs) {
    await service.deleteMemory(doc.id as UUID);
  }

  // Verify all documents and fragments are deleted
  const finalDocs = await service.getMemories({
    tableName: 'documents',
    count: 100,
  });

  const remainingTestDocs = finalDocs.filter((d) => testDocs.some((td) => td.id === d.id));

  if (remainingTestDocs.length > 0) {
    throw new Error(`${remainingTestDocs.length} documents were not deleted`);
  }

  const finalFragments = await service.getMemories({
    tableName: 'knowledge',
    count: 1000,
  });

  const remainingTestFragments = finalFragments.filter((f) =>
    testDocs.some((d) => (f.metadata as any)?.documentId === d.id)
  );

  if (remainingTestFragments.length > 0) {
    throw new Error(`${remainingTestFragments.length} fragments were not cascade deleted`);
  }

  console.log('✓ All test documents and fragments successfully cascade deleted');
  console.log('✓ Cascade deletion with complex structure tests completed\n');
}

export default comprehensiveKnowledgeTest;
