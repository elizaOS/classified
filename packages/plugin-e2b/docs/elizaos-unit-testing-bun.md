# ElizaOS Unit Testing with Bun

This guide explains how to write effective unit tests for ElizaOS components
using Bun's built-in test runner.

## Overview

ElizaOS unit tests focus on testing individual components in isolation:

- Test single functions, actions, providers, or services
- Use mocks for all dependencies (especially `IAgentRuntime`)
- Run via `bun test` command
- Aim for >75% code coverage on testable components
- Ensure all tests pass before considering work complete

## Key Differences from E2E Tests

| Unit Tests        | E2E Tests         |
| ----------------- | ----------------- |
| Mock the runtime  | Use real runtime  |
| Test in isolation | Test integration  |
| Fast execution    | Slower execution  |
| No side effects   | Real side effects |
| Bun test runner   | Runtime instance  |

## Test Structure

### File Organization

```
packages/my-plugin/
├── src/
│   ├── __tests__/
│   │   ├── actions/
│   │   │   └── my-action.test.ts
│   │   ├── providers/
│   │   │   └── my-provider.test.ts
│   │   ├── services/
│   │   │   └── my-service.test.ts
│   │   └── test-utils.ts         # Shared mock utilities
│   ├── actions/
│   │   └── my-action.ts
│   ├── providers/
│   │   └── my-provider.ts
│   └── index.ts
```

### Basic Test Template

```typescript
import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { myComponent } from '../my-component';
import { createMockRuntime } from '../test-utils';

describe('MyComponent', () => {
  let mockRuntime: any;

  beforeEach(() => {
    // Reset mocks before each test
    mockRuntime = createMockRuntime();
  });

  test('should handle valid input correctly', async () => {
    // Arrange
    const input = { text: 'valid input' };

    // Act
    const result = await myComponent.process(mockRuntime, input);

    // Assert
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  test('should handle errors gracefully', async () => {
    // Arrange
    const input = { text: '' };

    // Act & Assert
    expect(async () => {
      await myComponent.process(mockRuntime, input);
    }).toThrow('Input cannot be empty');
  });
});
```

## Creating Mock Runtime

The most critical part of unit testing is mocking the `IAgentRuntime`. Create a
reusable mock factory:

```typescript
// src/__tests__/test-utils.ts
import { mock } from 'bun:test';
import type { IAgentRuntime, Memory, State } from '@elizaos/core';

export function createMockRuntime(
  overrides: Partial<IAgentRuntime> = {}
): IAgentRuntime {
  return {
    // Core properties
    agentId: 'test-agent-id',
    character: {
      name: 'TestAgent',
      bio: ['Test bio'],
      system: 'Test system prompt',
      messageExamples: [],
      postExamples: [],
      topics: [],
      knowledge: [],
      plugins: [],
    },

    // Settings
    getSetting: mock((key: string) => {
      const settings: Record<string, string> = {
        API_KEY: 'test-api-key',
        SECRET_KEY: 'test-secret',
        ...overrides.settings,
      };
      return settings[key];
    }),

    // Services
    getService: mock((name: string) => {
      const services: Record<string, any> = {
        'test-service': {
          start: mock(),
          stop: mock(),
          doSomething: mock(() => Promise.resolve('service result')),
        },
        ...overrides.services,
      };
      return services[name];
    }),

    // Model/LLM
    useModel: mock(() => Promise.resolve('mock model response')),
    generateText: mock(() => Promise.resolve('generated text')),

    // Memory operations
    messageManager: {
      createMemory: mock(() => Promise.resolve(true)),
      getMemories: mock(() => Promise.resolve([])),
      updateMemory: mock(() => Promise.resolve(true)),
      deleteMemory: mock(() => Promise.resolve(true)),
      searchMemories: mock(() => Promise.resolve([])),
      getLastMessages: mock(() => Promise.resolve([])),
    },

    // State
    composeState: mock(() =>
      Promise.resolve({
        values: {},
        data: {},
        text: '',
      })
    ),
    updateState: mock(() => Promise.resolve(true)),

    // Actions & Providers
    actions: [],
    providers: [],
    evaluators: [],

    // Components
    createComponent: mock(() => Promise.resolve(true)),
    getComponents: mock(() => Promise.resolve([])),
    updateComponent: mock(() => Promise.resolve(true)),

    // Database
    db: {
      query: mock(() => Promise.resolve([])),
      execute: mock(() => Promise.resolve({ changes: 1 })),
      getWorlds: mock(() => Promise.resolve([])),
      getWorld: mock(() => Promise.resolve(null)),
    },

    // Logging
    logger: {
      info: mock(),
      warn: mock(),
      error: mock(),
      debug: mock(),
    },

    // Apply any overrides
    ...overrides,
  } as unknown as IAgentRuntime;
}

// Helper to create mock memory objects
export function createMockMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'test-memory-id',
    entityId: 'test-entity-id',
    roomId: 'test-room-id',
    agentId: 'test-agent-id',
    content: {
      text: 'test message',
      source: 'test',
    },
    createdAt: Date.now(),
    ...overrides,
  } as Memory;
}

// Helper to create mock state
export function createMockState(overrides: Partial<State> = {}): State {
  return {
    values: {},
    data: {},
    text: '',
    ...overrides,
  } as State;
}
```

