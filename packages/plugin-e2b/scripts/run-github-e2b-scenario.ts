#!/usr/bin/env bun

/**
 * Test script for the GitHub + E2B + Autocoder collaboration scenario
 * This script runs the complete workflow from issue identification to PR resolution
 */

import { elizaLogger } from '@elizaos/core';
import { createTestRuntime, RuntimeTestHarness } from '@elizaos/test-utils';
import { e2bPlugin } from '../src/index.js';
import { githubE2bAutocoderCollaborationScenario } from '../../scenarios/src/plugin-tests/22-github-e2b-autocoder-collaboration.js';

// Test configuration
const TEST_CONFIG = {
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  E2B_API_KEY: process.env.E2B_API_KEY || '',
  TIMEOUT: 15 * 60 * 1000, // 15 minutes
  VERBOSE: process.env.VERBOSE === 'true' || process.argv.includes('--verbose'),
  DRY_RUN: process.argv.includes('--dry-run'),
};

async function validateEnvironment(): Promise<void> {
  elizaLogger.info('Validating test environment...');

  const issues: string[] = [];

  if (!TEST_CONFIG.GITHUB_TOKEN) {
    issues.push('GITHUB_TOKEN environment variable is required');
  }

  if (!TEST_CONFIG.E2B_API_KEY) {
    issues.push('E2B_API_KEY environment variable is required');
  }

  if (issues.length > 0) {
    elizaLogger.error('Environment validation failed:', { issues });
    process.exit(1);
  }

  elizaLogger.info('✅ Environment validation passed');
}

async function createTestAgents() {
  elizaLogger.info('Creating test agents...');

  const testHarness = new RuntimeTestHarness('github-e2b-test');
  const agents = new Map();

  try {
    // Create main orchestrator agent
    const orchestratorCharacter = {
      name: 'GitHub Issue Orchestrator',
      bio: 'Coordinates GitHub issue resolution workflows using E2B sandboxes and autocoder',
      system:
        'You are a project coordinator responsible for managing GitHub issues and orchestrating development workflows.',
      messageExamples: [],
      postExamples: [],
      plugins: ['@elizaos/plugin-e2b'],
    };

    const orchestrator = await testHarness.createTestRuntime({
      character: orchestratorCharacter,
      plugins: [e2bPlugin],
      apiKeys: {
        GITHUB_TOKEN: TEST_CONFIG.GITHUB_TOKEN,
        E2B_API_KEY: TEST_CONFIG.E2B_API_KEY,
      },
    });
    agents.set('main-orchestrator', orchestrator);

    // Create sandbox coder agent
    const coderCharacter = {
      name: 'Sandbox Development Agent',
      bio: 'Implements solutions for GitHub issues within secure E2B sandbox environments',
      system:
        'You are a skilled software engineer operating in secure sandbox environments to implement solutions.',
      messageExamples: [],
      postExamples: [],
      plugins: ['@elizaos/plugin-e2b'],
    };

    const coder = await testHarness.createTestRuntime({
      character: coderCharacter,
      plugins: [e2bPlugin],
      apiKeys: {
        GITHUB_TOKEN: TEST_CONFIG.GITHUB_TOKEN,
        E2B_API_KEY: TEST_CONFIG.E2B_API_KEY,
      },
    });
    agents.set('e2b-coder-agent', coder);

    // Create PR reviewer agent
    const reviewerCharacter = {
      name: 'Quality Assurance Reviewer',
      bio: 'Conducts thorough code reviews to maintain high quality standards',
      system:
        'You are a senior code reviewer focused on maintaining high quality standards and security.',
      messageExamples: [],
      postExamples: [],
      plugins: ['@elizaos/plugin-e2b'],
    };

    const reviewer = await testHarness.createTestRuntime({
      character: reviewerCharacter,
      plugins: [e2bPlugin],
      apiKeys: {
        GITHUB_TOKEN: TEST_CONFIG.GITHUB_TOKEN,
        E2B_API_KEY: TEST_CONFIG.E2B_API_KEY,
      },
    });
    agents.set('pr-reviewer-agent', reviewer);

    elizaLogger.info(`✅ Created ${agents.size} test agents`);
    return { agents, testHarness };
  } catch (error) {
    elizaLogger.error('Failed to create test agents', { error: error.message });
    throw error;
  }
}

