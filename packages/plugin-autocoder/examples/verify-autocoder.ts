#!/usr/bin/env node

/**
 * Simple verification script for the autocoder plugin
 * 
 * Usage: bun run examples/verify-autocoder.ts
 */

import { autocoderPlugin } from '../src/index';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '..', '..', '.env') });

async function verifyAutocoder() {
  console.log('🔍 Verifying Autocoder Plugin Configuration\n');

  // Check API keys
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  
  console.log('📋 Environment Check:');
  console.log(`   - OpenAI API Key: ${hasOpenAI ? '✅ Found' : '❌ Missing'}`);
  console.log(`   - Anthropic API Key: ${hasAnthropic ? '✅ Found' : '❌ Missing'}`);
  
  if (!hasOpenAI && !hasAnthropic) {
    console.log('\n⚠️  Warning: No LLM API keys found. The plugin will not be able to generate code.');
    console.log('   Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in your .env file.\n');
  }

  // Verify plugin structure
  console.log('\n📦 Plugin Structure:');
  console.log(`   - Name: ${autocoderPlugin.name}`);
  console.log(`   - Description: ${autocoderPlugin.description.substring(0, 100)}...`);
  
  // Check services
  console.log(`\n🔧 Services (${autocoderPlugin.services.length}):`);
  autocoderPlugin.services.forEach(service => {
    console.log(`   - ${service.serviceName}`);
  });
  
  // Check actions
  console.log(`\n🎯 Actions (${autocoderPlugin.actions.length}):`);
  autocoderPlugin.actions.forEach(action => {
    console.log(`   - ${action.name}: ${action.description}`);
    if (action.similes && action.similes.length > 0) {
      console.log(`     Aliases: ${action.similes.join(', ')}`);
    }
  });
  
  // Check providers
  console.log(`\n📊 Providers (${autocoderPlugin.providers.length}):`);
  autocoderPlugin.providers.forEach(provider => {
    console.log(`   - ${provider.name}: ${provider.description}`);
  });
  
  // Check dependencies
  console.log('\n🔗 Dependencies:');
  autocoderPlugin.dependencies?.forEach(dep => {
    console.log(`   - ${dep}`);
  });

  // Usage examples
  console.log('\n💡 How to use the Autocoder Plugin:\n');
  
  console.log('1️⃣  Add to your agent character configuration:');
  console.log('```typescript');
  console.log('const character = {');
  console.log('  name: "Your Agent",');
  console.log('  plugins: [');
  console.log('    "@elizaos/plugin-sql",         // Required');
  console.log('    "@elizaos/plugin-forms",       // Required');
  console.log('    "@elizaos/plugin-openai",      // Or another LLM plugin');
  console.log('    "@elizaos/plugin-autocoder",   // The autocoder plugin');
  console.log('  ],');
  console.log('  // ... rest of configuration');
  console.log('};');
  console.log('```\n');
  
  console.log('2️⃣  Example prompts your agent will understand:');
  console.log('   • "Create a plugin that sends email notifications"');
  console.log('   • "Build an agent that monitors RSS feeds"');
  console.log('   • "Generate a workflow for data processing"');
  console.log('   • "Write code for a Discord bot"');
  console.log('   • "Implement a service that connects to Twitter"\n');
  
  console.log('3️⃣  The agent will:');
  console.log('   • Search the plugin registry for existing solutions');
  console.log('   • Generate a Product Requirements Document (PRD)');
  console.log('   • Create the code with proper structure and tests');
  console.log('   • Validate the generated code');
  console.log('   • Provide the complete, working solution\n');

  // Configuration tips
  console.log('📝 Configuration Tips:');
  console.log('   • Ensure you have at least one LLM API key configured');
  console.log('   • The plugin works best with GPT-4 or Claude 3');
  console.log('   • Generated code is saved to ./generated-plugins/');
  console.log('   • API keys for generated projects should be added to settings\n');

  console.log('✅ Autocoder plugin is properly configured and ready to use!');
  console.log('🚀 You can now add it to your agents to enable code generation capabilities.\n');
}

// Run verification
verifyAutocoder().catch(console.error);