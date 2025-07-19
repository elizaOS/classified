import {
  type IAgentRuntime,
  type Plugin,
  type Character,
  type UUID,
  AgentRuntime,
  ModelType,
  logger,
  asUUID,
} from '@elizaos/core';
import { selfModificationPlugin } from '../../index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * REAL RUNTIME TEST INFRASTRUCTURE
 *
 * This creates actual ElizaOS runtime instances with real database,
 * real LLM integration, and real plugin registration - NO MOCKS!
 */

export interface RealRuntimeTestConfig {
  useRealLLM?: boolean;
  apiKeys?: {
    OPENAI_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
  };
  databaseUrl?: string;
  characterOverrides?: Partial<Character>;
}

/**
 * Create a real ElizaOS runtime for testing
 * This is NOT a mock - it's a real runtime instance
 */
export async function createRealTestRuntime(
  config: RealRuntimeTestConfig = {}
): Promise<IAgentRuntime> {
  // Create test character
  const testCharacter: Character = {
    id: asUUID(uuidv4()),
    name: 'TestAgent',
    bio: ['Test AI assistant for real runtime validation'],
    topics: ['testing', 'validation'],
    system: 'You are a helpful test assistant designed to validate self-modification capabilities.',
    messageExamples: [
      [
        { name: 'User', content: { text: 'Hello' } },
        { name: 'TestAgent', content: { text: 'Hello! I am ready for testing.' } },
      ],
    ],
    style: {
      chat: ['Professional testing responses'],
      all: ['Maintain testing focus'],
    },
    plugins: ['@elizaos/plugin-sql', '@elizaos/plugin-personality'],
    settings: {
      ...config.apiKeys,
    },
    ...config.characterOverrides,
  };

  // Create real runtime instance
  const runtime = new AgentRuntime({
    character: testCharacter,
    agentId: asUUID(uuidv4()),
  });

  // Initialize runtime
  await runtime.initialize();

  logger.info('Real test runtime created', {
    agentId: runtime.agentId,
    characterName: runtime.character.name,
    servicesCount: runtime.services.size,
    actionsCount: runtime.actions.length,
    providersCount: runtime.providers.length,
    evaluatorsCount: runtime.evaluators.length,
  });

  return runtime;
}

/**
 * Test runner for real runtime integration tests
 */
export class RealRuntimeTestRunner {
  private runtime: IAgentRuntime | null = null;

  async setup(config: RealRuntimeTestConfig = {}) {
    this.runtime = await createRealTestRuntime(config);
  }

  async teardown() {
    if (this.runtime) {
      // Clean up runtime resources
      for (const service of this.runtime.services.values()) {
        await service.stop();
      }
      this.runtime = null;
    }
  }

  getRuntime(): IAgentRuntime {
    if (!this.runtime) {
      throw new Error('Runtime not initialized. Call setup() first.');
    }
    return this.runtime;
  }

  /**
   * Execute a test with real runtime
   */
  async runTest(
    testName: string,
    testFn: (runtime: IAgentRuntime) => Promise<void>,
    config?: RealRuntimeTestConfig
  ): Promise<{ success: boolean; error?: Error; duration: number }> {
    const startTime = Date.now();

    try {
      if (config) {
        await this.setup(config);
      }

      if (!this.runtime) {
        throw new Error('Runtime not available for test execution');
      }

      logger.info(`Starting real runtime test: ${testName}`);
      await testFn(this.runtime);

      const duration = Date.now() - startTime;
      logger.info(`Real runtime test passed: ${testName}`, { duration });

      return { success: true, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Real runtime test failed: ${testName}`, { error, duration });

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        duration,
      };
    }
  }
}

/**
 * Utilities for real runtime testing
 */
export class RealRuntimeTestUtils {
  static async createTestMessage(
    runtime: IAgentRuntime,
    text: string,
    entityId?: string,
    roomId?: string
  ) {
    const message = {
      id: asUUID(uuidv4()),
      entityId: asUUID(entityId || uuidv4()),
      roomId: asUUID(roomId || uuidv4()),
      agentId: runtime.agentId,
      content: {
        text,
        source: 'test',
      },
      createdAt: Date.now(),
    };

    // Store in real memory
    await runtime.createMemory(message, 'messages');
    return message;
  }

  static async validateCharacterModification(
    runtime: IAgentRuntime,
    expectedChanges: {
      bioContains?: string[];
      topicsContains?: string[];
    }
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const character = runtime.character;

    if (expectedChanges.bioContains) {
      const bioText = Array.isArray(character.bio)
        ? character.bio.join(' ').toLowerCase()
        : (character.bio || '').toLowerCase();

      for (const expected of expectedChanges.bioContains) {
        if (!bioText.includes(expected.toLowerCase())) {
          errors.push(`Bio does not contain expected text: "${expected}"`);
        }
      }
    }

    if (expectedChanges.topicsContains) {
      const topics = character.topics || [];
      for (const expected of expectedChanges.topicsContains) {
        if (!topics.some((topic) => topic.toLowerCase().includes(expected.toLowerCase()))) {
          errors.push(`Topics do not contain expected topic: "${expected}"`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static async executeActionWithRealRuntime(
    runtime: IAgentRuntime,
    actionName: string,
    message: any,
    state?: any
  ): Promise<{
    success: boolean;
    result?: any;
    response?: any;
    error?: string;
  }> {
    const action = runtime.actions.find((a) => a.name === actionName);
    if (!action) {
      return { success: false, error: `Action ${actionName} not found` };
    }

    try {
      // Validate action
      const isValid = await action.validate(runtime, message, state);
      if (!isValid) {
        return { success: false, error: 'Action validation failed' };
      }

      // Execute action with real callback
      let response: any = null;
      const callback = async (content: any) => {
        response = content;
        return [];
      };

      const result = await action.handler(runtime, message, state, {}, callback);

      return {
        success: true,
        result,
        response,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  static async waitForMemoryCreation(
    runtime: IAgentRuntime,
    tableName: string,
    roomId: string,
    timeout: number = 5000
  ): Promise<any[]> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const memories = await runtime.getMemories({
        roomId: asUUID(roomId),
        tableName,
        count: 10,
      });

      if (memories.length > 0) {
        return memories;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`No memories created in table ${tableName} within ${timeout}ms`);
  }
}
