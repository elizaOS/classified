import { AgentRuntime, Plugin } from '@elizaos/core';
import bootstrapPlugin from '@elizaos/plugin-bootstrap';
import openaiPlugin from '@elizaos/plugin-openai';
import sqlPlugin from '@elizaos/plugin-sql';
import { AgentServer } from '@elizaos/server';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
// Import commented out - will use a different approach
// import { internalMessageBus } from '@elizaos/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Store active agent runtimes
const activeAgents = new Map<string, AgentRuntime>();

// Function to start an agent runtime (following CLI pattern)
async function startAgent(character: any, server: any) {
  console.log('[AGENT START] Starting agent:', character );
  
  try {
    
    const runtime = new AgentRuntime({
      character,
      plugins: [sqlPlugin, bootstrapPlugin, openaiPlugin as any]
     });
    
    await runtime.initialize();
    
    // Register the runtime with the server
    server.registerAgent(runtime);
    
    // Store the runtime
    activeAgents.set(runtime.agentId, runtime);
    
    console.log('[AGENT START] ✅ Agent started successfully:', runtime.agentId);
    return runtime;
  } catch (error) {
    console.error('[AGENT START] Error starting agent:', error);
    throw error;
  }
}

// Function to stop an agent runtime
async function stopAgent(runtime: AgentRuntime, server: any) {
  console.log('[AGENT STOP] Stopping agent:', runtime.agentId);
  
  // Remove from active agents
  activeAgents.delete(runtime.agentId);
  
  // Unregister from server
  server.unregisterAgent(runtime.agentId);
  
  console.log('[AGENT STOP] ✅ Agent stopped successfully');
}

async function startServer() {
  try {
    console.log('[BACKEND] Initializing ElizaOS Terminal Server...');

    // Ensure data directory exists
    const dataDir = path.join(__dirname, '..', '..', 'data');
    await fs.mkdir(dataDir, { recursive: true });

    // Create server instance
    const server = new AgentServer();

    // Initialize with PGLite for local development
    await server.initialize({
      dataDir,
      postgresUrl: undefined, // Use PGLite
    });

    // Add startAgent and stopAgent methods to match CLI pattern
    (server as any).startAgent = (character: any) => startAgent(character, server);
    (server as any).stopAgent = (runtime: AgentRuntime) => stopAgent(runtime, server);

    console.log('[BACKEND] Server initialized with PGLite database');

    // Start the server
    const port = process.env.PORT || 3000;
    await server.start(Number(port));

    console.log('[BACKEND] Server started on port ' + port);
    console.log('[BACKEND] Server running at http://localhost:' + port);

    // Directly load and start default agent
    const characterPath = path.join(__dirname, '..', 'terminal-character.json');
    const characterData = await fs.readFile(characterPath, 'utf-8');
    const character = JSON.parse(characterData);

    // Ensure required plugins are included (preserve existing plugins)
    const requiredPlugins = [
      '@elizaos/plugin-sql'
    ];
    
    // Add required plugins if not already present
    character.plugins = character.plugins || [];
    for (const plugin of requiredPlugins) {
      if (!character.plugins.includes(plugin)) {
        character.plugins.push(plugin);
      }
    }

    console.log('[BACKEND] Starting default Terminal agent...');
    const runtime = await startAgent(character, server);
    console.log('[BACKEND] ✅ Terminal agent started successfully!');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n[BACKEND] Shutting down server...');
      
      // Stop all agent runtimes
      for (const [agentId, runtime] of activeAgents) {
        console.log(`[BACKEND] Stopping agent runtime: ${agentId}`);
        await stopAgent(runtime, server);
      }
      
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
