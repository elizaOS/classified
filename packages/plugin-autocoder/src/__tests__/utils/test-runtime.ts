import { 
  AgentRuntime,
  type IAgentRuntime,
  type Character,
  type Plugin,
  type UUID,
  elizaLogger
} from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import sqlPlugin from '@elizaos/plugin-sql';
import { formsPlugin } from '@elizaos/plugin-forms';
import { e2bPlugin } from '@elizaos/plugin-e2b';
import { openaiPlugin } from '@elizaos/plugin-openai';
import { autocoderPlugin } from '../../index';

export interface TestRuntimeOptions {
  character?: Partial<Character>;
  plugins?: Plugin[];
  environment?: Record<string, string>;
  databasePath?: string;
}

export interface TestRuntimeResult {
  runtime: IAgentRuntime;
  cleanup: () => Promise<void>;
}

/**
 * Creates a real runtime instance for testing with proper database and plugin initialization
 */
export async function createRealTestRuntime(
  options: TestRuntimeOptions = {}
): Promise<TestRuntimeResult> {
  elizaLogger.info('Creating real test runtime...');

  const {
    character = {},
    plugins = [],
    environment = {},
    databasePath = `./.eliza/.test-${Date.now()}`
  } = options;

  // Setup environment
  process.env.DATABASE_PATH = databasePath;
  process.env.FORCE_BUNSQLITE = 'true';
  process.env.ELIZA_TEST_MODE = 'true';
  process.env.SECRET_SALT = process.env.SECRET_SALT || 'test-salt-for-testing-only-not-secure';

  // Apply custom environment variables
  Object.entries(environment).forEach(([key, value]) => {
    process.env[key] = value;
  });

  // Ensure data directory exists
  const fs = await import('fs/promises');
  try {
    await fs.mkdir(process.env.DATABASE_PATH, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore
  }

  // Create character with defaults
  const testCharacter: Character = {
    name: character.name || 'TestAgent',
    bio: character.bio || ['A test agent for runtime testing'],
    system: character.system || 'You are a helpful test agent.',
    secrets: {},
    settings: {
      ...(process.env.OPENAI_API_KEY && { OPENAI_API_KEY: process.env.OPENAI_API_KEY }),
      ...(process.env.ANTHROPIC_API_KEY && { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY }),
      ...(process.env.E2B_API_KEY && { E2B_API_KEY: process.env.E2B_API_KEY }),
      ...(process.env.GITHUB_TOKEN && { GITHUB_TOKEN: process.env.GITHUB_TOKEN }),
      ...character.settings
    },
    plugins: character.plugins || [],
    ...character
  };

  // Create runtime
  const runtime = new AgentRuntime({
    agentId: uuidv4() as UUID,
    character: testCharacter,
  });

  // Override getSetting to use environment variables
  runtime.getSetting = (key: string) => {
    return testCharacter.settings?.[key] || process.env[key];
  };

  // Default plugin set if none provided
  const defaultPlugins = plugins.length > 0 ? plugins : [
    sqlPlugin as any,
    openaiPlugin as any,
    e2bPlugin as any,
    formsPlugin as any,
    autocoderPlugin as any
  ];

  // Register plugins in order
  for (const plugin of defaultPlugins) {
    try {
      await runtime.registerPlugin(plugin);
      elizaLogger.info(`✅ Registered plugin: ${plugin.name}`);
    } catch (error) {
      elizaLogger.error(`❌ Failed to register plugin ${plugin.name}:`, error);
      throw error;
    }
  }

  // Run database migrations
  const databaseAdapter = (runtime as any).adapter;
  if (databaseAdapter && databaseAdapter.db) {
    elizaLogger.info('Running database migrations...');
    try {
      const { DatabaseMigrationService } = await import('@elizaos/plugin-sql');
      const migrationService = new DatabaseMigrationService();

      // Initialize with the database from the adapter
      await migrationService.initializeWithDatabase(databaseAdapter.db);

      // Register schemas from all loaded plugins
      migrationService.discoverAndRegisterPluginSchemas(defaultPlugins as any[]);

      // Run all migrations
      await migrationService.runAllPluginMigrations();

      elizaLogger.info('✅ Database migrations completed');
    } catch (error) {
      elizaLogger.error('❌ Failed to run database migrations:', error);
      throw error;
    }
  }

  // Process any queued services
  const servicesInitQueue = (runtime as any).servicesInitQueue;
  if (servicesInitQueue && servicesInitQueue.size > 0) {
    for (const serviceClass of servicesInitQueue) {
      try {
        await runtime.registerService(serviceClass);
        elizaLogger.info(`✅ Registered service: ${serviceClass.serviceName}`);
      } catch (error) {
        elizaLogger.warn(`⚠️ Failed to register service: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    servicesInitQueue.clear();
  }

  // Set initialized flag
  (runtime as any).isInitialized = true;

  // Cleanup function
  const cleanup = async () => {
    elizaLogger.info('Cleaning up test runtime...');
    
    // Stop services
    const services = ['code-generation', 'forms', 'e2b', 'github', 'secrets-manager'];
    for (const serviceName of services) {
      const service = runtime.getService(serviceName);
      if (service && typeof (service as any).stop === 'function') {
        try {
          await (service as any).stop();
          elizaLogger.info(`✅ Stopped service: ${serviceName}`);
        } catch (error) {
          elizaLogger.warn(`⚠️ Error stopping service ${serviceName}:`, error);
        }
      }
    }

    // Clean up database directory
    try {
      await fs.rm(databasePath, { recursive: true, force: true });
      elizaLogger.info(`✅ Cleaned up database directory: ${databasePath}`);
    } catch (error) {
      elizaLogger.warn(`⚠️ Error cleaning up database directory:`, error);
    }
  };

  return { runtime, cleanup };
} 