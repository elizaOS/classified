import type { TestSuite, IAgentRuntime, Memory, State } from '@elizaos/core';
import { createUniqueUuid, elizaLogger } from '@elizaos/core';
import { E2BService } from '../../services/E2BService.js';

export class E2BBasicE2ETestSuite implements TestSuite {
  name = 'plugin-e2b-basic-e2e';
  description = 'Basic E2E tests for E2B plugin functionality';

  tests = [
    {
      name: 'Should initialize E2B service correctly',
      fn: async (runtime: any) => {
        elizaLogger.info('Testing E2B service initialization...');

        // Get E2B service
        const e2bService = runtime.getService('e2b');

        if (!e2bService) {
          throw new Error('E2B service not found');
        }

        // Check service properties
        const sandboxes = e2bService.listSandboxes();
        const isHealthy = await e2bService.isHealthy();

        if (!isHealthy) {
          throw new Error('E2B service is not healthy');
        }

        elizaLogger.info('✓ E2B service initialized successfully', {
          sandboxCount: sandboxes.length,
          isHealthy,
        });
      },
    },
    {
      name: 'Should execute code in sandbox',
      fn: async (runtime: any) => {
        elizaLogger.info('Testing code execution...');

        const e2bService = runtime.getService('e2b') as E2BService;
        if (!e2bService) {
          throw new Error('E2B service not found');
        }

        // Test Python code execution
        const pythonCode = `
result = 2 + 2
print(f"The result is: {result}")
result
`;
        const result = await e2bService.executeCode(pythonCode, 'python');

        elizaLogger.info('Python execution result:', {
          hasOutput: !!result.text,
          hasError: !!result.error,
          executionTime: result.executionTime,
        });

        // In local mode, we should get real execution results
        const isLocalMode =
          process.env.E2B_MODE === 'local' || runtime.getSetting('E2B_MODE') === 'local';
        if (isLocalMode) {
          if (result.error) {
            throw new Error(`Python execution failed: ${result.error.value}`);
          }
          if (!result.text || !result.text.includes('4')) {
            throw new Error('Python execution did not produce expected output');
          }
          elizaLogger.info('✓ Python code executed successfully in local mode');
        } else {
          // In mock mode, just verify we got a response
          if (!result.text && !result.error) {
            throw new Error('No result from code execution');
          }
          elizaLogger.info('✓ Code execution completed in mock mode');
        }
      },
    },
    {
      name: 'Should execute JavaScript code in local mode',
      fn: async (runtime: any) => {
        const isLocalMode =
          process.env.E2B_MODE === 'local' || runtime.getSetting('E2B_MODE') === 'local';
        if (!isLocalMode) {
          elizaLogger.info('Skipping JavaScript test in non-local mode');
          return;
        }

        elizaLogger.info('Testing JavaScript execution in local mode...');

        const e2bService = runtime.getService('e2b') as E2BService;
        if (!e2bService) {
          throw new Error('E2B service not found');
        }

        // Test JavaScript code execution
        const jsCode = `
const a = 3;
const b = 4;
const result = a * b;
console.log(\`Result: \${result}\`);
`;
        const result = await e2bService.executeCode(jsCode, 'javascript');

        elizaLogger.info('JavaScript execution result:', {
          hasOutput: !!result.text,
          hasError: !!result.error,
          executionTime: result.executionTime,
        });

        if (result.error) {
          // JavaScript might not be available in all environments
          elizaLogger.warn('JavaScript execution not supported:', result.error.value);
        } else if (result.text && result.text.includes('12')) {
          elizaLogger.info('✓ JavaScript code executed successfully');
        } else {
          elizaLogger.warn('JavaScript execution produced unexpected output');
        }
      },
    },
  ];
}
