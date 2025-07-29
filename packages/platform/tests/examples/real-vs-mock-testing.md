# Real Runtime Testing vs Mock Testing

This document demonstrates the difference between mock-based testing and real runtime testing, showing how to convert existing mock tests to use actual ElizaOS runtime.

## The Problem with Mock Testing

### Mock Test Example (Deprecated Pattern)

```typescript
// ❌ BAD: Mock-based test that doesn't validate real functionality
import { createMockRuntime } from '@elizaos/core/test-utils';

describe('Agent Memory (Mock)', () => {
  test('should store memory', async () => {
    const mockRuntime = createMockRuntime({
      createMemory: jest.fn().mockResolvedValue('mock-memory-id'),
      getMemories: jest
        .fn()
        .mockResolvedValue([
          { id: 'mock-id', content: { text: 'mock memory' } },
        ]),
    });

    // This only tests that mocks were called, not real functionality
    await mockRuntime.createMemory(testMemory);
    expect(mockRuntime.createMemory).toHaveBeenCalled();

    const memories = await mockRuntime.getMemories({ roomId: 'test-room' });
    expect(memories).toHaveLength(1);
    expect(memories[0].content.text).toBe('mock memory');
  });
});
```

**Problems:**

- Tests mock behavior, not real agent functionality
- Doesn't catch database schema issues
- Doesn't validate actual ElizaOS integration
- False confidence - tests pass but real functionality may be broken
- Mock responses may not match real ElizaOS behavior

### Real Runtime Test Example (Recommended Pattern)

```typescript
// ✅ GOOD: Real runtime test that validates actual functionality
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { ElizaService } from '../../lib/runtime/eliza-service';
import { testCharacterConfig } from '../fixtures/test-character';
import {
  cleanupTestDatabase,
  createTestOrganization,
} from '../test-utils/database';

describe('Agent Memory (Real Runtime)', () => {
  let elizaService: ElizaService;
  let testOrgId: string;
  let testUserId: string;
  let agentId: string;

  beforeAll(async () => {
    const testOrg = await createTestOrganization('memory-test');
    testOrgId = testOrg.organizationId;
    testUserId = testOrg.userId;
    elizaService = new ElizaService();
  });

  afterAll(async () => {
    if (agentId) await elizaService.stopAgent(agentId);
    await cleanupTestDatabase(testOrgId);
  });

  test('should store and retrieve memory in real database', async () => {
    // Deploy a real ElizaOS agent
    const deployment = await elizaService.deployAgent({
      character: testCharacterConfig,
      organizationId: testOrgId,
      userId: testUserId,
    });
    agentId = deployment.info.agentId;

    // Test real memory operations
    const testMemory = {
      id: crypto.randomUUID(),
      agentId: agentId,
      entityId: testUserId,
      roomId: crypto.randomUUID(),
      content: { text: 'Real memory test' },
      embedding: [0.1, 0.2, 0.3],
      unique: false,
    };

    // This actually stores in the database
    await deployment.runtime.createMemory(testMemory);

    // This actually retrieves from the database
    const memories = await deployment.runtime.getMemories({
      roomId: testMemory.roomId,
      count: 10,
    });

    // Validates real database operations and ElizaOS integration
    expect(memories).toBeDefined();
    expect(memories.length).toBeGreaterThan(0);

    const foundMemory = memories.find(
      (m) => m.content.text === 'Real memory test',
    );
    expect(foundMemory).toBeDefined();
    expect(foundMemory.agentId).toBe(agentId);
  });
});
```

**Benefits:**

- Tests actual ElizaOS agent functionality
- Validates real database operations
- Catches integration issues between components
- Tests multi-tenant isolation
- Validates actual memory storage and retrieval
- Tests real embedding and search functionality

## Migration Guide: Converting Mock Tests to Real Runtime Tests

### Step 1: Identify Mock Dependencies

Look for these patterns in existing tests:

```typescript
// Mock imports to replace
import { createMockRuntime } from '@elizaos/core/test-utils';
import { MockService } from '../mocks/service';

// Mock function calls to replace
const mockRuntime = createMockRuntime({ ... });
const mockService = new MockService();
```

### Step 2: Replace with Real Runtime Setup

```typescript
// Replace mock imports with real utilities
import { ElizaService } from '../../lib/runtime/eliza-service';
import { testCharacterConfig } from '../fixtures/test-character';
import {
  createTestOrganization,
  cleanupTestDatabase,
} from '../test-utils/database';

// Replace mock runtime with real agent deployment
const deployment = await elizaService.deployAgent({
  character: testCharacterConfig,
  organizationId: testOrgId,
  userId: testUserId,
});
const runtime = deployment.runtime;
```