## Testing Patterns

### Testing Actions

```typescript
// src/actions/__tests__/my-action.test.ts
import { describe, test, expect, mock } from 'bun:test';
import { myAction } from '../my-action';
import {
  createMockRuntime,
  createMockMemory,
  createMockState,
} from '../../__tests__/test-utils';

describe('MyAction', () => {
  describe('validate', () => {
    test('should return true when all requirements are met', async () => {
      const mockRuntime = createMockRuntime({
        getService: mock().mockReturnValue({ isReady: true }),
      });
      const mockMessage = createMockMemory();

      const isValid = await myAction.validate(mockRuntime, mockMessage);

      expect(isValid).toBe(true);
    });

    test('should return false when service is not available', async () => {
      const mockRuntime = createMockRuntime({
        getService: mock().mockReturnValue(null),
      });
      const mockMessage = createMockMemory();

      const isValid = await myAction.validate(mockRuntime, mockMessage);

      expect(isValid).toBe(false);
    });
  });

  describe('handler', () => {
    test('should process message and return response', async () => {
      const mockRuntime = createMockRuntime();
      const mockMessage = createMockMemory({
        content: { text: 'do something', source: 'test' },
      });
      const mockState = createMockState();
      const mockCallback = mock();

      const result = await myAction.handler(
        mockRuntime,
        mockMessage,
        mockState,
        {},
        mockCallback
      );

      expect(result).toBeDefined();
      expect(result.text).toContain('success');
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.any(String),
          actions: expect.arrayContaining(['MY_ACTION']),
        })
      );
    });

    test('should handle errors gracefully', async () => {
      const mockRuntime = createMockRuntime({
        getService: mock().mockImplementation(() => {
          throw new Error('Service error');
        }),
      });
      const mockMessage = createMockMemory();
      const mockState = createMockState();

      expect(async () => {
        await myAction.handler(mockRuntime, mockMessage, mockState);
      }).toThrow('Service error');
    });
  });
});
```

### Testing Providers

```typescript
// src/providers/__tests__/my-provider.test.ts
import { describe, test, expect, mock } from 'bun:test';
import { myProvider } from '../my-provider';
import {
  createMockRuntime,
  createMockMemory,
  createMockState,
} from '../../__tests__/test-utils';

describe('MyProvider', () => {
  test('should provide context information', async () => {
    const mockRuntime = createMockRuntime({
      getSetting: mock().mockReturnValue('test-value'),
    });
    const mockMessage = createMockMemory();
    const mockState = createMockState();

    const result = await myProvider.get(mockRuntime, mockMessage, mockState);

    expect(result).toBeDefined();
    expect(result.text).toContain('Provider context');
    expect(result.values).toHaveProperty('setting', 'test-value');
  });

  test('should handle missing configuration', async () => {
    const mockRuntime = createMockRuntime({
      getSetting: mock().mockReturnValue(null),
    });
    const mockMessage = createMockMemory();
    const mockState = createMockState();

    const result = await myProvider.get(mockRuntime, mockMessage, mockState);

    expect(result.text).toContain('not configured');
  });
});
```

### Testing Services

```typescript
// src/services/__tests__/my-service.test.ts
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { MyService } from '../my-service';
import { createMockRuntime } from '../../__tests__/test-utils';

describe('MyService', () => {
  let service: MyService;
  let mockRuntime: any;

  beforeEach(() => {
    mockRuntime = createMockRuntime();
    service = new MyService(mockRuntime);
  });

  describe('start', () => {
    test('should initialize successfully', async () => {
      await service.start();

      expect(service.isReady()).toBe(true);
      expect(mockRuntime.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Service started')
      );
    });

    test('should handle initialization errors', async () => {
      mockRuntime.getSetting.mockReturnValue(null);

      expect(async () => {
        await service.start();
      }).toThrow('Missing configuration');
    });
  });

  describe('operations', () => {
    beforeEach(async () => {
      await service.start();
    });

    test('should perform operation successfully', async () => {
      const result = await service.performOperation('test-input');

      expect(result).toBe('expected-output');
      expect(mockRuntime.logger.debug).toHaveBeenCalled();
    });

    test('should validate input before processing', async () => {
      expect(async () => {
        await service.performOperation('');
      }).toThrow('Invalid input');
    });
  });

  describe('stop', () => {
    test('should clean up resources', async () => {
      await service.start();
      await service.stop();

      expect(service.isReady()).toBe(false);
      expect(mockRuntime.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Service stopped')
      );
    });
  });
});
```

### Testing Utility Functions

