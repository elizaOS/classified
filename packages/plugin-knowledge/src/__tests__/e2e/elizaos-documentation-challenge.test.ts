import { TestCase, IAgentRuntime, UUID, Memory } from '@elizaos/core';
import { KnowledgeService } from '../../service';
import type { KnowledgeSearchResult } from '../../types';
import path from 'path';
import fs from 'fs/promises';

/**
 * ElizaOS Documentation Challenge Test
 *
 * This test loads comprehensive ElizaOS documentation and performs challenging Q&A scenarios
 * to validate that the knowledge system can accurately retrieve and rank relevant information.
 *
 * Focus areas:
 * 1. Complex multi-document knowledge bases
 * 2. Detailed technical Q&A requiring specific information
 * 3. Search relevance validation
 * 4. Cross-referential knowledge queries
 */
const elizaOSDocumentationChallengeTest: TestCase = {
  name: 'ElizaOS Documentation Challenge - Complex Knowledge Retrieval',

  async fn(runtime: IAgentRuntime): Promise<void> {
    console.log('Starting ElizaOS Documentation Challenge Test...\n');

    const service = runtime.getService('knowledge') as KnowledgeService;
    if (!service) {
      throw new Error('Knowledge service not found');
    }

    // Create test documents directory
    const testDocsPath = path.join(process.cwd(), 'test-elizaos-docs');
    await fs.mkdir(testDocsPath, { recursive: true });

    try {
      await loadElizaOSDocumentation(service, runtime, testDocsPath);
      await testBasicArchitectureQueries(service, runtime);
      await testAdvancedTechnicalQueries(service, runtime);
      await testPluginDevelopmentQueries(service, runtime);
      await testTroubleshootingQueries(service, runtime);
      await testCrossReferentialQueries(service, runtime);
      await testEdgeCaseScenarios(service, runtime);

      console.log('\n✅ All ElizaOS Documentation Challenge tests passed!');
    } finally {
      // Cleanup
      await fs.rm(testDocsPath, { recursive: true, force: true });
      console.log('✓ Cleaned up test documentation files');
    }
  },
};

/**
 * Load comprehensive ElizaOS documentation covering all major aspects
 */
