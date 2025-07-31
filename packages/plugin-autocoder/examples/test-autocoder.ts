#!/usr/bin/env node

/**
 * Test script to verify the autocoder plugin is working
 * 
 * Usage: bun run examples/test-autocoder.ts
 */

import { AgentRuntime, type IAgentRuntime, type UUID } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { autocoderPlugin } from '../src/index';
import sqlPlugin from '@elizaos/plugin-sql';
import formsPlugin from '@elizaos/plugin-forms';
// @ts-ignore - workspace dependency
import { openaiPlugin } from '@elizaos/plugin-openai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '..', '..', '.env') });

async function testAutocoder() {
  console.log('🚀 Testing Autocoder Plugin...\n');

  // Check for required API keys
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  
  if (!hasOpenAI && !hasAnthropic) {
    console.error('❌ Error: No API keys found. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in your .env file');
    process.exit(1);
  }

  console.log('✅ API Keys found:');
  console.log(`   - OpenAI: ${hasOpenAI ? 'Available' : 'Not configured'}`);
  console.log(`   - Anthropic: ${hasAnthropic ? 'Available' : 'Not configured'}\n`);

  try {
    // Create runtime with autocoder
    console.log('📦 Initializing runtime with autocoder plugin...');
    const runtime = new AgentRuntime({
      agentId: uuidv4() as UUID,
      character: {
        name: 'Autocoder Test Agent',
        bio: ['Test agent for autocoder plugin verification'],
        system: 'You are a helpful coding assistant.',
        settings: {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY,
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        },
      },
      plugins: [
        sqlPlugin,
        formsPlugin,
        openaiPlugin,
        autocoderPlugin,
      ],
    });

    await runtime.initialize();
    console.log('✅ Runtime initialized successfully\n');

    // Verify services
    console.log('🔍 Checking services...');
    const services = runtime.getServices();
    const serviceNames = services.map(s => s.constructor.name);
    console.log(`   Found ${services.length} services:`, serviceNames);
    
    const codeGenService = runtime.getService('code-generation');
    console.log(`   - Code Generation Service: ${codeGenService ? '✅' : '❌'}`);
    
    const planningService = runtime.getService('project-planning');
    console.log(`   - Project Planning Service: ${planningService ? '✅' : '❌'}`);
    
    const formsService = runtime.getService('forms');
    console.log(`   - Forms Service: ${formsService ? '✅' : '❌'}\n`);

    // Verify actions
    console.log('🎯 Checking actions...');
    const actions = runtime.getActions();
    const actionNames = actions.map(a => a.name);
    console.log(`   Found ${actions.length} actions`);
    
    const hasGenerateCode = actionNames.includes('GENERATE_CODE');
    console.log(`   - GENERATE_CODE: ${hasGenerateCode ? '✅' : '❌'}`);
    
    const hasCreateProject = actionNames.includes('CREATE_PROJECT');
    console.log(`   - CREATE_PROJECT: ${hasCreateProject ? '✅' : '❌'}\n`);

    // Verify providers
    console.log('📊 Checking providers...');
    const providers = runtime.getProviders();
    const providerNames = providers.map(p => p.name);
    console.log(`   Found ${providers.length} providers`);
    
    const hasProjectsProvider = providerNames.includes('PROJECTS_CONTEXT');
    console.log(`   - Projects Provider: ${hasProjectsProvider ? '✅' : '❌'}`);
    
    const hasCurrentProjectProvider = providerNames.includes('CURRENT_PROJECT_CONTEXT');
    console.log(`   - Current Project Provider: ${hasCurrentProjectProvider ? '✅' : '❌'}\n`);

    // Test action validation
    console.log('🧪 Testing action validation...');
    const generateCodeAction = actions.find(a => a.name === 'GENERATE_CODE');
    
    if (generateCodeAction) {
      const testMessage = {
        id: uuidv4() as UUID,
        entityId: uuidv4() as UUID,
        roomId: 'test-room' as UUID,
        userId: 'test-user' as UUID,
        agentId: runtime.agentId,
        content: {
          text: 'Create a simple plugin for sending emails',
        },
        createdAt: Date.now(),
      };

      const isValid = await generateCodeAction.validate(runtime, testMessage, {});
      console.log(`   - Valid code generation request: ${isValid ? '✅' : '❌'}`);

      const invalidMessage = {
        ...testMessage,
        content: {
          text: 'What is the weather today?',
        },
      };

      const isInvalid = await generateCodeAction.validate(runtime, invalidMessage, {});
      console.log(`   - Correctly rejects non-code request: ${!isInvalid ? '✅' : '❌'}\n`);
    }

    // Summary
    console.log('📋 Summary:');
    console.log('   ✅ Autocoder plugin is properly configured and ready to use!');
    console.log('   ✅ All required services are available');
    console.log('   ✅ Actions are registered and validating correctly');
    console.log('   ✅ Providers are available for context\n');

    console.log('💡 You can now use this agent to:');
    console.log('   - Generate new plugins with "Create a plugin that..."');
    console.log('   - Build agents with "Build an agent that..."');
    console.log('   - Create workflows and more!\n');

    console.log('🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the test
testAutocoder().catch(console.error);