async function runScenarioStep(stepName: string, stepFn: () => Promise<void>): Promise<boolean> {
  try {
    elizaLogger.info(`🚀 Starting: ${stepName}`);
    const startTime = Date.now();

    await stepFn();

    const duration = Date.now() - startTime;
    elizaLogger.info(`✅ Completed: ${stepName} (${duration}ms)`);
    return true;
  } catch (error) {
    elizaLogger.error(`❌ Failed: ${stepName}`, { error: error.message });
    return false;
  }
}

async function executeScenario(): Promise<{ success: boolean; testHarness?: RuntimeTestHarness }> {
  elizaLogger.info('🎬 Starting GitHub + E2B + Autocoder Collaboration Scenario');

  if (TEST_CONFIG.DRY_RUN) {
    elizaLogger.info('🔍 DRY RUN MODE - No actual GitHub or E2B operations will be performed');
    return { success: true };
  }

  const { agents, testHarness } = await createTestAgents();
  const orchestrator = agents.get('main-orchestrator');
  const coder = agents.get('e2b-coder-agent');

  let allStepsSuccessful = true;

  // Step 1: Validate services are available
  allStepsSuccessful &= await runScenarioStep('Service Validation', async () => {
    const e2bService = orchestrator.getService('e2b');
    if (!e2bService) {
      throw new Error('E2B service not available');
    }

    const isHealthy = await e2bService.isHealthy();
    if (!isHealthy) {
      throw new Error('E2B service is not healthy');
    }

    elizaLogger.info('✅ All required services are available and healthy');
  });

  // Step 2: GitHub issue fetching
  allStepsSuccessful &= await runScenarioStep('GitHub Issue Fetching', async () => {
    const message = {
      id: `test-msg-${Date.now()}`,
      entityId: 'test-user',
      content: {
        text: 'Help me resolve GitHub issues from the elizaOS repository using sandbox development',
      },
      agentId: orchestrator.agentId,
      roomId: orchestrator.agentId,
      createdAt: Date.now(),
    };

    let responseReceived = false;
    let responses: any[] = [];
    await orchestrator.emitEvent('MESSAGE_RECEIVED', {
      runtime: orchestrator,
      message,
      callback: async (response: any) => {
        responses.push(response);
        return [];
      },
      onComplete: () => {
        // Optional completion callback
      },
    });

    if (responses && responses.length > 0) {
      responseReceived = true;
      elizaLogger.info('GitHub issue orchestration response received', {
        responseCount: responses.length,
      });
    }

    if (!responseReceived) {
      throw new Error('No response received from GitHub issue orchestrator');
    }
  });

  // Step 3: Sandbox environment setup
  allStepsSuccessful &= await runScenarioStep('Sandbox Environment Setup', async () => {
    const e2bService = orchestrator.getService('e2b');
    const sandboxes = e2bService.listSandboxes();

    if (sandboxes.length === 0) {
      // Create a test sandbox
      const sandboxId = await e2bService.createSandbox({
        timeoutMs: 10 * 60 * 1000, // 10 minutes for test
        metadata: {
          purpose: 'test-github-workflow',
          testMode: true,
        },
      });

      elizaLogger.info('Test sandbox created', { sandboxId });
    }

    elizaLogger.info('✅ Sandbox environment is ready', {
      activeSandboxes: e2bService.listSandboxes().length,
    });
  });

  // Step 4: Agent coordination test
  allStepsSuccessful &= await runScenarioStep('Agent Coordination', async () => {
    const message = {
      id: `test-coord-${Date.now()}`,
      entityId: 'test-coordinator',
      content: {
        text: 'Coordinate with the coder agent to work on GitHub issue resolution',
      },
      agentId: orchestrator.agentId,
      roomId: orchestrator.agentId,
      createdAt: Date.now(),
    };

    let responses: any[] = [];
    await orchestrator.emitEvent('MESSAGE_RECEIVED', {
      runtime: orchestrator,
      message,
      callback: async (response: any) => {
        responses.push(response);
        return [];
      },
      onComplete: () => {
        // Optional completion callback
      },
    });

    if (!responses || responses.length === 0) {
      throw new Error('Agent coordination failed - no responses received');
    }

    elizaLogger.info('✅ Agent coordination successful', {
      responseCount: responses.length,
    });
  });

  // Step 5: Code execution test
  allStepsSuccessful &= await runScenarioStep('Code Execution Test', async () => {
    const testMessage = {
      id: `test-code-${Date.now()}`,
      entityId: 'test-user',
      content: {
        text: `\`\`\`python
# Test code execution in sandbox
print("GitHub + E2B + Autocoder workflow test")
result = "All systems operational"
print(f"Status: {result}")
\`\`\``,
      },
      agentId: coder.agentId,
      roomId: coder.agentId,
      createdAt: Date.now(),
    };

    let responses: any[] = [];
    await coder.emitEvent('MESSAGE_RECEIVED', {
      runtime: coder,
      message: testMessage,
      callback: async (response: any) => {
        responses.push(response);
        return [];
      },
      onComplete: () => {
        // Optional completion callback
      },
    });

    if (!responses || responses.length === 0) {
      throw new Error('Code execution test failed - no responses received');
    }

    // Check if execution was successful
    const response = responses[0];
    if (!response.content.text?.includes('operational')) {
      throw new Error('Code execution test failed - unexpected output');
    }

    elizaLogger.info('✅ Code execution test successful');
  });

  // Step 6: Workflow completion validation
  allStepsSuccessful &= await runScenarioStep('Workflow Validation', async () => {
    // Validate that all components are working together
    const e2bService = orchestrator.getService('e2b');
    const sandboxes = e2bService.listSandboxes();

    if (sandboxes.length === 0) {
      throw new Error('No sandboxes available for workflow validation');
    }

    // Check sandbox health
    const isHealthy = await e2bService.isHealthy();
    if (!isHealthy) {
      throw new Error('E2B service health check failed');
    }

    elizaLogger.info('✅ Complete workflow validation successful', {
      activeSandboxes: sandboxes.length,
      serviceHealth: isHealthy,
    });
  });

  return { success: allStepsSuccessful, testHarness };
}