async function loadElizaOSDocumentation(
  service: KnowledgeService,
  runtime: IAgentRuntime,
  testDocsPath: string
): Promise<void> {
  console.log('=== Loading Comprehensive ElizaOS Documentation ===');

  const elizaOSDocs = [
    {
      filename: 'core-architecture.md',
      content: `# ElizaOS Core Architecture

## Overview
ElizaOS is built on a modular, service-oriented architecture designed for scalability and extensibility. The core system consists of several key components that work together to provide a comprehensive AI agent platform.

## Core Components

### IAgentRuntime
The \`IAgentRuntime\` interface is the heart of ElizaOS, providing:
- **Memory Management**: Persistent storage via \`IDatabaseAdapter\`
- **Plugin System**: Modular extension through \`Plugin\` interface  
- **Model Integration**: AI model abstraction via \`ModelType\` enum
- **Service Registry**: Access to specialized services
- **Event System**: Asynchronous communication between components

### Memory Architecture
ElizaOS uses a sophisticated memory system with multiple types:
- **\`MemoryType.DOCUMENT\`**: Knowledge base documents for RAG
- **\`MemoryType.FRAGMENT\`**: Chunked knowledge pieces for efficient retrieval
- **\`MemoryType.MESSAGE\`**: Conversation messages and interactions
- **\`MemoryType.DESCRIPTION\`**: Entity descriptions and metadata

### Database Abstraction
The \`IDatabaseAdapter\` interface supports multiple backends:
- **PGLite**: Lightweight PostgreSQL for development and testing
- **PostgreSQL**: Full-featured production database with vector search
- **Custom Adapters**: Extensible interface for other databases

## Unique Features

### Deterministic UUID Generation
Each agent generates unique, deterministic UUIDs for entities, ensuring consistency across:
- Multiple agent instances
- Distributed deployments
- Data synchronization

### Platform Abstraction
ElizaOS abstracts platform-specific concepts into agent-friendly terms:
- **Channels → Rooms**: Platform channels become agent "rooms"
- **Servers → Worlds**: Platform servers become agent "worlds"
- **Cross-platform consistency**: Same entities across Discord, Twitter, etc.

### Provider Chain System
Dynamic context injection through providers:
- **Static Providers**: Always included (position-based ordering)
- **Dynamic Providers**: Included when needed based on context
- **Private Providers**: Must be explicitly requested
- **Contextual Providers**: Adapt based on current state

## Service Architecture
Services provide specialized functionality:
- **Registration**: Via \`ServiceType\` enum and service discovery
- **Lifecycle**: Automatic start/stop with agent runtime
- **Dependencies**: Declarative service dependencies
- **Type Safety**: Strong typing for service interactions`,
    },
    {
      filename: 'plugin-development-guide.md',
      content: `# ElizaOS Plugin Development Guide

## Plugin Architecture

### Plugin Interface
All plugins must implement the \`Plugin\` interface:

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
  init?: (config: Record<string, string>, runtime: IAgentRuntime) => Promise<void>;
}
\`\`\`

### Component Types

#### Actions
Actions define what agents can do:
- **Purpose**: Agent capabilities and behaviors
- **Validation**: \`validate(runtime, message, state)\` determines when to trigger
- **Handler**: \`handler(runtime, message, state, options, callback)\` executes the action
- **Examples**: Training data for LLM action recognition
- **Effects**: Declare what the action provides, requires, and modifies

#### Providers
Providers inject contextual information:
- **Static**: Always included (e.g., time, wallet balance)
- **Dynamic**: Included when context suggests relevance
- **Private**: Must be explicitly requested
- **Position**: Execution order via position property

#### Services
Services maintain persistent state and functionality:
- **Lifecycle**: \`start()\` and \`stop()\` methods
- **Registration**: Unique service name and optional type
- **Dependencies**: Declare other required services
- **Configuration**: Accept and validate configuration

#### Evaluators
Post-interaction cognitive processing:
- **Knowledge Extraction**: Store important information from conversations
- **Relationship Tracking**: Update entity relationships
- **Goal Assessment**: Track progress toward objectives
- **Quality Scoring**: Evaluate interaction quality

### Development Workflow

#### 1. Plugin Setup
\`\`\`bash
# Create plugin structure
packages/my-plugin/
├── src/
│   ├── actions/
│   │   ├── providers/
│   │   ├── services/
│   │   ├── tests/
│   │   └── index.ts
│   ├── package.json
│   └── README.md
\`\`\`

#### 2. Service Development
Services must extend the base \`Service\` class:
\`\`\`typescript
export class MyService extends Service {
  static serviceType = 'MY_SERVICE';
  
  capabilityDescription = 'My service description';
  
  async stop(): Promise<void> {
    // Cleanup logic
  }
}
\`\`\`

#### 3. Action Implementation
Actions require validation and handler functions:
\`\`\`typescript
export const myAction: Action = {
  name: 'MY_ACTION',
  description: 'Action description',
  
  validate: async (runtime, message, state) => {
    // Return true if action should trigger
    return message.content.text?.includes('trigger phrase');
  },
  
  handler: async (runtime, message, state, options, callback) => {
    // Action implementation
    const result = await performAction();
    
    if (callback) {
      await callback({
        text: \`Action completed: \${result}\`,
        actions: ['MY_ACTION']
      });
    }
    
    return { success: true, result };
  }
};
\`\`\`

### Testing
Every plugin should include comprehensive tests:
- **Unit Tests**: Test individual components in isolation
- **E2E Tests**: Test with real runtime environment
- **Integration Tests**: Test interactions with other plugins

### Best Practices
1. **Service Registration**: Use proper ServiceType constants
2. **Error Handling**: Comprehensive error handling and logging
3. **Configuration**: Validate configuration in init()
4. **Dependencies**: Declare all service dependencies
5. **Documentation**: Clear README and code documentation
6. **Testing**: Maintain high test coverage`,
    },
    {
      filename: 'testing-framework.md',
      content: `# ElizaOS Testing Framework

## Overview
ElizaOS provides a comprehensive testing framework supporting both unit and end-to-end testing with real runtime environments.

## Test Types

### Unit Tests
Unit tests use Vitest with standard primitives:
- **Isolation**: Test individual components in isolation
- **Mocking**: Mock all dependencies (especially IAgentRuntime)
- **Fast Execution**: Tests should run in milliseconds
- **Coverage**: Aim for >75% coverage on testable code

### E2E Tests
E2E tests use the actual ElizaOS runtime:
- **Real Runtime**: Use live agent runtime instances
- **Real Environment**: Test with actual database and services
- **Real Data**: Use live API keys and real data
- **Integration**: Test actual agent behaviors and responses

## Test Structure

### TestSuite Interface
\`\`\`typescript
interface TestSuite {
  name: string;
  tests: TestCase[];
}

interface TestCase {
  name: string;
  fn: (runtime: IAgentRuntime) => Promise<void> | void;
}
\`\`\`

### File Organization
\`\`\`
src/
├── __tests__/
│   ├── unit/
│   │   ├── component.test.ts
│   │   └── utils.test.ts
│   └── e2e/
│       ├── index.ts
│       └── integration.test.ts
├── tests.ts                   # Test exports
└── index.ts                   # Plugin definition
\`\`\`

## Running Tests

### Commands
- **All Tests**: \`elizaos test\`
- **Component Only**: \`elizaos test component\`
- **E2E Only**: \`elizaos test e2e\`

### Unit Test Patterns
\`\`\`typescript
import { describe, it, expect, vi } from 'bun:test';
import { createMockRuntime } from '../test-utils';

describe('MyComponent', () => {
  it('should handle valid input', async () => {
    const mockRuntime = createMockRuntime();
    const result = await myComponent.process(mockRuntime, input);
    expect(result).toBeDefined();
  });
});
\`\`\`

### E2E Test Patterns
\`\`\`typescript
const testCase: TestCase = {
  name: 'Integration test',
  fn: async (runtime) => {
    const service = runtime.getService('my-service');
    const result = await service.performOperation();
    
    if (!result) {
      throw new Error('Test failed');
    }
  }
};
\`\`\`

## Best Practices

### Unit Testing
1. **Mock Everything**: Never use real services or APIs
2. **Clear Structure**: Use Arrange-Act-Assert pattern
3. **Edge Cases**: Test empty inputs, null values, errors
4. **Descriptive Names**: Test names should explain what they verify

### E2E Testing
1. **Real Environment**: Use actual runtime and services
2. **Error = Failure**: Tests pass if no errors thrown
3. **Independent Tests**: Each test should work in isolation
4. **Console Logging**: Log progress for debugging

### Common Patterns
- **Service Testing**: Test lifecycle and public methods
- **Action Testing**: Test validation and handler functions
- **Provider Testing**: Test context injection
- **Integration Testing**: Test component interactions`,
    },
    {
      filename: 'troubleshooting-guide.md',
      content: `# ElizaOS Troubleshooting Guide

## Common Issues and Solutions

### Runtime Issues

#### Agent Initialization Failures
**Problem**: Agent fails to start or initialize properly
**Symptoms**: 
- Runtime errors during startup
- Services not registering
- Database connection failures

**Solutions**:
1. Check environment variables:
   \`\`\`bash
   # Required variables
   OPENAI_API_KEY=your_key
   DATABASE_URL=your_database_url
   \`\`\`

2. Verify database schema:
   \`\`\`bash
   elizaos migrate
   \`\`\`

3. Check service dependencies:
   \`\`\`typescript
   // Ensure services are properly registered
   static dependencies = ['database', 'logger'];
   \`\`\`

#### Memory Management Issues
**Problem**: Memory consumption grows over time
**Symptoms**:
- Increasing RAM usage
- Slow response times
- Out of memory errors

**Solutions**:
1. Implement proper cleanup in services:
   \`\`\`typescript
   async stop(): Promise<void> {
     this.connections.forEach(conn => conn.close());
     this.timers.forEach(timer => clearInterval(timer));
   }
   \`\`\`

2. Use memory limits in embeddings:
   \`\`\`typescript
   const results = await runtime.searchMemories({
     count: 10, // Limit results
     match_threshold: 0.7 // Higher threshold
   });
   \`\`\`

### Plugin Development Issues

#### Service Registration Problems
**Problem**: Services not found or accessible
**Symptoms**:
- \`getService()\` returns null
- Service methods unavailable
- Dependency injection failures

**Solutions**:
1. Verify service registration:
   \`\`\`typescript
   export const myPlugin: Plugin = {
     services: [MyService], // Include service class
     // ...
   };
   \`\`\`

2. Check service name consistency:
   \`\`\`typescript
   // Must match getService('my-service')
   \`\`\`

#### Action Validation Issues
**Problem**: Actions not triggering when expected
**Symptoms**:
- Actions never execute
- Validation always returns false
- LLM doesn't recognize actions

**Solutions**:
1. Improve validation logic:
   \`\`\`typescript
   validate: async (runtime, message, state) => {
     const text = message.content.text?.toLowerCase();
     return text?.includes('keyword') || 
            text?.includes('phrase') ||
            /pattern/i.test(text || '');
   }
   \`\`\`

2. Add better examples:
   \`\`\`typescript
   examples: [
     [
       { user: 'user', content: { text: 'trigger phrase' } },
       { user: 'assistant', content: { text: 'response', actions: ['MY_ACTION'] } }
     ]
   ]
   \`\`\`

### Database Issues

#### Vector Search Problems
**Problem**: Poor search results or slow queries
**Symptoms**:
- Irrelevant search results
- Slow response times
- High CPU usage

**Solutions**:
1. Optimize embedding model:
   \`\`\`typescript
   // Use appropriate model for your use case
   TEXT_EMBEDDING_MODEL=text-embedding-3-small
   \`\`\`

2. Adjust search parameters:
   \`\`\`typescript
   const results = await runtime.searchMemories({
     match_threshold: 0.8, // Higher threshold
     count: 5, // Fewer results
   });
   \`\`\`

3. Improve chunking strategy:
   \`\`\`typescript
   const chunks = await processFragmentsSynchronously({
     targetTokens: 1000, // Smaller chunks
     overlap: 100, // Less overlap
   });
   \`\`\`

### Performance Issues

#### Slow Response Times
**Problem**: Agent takes too long to respond
**Symptoms**:
- High latency
- Timeouts
- User frustration

**Solutions**:
1. Optimize provider execution:
   \`\`\`typescript
   // Use position to control execution order
   export const provider: Provider = {
     position: 1, // Run early
     dynamic: true, // Only when needed
   };
   \`\`\`

2. Cache expensive operations:
   \`\`\`typescript
   private cache = new Map();
   
   async getExpensiveData(key: string) {
     if (this.cache.has(key)) {
       return this.cache.get(key);
     }
     
     const result = await expensiveOperation(key);
     this.cache.set(key, result);
     return result;
   }
   \`\`\`

3. Use streaming for long operations:
   \`\`\`typescript
   handler: async (runtime, message, state, options, callback) => {
     // Stream partial results
     callback({ text: 'Processing...', actions: [] });
     
     const result = await longOperation();
     
     callback({ text: \`Complete: \${result}\`, actions: ['ACTION'] });
   }
   \`\`\`

## Debugging Tools

### Logging
Use structured logging for debugging:
\`\`\`typescript
import { logger } from '@elizaos/core';

logger.info('Operation started', { userId, operation });
logger.error('Operation failed', { error: error.message, stack: error.stack });
\`\`\`

### Development Mode
Enable debug mode for verbose output:
\`\`\`bash
DEBUG=true elizaos start
\`\`\`

### Testing
Use E2E tests to reproduce issues:
\`\`\`typescript
const debugTest: TestCase = {
  name: 'Debug specific issue',
  fn: async (runtime) => {
    // Reproduce the problematic scenario
    const result = await runtime.processMessage(message);
    console.log('Debug result:', result);
  }
};
\`\`\``,
    },
    {
      filename: 'api-reference.md',
      content: `# ElizaOS API Reference

## Core Interfaces

### IAgentRuntime
The main interface for agent runtime operations.

#### Methods

##### Memory Management
\`\`\`typescript
// Create a new memory
createMemory(memory: Memory, tableName?: string): Promise<UUID>;

// Get memory by ID
getMemoryById(id: UUID): Promise<Memory | null>;

// Get multiple memories with filters
getMemories(params: {
  tableName?: string;
  roomId?: UUID;
  agentId?: UUID;
  count?: number;
  start?: number;
  end?: number;
}): Promise<Memory[]>;

// Search memories by embedding
searchMemories(params: {
  tableName: string;
  embedding: number[];
  query?: string;
  roomId?: UUID;
  agentId?: UUID;
  count?: number;
  match_threshold?: number;
}): Promise<Memory[]>;

// Update existing memory
updateMemory(memory: Memory): Promise<void>;

// Delete memory
deleteMemory(id: UUID): Promise<void>;
\`\`\`

##### Service Management
\`\`\`typescript
// Get service instance
getService<T extends Service>(name: string): T | null;

// Register new service
registerService(service: Service): void;
\`\`\`

##### Model Operations
\`\`\`typescript
// Use AI model
useModel<T extends ModelTypeName>(
  modelType: T,
  params: ModelParamsMap[T]
): Promise<ModelResultMap[T]>;

// Generate embeddings
useModel(ModelType.TEXT_EMBEDDING, {
  text: string
}): Promise<number[]>;

// Generate text
useModel(ModelType.TEXT_LARGE, {
  prompt: string,
  max_tokens?: number,
  temperature?: number
}): Promise<string>;
\`\`\`

##### Configuration
\`\`\`typescript
// Get setting value
getSetting(key: string): string | null;

// Set setting value
setSetting(key: string, value: string): Promise<void>;
\`\`\`

##### Event System
\`\`\`typescript
// Emit event
emitEvent(type: EventType, data: any): Promise<void>;

// Listen for events
onEvent(type: EventType, handler: (data: any) => void): void;
\`\`\`

### Action Interface
\`\`\`typescript
interface Action {
  name: string;
  description: string;
  similes?: string[];
  examples?: ActionExample[][];
  
  validate: (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ) => Promise<boolean>;
  
  handler: (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback,
    responses?: Memory[]
  ) => Promise<ActionResult | void>;
  
  effects?: {
    provides: string[];
    requires: string[];
    modifies: string[];
  };
}
\`\`\`

### Provider Interface
\`\`\`typescript
interface Provider {
  name: string;
  description?: string;
  dynamic?: boolean;
  position?: number;
  private?: boolean;
  
  get: (
    runtime: IAgentRuntime,
    message: Memory,
    state: State
  ) => Promise<ProviderResult>;
}

interface ProviderResult {
  values?: { [key: string]: any };
  data?: { [key: string]: any };
  text?: string;
}
\`\`\`

### Service Interface
\`\`\`typescript
abstract class Service {
  protected runtime: IAgentRuntime;
  static serviceName: string;
  static serviceType?: ServiceTypeName;
  serviceName: string;
  abstract capabilityDescription: string;
  config?: Metadata;
  
  constructor(runtime?: IAgentRuntime);
  abstract stop(): Promise<void>;
  
  static async start(runtime: IAgentRuntime): Promise<Service>;
  static async stop(runtime: IAgentRuntime): Promise<void>;
}
\`\`\`

## Memory Types

### Memory
\`\`\`typescript
interface Memory {
  id?: UUID;
  entityId: UUID;
  agentId?: UUID;
  roomId: UUID;
  worldId?: UUID;
  content: Content;
  embedding?: number[];
  createdAt?: number;
  unique?: boolean;
  similarity?: number;
  metadata?: MemoryMetadata;
}
\`\`\`

### Content
\`\`\`typescript
interface Content {
  thought?: string;
  text?: string;
  actions?: string[];
  providers?: string[];
  source?: string;
  target?: string;
  url?: string;
  inReplyTo?: UUID;
  attachments?: Media[];
  [key: string]: unknown;
}
\`\`\`

### MemoryType Enum
\`\`\`typescript
enum MemoryType {
  DOCUMENT = 'document',
  FRAGMENT = 'fragment', 
  MESSAGE = 'message',
  DESCRIPTION = 'description',
  CUSTOM = 'custom'
}
\`\`\`

## Model Types

### ModelType Constants
\`\`\`typescript
const ModelType = {
  TEXT_SMALL: 'TEXT_SMALL',
  TEXT_LARGE: 'TEXT_LARGE',
  TEXT_EMBEDDING: 'TEXT_EMBEDDING',
  TEXT_REASONING_SMALL: 'REASONING_SMALL',
  TEXT_REASONING_LARGE: 'REASONING_LARGE',
  IMAGE: 'IMAGE',
  IMAGE_DESCRIPTION: 'IMAGE_DESCRIPTION',
  TRANSCRIPTION: 'TRANSCRIPTION',
  TEXT_TO_SPEECH: 'TEXT_TO_SPEECH',
  AUDIO: 'AUDIO',
  VIDEO: 'VIDEO'
} as const;
\`\`\`

## Plugin Types

### Plugin Interface
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
  init?: (config: Record<string, string>, runtime: IAgentRuntime) => Promise<void>;
}
\`\`\`

## Error Handling

### Common Error Types
\`\`\`typescript
// Service errors
class ServiceError extends Error {
  constructor(service: string, message: string) {
    super(\`[\${service}] \${message}\`);
  }
}

// Memory errors  
class MemoryError extends Error {
  constructor(operation: string, message: string) {
    super(\`Memory \${operation}: \${message}\`);
  }
}

// Model errors
class ModelError extends Error {
  constructor(model: string, message: string) {
    super(\`Model \${model}: \${message}\`);
  }
}
\`\`\`

### Error Handling Best Practices
\`\`\`typescript
try {
  const result = await runtime.useModel(ModelType.TEXT_LARGE, params);
  return result;
} catch (error) {
  logger.error('Model call failed', { error: error.message, params });
  
  if (error instanceof ModelError) {
    // Handle model-specific errors
    return fallbackResponse;
  }
  
  throw error; // Re-throw unexpected errors
}
\`\`\``,
    },
  ];

  // Write all documentation files
  for (const doc of elizaOSDocs) {
    await fs.writeFile(path.join(testDocsPath, doc.filename), doc.content);
  }

  // Load all documents
  const { loadDocsFromPath } = await import('../../docs-loader');
  const loadResult = await loadDocsFromPath(service, runtime.agentId);

  if (loadResult.successful < elizaOSDocs.length) {
    throw new Error(
      `Expected to load ${elizaOSDocs.length} documents, but loaded ${loadResult.successful}`
    );
  }

  console.log(`✓ Loaded ${loadResult.successful} comprehensive ElizaOS documentation files`);
  console.log(
    '✓ Documentation covers: Architecture, Plugin Development, Testing, Troubleshooting, API Reference\n'
  );
}

