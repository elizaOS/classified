#!/usr/bin/env bun

/**
 * Test script for LLM-driven E2B scenarios
 * This script creates a real agent runtime with LLM integration and tests actual agent behavior
 */

import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { readFile } from 'fs/promises';
import { AgentRuntime, elizaLogger, createUniqueUuid } from '@elizaos/core';
import { RealWorldScenariosE2ETestSuite } from '../src/tests/e2e/real-world-scenarios.js';
import type { Character, IAgentRuntime, Memory } from '@elizaos/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Track LLM usage
let totalLLMCalls = 0;
let totalTokensUsed = 0;
let costEstimate = 0;

interface LLMMetrics {
  calls: number;
  tokens: number;
  cost: number;
}

async function createTestRuntime(): Promise<IAgentRuntime> {
  elizaLogger.info('🚀 Creating test runtime with real LLM integration...');

  // Load character configuration
  const characterPath = resolve(__dirname, '../character.json');
  const characterData = await readFile(characterPath, 'utf-8');
  const character: Character = JSON.parse(characterData);

  // Ensure required environment variables
  const requiredEnvVars = ['E2B_API_KEY', 'POSTGRES_URL'];

  // Check for LLM provider
  const hasOpenAI = process.env.OPENAI_API_KEY;
  const hasAnthropic = process.env.ANTHROPIC_API_KEY;

  if (!hasOpenAI && !hasAnthropic) {
    throw new Error('No LLM provider configured! Set OPENAI_API_KEY or ANTHROPIC_API_KEY');
  }

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  // Add LLM plugin to character
  if (hasOpenAI) {
    character.plugins.push('@elizaos/plugin-openai');
    elizaLogger.info('✅ OpenAI LLM provider configured');
  }

  if (hasAnthropic) {
    character.plugins.push('@elizaos/plugin-anthropic');
    elizaLogger.info('✅ Anthropic LLM provider configured');
  }

  // Create agent runtime
  const runtime = new AgentRuntime({
    character,
    token: 'test-agent-token-' + Date.now(),
    serverUrl: 'http://localhost:3000',
    supabaseClient: null,
    fetch: fetch,
  });

  // Initialize the runtime
  await runtime.initialize();

  elizaLogger.info('✅ Test runtime created and initialized');
  return runtime;
}

function interceptLLMCalls(runtime: IAgentRuntime): void {
  const originalUseModel = runtime.useModel.bind(runtime);

  runtime.useModel = async (modelType: any, params: any) => {
    totalLLMCalls++;
    const estimatedTokens = params?.maxTokens || 1000; // Conservative estimate
    totalTokensUsed += estimatedTokens;

    // Estimate cost (very rough)
    const costPerToken = 0.000002; // ~$2 per 1M tokens
    costEstimate += estimatedTokens * costPerToken;

    elizaLogger.info(
      `🤖 LLM Call #${totalLLMCalls} - Model: ${modelType} - Est. Tokens: ${estimatedTokens}`
    );

    return await originalUseModel(modelType, params);
  };
}

async function runLLMDrivenTests(): Promise<void> {
  elizaLogger.info('🧪 Starting LLM-driven E2B testing...');

  let runtime: IAgentRuntime | null = null;

  try {
    // Create runtime with real LLM integration
    runtime = await createTestRuntime();

    // Intercept LLM calls for tracking
    interceptLLMCalls(runtime);

    // Create test suite
    const testSuite = new RealWorldScenariosE2ETestSuite();

    elizaLogger.info(`📋 Running ${testSuite.tests.length} LLM-driven tests...`);

    let passedTests = 0;
    let failedTests = 0;
    const testResults: { name: string; status: 'PASS' | 'FAIL'; error?: string }[] = [];

    // Run each test
    for (const test of testSuite.tests) {
      elizaLogger.info(`🏃 Running test: ${test.name}`);

      try {
        await test.fn(runtime);
        passedTests++;
        testResults.push({ name: test.name, status: 'PASS' });
        elizaLogger.info(`✅ PASSED: ${test.name}`);
      } catch (error) {
        failedTests++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        testResults.push({ name: test.name, status: 'FAIL', error: errorMessage });
        elizaLogger.error(`❌ FAILED: ${test.name} - ${errorMessage}`);
      }
    }

    // Report results
    elizaLogger.info('\n📊 TEST RESULTS SUMMARY');
    elizaLogger.info('================================');
    elizaLogger.info(`Total Tests: ${testSuite.tests.length}`);
    elizaLogger.info(
      `Passed: ${passedTests} (${((passedTests / testSuite.tests.length) * 100).toFixed(1)}%)`
    );
    elizaLogger.info(
      `Failed: ${failedTests} (${((failedTests / testSuite.tests.length) * 100).toFixed(1)}%)`
    );

    elizaLogger.info('\n🤖 LLM USAGE ANALYSIS');
    elizaLogger.info('================================');
    elizaLogger.info(`Total LLM Calls: ${totalLLMCalls}`);
    elizaLogger.info(`Total Tokens Used: ${totalTokensUsed}`);
    elizaLogger.info(`Estimated Cost: $${costEstimate.toFixed(4)} USD`);

    if (totalLLMCalls === 0) {
      elizaLogger.error(
        '❌ CRITICAL: No LLM calls detected! Tests are not using real language models.'
      );
      process.exit(1);
    }

    if (totalLLMCalls < 3) {
      elizaLogger.warn(
        `⚠️ WARNING: Only ${totalLLMCalls} LLM calls detected. Expected more for comprehensive testing.`
      );
    }

    elizaLogger.info('\n📝 DETAILED RESULTS');
    elizaLogger.info('================================');
    for (const result of testResults) {
      const status = result.status === 'PASS' ? '✅' : '❌';
      elizaLogger.info(`${status} ${result.name}`);
      if (result.error) {
        elizaLogger.info(`   Error: ${result.error}`);
      }
    }

    // Determine overall success
    const successRate = (passedTests / testSuite.tests.length) * 100;

    if (successRate === 100) {
      elizaLogger.info(
        '\n🎉 ALL TESTS PASSED! 100% success rate achieved with real LLM integration.'
      );
    } else if (successRate >= 75) {
      elizaLogger.info(
        `\n✅ Tests mostly passed: ${successRate.toFixed(1)}% success rate with real LLM integration.`
      );
    } else {
      elizaLogger.error(
        `\n❌ Tests failed: Only ${successRate.toFixed(1)}% success rate. Investigation needed.`
      );
      process.exit(1);
    }
  } catch (error) {
    elizaLogger.error('💥 Fatal error during testing:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (runtime) {
      try {
        // Cleanup runtime resources if needed
        elizaLogger.info('🧹 Cleaning up test runtime...');
      } catch (error) {
        elizaLogger.warn('Warning during cleanup:', error);
      }
    }
  }
}

async function main(): Promise<void> {
  try {
    await runLLMDrivenTests();
  } catch (error) {
    elizaLogger.error('Script failed:', error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
