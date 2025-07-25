/**
 * ELIZA Game Agent Implementation
 * This file contains all plugin loading and agent runtime logic.
 * Called by server.ts to initialize the agent in the same process.
 */

// Agent character and runtime setup for ELIZA game
import type { Plugin, UUID } from '@elizaos/core';
import { AgentRuntime as ElizaAgentRuntime, stringToUuid } from '@elizaos/core';
// Use sqlPlugin for database
import { autonomyPlugin } from '@elizaos/plugin-autonomy';
import { bootstrapPlugin } from '@elizaos/plugin-bootstrap';
import { experiencePlugin } from '@elizaos/plugin-experience';
// import { knowledgePlugin } from '@elizaos/plugin-knowledge'; // Temporarily disabled - likely causes DOMMatrix issues
import PersonalityPlugin from '@elizaos/plugin-personality';
import { shellPlugin } from '@elizaos/plugin-shell';
import { plugin as sqlPlugin } from '@elizaos/plugin-sql';
// Import only workspace plugins that exist
import { ollamaPlugin } from '@elizaos/plugin-ollama';
import anthropicPlugin from '@elizaos/plugin-anthropic';
import openaiPlugin from '@elizaos/plugin-openai';
import { GoalsPlugin } from '@elizaos/plugin-goals';
// Temporarily disable rolodex due to TypeScript compatibility issues
// import { RolodexPlugin } from '@elizaos/plugin-rolodex';
// import { pluginManagerPlugin } from '@elizaos/plugin-plugin-manager'; // Temporarily disabled due to dynamic require issues
// import { SAMPlugin } from '@elizaos/plugin-sam';
// Import stagehand with correct structure - temporarily disabled for container compatibility
// import { stagehandPlugin } from '@elizaos/plugin-stagehand';
// import { visionPlugin } from '@elizaos/plugin-vision';

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { gameAPIPlugin } from './game-api-plugin.ts';
import { terminalCharacter } from './terminal-character.ts';
// import { TodoPlugin } from '@elizaos/plugin-todo';
// import { pluginManagerPlugin } from '@elizaos/plugin-plugin-manager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from multiple locations
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') }); // Project root

// Function to start an agent runtime - called by server.ts
export async function startAgent(character: any, server: any) {
  console.log('[AGENT START] Starting agent:', character.name);
  
  let channelId: UUID | null = null;
  
  // Ensure agent ID is set
  const agentId = character.id || stringToUuid(character.name);
  console.log('[AGENT START] Agent ID:', agentId);
  
  // Create/ensure agent exists in database
  const updatedCharacter = { ...character, id: agentId, agentId: agentId };
  
  // Skip secure secrets management for now due to Bun crypto compatibility issues
  console.log('[SECURITY] Skipping secure secrets management (using environment variables directly)');
  
  // Create plugin list with all required plugins - filter out any undefined plugins
  const plugins: Plugin[] = [
    sqlPlugin,
    bootstrapPlugin,
    ollamaPlugin, // Add Ollama plugin for local AI
    openaiPlugin,
    anthropicPlugin,
    autonomyPlugin, // Temporarily disabled due to runtime method compatibility issues
    GoalsPlugin,
    // TodoPlugin,
    PersonalityPlugin,
    experiencePlugin,
    // knowledgePlugin, // Temporarily disabled - likely causes DOMMatrix issues
    shellPlugin,
    // stagehandPlugin, // Commented out due to browser-specific dependencies that cause errors in Node.js
    // pluginManagerPlugin, // Temporarily disabled due to dynamic require issues
    gameAPIPlugin, // Game-specific API endpoints plugin
    // visionPlugin, // Temporarily disabled for container compatibility
  ].filter(Boolean);
  
  console.log('[AGENT START] Loaded plugins:', plugins.map(p => p.name || 'unnamed').join(', '));
  
  // Create the runtime using ElizaAgentRuntime
  const runtime = new ElizaAgentRuntime({
    character: updatedCharacter,
    plugins
  });
  
  console.log('[AGENT START] AgentRuntime created');
  
  // Initialize runtime
  await runtime.initialize();
  console.log('[AGENT START] AgentRuntime initialized');

  // Apply dynamic configuration after initialization (temporarily disabled for integration testing)
  console.log('[AGENT START] Skipping dynamic configuration setup for now');
  // try {
  //   const { DynamicConfigurationManager } = await import('./services/DynamicConfigurationManager.ts');
  //   const configManager = new DynamicConfigurationManager(runtime);
  //   
  //   // Initialize with plugin manager service integration
  //   await configManager.initialize();
  //   console.log('[AGENT START] Dynamic configuration manager initialized with plugin management');
  //   
  //   // Apply configuration to the runtime
  //   const currentConfig = configManager.getCurrentConfiguration();
  //   if (currentConfig) {
  //       console.log(`[AGENT START] Applied dynamic configuration: ${currentConfig.modelProvider} provider`);
  //       console.log(`[AGENT START] Available providers:`, configManager.getAvailableProviders().map(p => `${p.name}: ${p.available ? 'available' : 'unavailable' + (p.reason ? ` (${p.reason})` : '')}`));
  //   }
  //   
  //   // Attach the configuration manager to the runtime
  //   (runtime as any).configManager = configManager;
  //   console.log('[AGENT START] ✅ Dynamic configuration applied to runtime');
  // } catch (error) {
  //   console.error('[AGENT START] Failed to set up dynamic configuration:', error);
  // }
  
  // Set initial room context
  if (character.initialRoom) {
    console.log('[AGENT START] Setting initial room:', character.initialRoom);
    channelId = character.initialRoom;
  }
  
  // Store runtime on server
  if (!server.agents) {
    server.agents = new Map();
  }
  server.agents.set(runtime.agentId, runtime);
  console.log('[AGENT START] Agent stored on server');
  
  console.log('[AGENT START] Agent started successfully:', runtime.agentId);
  
  return {
    success: true,
    runtime,
    agentId,
    channelId,
  };
}

// Export the function for use by server.ts
export default startAgent;

// Export the default character configuration
export async function getDefaultCharacter() {
  // Deep copy to avoid modifying the original
  const character = JSON.parse(JSON.stringify(terminalCharacter));
  
  // Apply any runtime configuration
  character.settings = character.settings || {};
  character.settings.secrets = character.settings.secrets || {};
  
  // Apply environment variables as secrets
  if (process.env.OPENAI_API_KEY) {
    character.settings.secrets.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  }
  if (process.env.ANTHROPIC_API_KEY) {
    character.settings.secrets.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  }
  
  // Apply model provider if set
  if (process.env.MODEL_PROVIDER) {
    character.modelProvider = process.env.MODEL_PROVIDER;
  }
  
  // Set default ID if not present
  if (!character.id) {
    character.id = stringToUuid(character.name);
  }
  
  return character;
}