/**
 * Test basic architecture understanding
 */
async function testBasicArchitectureQueries(
  service: KnowledgeService,
  runtime: IAgentRuntime
): Promise<void> {
  console.log('=== Testing Basic Architecture Queries ===');

  const architectureQueries = [
    {
      name: 'Core Runtime Components',
      query: 'What are the main components of the IAgentRuntime interface?',
      expectedTerms: [
        'memory management',
        'plugin system',
        'model integration',
        'service registry',
      ],
      minRelevanceScore: 0.6,
    },
    {
      name: 'Memory Types Usage',
      query: 'When should I use MemoryType.FRAGMENT vs MemoryType.DOCUMENT?',
      expectedTerms: ['fragment', 'document', 'chunked', 'knowledge'],
      minRelevanceScore: 0.5,
    },
    {
      name: 'Database Backends',
      query: 'What database backends does ElizaOS support and when should I use each?',
      expectedTerms: ['pglite', 'postgresql', 'development', 'production'],
      minRelevanceScore: 0.5,
    },
  ];

  for (const testQuery of architectureQueries) {
    await executeQuery(service, runtime, testQuery);
  }

  console.log('✓ Basic architecture queries completed\n');
}

/**
 * Test advanced technical queries requiring deep understanding
 */
async function testAdvancedTechnicalQueries(
  service: KnowledgeService,
  runtime: IAgentRuntime
): Promise<void> {
  console.log('=== Testing Advanced Technical Queries ===');

  const advancedQueries = [
    {
      name: 'UUID Generation Strategy',
      query:
        'How does ElizaOS ensure deterministic UUID generation across different agent instances?',
      expectedTerms: ['deterministic', 'uuid', 'agent', 'consistency'],
      minRelevanceScore: 0.4,
    },
    {
      name: 'Provider Execution Order',
      query: 'How does the provider chain system work and how can I control execution order?',
      expectedTerms: ['provider', 'position', 'dynamic', 'static'],
      minRelevanceScore: 0.4,
    },
    {
      name: 'Service Dependencies',
      query: 'How do I declare and manage service dependencies in ElizaOS plugins?',
      expectedTerms: ['dependencies', 'service', 'registration', 'lifecycle'],
      minRelevanceScore: 0.4,
    },
    {
      name: 'Memory Search Optimization',
      query:
        'What are the best practices for optimizing vector search performance in large knowledge bases?',
      expectedTerms: ['embedding', 'search', 'performance', 'threshold'],
      minRelevanceScore: 0.3,
    },
  ];

  for (const testQuery of advancedQueries) {
    await executeQuery(service, runtime, testQuery);
  }

  console.log('✓ Advanced technical queries completed\n');
}

