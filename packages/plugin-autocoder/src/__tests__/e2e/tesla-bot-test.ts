import { createTestRuntime } from '@elizaos/test-utils';
import { autocoderPlugin } from '../../index';
import { CodeGenerationService } from '../../services/CodeGenerationService';

// Import the required plugin dependencies
import { e2bPlugin } from '@elizaos/plugin-e2b';
import { formsPlugin } from '@elizaos/plugin-forms';
import { openaiPlugin } from '@elizaos/plugin-openai';

/**
 * Tesla News Bot Real Generation Test
 *
 * This test creates an actual Tesla news monitoring Discord bot
 * using the real CodeGenerationService with E2B integration.
 */
async function testTeslaBotGeneration() {
  console.log('🚀 Starting Tesla News Bot Generation Test...');
  console.log('This will create a real Tesla news monitoring Discord bot!\n');

  // Verify we have real API keys
  const requiredKeys = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    E2B_API_KEY: process.env.E2B_API_KEY,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
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
      name: 'TeslaBotGeneratorAgent',
      bio: ['An agent that generates Tesla news monitoring bots'],
      system:
        'You are an expert code generation agent that creates production-ready Tesla news monitoring applications.',
      settings: Object.fromEntries(
        Object.entries(requiredKeys)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => [key, value as string])
      ),
    },
    plugins,
  });

  const runtime = result.runtime;
  const harness = result.harness;

  try {
    // Get the REAL CodeGenerationService
    const codeGenService = runtime.getService('code-generation') as CodeGenerationService;
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
    console.log('🎯 Starting Tesla news bot generation...\n');

    // Generate Tesla News Discord Bot
    console.log('🤖 Generating Tesla News Discord Bot...');
    const teslaBot = await codeGenService.generateCode({
      projectName: 'tesla-news-discord-bot',
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
      githubRepo: `tesla-news-discord-bot-${Date.now()}`,
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

      // Show some generated files
      if (teslaBot.files && teslaBot.files.length > 0) {
        console.log('\n📄 Generated Files:');
        teslaBot.files.slice(0, 5).forEach((file) => {
          console.log(`  - ${file.path} (${file.content.length} chars)`);
        });
        if (teslaBot.files.length > 5) {
          console.log(`  ... and ${teslaBot.files.length - 5} more files`);
        }
      }
    } else {
      console.error('❌ Tesla bot generation failed:', teslaBot.errors);
    }

    console.log('\n🎉 Tesla News Bot generation test completed!');
    console.log('\n📋 Summary:');
    console.log(`Tesla Bot: ${teslaBot.success ? '✅ Success' : '❌ Failed'}`);

    if (teslaBot.githubUrl) {
      console.log(`\n🔗 Generated Repository: ${teslaBot.githubUrl}`);
    }

    if (teslaBot.projectPath) {
      console.log(`\n📁 Local Project Path: ${teslaBot.projectPath}`);
    }

    if (teslaBot.agentId) {
      console.log(`\n🤖 Running Agent ID: ${teslaBot.agentId}`);
    }

    console.log('\n💡 Next Steps:');
    console.log('1. Visit the GitHub repository to see the generated code');
    console.log('2. Clone the repository locally to run the bot');
    console.log('3. Follow the README instructions in the repo');
    console.log('4. Configure the .env file with your Discord bot token');
    console.log('5. Run `elizaos start` to launch the Tesla news bot');
  } catch (error) {
    console.error('❌ Tesla bot generation test failed:', error);
    console.error('Error details:', (error as Error).message);
    console.error('Stack trace:', (error as Error).stack);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test environment...');
    await harness.cleanup();
  }
}

// Run the test
if (require.main === module) {
  testTeslaBotGeneration().catch(console.error);
}

export { testTeslaBotGeneration };
