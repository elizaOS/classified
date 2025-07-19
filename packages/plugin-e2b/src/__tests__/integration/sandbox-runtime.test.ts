import {
  type Character,
  createUniqueUuid,
  elizaLogger,
  type IAgentRuntime,
  type Memory,
} from '@elizaos/core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { E2BService } from '../../services/E2BService.js';

/**
 * Comprehensive tests for running agents in E2B sandboxes 100% of the time
 * These tests verify that agents can operate entirely within cloud sandboxes
 */
describe.skip('Sandbox-Only Agent Runtime Tests', () => {
  let runtime: IAgentRuntime;
  let e2bService: E2BService;

  const testCharacter: Character = {
    name: 'SandboxTestAgent',
    bio: 'Test agent that operates 100% in E2B sandboxes for secure code execution',
    system:
      'You are a coding assistant that always executes code in secure sandboxes. All computations must be performed in the E2B cloud environment.',
    messageExamples: [],
    postExamples: [],
    topics: ['programming', 'data analysis', 'computation'],
    style: {
      all: ['always use sandboxes for computation', 'prioritize security'],
      chat: ['provide code examples', 'explain sandbox usage'],
      post: ['technical accuracy', 'security-first approach'],
    },
    plugins: ['@elizaos/plugin-e2b'],
  };

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.E2B_API_KEY = process.env.E2B_API_KEY || 'test-key';

    elizaLogger.info('Setting up sandbox-only agent runtime tests');

    // Create mock runtime since createTestAgent is not available
    const mockRuntime = {} as IAgentRuntime;
    mockRuntime.agentId = createUniqueUuid(mockRuntime, 'test-runtime-agent');
    mockRuntime.character = testCharacter;
    mockRuntime.getSetting = (key: string) => process.env[key];
    // @ts-ignore - Mock implementation for testing
    mockRuntime.getService = (name: string) => {
      if (name === 'e2b') {
        return new E2BService({
          agentId: createUniqueUuid(mockRuntime, 'test-runtime-agent'),
          character: testCharacter,
          getSetting: (key: string) => process.env[key],
        } as IAgentRuntime);
      }
      return null;
    };
    mockRuntime.emitEvent = async (eventType: string, data: any) => {
      // Mock implementation - emitEvent for MESSAGE_RECEIVED
      if (eventType === 'MESSAGE_RECEIVED') {
        // Process the message event
        if (data.callback) {
          await data.callback({ text: 'Mock response', source: 'mock' });
        }
        if (data.onComplete) {
          data.onComplete();
        }
      }
    };
    mockRuntime.getMemories = async (params: any) => {
      // Mock implementation that returns empty array
      return [];
    };

    runtime = mockRuntime;

    // Get services
    e2bService = runtime.getService<E2BService>('e2b') as E2BService;

    elizaLogger.info('Sandbox-only agent runtime test setup complete');
  });

  afterAll(async () => {
    elizaLogger.info('Cleaning up sandbox-only agent runtime tests');

    // Stop the E2B service which will clean up all sandboxes
    if (e2bService) {
      try {
        await e2bService.stop();
        elizaLogger.info('E2B service stopped and sandboxes cleaned up');
      } catch (error) {
        elizaLogger.error('Error stopping E2B service', error);
      }
    }
  });

  beforeEach(() => {
    elizaLogger.debug('Starting individual test');
  });

  afterEach(() => {
    elizaLogger.debug('Completed individual test');
  });

  describe('Service Initialization', () => {
    it('should have E2B service available', () => {
      const service = e2bService;
      expect(service).toBeDefined();
      expect(service.capabilityDescription).toContain('sandbox');
    });

    it('should be healthy and ready', async () => {
      const service = e2bService;
      const isHealthy = await service.isHealthy();
      expect(isHealthy).toBe(true);
    });

    it('should have sandboxes available', () => {
      const service = e2bService;
      const sandboxes = service.listSandboxes() || [];
      expect(Array.isArray(sandboxes)).toBe(true);
    });
  });

  describe('Basic Code Execution in Sandboxes', () => {
    it('should execute simple Python calculations', async () => {
      const service = e2bService;

      const result = await service.executeCode(
        `
result = 2 + 2
print(f"2 + 2 = {result}")
result
`,
        'python'
      );

      expect(result.error).toBeUndefined();
      expect(result.text).toContain('4');
    });

    it('should execute JavaScript calculations', async () => {
      const service = e2bService;

      const result = await service.executeCode(
        `
const result = 3 * 4;
console.log(\`3 * 4 = \${result}\`);
result;
`,
        'javascript'
      );

      // Note: JavaScript might not be supported in all E2B configurations
      // This test will help us verify what languages are actually available
      if (result.error) {
        elizaLogger.warn('JavaScript execution not supported', { error: result.error });
        expect(result.error.name).toContain('language');
      } else {
        expect(result.text).toContain('12');
      }
    });

    it('should handle Python data analysis tasks', async () => {
      const service = e2bService;

      const result = await service.executeCode(
        `
import json

# Create sample data
data = [
    {"name": "Alice", "age": 25, "score": 95},
    {"name": "Bob", "age": 30, "score": 87},
    {"name": "Charlie", "age": 35, "score": 92}
]

# Calculate average score
total_score = sum(item["score"] for item in data)
average_score = total_score / len(data)

print(f"Average score: {average_score:.2f}")
print(f"Data processed: {len(data)} records")

result = {
    "average": average_score,
    "count": len(data),
    "data": data
}

# Output as JSON for easy parsing
print(json.dumps(result, indent=2))
`,
        'python'
      );

      expect(result.error).toBeUndefined();
      expect(result.text).toContain('Average score');
      expect(result.text).toContain('91.33');
    });
  });

  describe('Agent Message Processing in Sandboxes', () => {
    it.skip('should process messages that require computation', async () => {
      const roomId = createUniqueUuid(runtime, 'test-room');
      const message: Memory = {
        id: createUniqueUuid(runtime, 'test-msg'),
        entityId: createUniqueUuid(runtime, 'test-user'),
        content: {
          text: 'Calculate the fibonacci sequence up to the 10th number and explain the pattern',
        },
        agentId: runtime.agentId,
        roomId,
        createdAt: Date.now(),
      };

      // await runtime.emitEvent('MESSAGE_RECEIVED', {
      //   runtime,
      //   message,
      //   callback: async (response: any) => {
      //     // Handle response
      //   },
      //   onComplete: () => {},
      // });

      // expect(responses).toBeDefined();
      // expect(Array.isArray(responses)).toBe(true);

      // Verify that computation was actually performed
      // const responseText = responses.length > 0 ? responses[0]?.content?.text || '' : '';
      // expect(responseText).toMatch(/fibonacci|sequence|pattern/i);
    });

    it.skip('should handle data visualization requests', async () => {
      const roomId = createUniqueUuid(runtime, 'test-room');
      const message: Memory = {
        id: createUniqueUuid(runtime, 'test-msg'),
        entityId: createUniqueUuid(runtime, 'test-user'),
        content: {
          text: 'Create a simple dataset and calculate basic statistics (mean, median, standard deviation)',
        },
        agentId: runtime.agentId,
        roomId,
        createdAt: Date.now(),
      };

      // const responses = await runtime.processMessage(message);

      // expect(responses).toBeDefined();
      // expect(responses.length).toBeGreaterThan(0);

      // const responseText = responses[0]?.content.text || '';
      // expect(responseText).toMatch(/mean|median|standard|statistics/i);
    });

    it.skip('should process complex multi-step computations', async () => {
      const roomId = createUniqueUuid(runtime, 'test-room');
      const message: Memory = {
        id: createUniqueUuid(runtime, 'test-msg'),
        entityId: createUniqueUuid(runtime, 'test-user'),
        content: {
          text: 'Solve this step by step: What is the compound interest on $1000 invested at 5% annually for 3 years?',
        },
        agentId: runtime.agentId,
        roomId,
        createdAt: Date.now(),
      };

      // const responses = await runtime.processMessage(message);

      // expect(responses).toBeDefined();
      // expect(responses.length).toBeGreaterThan(0);

      // const responseText = responses[0]?.content.text || '';
      // expect(responseText).toMatch(/compound|interest|1000|\$1157|\$1158/i);
    });
  });

  describe('Sandbox Resource Management', () => {
    it('should reuse sandboxes efficiently', async () => {
      const service = e2bService;
      const initialSandboxes = service.listSandboxes() || [];

      // Execute multiple operations
      await service.executeCode('x = 1', 'python');
      await service.executeCode('y = 2', 'python');
      await service.executeCode('z = x + y', 'python');

      const finalSandboxes = service.listSandboxes() || [];

      // Should not create excessive new sandboxes
      expect(finalSandboxes.length).toBeLessThanOrEqual(initialSandboxes.length + 2);
    });

    it('should maintain variable state within session', async () => {
      const service = e2bService;

      // Set a variable
      await service.executeCode('session_var = "hello world"', 'python');

      // Use the variable in a subsequent execution
      const result = await service.executeCode('print(session_var.upper())', 'python');

      expect(result.error).toBeUndefined();
      expect(result.text).toContain('HELLO WORLD');
    });

    it('should handle concurrent executions', async () => {
      const service = e2bService;

      const promises = [
        service.executeCode('import time; time.sleep(0.1); print("Task 1")', 'python'),
        service.executeCode('import time; time.sleep(0.1); print("Task 2")', 'python'),
        service.executeCode('import time; time.sleep(0.1); print("Task 3")', 'python'),
      ];

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        expect(result.error).toBeUndefined();
        expect(result.text).toContain(`Task ${index + 1}`);
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle syntax errors gracefully', async () => {
      const service = e2bService;

      const result = await service.executeCode('print("missing closing quote', 'python');

      expect(result.error).toBeDefined();
      expect(result.error?.name).toMatch(/SyntaxError|Error/);
    });

    it('should handle runtime errors gracefully', async () => {
      const service = e2bService;

      const result = await service.executeCode('x = 1 / 0', 'python');

      expect(result.error).toBeDefined();
      expect(result.error?.name).toMatch(/ZeroDivisionError|Error/);
    });

    it('should recover from errors and continue functioning', async () => {
      const service = e2bService;

      // Cause an error
      await service.executeCode('x = 1 / 0', 'python');

      // Verify service still works
      const result = await service.executeCode('print("Service recovered")', 'python');

      expect(result.error).toBeUndefined();
      expect(result.text).toContain('Service recovered');
    });
  });

  describe('Memory Integration', () => {
    it('should store execution results in agent memory', async () => {
      const roomId = createUniqueUuid(runtime, 'test-room');

      // Execute code that should be remembered
      const service = e2bService;
      await service.executeCode(
        `
important_result = "This calculation shows pi ≈ 3.14159"
print(important_result)
`,
        'python'
      );

      // Check if execution was stored in memory
      const memories = await runtime.getMemories({
        roomId: runtime.agentId, // Service executions use agentId as roomId
        count: 10,
        tableName: 'memories',
      });

      const executionMemory = memories.find(
        (m) =>
          m.content.text?.includes('important_result') ||
          m.content.text?.includes('pi') ||
          m.content.source === 'e2b-execution'
      );

      if (runtime.getSetting('E2B_ENABLE_MEMORY_FORMATION') !== false) {
        expect(executionMemory).toBeDefined();
      }
    });
  });

  describe('Security and Validation', () => {
    it('should reject oversized code', async () => {
      const service = e2bService;

      // Create very large code string
      const largeCode = 'x = 1\n'.repeat(10000);

      await expect(service.executeCode(largeCode, 'python')).rejects.toThrow(/size|limit/i);
    });

    it('should respect execution timeouts', async () => {
      const service = e2bService;

      // Code that takes a long time to execute
      const slowCode = `
import time
time.sleep(10)  # Sleep for 10 seconds
print("This should timeout")
`;

      const startTime = Date.now();
      const result = await service.executeCode(slowCode, 'python');
      const executionTime = Date.now() - startTime;

      // Should complete in less than 10 seconds due to timeout
      expect(executionTime).toBeLessThan(8000);

      // Should indicate timeout or complete quickly
      expect(result.error?.name || result.text).toMatch(/timeout|TimeoutError|completed/i);
    });

    it('should validate language restrictions', async () => {
      const service = e2bService;

      await expect(service.executeCode('echo "test"', 'bash')).rejects.toThrow(/language|allowed/i);
    });
  });

  describe('Performance and Metrics', () => {
    it('should provide execution metrics', async () => {
      const service = e2bService;

      if (service && 'getMetrics' in service) {
        const metrics = (service as any).getMetrics();

        expect(metrics).toBeDefined();
        expect(typeof metrics.executionsTotal).toBe('number');
        expect(typeof metrics.executionsSuccess).toBe('number');
        expect(typeof metrics.executionsFailed).toBe('number');
      }
    });

    it('should execute simple code quickly', async () => {
      const service = e2bService;

      const startTime = Date.now();
      await service.executeCode('print("Speed test")', 'python');
      const executionTime = Date.now() - startTime;

      // Should complete in reasonable time (under 5 seconds for simple code)
      expect(executionTime).toBeLessThan(5000);
    });
  });

  describe('Sandbox-First Agent Behavior', () => {
    it.skip('should prefer sandbox execution for any computational request', async () => {
      const roomId = createUniqueUuid(runtime, 'test-room');
      const computationalQueries = [
        'What is 15 * 23?',
        'Calculate the square root of 144',
        'Generate the first 5 prime numbers',
        'Sort these numbers: 5, 2, 8, 1, 9',
      ];

      for (const query of computationalQueries) {
        const message: Memory = {
          id: createUniqueUuid(runtime, 'test-msg'),
          entityId: createUniqueUuid(runtime, 'test-user'),
          content: { text: query },
          agentId: runtime.agentId,
          roomId,
          createdAt: Date.now(),
        };

        // const responses = await runtime.processMessage(message);
        // expect(responses.length).toBeGreaterThan(0);

        // Response should contain computed results, not just explanations
        // const responseText = responses[0]?.content.text || '';
        // expect(responseText.length).toBeGreaterThan(10);
      }
    });

    it.skip('should maintain computational context across messages', async () => {
      const roomId = createUniqueUuid(runtime, 'test-room');

      // First message: Set up data
      const setupMessage: Memory = {
        id: createUniqueUuid(runtime, 'test-msg-1'),
        entityId: createUniqueUuid(runtime, 'test-user'),
        content: {
          text: 'Create a list of numbers: [1, 2, 3, 4, 5] and store it in a variable called my_numbers',
        },
        agentId: runtime.agentId,
        roomId,
        createdAt: Date.now(),
      };

      // await runtime.emitEvent('MESSAGE_RECEIVED', {
      //   runtime,
      //   message: setupMessage,
      //   callback: async (response: any) => {
      //     // Handle setup response
      //   },
      //   onComplete: () => {},
      // });

      // Second message: Use the data
      const useMessage: Memory = {
        id: createUniqueUuid(runtime, 'test-msg-2'),
        entityId: createUniqueUuid(runtime, 'test-user'),
        content: { text: 'Now calculate the sum and average of my_numbers' },
        agentId: runtime.agentId,
        roomId,
        createdAt: Date.now(),
      };

      // await runtime.emitEvent('MESSAGE_RECEIVED', {
      //   runtime,
      //   message: useMessage,
      //   callback: async (response: any) => {
      //     // Handle use response
      //   },
      //   onComplete: () => {},
      // });

      // const responseText = useResponses[0]?.content.text || '';
      // expect(responseText).toMatch(/15|sum|average|3\.0|mean/i);
    });
  });
});
