/**
 * ELIZA Game Agent Implementation
 * This file contains all plugin loading and agent runtime logic.
 * Called by server.ts to initialize the agent in the same process.
 */

// CRITICAL: Load @thednp/dommatrix polyfills FIRST - this is the only polyfill we need
import './polyfills.js';

// Mock window object for browser dependencies (only minimal ones needed)
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    location: { 
      href: '',
      search: '',
      origin: '',
      pathname: '/',
      hash: '',
      host: '',
      hostname: '',
      protocol: 'http:',
      port: ''
    },
    document: { 
      createElement: () => ({
        setAttribute: () => {},
        getAttribute: () => null,
        appendChild: () => {},
        removeChild: () => {},
        style: {},
        innerHTML: '',
        textContent: ''
      }),
      getElementsByTagName: () => ([]),
      querySelector: () => null,
      querySelectorAll: () => ([]),
      body: { appendChild: () => {} },
      head: { appendChild: () => {} }
    },
    navigator: { userAgent: 'Node.js' },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {}
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {}
    },
    XMLHttpRequest: class MockXMLHttpRequest {
      open() {}
      send() {}
      setRequestHeader() {}
    },
    fetch: typeof fetch !== 'undefined' ? fetch : () => Promise.reject(new Error('fetch not available'))
  } as any;
}

// Mock additional DOM APIs that plugins might need
if (typeof globalThis.document === 'undefined') {
  globalThis.document = globalThis.window.document;
}

// Also set globalThis.location directly for URLSearchParams compatibility
if (typeof globalThis.location === 'undefined') {
  globalThis.location = {
    href: '',
    search: '',
    origin: '',
    pathname: '/',
    hash: '',
    host: '',
    hostname: '',
    protocol: 'http:',
    port: ''
  } as any;
}

console.log('[POLYFILLS] Using @thednp/dommatrix polyfills in agent.ts');

// Agent character and runtime setup for ELIZA game
import type { Plugin, UUID } from '@elizaos/core';
import { AgentRuntime as ElizaAgentRuntime, stringToUuid } from '@elizaos/core';
// Use sqlPlugin for database
import { autonomyPlugin } from '@elizaos/plugin-autonomy';
import { bootstrapPlugin } from '@elizaos/plugin-bootstrap';
import { experiencePlugin } from '@elizaos/plugin-experience';
import { knowledgePlugin } from '@elizaos/plugin-knowledge';
import PersonalityPlugin from '@elizaos/plugin-personality';
import { shellPlugin } from '@elizaos/plugin-shell';
import { plugin as sqlPlugin } from '@elizaos/plugin-sql';
// Import only workspace plugins that exist
import { ollamaPlugin } from './ollama-plugin.js';
// import anthropicPlugin from '@elizaos/plugin-anthropic';
// import openaiPlugin from '@elizaos/plugin-openai';
import { GoalsPlugin } from '@elizaos/plugin-goals';
// Additional plugins - enable if available
// import { RolodexPlugin } from '@elizaos/plugin-rolodex';
// import { pluginManagerPlugin } from '@elizaos/plugin-plugin-manager';
// import { SAMPlugin } from '@elizaos/plugin-sam';
// Import stagehand with correct structure
// import { stagehandPlugin } from '@elizaos/plugin-stagehand'; // DISABLED - server binary not available in container
import { visionPlugin } from '@elizaos/plugin-vision';

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { gameAPIPlugin } from './game-api-plugin.ts';
import { terminalCharacter } from './terminal-character.ts';
import { TodoPlugin } from '@elizaos/plugin-todo';

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
  
  // Create plugin list with ALL plugins enabled as requested
  const plugins: Plugin[] = [
    sqlPlugin,
    bootstrapPlugin,
    ollamaPlugin, // ENABLED - Ollama support for local models
    // openaiPlugin, // Disabled - will be loaded dynamically via ollama plugin
    // anthropicPlugin, // Disabled - will be loaded dynamically via ollama plugin
    autonomyPlugin, // ENABLED - Agent autonomy capabilities
    GoalsPlugin, // ENABLED - Goal management system
    TodoPlugin, // ENABLED - Task management system
    PersonalityPlugin, // ENABLED - Agent personality traits
    experiencePlugin, // ENABLED - Experience and memory management
    knowledgePlugin, // ENABLED - Knowledge base and RAG (using local ollama embeddings)
    shellPlugin, // ENABLED - Shell command execution
    // stagehandPlugin, // TEMPORARILY DISABLED - Browser automation server binary not found in container
    gameAPIPlugin, // ENABLED - Game-specific API endpoints plugin
    visionPlugin, // ENABLED - Vision and image processing (using jimp instead of sharp)
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

  // Enable all plugin capabilities by setting environment variables
  console.log('[AGENT START] Enabling all plugin capabilities...');
  runtime.setSetting('AUTONOMY_ENABLED', 'true');
  runtime.setSetting('ENABLE_AUTONOMY', 'true');
  runtime.setSetting('ENABLE_SHELL', 'true');
  runtime.setSetting('SHELL_ENABLED', 'true');
  runtime.setSetting('ENABLE_BROWSER', 'true');
  runtime.setSetting('BROWSER_ENABLED', 'true');
  runtime.setSetting('ENABLE_VISION', 'true');
  runtime.setSetting('VISION_ENABLED', 'true');
  runtime.setSetting('ENABLE_CAMERA', 'true');
  runtime.setSetting('VISION_CAMERA_ENABLED', 'true');
  runtime.setSetting('ENABLE_MICROPHONE', 'true');
  runtime.setSetting('VISION_MICROPHONE_ENABLED', 'true');
  runtime.setSetting('ENABLE_SPEAKER', 'true');
  runtime.setSetting('VISION_SPEAKER_ENABLED', 'true');
  runtime.setSetting('ENABLE_SCREEN_CAPTURE', 'true');
  runtime.setSetting('VISION_SCREEN_ENABLED', 'true');
  console.log('[AGENT START] ✅ All plugin capabilities enabled');
  
  // Apply dynamic configuration after initialization (re-enabled for full functionality)
  console.log('[AGENT START] Setting up dynamic configuration...');
  try {
    const { DynamicConfigurationManager } = await import('./services/DynamicConfigurationManager.ts');
    const configManager = new DynamicConfigurationManager(runtime);
    
    // Initialize with plugin manager service integration
    await configManager.initialize();
    console.log('[AGENT START] Dynamic configuration manager initialized with plugin management');
    
    // Apply configuration to the runtime
    const currentConfig = configManager.getCurrentConfiguration();
    if (currentConfig) {
        console.log(`[AGENT START] Applied dynamic configuration: ${currentConfig.modelProvider} provider`);
        console.log(`[AGENT START] Available providers:`, configManager.getAvailableProviders().map(p => `${p.name}: ${p.available ? 'available' : 'unavailable' + (p.reason ? ` (${p.reason})` : '')}`));
    }
    
    // Attach the configuration manager to the runtime
    (runtime as any).configManager = configManager;
    console.log('[AGENT START] ✅ Dynamic configuration applied to runtime');
  } catch (error) {
    console.error('[AGENT START] Failed to set up dynamic configuration:', error);
    console.log('[AGENT START] Continuing without dynamic configuration...');
  }
  
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