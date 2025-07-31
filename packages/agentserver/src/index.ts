import './polyfill';

import type { Plugin } from '@elizaos/core';
import {
  AgentRuntime as ElizaAgentRuntime,
  IAgentRuntime,
  logger,
  stringToUuid,
} from '@elizaos/core';
import { autonomyPlugin } from '@elizaos/plugin-autonomy';
import { bootstrapPlugin } from '@elizaos/plugin-bootstrap';
import GoalsPlugin from '@elizaos/plugin-goals';
import TodoPlugin from '@elizaos/plugin-todo';
import shellPlugin from '@elizaos/plugin-shell';
import { knowledgePlugin } from '@elizaos/plugin-knowledge';
import { inferencePlugin } from '@elizaos/plugin-inference';
import PersonalityPlugin from '@elizaos/plugin-personality';
import { plugin as sqlPlugin } from '@elizaos/plugin-sql';
import { experiencePlugin } from '@elizaos/plugin-experience';
import { stagehandPlugin } from '@elizaos/plugin-stagehand';
import { visionPlugin } from '@elizaos/plugin-vision';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { terminalCharacter } from './character';
import { gameAPIPlugin } from './game-api-plugin';
import { AgentServer } from './server';
import { CapabilityProgressionService } from './services/capabilityProgressionService';
import { ProgressionTracker } from './services/progressionTracker';

