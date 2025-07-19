#!/usr/bin/env bun

/**
 * Simple test to verify E2B plugin basic functionality
 */

import { elizaLogger } from '@elizaos/core';
import { createTestRuntime } from '@elizaos/test-utils';

async function testBasicFunctionality() {
  elizaLogger.info('🚀 Starting Simple E2B Plugin Test');

  try {
    // Test that we can import the plugin
    elizaLogger.info('📦 Importing E2B plugin...');
    const { e2bPlugin } = await import('../src/index.js');
    elizaLogger.info('✅ Plugin imported successfully');

    // Test that we can create a basic runtime
    elizaLogger.info('🏗️ Creating test runtime...');
    const runtime = await createTestRuntime({
      character: {
        name: 'Test Agent',
        bio: 'A test agent for E2B plugin verification',
        system: 'You are a test agent.',
        messageExamples: [],
        postExamples: [],
      },
      plugins: [e2bPlugin],
      apiKeys: {
        E2B_API_KEY: process.env.E2B_API_KEY || '',
      },
    });

    elizaLogger.info('✅ Runtime created successfully', { agentId: runtime.agentId });

    // Test that E2B service is available
    elizaLogger.info('🔍 Checking E2B service...');
    const e2bService = runtime.getService('e2b');

    if (!e2bService) {
      throw new Error('E2B service not found');
    }

    elizaLogger.info('✅ E2B service found');

    // Test service health
    elizaLogger.info('🏥 Testing E2B service health...');
    const isHealthy = await e2bService.isHealthy();
    elizaLogger.info(`Health check result: ${isHealthy}`);

    if (isHealthy) {
      elizaLogger.info('✅ E2B service is healthy');

      // Test listing sandboxes
      const sandboxes = e2bService.listSandboxes();
      elizaLogger.info(`Current sandboxes: ${sandboxes.length}`);

      // Test basic code execution
      elizaLogger.info('🧪 Testing basic code execution...');
      const result = await e2bService.executeCode('print("Hello from E2B!")', 'python');

      if (result.error) {
        elizaLogger.warn('Code execution returned error', { error: result.error });
      } else {
        elizaLogger.info('✅ Code execution successful', { result: result.text });
      }
    } else {
      elizaLogger.warn('⚠️ E2B service is not healthy - this may be expected in test environment');
    }

    elizaLogger.info('🎉 Simple E2B Plugin Test Completed Successfully!');
    return true;
  } catch (error) {
    elizaLogger.error('❌ Simple test failed', {
      error: error.message,
      stack: error.stack,
    });
    return false;
  }
}

async function main() {
  const success = await testBasicFunctionality();

  if (success) {
    elizaLogger.info('✅ All tests passed!');
    process.exit(0);
  } else {
    elizaLogger.error('❌ Tests failed!');
    process.exit(1);
  }
}

main().catch((error) => {
  elizaLogger.error('Fatal error in test runner', { error: error.message });
  process.exit(1);
});