### Step 3: Update Test Assertions

```typescript
// ❌ Mock assertions (tests mock calls, not functionality)
expect(mockRuntime.createMemory).toHaveBeenCalledWith(testMemory);
expect(mockService.processMessage).toHaveBeenCalledTimes(1);

// ✅ Real assertions (tests actual functionality)
const result = await runtime.createMemory(testMemory);
expect(result).toBeDefined();

const memories = await runtime.getMemories({ roomId: testMemory.roomId });
expect(memories).toContainEqual(
  expect.objectContaining({
    content: testMemory.content,
    agentId: testMemory.agentId,
  }),
);
```

### Step 4: Add Proper Cleanup

```typescript
// Ensure test isolation and cleanup
afterAll(async () => {
  if (agentId) {
    await elizaService.stopAgent(agentId);
  }
  await cleanupTestDatabase(testOrgId);
});
```

## Common Conversion Patterns

### Pattern 1: Service Method Testing

**Before (Mock):**

```typescript
test('service processes message', async () => {
  const mockService = {
    processMessage: jest.fn().mockResolvedValue({ success: true }),
  };

  const result = await mockService.processMessage('test');
  expect(mockService.processMessage).toHaveBeenCalledWith('test');
  expect(result.success).toBe(true);
});
```

**After (Real):**

```typescript
test('service processes message', async () => {
  const service = new RealService(realDependencies);

  const result = await service.processMessage('test');
  expect(result).toBeDefined();
  expect(result.success).toBe(true);

  // Validate side effects in real database
  const logs = await getLogs(result.messageId);
  expect(logs).toContainEqual(
    expect.objectContaining({
      level: 'info',
      message: 'Message processed successfully',
    }),
  );
});
```

### Pattern 2: Database Operation Testing

**Before (Mock):**

```typescript
test('stores data in database', async () => {
  const mockDb = {
    insert: jest.fn().mockResolvedValue({ id: 'mock-id' }),
    select: jest.fn().mockResolvedValue([{ id: 'mock-id', data: 'mock' }]),
  };

  await repository.save(mockDb, testData);
  expect(mockDb.insert).toHaveBeenCalledWith(testData);
});
```

**After (Real):**

```typescript
test('stores data in database', async () => {
  const result = await repository.save(testData);
  expect(result.id).toBeDefined();

  // Verify data is actually stored
  const retrieved = await repository.findById(result.id);
  expect(retrieved).toEqual(expect.objectContaining(testData));

  // Test data isolation
  const otherOrgData = await repository.findById(result.id, otherOrgId);
  expect(otherOrgData).toBeNull();
});
```

## Performance Considerations

### Running Real Tests Efficiently

1. **Use Test Database**: Use a separate test database or in-memory database for fast execution
2. **Parallel Execution**: Run tests in parallel with proper isolation
3. **Smart Cleanup**: Only clean up data created by each test
4. **Connection Pooling**: Reuse database connections across tests

### Example Test Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // Run tests in parallel but limit concurrency for database tests
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
      },
    },

    // Setup and teardown for database tests
    globalSetup: './tests/global-setup.ts',

    // Environment variables for testing
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5433/test_db',
    },
  },
});
```

## Benefits of Real Runtime Testing

1. **Confidence**: Tests validate actual functionality, not mock behavior
2. **Integration Coverage**: Catches issues between components
3. **Database Validation**: Tests real schema, constraints, and queries
4. **Performance Insights**: Reveals actual performance characteristics
5. **Security Testing**: Validates multi-tenant isolation and security
6. **Regression Prevention**: Real tests catch more types of breaking changes

## When to Use Mocks vs Real Runtime

### Use Real Runtime Testing For:

- Integration tests
- Database operations
- Agent conversation flows
- Multi-tenant isolation
- Performance testing
- End-to-end workflows

### Use Mocks For:

- Pure unit tests of isolated functions
- Testing error conditions that are hard to reproduce
- External service dependencies (APIs, third-party services)
- Performance-critical test suites
- Testing edge cases with specific responses

## Migration Priority

1. **High Priority**: Core agent functionality, database operations, security features
2. **Medium Priority**: Plugin integrations, API endpoints, service interactions
3. **Low Priority**: Utility functions, pure logic, external dependencies

Convert the highest-impact tests first to get the most benefit from real runtime testing.
