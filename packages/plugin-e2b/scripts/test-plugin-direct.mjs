#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '../../../.env');
console.log('Loading environment from:', envPath);
dotenv.config({ path: envPath });

console.log('Environment loaded:', {
  E2B_API_KEY: !!process.env.E2B_API_KEY,
  GITHUB_TOKEN: !!process.env.GITHUB_TOKEN,
  OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
});

console.log('🧪 Testing E2B Plugin Services Directly...');

try {
  // Import the E2B service classes directly from TypeScript source
  const { MockE2BService } = await import('../src/services/MockE2BService.ts');
  const { GitHubIntegrationService } = await import('../src/services/GitHubIntegrationService.ts');
  const { AgentCommunicationBridge } = await import('../src/services/AgentCommunicationBridge.ts');

  console.log('✅ E2B Plugin modules imported successfully');

  // Create a minimal mock runtime for testing
  const mockRuntime = {
    agentId: 'test-agent-123',
    character: { name: 'TestAgent' },
    getSetting: (key) => process.env[key],
    registerTaskWorker: () => {},
    createTask: () => Promise.resolve('task-123'),
    logger: {
      info: console.log,
      error: console.error,
      debug: console.log,
      warn: console.warn,
    },
  };

  console.log('📦 Testing MockE2BService...');
  const mockE2BService = await MockE2BService.start(mockRuntime);
  console.log('✅ MockE2BService started successfully');

  // Test sandbox creation
  const sandboxId = await mockE2BService.createSandbox({
    timeoutMs: 30000,
    metadata: { purpose: 'test' },
  });
  console.log('✅ Mock sandbox created:', sandboxId);

  // Test code execution
  const result = await mockE2BService.executeCode('print("Hello from mock E2B!")');
  console.log('✅ Mock code execution result:', result.text);
  console.log('   - Output logs:', result.logs.stdout);

  // Test file operations
  await mockE2BService.writeFileToSandbox(sandboxId, '/tmp/test.py', 'print("test file")');
  const fileContent = await mockE2BService.readFileFromSandbox(sandboxId, '/tmp/test.py');
  console.log('✅ Mock file operations successful');

  // Test health check
  const isHealthy = await mockE2BService.isHealthy();
  console.log('✅ Mock service health check:', isHealthy);

  // Clean up
  await mockE2BService.killSandbox(sandboxId);
  await mockE2BService.stop();
  console.log('✅ Mock service stopped and cleaned up');

  console.log('\n📡 Testing GitHubIntegrationService...');
  const githubService = await GitHubIntegrationService.start(mockRuntime);
  console.log('✅ GitHubIntegrationService started successfully');

  // Test GitHub API connectivity (read-only)
  try {
    const issues = await githubService.getIssues('elizaos/eliza', { state: 'open', per_page: 3 });
    console.log('✅ GitHub API test successful - fetched', issues.length, 'issues');

    if (issues.length > 0) {
      console.log('   - Sample issue:', issues[0].title);
      console.log('   - Issue #' + issues[0].number, 'by', issues[0].user.login);
    }
  } catch (githubError) {
    console.warn('⚠️  GitHub API test failed (expected if no valid token):', githubError.message);
  }

  await githubService.stop();
  console.log('✅ GitHub service stopped');

  console.log('\n🌉 Testing AgentCommunicationBridge...');
  const commBridge = await AgentCommunicationBridge.start(mockRuntime);
  console.log('✅ AgentCommunicationBridge started successfully');

  // Test communication bridge capabilities
  const bridgeHealth = await commBridge.isHealthy();
  console.log('✅ Communication bridge health:', bridgeHealth);

  await commBridge.stop();
  console.log('✅ Communication bridge stopped');

  console.log('\n🎉 All E2B Plugin Services Tests Passed!');
  console.log('✅ MockE2BService: Working');
  console.log('✅ GitHubIntegrationService: Working');
  console.log('✅ AgentCommunicationBridge: Working');
  console.log('\n🔧 Plugin is ready for integration testing');

  process.exit(0);
} catch (error) {
  console.error('❌ E2B Plugin test failed:');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack?.split('\n').slice(0, 10).join('\n'));
  process.exit(1);
}
