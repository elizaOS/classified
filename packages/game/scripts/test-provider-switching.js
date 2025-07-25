#!/usr/bin/env node

/**
 * Provider Switching Test Suite
 * Tests switching between different AI providers and configurations
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

class ProviderSwitchingTests {
  constructor() {
    this.gameDir = join(__dirname, '..');
    this.baseUrl = 'http://localhost:7777';
    this.testResults = [];

    // Test configurations for different providers
    this.providers = {
      openai: {
        name: 'OpenAI',
        config: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: process.env.OPENAI_API_KEY,
          settings: {
            temperature: 0.7,
            maxTokens: 2000
          }
        }
      },
      anthropic: {
        name: 'Anthropic',
        config: {
          provider: 'anthropic',
          model: 'claude-3-haiku-20240229',
          apiKey: process.env.ANTHROPIC_API_KEY,
          settings: {
            temperature: 0.7,
            maxTokens: 2000
          }
        }
      },
      local: {
        name: 'Local Ollama',
        config: {
          provider: 'local',
          model: 'llama2',
          endpoint: 'http://localhost:11434',
          settings: {
            temperature: 0.7,
            maxTokens: 2000
          }
        }
      }
    };
  }

  async waitForServer(maxAttempts = 30) {
    console.log('⏳ Waiting for server to be ready...');

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`${this.baseUrl}/api/server/health`);
        if (response.ok) {
          console.log('✅ Server is ready');
          return;
        }
      } catch (error) {
        // Keep trying
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log(`   Attempt ${i + 1}/${maxAttempts}...`);
    }

    throw new Error('Server did not become ready in time');
  }

  async makeRequest(method, endpoint, data = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    const responseData = await response.json();

    return {
      status: response.status,
      ok: response.ok,
      data: responseData
    };
  }

  async testProviderConfiguration(providerKey) {
    const provider = this.providers[providerKey];
    console.log(`🔧 Testing ${provider.name} configuration...`);

    try {
      // Test configuration endpoint
      const configResponse = await this.makeRequest('POST', '/api/config/update', provider.config);

      if (!configResponse.ok) {
        throw new Error(`Configuration failed: ${JSON.stringify(configResponse.data)}`);
      }

      console.log(`   ✅ Configuration accepted for ${provider.name}`);
      return { success: true, provider: providerKey };

    } catch (error) {
      console.log(`   ❌ Configuration failed for ${provider.name}: ${error.message}`);
      return { success: false, provider: providerKey, error: error.message };
    }
  }

  async testProviderResponse(providerKey) {
    const provider = this.providers[providerKey];
    console.log(`💬 Testing ${provider.name} response...`);

    try {
      // Send a test message to the agent
      const testMessage = {
        content: {
          text: "Hello, can you respond with 'Provider test successful' to confirm you're working?"
        },
        roomId: `test-room-${Date.now()}`
      };

      const messageResponse = await this.makeRequest('POST', '/api/agents/test/message', testMessage);

      if (!messageResponse.ok) {
        throw new Error(`Message failed: ${JSON.stringify(messageResponse.data)}`);
      }

      // Wait a bit for the response
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check for response in the conversation
      const conversationResponse = await this.makeRequest('GET', `/api/agents/test/messages?roomId=${testMessage.roomId}&limit=10`);

      if (!conversationResponse.ok) {
        throw new Error(`Conversation retrieval failed: ${JSON.stringify(conversationResponse.data)}`);
      }

      const messages = conversationResponse.data.messages || [];
      const agentResponse = messages.find(m => m.content?.text?.includes('Provider test successful'));

      if (agentResponse) {
        console.log(`   ✅ ${provider.name} responded successfully`);
        return { success: true, provider: providerKey, response: agentResponse.content.text };
      } else {
        throw new Error('Agent did not respond with expected message');
      }

    } catch (error) {
      console.log(`   ❌ Response test failed for ${provider.name}: ${error.message}`);
      return { success: false, provider: providerKey, error: error.message };
    }
  }

  async testProviderSwitching() {
    console.log('🔄 Testing provider switching...');

    const availableProviders = Object.keys(this.providers).filter(key => {
      const provider = this.providers[key];
      // Check if required API keys are available
      if (key === 'openai' && !process.env.OPENAI_API_KEY) {return false;}
      if (key === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {return false;}
      return true;
    });

    console.log(`   Available providers: ${availableProviders.join(', ')}`);

    const switchResults = [];

    for (let i = 0; i < availableProviders.length; i++) {
      const providerKey = availableProviders[i];
      const provider = this.providers[providerKey];

      console.log(`\n🎯 Testing switch to ${provider.name}...`);

      // Configure the provider
      const configResult = await this.testProviderConfiguration(providerKey);
      switchResults.push(configResult);

      if (configResult.success) {
        // Test the provider response
        const responseResult = await this.testProviderResponse(providerKey);
        switchResults.push(responseResult);
      }

      // Add delay between provider switches
      if (i < availableProviders.length - 1) {
        console.log('   ⏸️  Waiting before next provider switch...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    return switchResults;
  }

  async testConfigurationValidation() {
    console.log('✅ Testing configuration validation...');

    const validationTests = [
      {
        name: 'Invalid API Key',
        config: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: 'invalid-key-12345',
        },
        expectError: true
      },
      {
        name: 'Missing API Key',
        config: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
        },
        expectError: true
      },
      {
        name: 'Invalid Model',
        config: {
          provider: 'openai',
          model: 'nonexistent-model',
          apiKey: process.env.OPENAI_API_KEY,
        },
        expectError: true
      },
      {
        name: 'Valid Configuration',
        config: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: process.env.OPENAI_API_KEY,
        },
        expectError: false
      }
    ];

    const validationResults = [];

    for (const test of validationTests) {
      console.log(`   🧪 Testing: ${test.name}`);

      try {
        const response = await this.makeRequest('POST', '/api/config/validate', test.config);

        if (test.expectError && response.ok) {
          console.log('   ❌ Expected error but validation passed');
          validationResults.push({
            name: test.name,
            success: false,
            error: 'Expected validation to fail but it passed'
          });
        } else if (!test.expectError && !response.ok) {
          console.log(`   ❌ Expected success but validation failed: ${JSON.stringify(response.data)}`);
          validationResults.push({
            name: test.name,
            success: false,
            error: response.data.error || 'Validation failed unexpectedly'
          });
        } else {
          console.log(`   ✅ ${test.name} behaved as expected`);
          validationResults.push({
            name: test.name,
            success: true,
            expected: test.expectError ? 'error' : 'success'
          });
        }

      } catch (error) {
        if (test.expectError) {
          console.log(`   ✅ ${test.name} correctly threw error: ${error.message}`);
          validationResults.push({
            name: test.name,
            success: true,
            error: error.message
          });
        } else {
          console.log(`   ❌ ${test.name} unexpectedly threw error: ${error.message}`);
          validationResults.push({
            name: test.name,
            success: false,
            error: error.message
          });
        }
      }
    }

    return validationResults;
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.testResults.length,
        passed: this.testResults.filter(r => r.success).length,
        failed: this.testResults.filter(r => !r.success).length
      },
      results: this.testResults,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        availableProviders: Object.keys(this.providers).filter(key => {
          if (key === 'openai') {return !!process.env.OPENAI_API_KEY;}
          if (key === 'anthropic') {return !!process.env.ANTHROPIC_API_KEY;}
          return true;
        })
      }
    };

    // Write report to file
    const reportPath = join(this.gameDir, 'provider-switching-test-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n📊 Test Report Generated');
    console.log('========================');
    console.log(`Total Tests: ${report.summary.total}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    console.log(`Report saved to: ${reportPath}`);

    return report;
  }

  async runTests() {
    try {
      console.log('🧪 ELIZA Provider Switching Tests');
      console.log('==================================');

      // Wait for server to be ready
      await this.waitForServer();

      // Run provider switching tests
      console.log('\n🔄 Running Provider Switching Tests...');
      const switchingResults = await this.testProviderSwitching();
      this.testResults.push(...switchingResults);

      // Run configuration validation tests
      console.log('\n✅ Running Configuration Validation Tests...');
      const validationResults = await this.testConfigurationValidation();
      this.testResults.push(...validationResults);

      // Generate report
      await this.generateReport();

      const failedTests = this.testResults.filter(r => !r.success);
      if (failedTests.length > 0) {
        console.log('\n❌ Some tests failed:');
        failedTests.forEach(test => {
          console.log(`   • ${test.name || test.provider}: ${test.error}`);
        });
        process.exit(1);
      } else {
        console.log('\n🎉 All tests passed!');
      }

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tests = new ProviderSwitchingTests();
  tests.runTests();
}

export { ProviderSwitchingTests };
