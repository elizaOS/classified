import './polyfill';

import type { Plugin } from '@elizaos/core';
import {
  AgentRuntime as ElizaAgentRuntime,
  IAgentRuntime,
  logger,
  stringToUuid,
} from '@elizaos/core';
// import anthropicPlugin from '@elizaos/plugin-anthropic';
// import { autonomyPlugin } from '@elizaos/plugin-autonomy';
import { bootstrapPlugin } from '@elizaos/plugin-bootstrap';
// import { experiencePlugin } from '@elizaos/plugin-experience';
// import { GoalsPlugin } from '@elizaos/plugin-goals';
// import { knowledgePlugin } from '@elizaos/plugin-knowledge';
import { ollamaPlugin } from '@elizaos/plugin-ollama';
// import openaiPlugin from '@elizaos/plugin-openai';
// import PersonalityPlugin from '@elizaos/plugin-personality';
// import { shellPlugin } from '@elizaos/plugin-shell';
import { plugin as sqlPlugin } from '@elizaos/plugin-sql';
// import { TodoPlugin } from '@elizaos/plugin-todo';
// import { visionPlugin } from '@elizaos/plugin-vision';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { terminalCharacter } from './character';
import { gameAPIPlugin } from './game-api-plugin.ts';
import { AgentServer } from './server';
// import { pluginManagerPlugin } from '@elizaos/plugin-plugin-manager';
// import { SAMPlugin } from '@elizaos/plugin-sam';
// import { stagehandPlugin } from '@elizaos/plugin-stagehand';

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

// Create plugin list with conditional loading based on providers
const plugins: Plugin[] = [
  sqlPlugin,
  bootstrapPlugin,
  // Only load model provider plugins that are being used
  ...(modelProvider === 'ollama' || modelProvider === 'all' ? [ollamaPlugin] : []),
  // ...(modelProvider === 'openai' || modelProvider === 'all' ? [openaiPlugin] : []),
  // ...(modelProvider === 'anthropic' || modelProvider === 'all' ? [anthropicPlugin] : []),
  // localEmbeddingPlugin,
  // autonomyPlugin,
  // GoalsPlugin,
  // TodoPlugin,
  // PersonalityPlugin,
  // experiencePlugin,
  // knowledgePlugin,
  // shellPlugin,
  // stagehandPlugin,
  gameAPIPlugin,
  // visionPlugin,
].filter(Boolean);

// Function to start an agent runtime - called by server.ts
export async function startAgent(character: any): Promise<IAgentRuntime> {
  console.log('[AGENT START] Starting agent:', character.name);

  // Generate the proper agent ID from the character name
  const agentId = stringToUuid(character.name);
  console.log('[AGENT START] Generated agent ID:', agentId, 'for character:', character.name);

  console.log('[AGENT START] Using embedding provider:', embeddingProvider);
  console.log('[AGENT START] Using model provider:', modelProvider);

  console.log('[AGENT START] Loaded plugins:', plugins.map((p) => p.name || 'unnamed').join(', '));

  // Create the runtime using ElizaAgentRuntime
  const runtime = new ElizaAgentRuntime({
    agentId,
    character: { ...character, id: agentId },
    plugins,
  });

  console.log('[AGENT START] AgentRuntime created');

  // Initialize runtime - this will set up database connection AND create the agent via ensureAgentExists
  await runtime.initialize();
  console.log(
    '[AGENT START] Runtime initialized - agent creation handled by runtime.ensureAgentExists()'
  );

  // Remove the duplicate agent creation code - the runtime.initialize() already handles this
  // via the ensureAgentExists method which is called during initialization

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
          `Failed to connect to PostgreSQL after ${maxRetries} attempts: ${error.message}`
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

  // Start the server on port 7777 AFTER the agent is ready
  const PORT = 7777;

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
      const targetRuntime = Array.from((server as any).agents?.values() || [])[0] as IAgentRuntime;
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
      res.status(500).json({ success: false, error: { message: error.message } });
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
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // Generic Capability Toggle endpoint
  server.app.post('/api/agents/default/capabilities/:capability', async (req: any, res: any) => {
    try {
      const capability = req.params.capability.toLowerCase();
      const targetRuntime = Array.from((server as any).agents?.values() || [])[0] as IAgentRuntime;

      if (!targetRuntime) {
        return res.status(503).json({ success: false, error: { message: 'Agent not available' } });
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

      if (!capabilityMappings[capability]) {
        return res
          .status(400)
          .json({ success: false, error: { message: `Unknown capability: ${capability}` } });
      }

      const settings = capabilityMappings[capability];
      const currentlyEnabled = settings.some(
        (setting) =>
          targetRuntime.getSetting(setting) === 'true' || targetRuntime.getSetting(setting) === true
      );

      const newState = !currentlyEnabled;
      settings.forEach((setting) => {
        targetRuntime.setSetting(setting, newState.toString());
      });

      res.json({
        success: true,
        data: {
          enabled: newState,
          capability,
          settings_updated: settings,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  server.app.delete('/knowledge/documents/:documentId', async (req: any, res: any) => {
    try {
      console.log('[BACKEND] Direct delete endpoint called for document:', req.params.documentId);

      // Find the runtime with the knowledge service
      let targetRuntime: IAgentRuntime | null = null;

      // Get all agents from the server
      const agents = Array.from((server as any).agents?.values() || []) as IAgentRuntime[];
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
        error: { code: 'DELETE_FAILED', message: error.message },
      });
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
