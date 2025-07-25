#!/usr/bin/env node

/**
 * Test script to verify ELIZA container setup and functionality
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

class ContainerTester {
  constructor() {
    this.baseUrl = 'http://localhost:7777';
    this.testResults = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': '📋',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌'
    }[type] || '📋';

    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async test(description, testFn) {
    this.log(`Testing: ${description}`);

    try {
      const result = await testFn();
      this.testResults.push({ description, passed: true, result });
      this.log(`✅ PASS: ${description}`, 'success');
      return result;
    } catch (error) {
      this.testResults.push({ description, passed: false, error: error.message });
      this.log(`❌ FAIL: ${description} - ${error.message}`, 'error');
      throw error;
    }
  }

  async checkDockerServices() {
    return this.test('Docker services are running', async () => {
      const { stdout } = await execAsync('docker ps --format "table {{.Names}}\t{{.Status}}"');
      const runningContainers = stdout.split('\n').filter(line => line.includes('eliza-'));

      if (runningContainers.length === 0) {
        throw new Error('No ELIZA containers found running');
      }

      this.log(`Found ${runningContainers.length} ELIZA containers:`);
      runningContainers.forEach(container => this.log(`  ${container}`));

      return runningContainers;
    });
  }

  async checkDatabaseConnection() {
    return this.test('Database connection is working', async () => {
      // Test database connection through the agent API
      const response = await fetch(`${this.baseUrl}/api/server/health`);

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }

      const healthData = await response.json();

      if (healthData.data?.status !== 'healthy') {
        throw new Error(`Server is not healthy: ${JSON.stringify(healthData)}`);
      }

      return healthData;
    });
  }

  async checkAgentStartup() {
    return this.test('Agent is running and responsive', async () => {
      const response = await fetch(`${this.baseUrl}/api/agents`);

      if (!response.ok) {
        throw new Error(`Agents API failed: ${response.status} ${response.statusText}`);
      }

      const agentsData = await response.json();

      if (!agentsData.data?.agents || agentsData.data.agents.length === 0) {
        throw new Error('No agents found running');
      }

      this.log(`Found ${agentsData.data.agents.length} active agents`);

      return agentsData.data.agents;
    });
  }

  async checkPluginLoading() {
    return this.test('Plugins are loaded correctly', async () => {
      // Get container logs to check for plugin loading
      const { stdout } = await execAsync('docker logs eliza-agent 2>&1 | grep -i plugin | tail -10');

      if (!stdout.includes('plugin')) {
        throw new Error('No plugin loading messages found in logs');
      }

      this.log('Recent plugin-related log entries:');
      stdout.split('\n').filter(line => line.trim()).forEach(line => {
        this.log(`  ${line}`);
      });

      return true;
    });
  }

  async checkMessaging() {
    return this.test('Messaging system is working', async () => {
      // Try to send a test message to the agent
      const testMessage = {
        text: 'Hello ELIZA, this is a container test message',
        roomId: `test-room-${Date.now()}`,
        senderId: 'test-user'
      };

      const response = await fetch(`${this.baseUrl}/api/agents/${await this.getFirstAgentId()}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testMessage)
      });

      if (!response.ok) {
        throw new Error(`Message API failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      this.log('Agent responded to test message');

      return result;
    });
  }

  async getFirstAgentId() {
    const response = await fetch(`${this.baseUrl}/api/agents`);
    const data = await response.json();
    return data.data.agents[0]?.id;
  }

  async checkDataPersistence() {
    return this.test('Data persistence is configured', async () => {
      // Check if data directories exist on host
      const dataDir = `${process.env.HOME}/.eliza/data`;

      if (!existsSync(dataDir)) {
        throw new Error(`Data directory not found: ${dataDir}`);
      }

      this.log(`Data directory exists: ${dataDir}`);

      // Check if PostgreSQL data is persisted
      const { stdout } = await execAsync('docker exec eliza-postgres psql -U eliza -d eliza_game -c "SELECT count(*) FROM information_schema.tables;"');

      if (!stdout.includes('count')) {
        throw new Error('Unable to query PostgreSQL database');
      }

      this.log('PostgreSQL database is accessible');

      return true;
    });
  }

  async runAllTests() {
    this.log('🧪 Starting ELIZA Container Tests', 'info');
    this.log('================================', 'info');

    const tests = [
      () => this.checkDockerServices(),
      () => this.checkDatabaseConnection(),
      () => this.checkAgentStartup(),
      () => this.checkPluginLoading(),
      () => this.checkDataPersistence(),
      () => this.checkMessaging()
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        await test();
        passed++;
      } catch (error) {
        failed++;
        // Continue with other tests
      }

      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.log('', 'info');
    this.log('🏁 Test Results Summary', 'info');
    this.log('======================', 'info');
    this.log(`Total tests: ${passed + failed}`, 'info');
    this.log(`Passed: ${passed}`, passed > 0 ? 'success' : 'info');
    this.log(`Failed: ${failed}`, failed > 0 ? 'error' : 'info');

    if (failed === 0) {
      this.log('🎉 All tests passed! ELIZA container is working correctly.', 'success');
    } else {
      this.log(`⚠️  ${failed} test(s) failed. Check the logs above for details.`, 'warning');
    }

    return failed === 0;
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ContainerTester();

  tester.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

export { ContainerTester };