/**
 * Test plugin development specific queries
 */
async function testPluginDevelopmentQueries(
  service: KnowledgeService,
  runtime: IAgentRuntime
): Promise<void> {
  console.log('=== Testing Plugin Development Queries ===');

  const pluginQueries = [
    {
      name: 'Action Implementation',
      query: 'How do I implement an action with proper validation and handler functions?',
      expectedTerms: ['action', 'validate', 'handler', 'callback'],
      minRelevanceScore: 0.5,
    },
    {
      name: 'Service Base Class',
      query: 'What methods must I implement when extending the Service base class?',
      expectedTerms: ['service', 'extend', 'stop', 'capability'],
      minRelevanceScore: 0.4,
    },
    {
      name: 'Evaluator Purpose',
      query: 'What are evaluators used for and when should I implement one?',
      expectedTerms: ['evaluator', 'knowledge', 'relationship', 'quality'],
      minRelevanceScore: 0.4,
    },
    {
      name: 'Testing Strategy',
      query: 'What is the difference between unit tests and E2E tests in ElizaOS?',
      expectedTerms: ['unit', 'e2e', 'mock', 'runtime'],
      minRelevanceScore: 0.5,
    },
  ];

  for (const testQuery of pluginQueries) {
    await executeQuery(service, runtime, testQuery);
  }

  console.log('✓ Plugin development queries completed\n');
}