```typescript
// src/utils/__tests__/helpers.test.ts
import { describe, test, expect } from 'bun:test';
import { formatMessage, validateInput, parseResponse } from '../helpers';

describe('Utility Functions', () => {
  describe('formatMessage', () => {
    test('should format message correctly', () => {
      const input = { text: 'hello', user: 'test' };
      const result = formatMessage(input);

      expect(result).toBe('[test]: hello');
    });

    test('should handle empty text', () => {
      const input = { text: '', user: 'test' };
      const result = formatMessage(input);

      expect(result).toBe('[test]: <empty message>');
    });
  });

  describe('validateInput', () => {
    test('should accept valid input', () => {
      expect(validateInput('valid input')).toBe(true);
    });

    test('should reject invalid input', () => {
      expect(validateInput('')).toBe(false);
      expect(validateInput(null)).toBe(false);
      expect(validateInput(undefined)).toBe(false);
    });
  });
});
```

## Running Tests

### Commands

```bash
# Run all tests (unit and E2E)
bun test

# Run tests with coverage
bun test --coverage

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test src/__tests__/my-test.test.ts

# Run tests matching a pattern
bun test --test-name-pattern="should handle"
```

### Coverage Requirements

Aim for >75% coverage on testable code:

- Actions: Test both `validate` and `handler`
- Providers: Test the `get` method
- Services: Test lifecycle and public methods
- Utilities: Test all exported functions

## Best Practices

1. **Isolation**: Each test should be completely independent
2. **Clear Structure**: Use Arrange-Act-Assert pattern
3. **Mock Everything**: Never use real services, databases, or APIs
4. **Test Edge Cases**: Empty inputs, null values, errors
5. **Descriptive Names**: Test names should explain what they verify
6. **Fast Execution**: Unit tests should run in milliseconds
7. **Coverage Goals**: Maintain >75% coverage on testable code
8. **Pass Before Proceeding**: All tests must pass before moving on

## Common Patterns

### Mocking Async Operations

```typescript
// Mock a service that returns promises
const mockService = {
  fetchData: mock(() => Promise.resolve({ data: 'test' })),
  saveData: mock(() => Promise.resolve(true)),
  // Simulate errors
  failingMethod: mock(() => Promise.reject(new Error('API Error'))),
};
```

### Testing Error Scenarios

```typescript
test('should handle network errors', async () => {
  const mockRuntime = createMockRuntime({
    useModel: mock(() => Promise.reject(new Error('Network error'))),
  });

  expect(async () => {
    await myAction.handler(mockRuntime, message, state);
  }).toThrow('Network error');
});
```

### Spying on Method Calls

```typescript
test('should call logger with correct parameters', async () => {
  const mockRuntime = createMockRuntime();

  await myComponent.process(mockRuntime, input);

  expect(mockRuntime.logger.info).toHaveBeenCalledWith('Processing started', {
    input,
  });
  expect(mockRuntime.logger.info).toHaveBeenCalledTimes(2);
});
```

### Testing with Different Runtime Configurations

```typescript
const testCases = [
  { setting: 'MODE', value: 'production', expected: 'strict' },
  { setting: 'MODE', value: 'development', expected: 'relaxed' },
];

testCases.forEach(({ setting, value, expected }) => {
  test(`should handle ${value} mode correctly`, async () => {
    const mockRuntime = createMockRuntime({
      getSetting: mock((key) => (key === setting ? value : null)),
    });

    const result = await myComponent.getMode(mockRuntime);
    expect(result).toBe(expected);
  });
});
```

## Debugging Tests

### Useful Bun Features

```typescript
// Skip a test temporarily
test.skip('should do something', async () => {
  // Test implementation
});

// Run only this test
test.only('should focus on this', async () => {
  // Test implementation
});

// Add console logs for debugging
test('should debug something', async () => {
  console.log('Input:', input);
  const result = await myComponent.process(input);
  console.log('Result:', result);
  expect(result).toBeDefined();
});

// Set a timeout for long-running tests
test(
  'should handle long operation',
  async () => {
    // Test implementation
  },
  { timeout: 10000 }
); // 10 seconds
```

## Mocking with Bun

Bun provides built-in mocking utilities:

```typescript
import { mock, spyOn } from 'bun:test';

// Create a mock function
const mockFn = mock((x: number) => x * 2);

// Use the mock
mockFn(5); // returns 10

// Check calls
expect(mockFn).toHaveBeenCalledWith(5);
expect(mockFn).toHaveBeenCalledTimes(1);

// Mock return values
mockFn.mockReturnValue(42);
mockFn.mockReturnValueOnce(100);
mockFn.mockResolvedValue(Promise.resolve(200));

// Reset mocks
mockFn.mockReset();
mockFn.mockClear();

// Spy on existing functions
const obj = {
  method: (x: number) => x + 1,
};

const spy = spyOn(obj, 'method');
obj.method(5); // returns 6
expect(spy).toHaveBeenCalledWith(5);
```

## Summary

Unit testing in ElizaOS ensures individual components work correctly in
isolation. By using Bun's built-in test runner, creating comprehensive mocks,
and following these patterns, you can build a robust test suite that catches
bugs early and maintains code quality.

Remember:

- **Always use `bun test`** for running tests
- **Mock everything** - no real dependencies in unit tests
- **Aim for >75% coverage** on testable code
- **All tests must pass** before considering work complete
- **Use Bun's built-in mocking** utilities for cleaner tests
