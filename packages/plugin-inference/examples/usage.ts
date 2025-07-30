/**
 * ElizaOS Inference Plugin Usage Examples
 *
 * This file demonstrates various ways to use the inference plugin
 * for dynamic model provider switching.
 */

import { AgentRuntime, ModelType } from '@elizaos/core';
import {
  inferencePlugin,
  getProviderStatus,
  setSelectedProvider,
  setProviderPreferences,
} from '../src';

// Example 1: Basic Setup
async function basicSetup() {
  console.log('=== Basic Setup Example ===');

  // Create an agent runtime with the inference plugin
  const runtime = new AgentRuntime({
    agentId: 'example-agent',
    character: {
      name: 'Example Agent',
      system: 'You are a helpful assistant.',
    },
    plugins: [inferencePlugin],
  });

  // Initialize the runtime
  await runtime.initialize();

  // Use the agent with whatever provider is available
  const response = await runtime.useModel(ModelType.TEXT_SMALL, {
    prompt: 'Hello! What LLM provider are you using?',
  });

  console.log('Response:', response);
}

// Example 2: Checking Provider Status
async function checkProviders(runtime: any) {
  console.log('\n=== Provider Status Example ===');

  const status = await getProviderStatus(runtime);

  console.log('Available Providers:');
  status.providers.forEach((provider) => {
    console.log(`- ${provider.displayName} (${provider.name}): ${provider.status}`);
    if (provider.message) {
      console.log(`  Message: ${provider.message}`);
    }
  });

  console.log(`\nActive Provider: ${status.active || 'None'}`);
  console.log(`Selected Provider: ${status.selected || 'None (using preferences)'}`);
}

// Example 3: Setting Provider Preferences
async function configurePreferences(runtime: any) {
  console.log('\n=== Provider Preferences Example ===');

  // Set preference order - system will use first available
  await setProviderPreferences(runtime, ['anthropic', 'openai', 'ollama', 'elizaos']);
  console.log('Set provider preferences: Anthropic → OpenAI → Ollama → ElizaOS');

  // Check which provider is now active
  const status = await getProviderStatus(runtime);
  console.log(`Active provider after setting preferences: ${status.active}`);
}

// Example 4: Selecting a Specific Provider
async function selectProvider(runtime: any) {
  console.log('\n=== Provider Selection Example ===');

  // Explicitly select OpenAI (if available)
  try {
    await setSelectedProvider(runtime, 'openai');
    console.log('Successfully selected OpenAI as the provider');

    // Generate text using OpenAI
    const response = await runtime.useModel(ModelType.TEXT_LARGE, {
      prompt: 'Write a haiku about AI model providers.',
    });
    console.log('OpenAI Response:', response);
  } catch (error) {
    console.error('Failed to select OpenAI:', error.message);
    console.log('Make sure OPENAI_API_KEY is configured');
  }
}

// Example 5: Handling Multiple Model Types
async function multiModelExample(runtime: any) {
  console.log('\n=== Multi-Model Example ===');

  // Text generation
  const textResponse = await runtime.useModel(ModelType.TEXT_SMALL, {
    prompt: 'Explain quantum computing in one sentence.',
  });
  console.log('Text Generation:', textResponse);

  // Text embedding
  const embedding = await runtime.useModel(ModelType.TEXT_EMBEDDING, {
    text: 'Quantum computing uses quantum mechanics principles.',
  });
  console.log('Embedding dimensions:', embedding.length);

  // Object generation (structured output)
  const objectResponse = await runtime.useModel(ModelType.OBJECT_SMALL, {
    prompt:
      'Generate a JSON object with name, age, and occupation fields for a fictional character.',
  });
  console.log('Structured Output:', objectResponse);
}

// Example 6: Fallback Behavior
async function fallbackExample(runtime: any) {
  console.log('\n=== Fallback Behavior Example ===');

  // Select a provider that might not be available
  await setSelectedProvider(runtime, 'anthropic');

  const status = await getProviderStatus(runtime);
  const anthropicProvider = status.providers.find((p) => p.name === 'anthropic');

  if (anthropicProvider?.status !== 'available') {
    console.log('Anthropic is not available, system will fall back to next available provider');
    console.log(`Active provider: ${status.active}`);
  }

  // This will still work, using the fallback provider
  const response = await runtime.useModel(ModelType.TEXT_SMALL, {
    prompt: 'Hello from the fallback provider!',
  });
  console.log('Response:', response);
}

// Example 7: Environment Configuration
function showEnvironmentSetup() {
  console.log('\n=== Environment Configuration ===');
  console.log(`
Configure providers using environment variables:

# OpenAI
OPENAI_API_KEY=your-api-key

# Anthropic
ANTHROPIC_API_KEY=your-api-key

# Ollama (local)
OLLAMA_API_ENDPOINT=http://localhost:11434

# ElizaOS Cloud
ELIZAOS_API_KEY=your-api-key

# Provider preferences (optional)
INFERENCE_PREFERENCES=anthropic,openai,ollama,elizaos

# Selected provider (optional)
SELECTED_PROVIDER=openai
  `);
}

// Example 8: REST API Usage
function showAPIUsage() {
  console.log('\n=== REST API Usage ===');
  console.log(`
The inference plugin exposes REST endpoints when used with agentserver:

# Get provider status
curl http://localhost:3000/api/providers

# Set selected provider
curl -X PUT http://localhost:3000/api/providers/selected \\
  -H "Content-Type: application/json" \\
  -d '{"provider": "anthropic"}'

# Set provider preferences
curl -X PUT http://localhost:3000/api/providers/preferences \\
  -H "Content-Type: application/json" \\
  -d '{"preferences": ["anthropic", "openai", "ollama"]}'
  `);
}

// Main function to run all examples
async function main() {
  console.log('ElizaOS Inference Plugin Examples\n');

  // Show environment setup
  showEnvironmentSetup();

  // Create a runtime for examples
  const runtime = new AgentRuntime({
    agentId: 'example-agent',
    character: {
      name: 'Example Agent',
      system: 'You are a helpful assistant.',
    },
    plugins: [inferencePlugin],
  });

  // Note: In a real application, you would have API keys configured
  // For this example, we'll simulate with mock settings
  runtime.setSetting('OPENAI_API_KEY', process.env.OPENAI_API_KEY || 'mock-key');
  runtime.setSetting('OLLAMA_API_ENDPOINT', 'http://localhost:11434');

  await runtime.initialize();

  // Run examples
  await checkProviders(runtime);
  await configurePreferences(runtime);
  await selectProvider(runtime);
  await multiModelExample(runtime);
  await fallbackExample(runtime);

  // Show API usage
  showAPIUsage();
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