/**
 * Test troubleshooting and debugging queries
 */
async function testTroubleshootingQueries(
  service: KnowledgeService,
  runtime: IAgentRuntime
): Promise<void> {
  console.log('=== Testing Troubleshooting Queries ===');

  const troubleshootingQueries = [
    {
      name: 'Service Registration Issues',
      query: 'My service is not found when I call getService(), what could be wrong?',
      expectedTerms: ['service', 'registration', 'getservice', 'null'],
      minRelevanceScore: 0.4,
    },
    {
      name: 'Action Not Triggering',
      query: 'My action validation is never returning true, how can I debug this?',
      expectedTerms: ['action', 'validation', 'trigger', 'examples'],
      minRelevanceScore: 0.4,
    },
    {
      name: 'Memory Issues',
      query: 'My agent is consuming too much memory over time, what should I check?',
      expectedTerms: ['memory', 'cleanup', 'stop', 'connections'],
      minRelevanceScore: 0.3,
    },
    {
      name: 'Slow Response Times',
      query: 'How can I optimize my agent to respond faster to user messages?',
      expectedTerms: ['performance', 'provider', 'cache', 'streaming'],
      minRelevanceScore: 0.3,
    },
  ];

  for (const testQuery of troubleshootingQueries) {
    await executeQuery(service, runtime, testQuery);
  }

  console.log('✓ Troubleshooting queries completed\n');
}

