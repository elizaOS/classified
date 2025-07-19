/**
 * Real runtime test helper for integration testing
 * Uses actual ElizaOS runtime instead of mocks
 */

import {
  Character,
  stringToUuid,
  type Plugin,
  type UUID,
  type Memory,
  type IAgentRuntime,
  AgentRuntime,
  type IDatabaseAdapter,
} from '@elizaos/core';
import { rolodexPlugin } from '../index';

// Test character configuration
const testCharacter: Character = {
  name: 'Test Agent',
  username: 'test-agent',
  bio: ['A test agent for rolodex plugin testing'],
  system: 'You are a helpful assistant for testing the rolodex plugin.',
  settings: {
    model: 'gpt-4o-mini',
    temperature: 0.3,
  },
  plugins: ['rolodex'],
};

export interface TestRuntimeOptions {
  character?: Partial<Character>;
  plugins?: Plugin[];
  testName?: string;
}

/**
 * Creates a real runtime instance for testing
 * Note: This is only used for unit tests. E2E tests use the ElizaOS test runner
 * which properly handles plugin dependencies including SQL plugin.
 */
export async function createTestRuntime(options: TestRuntimeOptions = {}): Promise<IAgentRuntime> {
  const testName = options.testName || `rolodex-test-${Date.now()}`;

  // Set required environment variables for tests
  if (!process.env.SECRET_SALT) {
    process.env.SECRET_SALT = 'test-secret-salt-for-unit-tests-only-do-not-use-in-production';
  }

  // Merge character options
  const character: Character = {
    ...testCharacter,
    ...options.character,
    id: options.character?.id || stringToUuid(`test-agent-${testName}`),
    settings: {
      ...testCharacter.settings,
      ...options.character?.settings,
    },
  };

  // Create runtime with rolodex plugin
  // Note: For proper database support, use the E2E test framework instead
  const runtime = new AgentRuntime({
    character,
    plugins: [rolodexPlugin, ...(options.plugins || [])],
    conversationLength: 10,
  });

  // Initialize runtime
  await runtime.initialize();

  // Wait for all services to be fully initialized
  // This is important because some services might initialize asynchronously
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Verify that the rolodex service is available
  const maxRetries = 10;
  let retries = 0;
  let rolodexService: any = null;

  while (retries < maxRetries) {
    // Try both service name and type
    rolodexService = runtime.getService('rolodex') || runtime.getService('RolodexService');
    if (rolodexService) {
      console.log('[runtime-helper] Rolodex service found after', retries, 'retries');
      break;
    }
    retries++;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!rolodexService) {
    // Debug: List all available services
    console.error(
      '[runtime-helper] Available services:',
      Array.from(runtime.services?.keys() || [])
    );

    // Also check if it's available under a different name
    for (const [key, service] of runtime.services || new Map()) {
      console.error(`[runtime-helper] Service: ${key}, Type: ${service.constructor.name}`);
    }

    throw new Error('Rolodex service not available after initialization');
  }

  return runtime;
}

/**
 * Creates a test message
 */
export function createTestMessage(
  runtime: IAgentRuntime,
  text: string,
  options: {
    entityId?: UUID;
    roomId?: UUID;
  } = {}
): Memory {
  return {
    id: stringToUuid(`msg-${Date.now()}`),
    entityId: options.entityId || stringToUuid('test-user'),
    agentId: runtime.agentId,
    roomId: options.roomId || stringToUuid('test-room'),
    content: {
      text,
      source: 'test',
    },
    createdAt: Date.now(),
  };
}

/**
 * Waits for a condition to be true
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error('Condition not met within timeout');
}

/**
 * Processes a message and waits for completion
 */
export async function processMessageAndWait(
  runtime: IAgentRuntime,
  message: Memory,
  waitTime: number = 2000
): Promise<void> {
  // In ElizaOS, messages are handled differently based on the runtime implementation
  // For testing, we need to trigger the action/evaluator pipeline directly

  // First, compose the state
  const state = await runtime.composeState(message);

  // Create a callback for responses
  const responses: Memory[] = [];
  const callback = async (content: any) => {
    const response: Memory = {
      id: stringToUuid(`response-${Date.now()}`),
      entityId: runtime.agentId,
      agentId: runtime.agentId,
      roomId: message.roomId,
      content,
      createdAt: Date.now(),
    };
    responses.push(response);
    return responses;
  };

  // Process through the action pipeline
  await runtime.processActions(message, responses, state, callback);

  // Also run evaluators
  await runtime.evaluate(message, state, true, callback, responses);

  // Wait for async operations to complete
  await new Promise((resolve) => setTimeout(resolve, waitTime));
}

/**
 * Cleanup function to close database connections
 */
export async function cleanupRuntime(runtime: IAgentRuntime): Promise<void> {
  if (!runtime) {
    return;
  }

  try {
    // Stop all services if available
    if (runtime.services && runtime.services instanceof Map) {
      for (const [name, service] of runtime.services) {
        try {
          if (service && typeof service.stop === 'function') {
            await service.stop();
          }
        } catch (error) {
          console.error(`Error stopping service ${name}:`, error);
        }
      }
    }

    // Close database connection if stop method exists
    if (typeof runtime.stop === 'function') {
      await runtime.stop();
    }
  } catch (error) {
    console.error('Error during runtime cleanup:', error);
  }
}

/**
 * Test helper to get service from runtime
 */
export function getService<T>(runtime: IAgentRuntime, serviceName: string): T {
  // Try multiple possible service names
  let service =
    runtime.getService(serviceName) ||
    runtime.getService('RolodexService') ||
    runtime.getService('rolodexService');

  // If still not found, try to find by type
  if (!service && runtime.services) {
    for (const [key, svc] of runtime.services) {
      if (svc.constructor.name === 'RolodexService' || (key as string) === 'rolodex') {
        service = svc;
        break;
      }
    }
  }

  if (!service) {
    // Debug: List all available services
    console.error(
      `[getService] Service ${serviceName} not found. Available services:`,
      Array.from(runtime.services?.keys() || [])
    );
    throw new Error(`Service ${serviceName} not found`);
  }
  return service as T;
}