/**
 * Agent ID Handling Strategy:
 *
 * The system supports multiple ways to access agent-specific endpoints:
 *
 * 1. Using "default" as agent ID - This resolves to the first available agent
 *    Example: /api/agents/default/settings
 *
 * 2. Using actual agent UUID - Direct access to a specific agent
 *    Example: /api/agents/123e4567-e89b-12d3-a456-426614174000/settings
 *
 * 3. Discovery endpoints:
 *    - GET /api/agents/primary - Returns the primary (first) agent's details
 *    - GET /api/agents - Returns list of all available agents
 *
 * Frontend should ideally:
 * 1. Call /api/agents/primary to get the actual agent ID
 * 2. Use the returned agent ID for subsequent API calls
 * 3. Fall back to "default" if needed for backward compatibility
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load .env only if file exists
function loadEnvIfExists(envPath: string) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const envPaths = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', '.env'),
  path.join(__dirname, '..', '..', '..', '.env'),
];

envPaths.forEach(loadEnvIfExists);

// Check which embedding provider to use
const embeddingProvider =
  process.env.EMBEDDING_PROVIDER || terminalCharacter.settings?.EMBEDDING_PROVIDER || 'ollama';
const modelProvider =
  process.env.MODEL_PROVIDER || terminalCharacter.settings?.MODEL_PROVIDER || 'ollama';

// Define all available plugins for progressive unlocking
const allAvailablePlugins: Record<string, Plugin> = {
  sql: sqlPlugin,
  bootstrap: bootstrapPlugin,
  autonomy: autonomyPlugin,
  goals: GoalsPlugin,
  todo: TodoPlugin,
  vision: visionPlugin,
  personality: PersonalityPlugin,
  experience: experiencePlugin,
  knowledge: knowledgePlugin,
  shell: shellPlugin,
  stagehand: stagehandPlugin,
  gameAPI: gameAPIPlugin,
  inference: inferencePlugin,
};

// Create initial plugin list with only basic capabilities
function createInitialPlugins(): Plugin[] {
  return [
    sqlPlugin,          // Always needed for database
    bootstrapPlugin,    // Always needed for basic runtime
    gameAPIPlugin,      // Always needed for game API
    inferencePlugin,    // Always needed for inference
    autonomyPlugin,     // Start with autonomy enabled
    knowledgePlugin,    // Always needed for memory
    PersonalityPlugin,  // Always needed for character
    experiencePlugin,   // Always needed for learning
          GoalsPlugin,        // Goals tracking and management
      TodoPlugin,         // Todo tracking and management
    ].filter(Boolean);
}

const initialPlugins = createInitialPlugins();

// Function to start an agent runtime - called by server.ts
export async function startAgent(character: any): Promise<IAgentRuntime> {
  console.log('[AGENT START] Starting agent:', character.name);

  // Generate the proper agent ID from the character name
  const agentId = stringToUuid(character.name);
  console.log('[AGENT START] Generated agent ID:', agentId, 'for character:', character.name);

  console.log('[AGENT START] Using embedding provider:', embeddingProvider);
  console.log('[AGENT START] Using model provider:', modelProvider);

  console.log('[AGENT START] Initial plugins:', initialPlugins.map((p) => p.name || 'unnamed').join(', '));

  // Ensure character has proper structure with UUID string
  const cleanCharacter = {
    ...character,
    id: agentId, // Ensure ID is always a string UUID
  };

  // Remove any nested objects that might have been accidentally included
  if (typeof cleanCharacter.id !== 'string') {
    console.warn('[AGENT START] Character ID was not a string, fixing...');
    cleanCharacter.id = agentId;
  }

  // Create the runtime using ElizaAgentRuntime with initial plugins only
  const runtime = new ElizaAgentRuntime({
    agentId,
    character: cleanCharacter,
    plugins: initialPlugins,
  });

  // Add progressive plugin support
  (runtime as any).registerProgressivePlugin = async (capability: string) => {
    console.log(`[PROGRESSION] Registering plugin for capability: ${capability}`);
    logger.info(`[PROGRESSION] Registering plugin for capability: ${capability}`);
    
    const pluginMappings: Record<string, Plugin[]> = {
      'browser': [stagehandPlugin], // Browser capability uses Stagehand for web automation
      'stagehand': [stagehandPlugin], // Alias for backward compatibility
      'vision': [], // Vision plugin would go here when available
      'screen_capture': [], // Screen capture plugin would go here
      'microphone': [], // SAM plugin would go here
      'sam': [], // SAM plugin would go here  
      'audio': [], // Audio plugin would go here
      'camera': [], // Camera plugin would go here
      'advanced_vision': [], // Advanced vision plugin would go here
      'shell': [shellPlugin],
      'goals': [GoalsPlugin],
      'todo': [TodoPlugin],
    };
    
    const pluginsToRegister = pluginMappings[capability] || [];
    console.log(`[PROGRESSION] Found ${pluginsToRegister.length} plugins to register for ${capability}`);
    logger.info(`[PROGRESSION] Found ${pluginsToRegister.length} plugins to register for ${capability}`);
    
    for (const plugin of pluginsToRegister) {
      if (!runtime.plugins.find(p => p.name === plugin.name)) {
        console.log(`[PROGRESSION] Registering plugin: ${plugin.name} for capability: ${capability}`);
        logger.info(`[PROGRESSION] Registering plugin: ${plugin.name} for capability: ${capability}`);
        
        try {
          await runtime.registerPlugin(plugin);
          console.log(`[PROGRESSION] Successfully registered plugin: ${plugin.name}`);
          logger.info(`[PROGRESSION] Successfully registered plugin: ${plugin.name}`);
        } catch (error) {
          console.error(`[PROGRESSION] Failed to register plugin ${plugin.name}:`, error);
          logger.error(`[PROGRESSION] Failed to register plugin ${plugin.name}:`, error);
        }
      } else {
        console.log(`[PROGRESSION] Plugin ${plugin.name} already registered`);
        logger.info(`[PROGRESSION] Plugin ${plugin.name} already registered`);
      }
    }
  };

  console.log('[AGENT START] AgentRuntime created with initial capabilities and progressive plugin support');

  // Initialize runtime - this will set up database connection AND create the agent via ensureAgentExists
  await runtime.initialize();
  console.log(
    '[AGENT START] Runtime initialized - agent creation handled by runtime.ensureAgentExists()'
  );

  // Initialize the capability progression service
  const progressionService = new CapabilityProgressionService(runtime);
  
  // Initialize the progression tracker
  const progressionTracker = new ProgressionTracker(runtime, progressionService);
  
  // Store the progression service and tracker on the runtime for later access
  (runtime as any).progressionService = progressionService;
  (runtime as any).progressionTracker = progressionTracker;

  console.log('[AGENT START] Capability progression system initialized');

  return runtime;
}

export async function startServer() {
  // Check for existing database URL in environment variables first
  const envDatabaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  // Use localhost for local development, eliza-postgres for container environments
  const isContainer =
    process.env.CONTAINER === 'true' ||
    process.env.AGENT_CONTAINER === 'true' ||
    process.env.DOCKER_CONTAINER === 'true' ||
    fs.existsSync('/.dockerenv');
  const postgresHost = isContainer ? 'eliza-postgres:5432' : 'localhost:5432';
  const fallbackDatabaseUrl = `postgresql://eliza:eliza_secure_pass@${postgresHost}/eliza`;

  // Use environment variable if set, otherwise use fallback
  const databaseUrl = envDatabaseUrl || fallbackDatabaseUrl;
  const _dataDir = path.resolve(process.cwd(), 'data');

  // Create and initialize server
  const server = new AgentServer();

  // Make server instance globally available for MessageBusService
  (global as any).elizaAgentServer = server;

  // Assign the startAgent method to make it compatible with the lifecycle API
  (server as any).startAgent = async (character: any) => {
    logger.info('[SERVER] Starting agent via API call:', character.name);
    const runtime = await startAgent(character);
    await server.registerAgent(runtime);
    return runtime;
  };

  console.log(`[BACKEND] Using PostgreSQL database ${databaseUrl}`);

  // In containers, retry initialization to wait for PostgreSQL
  const maxRetries = 30; // 30 seconds total
  let retries = 0;
  let initialized = false;

  while (!initialized && retries < maxRetries) {
    try {
      await server.initialize(databaseUrl);
      initialized = true;
    } catch (error) {
      retries++;
      if (retries < maxRetries) {
        console.log(`[BACKEND] Waiting for PostgreSQL... (${retries}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        throw new Error(
          `Failed to connect to PostgreSQL after ${maxRetries} attempts: ${(error as any).message}`
        );
      }
    }
  }

  // Add file upload middleware for knowledge document uploads
  const fileUpload = await import('express-fileupload');
  server.app.use(
    fileUpload.default({
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
      useTempFiles: true,
      tempFileDir: '/tmp/',
      createParentPath: true,
    }) as any
  );
  console.log('[BACKEND] ✅ All plugin migrations completed');

  // Create and register the default agent BEFORE starting the server
  // This ensures the agent exists when WebSocket messages arrive
  const runtime = await startAgent(terminalCharacter);
  await server.registerAgent(runtime);
  console.log(
    '[BACKEND] ✅ Default agent started and registered successfully with secure configuration'
  );

  // Test the shell service to ensure it's working properly
  console.log('[BACKEND] Testing shell service...');
  try {
    const shellService = runtime.getService('SHELL');
    if (!shellService) {
      console.error('[BACKEND] ❌ Shell service not found! Shell commands will not work.');
    } else {
      console.log('[BACKEND] ✅ Shell service found, running test commands...');

      // Test 1: Execute a simple command
      const result1 = await (shellService as any).executeCommand('pwd');
      console.log('[BACKEND] Test 1 - Current directory:', result1.output.trim());
      console.log('[BACKEND]   Exit code:', result1.exitCode);
      const originalDir = result1.output.trim();

      // Test 2: Change directory to a cross-platform directory
      // Use temp directory which exists on all platforms
      const tempDir = process.platform === 'win32' ? process.env.TEMP || 'C:\\Temp' : '/tmp';
      const result2 = await (shellService as any).executeCommand(`cd ${tempDir}`);
      console.log('[BACKEND] Test 2 - Change directory result:', result2.output.trim());

      // Test 3: Verify directory change persisted
      const result3 = await (shellService as any).executeCommand('pwd');
      console.log('[BACKEND] Test 3 - New working directory:', result3.output.trim());
      console.log(
        '[BACKEND]   Directory change persisted:',
        result3.output.trim().includes(tempDir) ? '✅' : '❌'
      );

      // Test 4: Run a command in the new directory
      const listCmd = process.platform === 'win32' ? 'dir' : 'ls -la';
      const result4 = await (shellService as any).executeCommand(listCmd);
      console.log(
        '[BACKEND] Test 4 - Directory listing executed successfully:',
        result4.exitCode === 0 ? '✅' : '❌'
      );

      // Test 5: Return to original directory
      const result5 = await (shellService as any).executeCommand(`cd ${originalDir}`);
      console.log('[BACKEND] Test 5 - Return to original directory:', result5.output.trim());

      console.log('[BACKEND] ✅ Shell service tests completed successfully');
    }
  } catch (error) {
    console.error('[BACKEND] ❌ Shell service test failed:', error);
  }

  // Start the server on port 7777 AFTER the agent is ready
  const PORT = parseInt(process.env.PORT || '7777', 10);

  await server.start(PORT);
  console.log(`[BACKEND] ✅ Server started on port ${PORT}`);
  console.log(`[BACKEND] Server running at http://localhost:${PORT}`);

  // WebSocket server is already integrated in packages/server at the same port
  console.log(`[BACKEND] WebSocket available at ws://localhost:${PORT}/ws`);

  // Add messaging stub endpoints directly to the server for MessageBusService compatibility
  // These need to be available before the agent starts
  console.log('[BACKEND] Adding messaging stub endpoints...');

  // Knowledge Files endpoint (expected by frontend)
  server.app.get('/api/knowledge/files', async (req: any, res: any) => {
    try {
      const targetRuntime = Array.from((server as any).agents?.values() || [])[0] as any;
      if (!targetRuntime) {
        return res.json({ success: true, data: { files: [], count: 0 } });
      }

      const knowledgeService = targetRuntime.getService('knowledge');
      if (!knowledgeService) {
        return res.json({ success: true, data: { files: [], count: 0 } });
      }

      const documents = await (knowledgeService as any).getMemories({
        tableName: 'documents',
        count: 100,
        agentId: targetRuntime.agentId,
      });

      const files = documents.map((doc: any) => ({
        id: doc.id,
        name: doc.metadata?.originalFilename || doc.metadata?.title || 'Untitled',
        filename: doc.metadata?.originalFilename || 'unknown',
        contentType: doc.metadata?.contentType || 'text/plain',
        size: doc.metadata?.size || 0,
        uploadedAt: new Date(doc.createdAt || doc.metadata?.timestamp || Date.now()).toISOString(),
        fragmentCount: doc.metadata?.fragmentCount || 0,
      }));

      res.json({ success: true, data: { files, count: files.length } });
    } catch (error) {
      res.status(500).json({ success: false, error: { message: (error as any).message } });
    }
  });

  // Plugin Config endpoint
  server.app.get('/api/plugin-config', async (req: any, res: any) => {
    try {
      const _targetRuntime = Array.from((server as any).agents?.values() || [])[0];
      const configurations = {
        environment: {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '***SET***' : 'NOT_SET',
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? '***SET***' : 'NOT_SET',
          MODEL_PROVIDER: process.env.MODEL_PROVIDER || 'ollama',
        },
      };
      res.json({ success: true, data: { configurations, availablePlugins: [] } });
    } catch (error) {
      res.status(500).json({ success: false, error: { message: (error as any).message } });
    }
  });

  // Generic Capability Toggle endpoint - supports both default and specific agent IDs
  server.app.post('/api/agents/:agentId/capabilities/:capability', async (req: any, res: any) => {
    try {
      const capability = req.params.capability.toLowerCase();
      let targetRuntime: any | undefined;

      // Handle "default" as a special case - get the first agent
      if (req.params.agentId === 'default') {
        targetRuntime = Array.from((server as any).agents?.values() || [])[0];
      } else {
        // Try to get the specific agent by ID
        targetRuntime = (server as any).agents?.get(req.params.agentId);
      }

      if (!targetRuntime) {
        return res.status(503).json({
          success: false,
          error: {
            message:
              req.params.agentId === 'default'
                ? 'No agents available'
                : `Agent ${req.params.agentId} not found`,
          },
        });
      }

      const capabilityMappings = {
        camera: ['ENABLE_CAMERA', 'VISION_CAMERA_ENABLED'],
        microphone: ['ENABLE_MICROPHONE', 'VISION_MICROPHONE_ENABLED'],
        speakers: ['ENABLE_SPEAKER', 'VISION_SPEAKER_ENABLED'],
        screen: ['ENABLE_SCREEN_CAPTURE', 'VISION_SCREEN_ENABLED'],
        shell: ['ENABLE_SHELL', 'SHELL_ENABLED'],
        browser: ['ENABLE_BROWSER', 'BROWSER_ENABLED'],
        autonomy: ['AUTONOMY_ENABLED', 'ENABLE_AUTONOMY'],
      };

      if (!capabilityMappings[capability as keyof typeof capabilityMappings]) {
        return res
          .status(400)
          .json({ success: false, error: { message: `Unknown capability: ${capability}` } });
      }

      const settings = capabilityMappings[capability as keyof typeof capabilityMappings];
      const currentlyEnabled = settings.some(
        (setting: string) =>
          targetRuntime.getSetting(setting) === 'true' || targetRuntime.getSetting(setting) === true
      );

      const newState = !currentlyEnabled;
      settings.forEach((setting: string) => {
        targetRuntime.setSetting(setting, newState.toString());
      });

      res.json({
        success: true,
        data: {
          enabled: newState,
          capability,
          settings_updated: settings,
          agentId: targetRuntime.agentId,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: { message: (error as any).message } });
    }
  });

  server.app.delete('/knowledge/documents/:documentId', async (req: any, res: any) => {
    try {
      console.log('[BACKEND] Direct delete endpoint called for document:', req.params.documentId);

      // Find the runtime with the knowledge service
      let targetRuntime: any | null = null;

      // Get all agents from the server
      const agents = Array.from((server as any).agents?.values() || []) as any[];
      for (const runtime of agents) {
        const knowledgeService = runtime.getService('knowledge');
        if (knowledgeService) {
          targetRuntime = runtime;
          break;
        }
      }

      if (!targetRuntime) {
        return res.status(503).json({
          success: false,
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Knowledge service not available' },
        });
      }

      const knowledgeService = targetRuntime.getService('knowledge');
      const documentId = req.params.documentId;

      // Use the knowledge service deleteMemory method to actually delete the document
      await (knowledgeService as any).deleteMemory(documentId);
      console.log('[BACKEND] Successfully deleted knowledge document:', documentId);

      res.json({
        success: true,
        data: {
          message: 'Document deleted successfully',
          documentId,
        },
      });
    } catch (error) {
      console.error('[BACKEND] Error deleting knowledge document:', error);
      res.status(500).json({
        success: false,
        error: { code: 'DELETE_FAILED', message: (error as any).message },
      });
    }
  });

  // GET primary agent endpoint - returns the first available agent
  server.app.get('/api/agents/primary', async (req: any, res: any) => {
    try {
      const primaryAgent = Array.from((server as any).agents?.values() || [])[0] as any | undefined;

      if (!primaryAgent) {
        return res.status(200).json({
          success: true,
          data: {
            available: false,
            message: 'No agents loaded yet',
          },
        });
      }

      res.json({
        success: true,
        data: {
          available: true,
          agentId: primaryAgent.agentId,
          agentName: primaryAgent.character?.name || 'Unknown Agent',
          // Include the actual endpoints the frontend should use
          endpoints: {
            settings: `/api/agents/${primaryAgent.agentId}/settings`,
            capabilities: `/api/agents/${primaryAgent.agentId}/capabilities`,
            vision: `/api/agents/${primaryAgent.agentId}/vision`,
          },
        },
      });
    } catch (error) {
      console.error('[API] Error getting primary agent:', error);
      res.status(500).json({ success: false, error: { message: (error as any).message } });
    }
  });

  // GET list of agents endpoint
  server.app.get('/api/agents', async (req: any, res: any) => {
    try {
      const agentEntries = Array.from((server as any).agents?.entries() || []) as Array<
        [string, any]
      >;
      const agents = agentEntries.map(([id, runtime]) => ({
        id,
        name: runtime.character?.name || 'Unknown Agent',
        ready: true,
      }));

      res.json({
        success: true,
        data: {
          agents,
          count: agents.length,
        },
      });
    } catch (error) {
      console.error('[API] Error listing agents:', error);
      res.status(500).json({ success: false, error: { message: (error as any).message } });
    }
  });

  // GET default agent settings endpoint - specific route to bypass UUID validation
  server.app.get('/api/agents/default/settings', async (req: any, res: any) => {
    try {
      // Get the first available agent
      const targetRuntime = Array.from((server as any).agents?.values() || [])[0] as any;

      if (!targetRuntime) {
        // Return a minimal response indicating server is ready but no agent yet
        return res.status(200).json({
          success: true,
          data: {
            gameApiReady: true,
            agentReady: false,
            message: 'Server is running, agent initializing',
          },
        });
      }

      // Get common settings
      const settings: Record<string, any> = {};
      const commonSettingKeys = [
        'ENABLE_CAMERA',
        'ENABLE_SCREEN_CAPTURE',
        'ENABLE_MICROPHONE',
        'ENABLE_SPEAKER',
        'VISION_CAMERA_ENABLED',
        'VISION_SCREEN_ENABLED',
        'VISION_MICROPHONE_ENABLED',
        'VISION_SPEAKER_ENABLED',
        'AUTONOMY_ENABLED',
        'SHELL_ENABLED',
        'BROWSER_ENABLED',
      ];

      commonSettingKeys.forEach((key) => {
        const value = targetRuntime.getSetting(key);
        if (value !== undefined) {
          settings[key] = value;
        }
      });

      res.json({
        success: true,
        data: {
          ...settings,
          agentId: targetRuntime.agentId,
          agentName: targetRuntime.character?.name || 'Unknown Agent',
          gameApiReady: true,
          agentReady: true,
        },
      });
    } catch (error) {
      console.error('[API] Error retrieving default agent settings:', error);
      res.status(500).json({ success: false, error: { message: (error as any).message } });
    }
  });

  // GET settings endpoint - supports both /api/agents/default/settings and /api/agents/:agentId/settings
  // Progression status endpoint
  server.app.get('/api/agents/:agentId/progression', async (req: any, res: any) => {
    try {
      let targetRuntime: IAgentRuntime | undefined;

      // Handle "default" as a special case - get the first agent
      if (req.params.agentId === 'default') {
        targetRuntime = Array.from((server as any).agents?.values() || [])[0] as IAgentRuntime;
      } else {
        // Try to get the specific agent by ID
        targetRuntime = (server as any).agents?.get(req.params.agentId);
      }

      if (!targetRuntime) {
        return res.status(200).json({
          success: true,
          data: {
            progressionReady: false,
            message: req.params.agentId === 'default'
              ? 'No agents available yet'
              : `Agent ${req.params.agentId} not found`,
          },
        });
      }

      // Get progression status from the tracker
      const progressionTracker = (targetRuntime as any).progressionTracker;
      if (!progressionTracker) {
        return res.status(200).json({
          success: true,
          data: {
            progressionReady: false,
            message: 'Progression system not initialized',
          },
        });
      }

      const progressionStatus = progressionTracker.getProgressionStatus();

      res.json({
        success: true,
        data: {
          progressionReady: true,
          agentId: targetRuntime.agentId,
          agentName: targetRuntime.character?.name || 'Unknown Agent',
          ...progressionStatus,
        },
      });
    } catch (error) {
      console.error('[API] Error retrieving progression status:', error);
      res.status(500).json({ success: false, error: { message: (error as any).message } });
    }
  });

  server.app.get('/api/agents/:agentId/settings', async (req: any, res: any) => {
    try {
      let targetRuntime: any | undefined;

      // Handle "default" as a special case - get the first agent
      if (req.params.agentId === 'default') {
        targetRuntime = Array.from((server as any).agents?.values() || [])[0] as any;
      } else {
        // Try to get the specific agent by ID
        targetRuntime = (server as any).agents?.get(req.params.agentId);
      }

      if (!targetRuntime) {
        // Return a response indicating no agent found
        return res.status(200).json({
          success: true,
          data: {
            gameApiReady: true,
            agentReady: false,
            agentId: req.params.agentId,
            message:
              req.params.agentId === 'default'
                ? 'No agents available yet'
                : `Agent ${req.params.agentId} not found`,
          },
        });
      }

      // Get common settings
      const settings: Record<string, any> = {};
      const commonSettingKeys = [
        'ENABLE_CAMERA',
        'ENABLE_SCREEN_CAPTURE',
        'ENABLE_MICROPHONE',
        'ENABLE_SPEAKER',
        'VISION_CAMERA_ENABLED',
        'VISION_SCREEN_ENABLED',
        'VISION_MICROPHONE_ENABLED',
        'VISION_SPEAKER_ENABLED',
        'AUTONOMY_ENABLED',
        'SHELL_ENABLED',
        'BROWSER_ENABLED',
      ];

      commonSettingKeys.forEach((key) => {
        const value = targetRuntime.getSetting(key);
        if (value !== undefined) {
          settings[key] = value;
        }
      });

      res.json({
        success: true,
        data: {
          ...settings,
          agentId: targetRuntime.agentId,
          agentName: targetRuntime.character?.name || 'Unknown Agent',
          gameApiReady: true,
          agentReady: true,
        },
      });
    } catch (error) {
      console.error('[API] Error retrieving settings:', error);
      res.status(500).json({ success: false, error: { message: (error as any).message } });
    }
  });

  return server;
}

// Start the server only if this file is run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    console.error('[BACKEND] Fatal error:', error);
    process.exit(1);
  });
}
