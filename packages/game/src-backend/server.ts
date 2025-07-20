import { AgentRuntime, Plugin } from '@elizaos/core';
import bootstrapPlugin from '@elizaos/plugin-bootstrap';
import openaiPlugin from '@elizaos/plugin-openai';
import sqlPlugin, { createDatabaseAdapter, DatabaseMigrationService } from '@elizaos/plugin-sql';
import autonomyPlugin from '@elizaos/plugin-autonomy';
import { shellPlugin } from '@elizaos/plugin-shell';
import { stagehandPlugin } from '@elizaos/plugin-stagehand';
import visionPlugin from '@elizaos/plugin-vision';
import { GoalsPlugin } from '@elizaos/plugin-goals';
import { TodoPlugin } from '@elizaos/plugin-todo';
import KnowledgePlugin from '@elizaos/plugin-knowledge';
import personalityPlugin from '@elizaos/plugin-personality';
import { experiencePlugin } from '@elizaos/plugin-experience';
import { AgentServer } from '@elizaos/server';
import { terminalCharacter } from './terminal-character.js';
import { gameAPIPlugin } from './game-api-plugin.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Function to start an agent runtime (following CLI pattern)
async function startAgent(character: any, server: any) {
  console.log('[AGENT START] Starting agent:', character );
  
  try {
    
    // Create plugin list with all required plugins including our Game API plugin
    const plugins: Plugin[] = [
      sqlPlugin,
      bootstrapPlugin,
      openaiPlugin as any,
      autonomyPlugin,
      shellPlugin,
      visionPlugin,
      stagehandPlugin,
      GoalsPlugin,
      TodoPlugin,
      KnowledgePlugin,
      personalityPlugin,
      experiencePlugin,
      gameAPIPlugin  // Our custom API routes plugin
    ];

    // Create database adapter first
    const dbAdapter = createDatabaseAdapter({
      dataDir: process.env.DATABASE_PATH || './.elizadb'
    }, character.id);
    
    await dbAdapter.init();
    console.log('[AGENT START] Database adapter initialized');
    
    // Run migrations BEFORE creating runtime
    try {
      const db = dbAdapter.db;
      console.log('[AGENT START] Running database migrations...');
      
      const migrationService = new DatabaseMigrationService();
      await migrationService.initializeWithDatabase(db);
      migrationService.discoverAndRegisterPluginSchemas(plugins);
      await migrationService.runAllPluginMigrations();
      
      console.log('[AGENT START] All plugin migrations completed successfully');
    } catch (error) {
      console.error('[AGENT START] Failed to run plugin migrations:', error);
      throw error;
    }

    // Now create runtime with pre-initialized database
    const runtime = new AgentRuntime({
      character,
      plugins
    });
    
    // Register the database adapter
    runtime.registerDatabaseAdapter(dbAdapter);
    
    // Initialize runtime (tables already exist)
    await runtime.initialize();
    
    // Register the runtime with the server
    server.registerAgent(runtime);
    
    console.log('[AGENT START] ✅ Agent started successfully:', runtime.agentId);
    return runtime;
  } catch (error) {
    console.error('[AGENT START] Error starting agent:', error);
    throw error;
  }
}

async function startServer() {
  try {
    console.log('[BACKEND] Initializing ElizaOS Terminal Server...');

    // Ensure data directory exists
    const dataDir = path.join(__dirname, '..', 'data');
    await fs.mkdir(dataDir, { recursive: true });

    // Create server instance
    const server = new AgentServer();

    // Initialize with PGLite for local development
    await server.initialize({
      dataDir,
      postgresUrl: undefined, // Use PGLite
    });

    console.log('[BACKEND] Server initialized with PGLite database');

    // API routes are now handled by the gameAPIPlugin which is registered with the agent

    // Start the server
    const port = process.env.PORT || 3000;
    await server.start(Number(port));

    console.log('[BACKEND] ✅ Server started on port ' + port);
    console.log('[BACKEND] Server running at http://localhost:' + port);

    // Now start the agent
    console.log('[BACKEND] Starting default Terminal agent...');
    const character = terminalCharacter;
    const runtime = await startAgent(character, server);
    console.log('[BACKEND] ✅ Terminal agent started successfully!');

    // Test that our APIs are working
    setTimeout(async () => {
      try {
        console.log('[BACKEND] Testing API endpoints...');
        
        const healthResponse = await fetch(`http://localhost:${port}/api/server/health`);
        console.log(`[BACKEND] Health check: ${healthResponse.ok ? '✅' : '❌'} (${healthResponse.status})`);
        
        const goalsResponse = await fetch(`http://localhost:${port}/api/goals`);
        console.log(`[BACKEND] Goals API: ${goalsResponse.ok ? '✅' : '❌'} (${goalsResponse.status})`);
        
        const autonomyResponse = await fetch(`http://localhost:${port}/autonomy/status`);
        console.log(`[BACKEND] Autonomy API: ${autonomyResponse.ok ? '✅' : '❌'} (${autonomyResponse.status})`);
        
        console.log('[BACKEND] API endpoint testing complete');
      } catch (error) {
        console.error('[BACKEND] API endpoint test failed:', error);
      }
    }, 2000);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n[BACKEND] Shutting down server...');
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('[BACKEND] Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();