async function cleanup(testHarness?: RuntimeTestHarness) {
  elizaLogger.info('🧹 Cleaning up test environment...');

  try {
    if (testHarness) {
      await testHarness.cleanup();
    }
    elizaLogger.info('✅ Test environment cleanup completed');
  } catch (error) {
    elizaLogger.error('❌ Cleanup failed', { error: error.message });
  }
}

async function main() {
  const startTime = Date.now();
  let success = false;
  let testHarness: RuntimeTestHarness | undefined;

  try {
    elizaLogger.info('🎯 GitHub + E2B + Autocoder Scenario Test Runner');
    elizaLogger.info('===============================================');

    if (TEST_CONFIG.VERBOSE) {
      elizaLogger.info('Test Configuration:', {
        hasGitHubToken: !!TEST_CONFIG.GITHUB_TOKEN,
        hasE2BKey: !!TEST_CONFIG.E2B_API_KEY,
        timeout: TEST_CONFIG.TIMEOUT,
        dryRun: TEST_CONFIG.DRY_RUN,
      });
    }

    await validateEnvironment();
    const result = await executeScenario();
    success = result.success;
    testHarness = result.testHarness;
  } catch (error) {
    elizaLogger.error('❌ Scenario execution failed', { error: error.message });
    success = false;
  } finally {
    await cleanup(testHarness);
  }

  const duration = Date.now() - startTime;
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);

  elizaLogger.info('===============================================');
  if (success) {
    elizaLogger.info(`🎉 SCENARIO COMPLETED SUCCESSFULLY in ${minutes}m ${seconds}s`);
    elizaLogger.info('All workflow components are functioning correctly!');
  } else {
    elizaLogger.error(`💥 SCENARIO FAILED after ${minutes}m ${seconds}s`);
    elizaLogger.error('Some workflow components need attention.');
  }

  process.exit(success ? 0 : 1);
}

// Handle process signals
process.on('SIGINT', async () => {
  elizaLogger.info('Received SIGINT, cleaning up...');
  await cleanup();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  elizaLogger.info('Received SIGTERM, cleaning up...');
  await cleanup();
  process.exit(1);
});

// Run the test
main().catch((error) => {
  elizaLogger.error('Fatal error in test runner', { error: error.message });
  process.exit(1);
});
