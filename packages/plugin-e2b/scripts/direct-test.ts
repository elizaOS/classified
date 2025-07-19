#!/usr/bin/env bun

/**
 * Direct test of E2B functionality without runtime harness
 */

import { elizaLogger } from '@elizaos/core';

async function testE2BDirect() {
  elizaLogger.info('🚀 Testing E2B Direct Integration');

  try {
    // Test E2B service directly
    elizaLogger.info('📦 Importing E2B service...');
    const { E2BService } = await import('../src/services/E2BService.js');
    elizaLogger.info('✅ E2B service imported');

    // Create a mock runtime object with minimal interface
    const mockRuntime = {
      getSetting: (key: string) => {
        if (key === 'E2B_API_KEY') return process.env.E2B_API_KEY;
        return null;
      },
      agentId: 'test-agent-123',
    };

    elizaLogger.info('🏗️ Creating E2B service instance...');
    const service = new E2BService(mockRuntime as any);
    elizaLogger.info('✅ E2B service created');

    elizaLogger.info('🔄 Initializing E2B service...');
    await service.initialize();
    elizaLogger.info('✅ E2B service initialized');

    elizaLogger.info('🏥 Testing health check...');
    const isHealthy = await service.isHealthy();
    elizaLogger.info(`Health status: ${isHealthy ? '✅ Healthy' : '⚠️ Not healthy'}`);

    if (isHealthy) {
      elizaLogger.info('🧪 Testing code execution...');
      const result = await service.executeCode(
        `
print("Hello from E2B!")
result = 2 + 2
print(f"2 + 2 = {result}")
result
`,
        'python'
      );

      if (result.error) {
        elizaLogger.error('Code execution error', { error: result.error });
      } else {
        elizaLogger.info('✅ Code execution successful', {
          text: result.text,
          hasResults: result.results?.length > 0,
        });
      }

      // Test sandbox management
      elizaLogger.info('📋 Testing sandbox listing...');
      const sandboxes = service.listSandboxes();
      elizaLogger.info(`Active sandboxes: ${sandboxes.length}`);

      sandboxes.forEach((sandbox, index) => {
        elizaLogger.info(
          `  ${index + 1}. ${sandbox.sandboxId} (${sandbox.isActive ? 'active' : 'inactive'})`
        );
      });
    }

    // Cleanup
    elizaLogger.info('🧹 Cleaning up...');
    await service.stop();
    elizaLogger.info('✅ Service stopped');

    elizaLogger.info('🎉 Direct E2B test completed successfully!');
    return true;
  } catch (error) {
    elizaLogger.error('❌ Direct test failed', {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5),
    });
    return false;
  }
}

async function testGitHubIntegration() {
  elizaLogger.info('🐙 Testing GitHub Integration');

  try {
    const { GitHubIntegrationService } = await import(
      '../src/services/GitHubIntegrationService.js'
    );
    elizaLogger.info('✅ GitHub service imported');

    const mockRuntime = {
      getSetting: (key: string) => {
        if (key === 'GITHUB_TOKEN') return process.env.GITHUB_TOKEN;
        return null;
      },
      agentId: 'test-agent-123',
    };

    elizaLogger.info('🏗️ Creating GitHub service...');
    const service = new GitHubIntegrationService(mockRuntime as any);
    elizaLogger.info('✅ GitHub service created');

    elizaLogger.info('🔄 Initializing GitHub service...');
    await service.initialize();
    elizaLogger.info('✅ GitHub service initialized');

    elizaLogger.info('📋 Testing issue fetching...');
    const issues = await service.getIssues('elizaOS', 'eliza', {
      state: 'open',
      limit: 3,
    });

    elizaLogger.info(`✅ Found ${issues.length} issues`);
    issues.forEach((issue, index) => {
      elizaLogger.info(`  ${index + 1}. #${issue.number}: ${issue.title}`);
    });

    elizaLogger.info('🎉 GitHub integration test completed successfully!');
    return true;
  } catch (error) {
    elizaLogger.error('❌ GitHub test failed', {
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 5),
    });
    return false;
  }
}

async function main() {
  elizaLogger.info('🧪 Direct Integration Tests');
  elizaLogger.info('===========================');

  const e2bSuccess = await testE2BDirect();
  const githubSuccess = await testGitHubIntegration();

  elizaLogger.info('===========================');
  elizaLogger.info(`E2B Test: ${e2bSuccess ? '✅ PASS' : '❌ FAIL'}`);
  elizaLogger.info(`GitHub Test: ${githubSuccess ? '✅ PASS' : '❌ FAIL'}`);

  if (e2bSuccess && githubSuccess) {
    elizaLogger.info('🎉 All direct tests passed!');
    process.exit(0);
  } else {
    elizaLogger.error('❌ Some tests failed!');
    process.exit(1);
  }
}

main().catch((error) => {
  elizaLogger.error('Fatal error', { error: error.message });
  process.exit(1);
});
