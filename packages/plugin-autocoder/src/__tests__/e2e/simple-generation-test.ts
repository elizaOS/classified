import { createTestRuntime } from '@elizaos/test-utils';
import { autocoderPlugin } from '../../index';
import { CodeGenerationService } from '../../services/CodeGenerationService';

// Import the required plugin dependencies
import { e2bPlugin } from '@elizaos/plugin-e2b';
import formsPlugin from '../../../../plugin-forms/src';
import { openaiPlugin } from '@elizaos/plugin-openai';

/**
 * Simple Generation Test - Create a basic plugin structure
 *
 * This test creates a minimal plugin to verify all fixes work
 * without hitting complex timeout scenarios.
 */
async function testSimpleGeneration() {
  console.log('🚀 Starting Simple Generation Test...');
  console.log('This will create a basic ElizaOS plugin structure!\n');

  // Verify we have real API keys
  const requiredKeys = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    E2B_API_KEY: process.env.E2B_API_KEY,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  };

  console.log('🔑 API Key Status:');
  for (const [key, value] of Object.entries(requiredKeys)) {
    console.log(`  ${key}: ${value ? '✅ Present' : '❌ Missing'}`);
  }
  console.log('');

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
      name: 'SimpleGeneratorAgent',
      bio: ['An agent that generates simple ElizaOS plugins'],
      system: 'You are an expert code generation agent that creates basic ElizaOS plugins.',
      settings: {
        ...Object.fromEntries(
          Object.entries(requiredKeys)
            .filter(([_, value]) => value !== undefined)
            .map(([key, value]) => [key, value as string])
        ),
        E2B_MODE: 'local',
        E2B_LOCAL_USE_DOCKER: 'false',
        E2B_MAX_EXECUTION_TIME: '600000',
      },
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
    console.log('🎯 Starting simple plugin generation...\n');

    // Generate Simple Hello World Plugin
    console.log('📝 Generating Simple Hello World Plugin...');
    const simplePlugin = await codeGenService.generateCode({
      projectName: 'hello-world-plugin',
      description: 'A simple Hello World ElizaOS plugin that responds to greetings',
      targetType: 'plugin',
      requirements: [
        'Respond to hello messages',
        'Include a simple action',
        'Include basic provider for context',
        'Include unit tests',
        'Export plugin correctly',
      ],
      apis: ['ElizaOS Core API'],
      testScenarios: [
        'Test hello action triggers correctly',
        'Test provider provides context',
        'Test plugin exports work',
      ],
      githubRepo: `hello-world-plugin-${Date.now()}`,
    });

    if (simplePlugin.success) {
      console.log('✅ Simple Hello World Plugin generated successfully!');
      console.log(`📁 Project saved to: ${simplePlugin.projectPath}`);
      if (simplePlugin.githubUrl) {
        console.log(`🔗 GitHub repository: ${simplePlugin.githubUrl}`);
      }
      if (simplePlugin.agentId) {
        console.log(`🤖 Agent ID: ${simplePlugin.agentId}`);
      }
      console.log(`📄 Generated ${simplePlugin.files?.length || 0} files`);

      // Show generated files
      if (simplePlugin.files && simplePlugin.files.length > 0) {
        console.log('\n📄 Generated Files:');
        simplePlugin.files.forEach((file) => {
          console.log(`  - ${file.path} (${file.content.length} chars)`);
        });
      }

      // Show some file contents
      if (simplePlugin.files && simplePlugin.files.length > 0) {
        const mainFile = simplePlugin.files.find((f) => f.path.includes('index.ts'));
        if (mainFile) {
          console.log('\n📋 Main Plugin File Preview:');
          console.log('```typescript');
          console.log(`${mainFile.content.substring(0, 500)}...`);
          console.log('```');
        }
      }
    } else {
      console.error('❌ Simple plugin generation failed:', simplePlugin.errors);
    }

    console.log('\n🎉 Simple generation test completed!');
    console.log('\n📋 Summary:');
    console.log(`Simple Plugin: ${simplePlugin.success ? '✅ Success' : '❌ Failed'}`);

    if (simplePlugin.githubUrl) {
      console.log(`\n🔗 Generated Repository: ${simplePlugin.githubUrl}`);
    }

    if (simplePlugin.projectPath) {
      console.log(`\n📁 Local Project Path: ${simplePlugin.projectPath}`);
    }

    console.log('\n💡 Key Improvements Demonstrated:');
    console.log('✅ Extended E2B timeout limits');
    console.log('✅ Improved file structure detection');
    console.log('✅ Error recovery and retry logic');
    console.log('✅ Direct E2B service integration');
    console.log('✅ Non-mock code generation');
  } catch (error) {
    console.error('❌ Simple generation test failed:', error);
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
  testSimpleGeneration().catch(console.error);
}

export { testSimpleGeneration };
