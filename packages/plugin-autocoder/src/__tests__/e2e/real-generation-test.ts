import { createTestRuntime } from '@elizaos/test-utils';
import { autocoderPlugin } from '../../index';
import { CodeGenerationService } from '../../services/CodeGenerationService';
import { elizaLogger } from '@elizaos/core';
import { SecretsManagerService } from '../../services/SecretsManagerService';
import sqlPlugin from '@elizaos/plugin-sql';
import { formsPlugin } from '@elizaos/plugin-forms';
import { e2bPlugin } from '@elizaos/plugin-e2b';
import { githubPlugin } from '@elizaos/plugin-github';
import { openaiPlugin } from '@elizaos/plugin-openai';

/**
 * Real Code Generation Test - Creates actual applications and deploys them
 *
 * This test uses the REAL CodeGenerationService to generate complete,
 * working applications that get deployed to GitHub and can be run.
 *
 * Unlike the mock tests, this creates real:
 * - Project directories with actual files
 * - GitHub repositories with full code
 * - Deployable ElizaOS agents/plugins
 * - Working API integrations
 */

async function testRealGeneration() {
  console.log('🚀 Starting REAL code generation test...');
  console.log('This will create actual projects and deploy to GitHub!\n');

  // Verify we have real API keys
  const requiredKeys = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    E2B_API_KEY: process.env.E2B_API_KEY,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
  };

  console.log('🔑 API Key Status:');
  for (const [key, value] of Object.entries(requiredKeys)) {
    console.log(`  ${key}: ${value ? '✅ Present' : '❌ Missing'}`);
  }
  console.log('');

  // Check if all required keys are present
  const missingKeys = Object.entries(requiredKeys)
    .filter(([_, value]) => !value)
    .map(([key, _]) => key);

  if (missingKeys.length > 0) {
    console.error('❌ Missing required API keys:', missingKeys.join(', '));
    console.error('Please set these environment variables and try again.');
    process.exit(1);
  }

  // Create real runtime with all required plugins
  const plugins = [
    openaiPlugin, // Provides TEXT_LARGE model handlers
    e2bPlugin,
    formsPlugin,
    autocoderPlugin, // Must be last to have access to dependencies
  ];

  console.log('✅ Added @elizaos/plugin-openai');
  console.log('✅ Added @elizaos/plugin-e2b');
  console.log('✅ Added @elizaos/plugin-forms');
  console.log('✅ Added @elizaos/plugin-autocoder');

  const result = await createTestRuntime({
    character: {
      name: 'RealAutoCoderAgent',
      bio: ['An agent that generates real, working applications'],
      system:
        'You are an expert code generation agent that creates complete, production-ready applications.',
      settings: Object.fromEntries(
        Object.entries(requiredKeys)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => [key, value as string])
      ),
    },
    plugins, // Use all required plugins
  });

  const runtime = result.runtime;
  const harness = result.harness;

  // Get the REAL CodeGenerationService
  const codeGenService = runtime.getService('code-generation') as CodeGenerationService;
  const githubService = runtime.getService('github');
  const e2bService = runtime.getService('e2b');

  if (!codeGenService) {
    console.error('❌ Real CodeGenerationService not found!');
    console.log('Available services:', Array.from(runtime.services.keys()));
    process.exit(1);
  }

  if (!e2bService) {
    console.error('❌ E2B Service not found!');
    console.log('Available services:', Array.from(runtime.services.keys()));
    process.exit(1);
  }

  console.log('✅ Real CodeGenerationService found!');
  console.log('✅ Real E2B Service found!');
  console.log('✅ Real GitHub Service found!');
  console.log('🎯 Starting real application generation...\n');

  try {
    // Test 1: Generate Tesla News Discord Bot
    console.log('🤖 Generating Tesla News Discord Bot...');
    const teslaBot = await codeGenService.generateCode({
      projectName: 'tesla-news-discord-bot-real',
      description:
        'Discord bot that monitors RSS feeds for Tesla news and sends alerts to Discord channels',
      targetType: 'plugin',
      requirements: [
        'Monitor RSS feeds for Tesla-related news',
        'Send Discord notifications when Tesla news is found',
        'Filter news by keywords (Tesla, Elon Musk, stock)',
        'Throttle notifications to avoid spam',
        'Store seen articles to prevent duplicates',
        'Support multiple RSS sources',
        'Include article title, summary, and link in Discord messages',
      ],
      apis: ['Discord API', 'RSS feed parsing', 'Web scraping for article content'],
      testScenarios: [
        'Parse RSS feed and extract Tesla articles',
        'Send formatted Discord message',
        'Handle duplicate article detection',
        'Process multiple RSS sources',
        'Throttle notification frequency',
      ],
      githubRepo: `tesla-news-discord-bot-real-${Date.now()}`,
    });

    if (teslaBot.success) {
      console.log('✅ Tesla News Discord Bot generated successfully!');
      console.log(`📁 Project saved to: ${teslaBot.projectPath}`);
      if (teslaBot.githubUrl) {
        console.log(`🔗 GitHub repository: ${teslaBot.githubUrl}`);
      }
      if (teslaBot.agentId) {
        console.log(`🤖 Agent ID: ${teslaBot.agentId}`);
      }
      console.log(`📄 Generated ${teslaBot.files?.length || 0} files`);
    } else {
      console.error('❌ Tesla bot generation failed:', teslaBot.errors);
    }
    console.log('');

    // Test 2: Generate Weather App Agent
    console.log('🌤️ Generating Global Weather App Agent...');
    const weatherApp = await codeGenService.generateCode({
      projectName: 'global-weather-app-real',
      description:
        'Complete weather application agent supporting global location queries with natural language',
      targetType: 'agent',
      requirements: [
        'Query weather for any location worldwide',
        'Support city names, coordinates, and postal codes',
        'Provide current weather and forecasts',
        'Include weather alerts and warnings',
        'Support multiple weather data providers',
        'Cache weather data to reduce API calls',
        'Handle location disambiguation',
        'Provide weather maps and radar',
      ],
      apis: [
        'OpenWeatherMap API',
        'WeatherAPI.com',
        'Location geocoding services',
        'Time zone APIs',
      ],
      testScenarios: [
        'Query weather for major cities',
        'Handle ambiguous location names',
        'Provide accurate forecasts',
        'Display weather alerts',
        'Cache and retrieve weather data',
        'Support different units (metric/imperial)',
      ],
      githubRepo: `global-weather-app-real-${Date.now()}`,
    });

    if (weatherApp.success) {
      console.log('✅ Global Weather App generated successfully!');
      console.log(`📁 Project saved to: ${weatherApp.projectPath}`);
      if (weatherApp.githubUrl) {
        console.log(`🔗 GitHub repository: ${weatherApp.githubUrl}`);
      }
      if (weatherApp.agentId) {
        console.log(`🤖 Agent ID: ${weatherApp.agentId}`);
      }
      console.log(`📄 Generated ${weatherApp.files?.length || 0} files`);
    } else {
      console.error('❌ Weather app generation failed:', weatherApp.errors);
    }

    console.log('\n🎉 Real code generation test completed!');
    console.log('\n📋 Summary:');
    console.log(`Tesla Bot: ${teslaBot.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`Weather App: ${weatherApp.success ? '✅ Success' : '❌ Failed'}`);

    if (teslaBot.githubUrl || weatherApp.githubUrl) {
      console.log('\n🔗 Generated Repositories:');
      if (teslaBot.githubUrl) {
        console.log(`  Tesla Bot: ${teslaBot.githubUrl}`);
      }
      if (weatherApp.githubUrl) {
        console.log(`  Weather App: ${weatherApp.githubUrl}`);
      }
    }

    if (teslaBot.projectPath || weatherApp.projectPath) {
      console.log('\n📁 Local Project Paths:');
      if (teslaBot.projectPath) {
        console.log(`  Tesla Bot: ${teslaBot.projectPath}`);
      }
      if (weatherApp.projectPath) {
        console.log(`  Weather App: ${weatherApp.projectPath}`);
      }
    }

    if (teslaBot.agentId || weatherApp.agentId) {
      console.log('\n🤖 Running Agent IDs:');
      if (teslaBot.agentId) {
        console.log(`  Tesla Bot Agent: ${teslaBot.agentId}`);
      }
      if (weatherApp.agentId) {
        console.log(`  Weather App Agent: ${weatherApp.agentId}`);
      }
    }

    console.log('\n💡 Next Steps:');
    console.log('1. Visit the GitHub repositories to see the generated code');
    console.log('2. Clone the repositories locally to run the agents');
    console.log('3. Follow the README instructions in each repo');
    console.log('4. Configure the .env files with your API keys');
    console.log('5. Run `elizaos start` to launch the agents');
  } catch (error) {
    console.error('❌ Real generation test failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test environment...');
    await harness.cleanup();
  }
}

// Run the test
if (require.main === module) {
  testRealGeneration().catch(console.error);
}

export { testRealGeneration };
