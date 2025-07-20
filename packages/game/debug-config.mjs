#!/usr/bin/env node

// Debug script to test knowledge plugin configuration
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

// Set environment variables like the server does
process.env.LOAD_DOCS_ON_STARTUP = process.env.LOAD_DOCS_ON_STARTUP || 'true';
process.env.CTX_KNOWLEDGE_ENABLED = process.env.CTX_KNOWLEDGE_ENABLED || 'true';

console.log('=== Environment Variables ===');
console.log('LOAD_DOCS_ON_STARTUP:', process.env.LOAD_DOCS_ON_STARTUP);
console.log('CTX_KNOWLEDGE_ENABLED:', process.env.CTX_KNOWLEDGE_ENABLED);

// Mock runtime object similar to what the actual runtime would have
const mockRuntime = {
  getSetting: (key) => {
    // This mimics how AgentRuntime.getSetting() might work
    const settings = {
      'LOAD_DOCS_ON_STARTUP': 'true',
      'CTX_KNOWLEDGE_ENABLED': 'true',
      'EMBEDDING_PROVIDER': 'openai',
      'TEXT_EMBEDDING_MODEL': 'text-embedding-3-small',
      'TEXT_PROVIDER': 'openai'
    };
    console.log(`Mock runtime.getSetting('${key}') returning:`, settings[key]);
    return settings[key];
  },
  character: {
    settings: {
      LOAD_DOCS_ON_STARTUP: 'true',
      CTX_KNOWLEDGE_ENABLED: 'true',
      EMBEDDING_PROVIDER: 'openai',
      TEXT_EMBEDDING_MODEL: 'text-embedding-3-small',
      TEXT_PROVIDER: 'openai'
    }
  }
};

console.log('\n=== Mock Runtime Character Settings ===');
console.log('character.settings:', mockRuntime.character.settings);

// Test the config validation logic manually
console.log('\n=== Testing Configuration Logic ===');

// Check if CTX_KNOWLEDGE_ENABLED is set
const ctxKnowledgeEnabled =
  mockRuntime?.getSetting('CTX_KNOWLEDGE_ENABLED') === 'true' ||
  mockRuntime?.character?.settings?.CTX_KNOWLEDGE_ENABLED === 'true' ||
  process.env.CTX_KNOWLEDGE_ENABLED === 'true' ||
  false;

console.log('CTX_KNOWLEDGE_ENABLED result:', ctxKnowledgeEnabled);

// Check if docs should be loaded on startup - default to true unless explicitly disabled
const loadDocsOnStartup =
  mockRuntime?.getSetting('LOAD_DOCS_ON_STARTUP') === 'true' ||
  mockRuntime?.character?.settings?.LOAD_DOCS_ON_STARTUP === 'true' ||
  process.env.LOAD_DOCS_ON_STARTUP === 'true' ||
  (mockRuntime?.getSetting('LOAD_DOCS_ON_STARTUP') !== 'false' &&
   mockRuntime?.character?.settings?.LOAD_DOCS_ON_STARTUP !== 'false' &&
   process.env.LOAD_DOCS_ON_STARTUP !== 'false');

console.log('LOAD_DOCS_ON_STARTUP result:', loadDocsOnStartup);

console.log('\n=== Final Configuration ===');
console.log({
  CTX_KNOWLEDGE_ENABLED: ctxKnowledgeEnabled,
  LOAD_DOCS_ON_STARTUP: loadDocsOnStartup
});