/**
 * Test cross-referential queries that require connecting information across documents
 */
async function testCrossReferentialQueries(
  service: KnowledgeService,
  runtime: IAgentRuntime
): Promise<void> {
  console.log('=== Testing Cross-Referential Queries ===');

  const crossRefQueries = [
    {
      name: 'Plugin Testing Integration',
      query: 'How do I create a plugin with proper testing that covers both actions and services?',
      expectedTerms: ['plugin', 'testing', 'action', 'service', 'unit', 'e2e'],
      minRelevanceScore: 0.3,
    },
    {
      name: 'Memory and Service Integration',
      query: 'How do services interact with the memory system for storing and retrieving data?',
      expectedTerms: ['service', 'memory', 'runtime', 'creatememory', 'getmemories'],
      minRelevanceScore: 0.3,
    },
    {
      name: 'Plugin Architecture Best Practices',
      query:
        'What are the architectural best practices for developing a complex plugin with multiple services?',
      expectedTerms: ['plugin', 'architecture', 'service', 'dependencies', 'best practices'],
      minRelevanceScore: 0.3,
    },
  ];

  for (const testQuery of crossRefQueries) {
    await executeQuery(service, runtime, testQuery);
  }

  console.log('✓ Cross-referential queries completed\n');
}

/**
 * Test edge case scenarios and complex queries
 */
