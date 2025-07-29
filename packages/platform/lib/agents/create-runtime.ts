/**
 * Agent Runtime Creation
 * Creates and configures agent runtimes for various purposes
 */

import {
  AgentRuntime,
  Character,
  IDatabaseAdapter,
  IAgentRuntime,
  elizaLogger,
} from '@elizaos/core';
// DirectClient would need to be imported from the actual client package
// For now, we'll use a simple interface
interface DirectClient {
  runtime: IAgentRuntime;
}

// Default character for runtime creation
const defaultCharacter: Character = {
  name: 'Platform Agent',
  username: 'agent',
  bio: 'A helpful AI agent for the ElizaOS platform',
  system: 'You are a helpful AI assistant.',
  messageExamples: [],
  knowledge: [],
  settings: {
    secrets: {},
    voice: {
      model: 'en_US-hfc_female-medium',
    },
  },
};

// Simple DirectClient creator - simplified implementation
function createDirectClient(config: {
  runtime: IAgentRuntime;
  serverUrl?: string;
}): any {
  // This would typically create a client to communicate with the runtime
  // For now, return a simple object
  return {
    runtime: config.runtime,
    serverUrl: config.serverUrl,
    // Add any methods that might be expected
  };
}

export interface RuntimeConfig {
  character?: Character;
  token?: string;
  serverUrl?: string;
  databaseAdapter?: IDatabaseAdapter;
  cacheAdapter?: any;
  modelProvider?: string;
  verbose?: boolean;
}

/**
 * Create a new agent runtime instance
 */
export async function createAgentRuntime(
  config: RuntimeConfig = {},
): Promise<IAgentRuntime> {
  try {
    // Use provided character or default
    const character = config.character || defaultCharacter;

    // Create the runtime
    const runtime = new AgentRuntime({
      character,
      adapter: config.databaseAdapter,
      // Note: other config properties like token, modelProvider, cacheAdapter
      // are not directly supported by AgentRuntime constructor
      // They would need to be handled separately or through settings
    });

    // Initialize the runtime
    await runtime.initialize();

    if (config.verbose) {
      elizaLogger.info(
        `Agent runtime created for character: ${character.name}`,
      );
    }

    return runtime;
  } catch (error) {
    elizaLogger.error('Failed to create agent runtime:', error);
    throw error;
  }
}

/**
 * Create a runtime with a direct client connection
 */
export async function createAgentRuntimeWithClient(
  config: RuntimeConfig = {},
): Promise<{
  runtime: IAgentRuntime;
  client: any;
}> {
  const runtime = await createAgentRuntime(config);

  const client = createDirectClient({
    runtime,
    serverUrl: config.serverUrl,
  });

  return { runtime, client };
}

/**
 * Create a minimal runtime for testing/development
 */
export async function createTestRuntime(
  config: Partial<RuntimeConfig> = {},
): Promise<IAgentRuntime> {
  const testCharacter: Character = {
    ...defaultCharacter,
    name: config.character?.name || 'TestAgent',
    bio: config.character?.bio || [
      'A test agent for development and testing purposes.',
    ],
    ...config.character,
  };

  return createAgentRuntime({
    ...config,
    character: testCharacter,
    verbose: true,
  });
}
