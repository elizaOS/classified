import { createTestRuntime } from '@elizaos/test-utils';
import { autocoderPlugin } from '../../index';
import { CodeGenerationService } from '../../services/CodeGenerationService';
import { E2BService } from '@elizaos/plugin-e2b';
import { e2bPlugin } from '@elizaos/plugin-e2b';
import formsPlugin from '@elizaos/plugin-forms';
import { openaiPlugin } from '@elizaos/plugin-openai';

async function testSandboxGeneration() {
  console.log('🚀 Testing real sandbox-based Claude Code generation...\n');

  // Check required API keys
  const requiredKeys = ['OPENAI_API_KEY', 'E2B_API_KEY'];
  const missingKeys = requiredKeys.filter((key) => !process.env[key]);

  if (missingKeys.length > 0) {
    console.error('❌ Missing required API keys:', missingKeys.join(', '));
    console.log('\nPlease set the following environment variables:');
    missingKeys.forEach((key) => console.log(`  export ${key}=your_api_key_here`));
    process.exit(1);
  }

  // Create real runtime with all required plugins
  const plugins = [openaiPlugin, e2bPlugin, formsPlugin, autocoderPlugin];

  const result = await createTestRuntime({
    character: {
      name: 'SandboxTestAgent',
      bio: ['An agent that tests sandbox code generation'],
      system: 'You are a helpful code generation test agent.',
      settings: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
        E2B_API_KEY: process.env.E2B_API_KEY!,
        ...(process.env.GITHUB_TOKEN && { GITHUB_TOKEN: process.env.GITHUB_TOKEN }),
        E2B_MODE: 'cloud', // Use real E2B cloud for this test
        E2B_MAX_EXECUTION_TIME: '600000',
        E2B_SANDBOX_TIMEOUT: '1200000',
      },
    },
    plugins,
  });

  const runtime = result.runtime;
  const harness = result.harness;

  try {
    // Get services from runtime
    const codeGenService = runtime.getService('code-generation') as CodeGenerationService;
    const e2bService = runtime.getService('e2b') as E2BService;

    if (!codeGenService || !e2bService) {
      console.error('❌ Required services not found!');
      return;
    }

    console.log('✅ Services initialized successfully');
    console.log('📦 Testing sandbox code generation...\n');

    // Test 1: Simple Plugin Generation
    const pluginRequest = {
      projectName: 'weather-plugin',
      description: 'A simple weather information plugin for ElizaOS',
      requirements: [
        'Get current weather for a city',
        'Support temperature in Celsius and Fahrenheit',
        'Include weather description',
      ],
      apis: ['OpenWeatherMap API'],
      targetType: 'plugin' as const,
      testScenarios: ['Get weather for New York', 'Get weather for London in Celsius'],
    };

    console.log('🌤️ Generating weather plugin...');
    const pluginResult = await codeGenService.generateCode(pluginRequest);

    if (pluginResult.success) {
      console.log('✅ Weather plugin generated successfully!');
      console.log(`📁 Project path: ${pluginResult.projectPath}`);
      console.log(`📄 Files generated: ${pluginResult.files?.length || 0}`);

      if (pluginResult.files && pluginResult.files.length > 0) {
        console.log('\nGenerated files:');
        pluginResult.files.forEach((file: any) => {
          console.log(`  - ${file.path}`);
        });
      }

      if (pluginResult.executionResults) {
        console.log('\nExecution results:');
        console.log(`  Tests: ${pluginResult.executionResults.testsPass ? '✅' : '❌'}`);
        console.log(`  Lint: ${pluginResult.executionResults.lintPass ? '✅' : '❌'}`);
        console.log(`  Types: ${pluginResult.executionResults.typesPass ? '✅' : '❌'}`);
        console.log(`  Build: ${pluginResult.executionResults.buildPass ? '✅' : '❌'}`);
      }
    } else {
      console.error('❌ Plugin generation failed:', pluginResult.errors);
    }

    // Test 2: Agent Generation
    console.log('\n🤖 Generating customer support agent...');
    const agentRequest = {
      projectName: 'support-agent',
      description: 'A customer support agent that helps users with common issues',
      requirements: [
        'Handle frequently asked questions',
        'Escalate complex issues',
        'Maintain conversation history',
      ],
      apis: [],
      targetType: 'agent' as const,
      testScenarios: ['User asks about refund policy', 'User reports a bug'],
    };

    const agentResult = await codeGenService.generateCode(agentRequest);

    if (agentResult.success) {
      console.log('✅ Support agent generated successfully!');
      console.log(`📁 Project path: ${agentResult.projectPath}`);
      console.log(`📄 Files generated: ${agentResult.files?.length || 0}`);
    } else {
      console.error('❌ Agent generation failed:', agentResult.errors);
    }

    // Test 3: Complex Full-Stack App
    console.log('\n🌐 Generating full-stack application...');
    const fullStackRequest = {
      projectName: 'task-manager',
      description: 'A full-stack task management application with ElizaOS integration',
      requirements: [
        'React frontend with task list UI',
        'Express backend with REST API',
        'SQLite database for persistence',
        'ElizaOS agent for natural language task management',
      ],
      apis: [],
      targetType: 'full-stack' as const,
      testScenarios: ['Create a new task', 'Mark task as complete', 'Delete a task'],
    };

    const fullStackResult = await codeGenService.generateCode(fullStackRequest);

    if (fullStackResult.success) {
      console.log('✅ Full-stack app generated successfully!');
      console.log(`📁 Project path: ${fullStackResult.projectPath}`);
      console.log(`📄 Files generated: ${fullStackResult.files?.length || 0}`);
    } else {
      console.error('❌ Full-stack generation failed:', fullStackResult.errors);
    }

    console.log('\n🎉 All sandbox generation tests completed!');
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  } finally {
    // Cleanup
    if (harness && typeof harness.cleanup === 'function') {
      await harness.cleanup();
    }
    console.log('\n🧹 Test runtime cleaned up');
  }
}

// Run the test
testSandboxGeneration().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