async function testEdgeCaseScenarios(
  service: KnowledgeService,
  runtime: IAgentRuntime
): Promise<void> {
  console.log('=== Testing Edge Case Scenarios ===');

  const edgeCaseQueries = [
    {
      name: 'Very Specific Technical Detail',
      query: 'What is the exact interface signature for the validate function in an Action?',
      expectedTerms: ['validate', 'runtime', 'message', 'state', 'boolean'],
      minRelevanceScore: 0.3,
    },
    {
      name: 'Configuration Parameter',
      query: 'How do I set match_threshold when searching memories with embeddings?',
      expectedTerms: ['match_threshold', 'searchmemories', 'embedding'],
      minRelevanceScore: 0.3,
    },
    {
      name: 'Error Handling Pattern',
      query: 'What is the recommended way to handle ModelError exceptions?',
      expectedTerms: ['modelerror', 'error', 'handling', 'fallback'],
      minRelevanceScore: 0.3,
    },
  ];

  for (const testQuery of edgeCaseQueries) {
    await executeQuery(service, runtime, testQuery);
  }

  console.log('✓ Edge case scenarios completed\n');
}

/**
 * Execute a single query and validate results
 */
async function executeQuery(
  service: KnowledgeService,
  runtime: IAgentRuntime,
  testQuery: {
    name: string;
    query: string;
    expectedTerms: string[];
    minRelevanceScore: number;
  }
): Promise<void> {
  console.log(`Testing: ${testQuery.name}...`);

  const queryMessage = {
    id: `query-${Date.now()}` as UUID,
    content: { text: testQuery.query },
    agentId: runtime.agentId,
    roomId: runtime.agentId,
    entityId: runtime.agentId,
    createdAt: Date.now(),
  };

  try {
    const results = await service.getKnowledge(queryMessage as any);

    if (results.length === 0) {
      console.log(`⚠️ No results for: ${testQuery.name}`);
      return;
    }

    // Check relevance of top result
    const topResult = results[0] as KnowledgeSearchResult;
    const hasGoodRelevance = (topResult.similarity || 0) >= testQuery.minRelevanceScore;

    // Check if expected terms are present in results
    const resultText = results
      .slice(0, 3) // Check top 3 results
      .map((r) => r.content.text || '')
      .join(' ')
      .toLowerCase();

    const foundTerms = testQuery.expectedTerms.filter((term) =>
      resultText.includes(term.toLowerCase())
    );

    const termCoverage = foundTerms.length / testQuery.expectedTerms.length;

    if (hasGoodRelevance && termCoverage >= 0.5) {
      console.log(
        `✓ ${testQuery.name}: Found ${foundTerms.length}/${testQuery.expectedTerms.length} expected terms, relevance: ${(topResult.similarity || 0).toFixed(3)}`
      );
    } else if (termCoverage >= 0.3) {
      console.log(
        `⚠️ ${testQuery.name}: Partial match (${foundTerms.length}/${testQuery.expectedTerms.length} terms), relevance: ${(topResult.similarity || 0).toFixed(3)}`
      );
    } else {
      console.log(
        `❌ ${testQuery.name}: Poor match (${foundTerms.length}/${testQuery.expectedTerms.length} terms), relevance: ${(topResult.similarity || 0).toFixed(3)}`
      );
    }

    // Small delay to avoid overwhelming the system
    await new Promise((resolve) => setTimeout(resolve, 50));
  } catch (error) {
    console.log(
      `❌ ${testQuery.name}: Query failed - ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export default elizaOSDocumentationChallengeTest;
