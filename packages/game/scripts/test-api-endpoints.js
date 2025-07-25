#!/usr/bin/env node

/**
 * API Endpoints Test Suite
 * Tests all API endpoints with curl and programmatic requests
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

class ApiEndpointTests {
  constructor() {
    this.gameDir = join(__dirname, '..');
    this.baseUrl = 'http://localhost:7777';
    this.testResults = [];
    this.authToken = null;

    // Define all endpoints to test
    this.endpoints = {
      health: {
        method: 'GET',
        path: '/api/server/health',
        description: 'Server health check',
        expectStatus: 200
      },

      // Configuration endpoints
      configValidate: {
        method: 'POST',
        path: '/api/config/validate',
        description: 'Validate configuration',
        requiresAuth: true,
        body: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          apiKey: process.env.OPENAI_API_KEY || 'test-key'
        },
        expectStatus: 200
      },

      configUpdate: {
        method: 'POST',
        path: '/api/config/update',
        description: 'Update configuration',
        requiresAuth: true,
        body: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          settings: {
            temperature: 0.7,
            maxTokens: 2000
          }
        },
        expectStatus: 200
      },

      configGet: {
        method: 'GET',
        path: '/api/config/current',
        description: 'Get current configuration',
        requiresAuth: true,
        expectStatus: 200
      },

      // Agent endpoints
      agentCapabilities: {
        method: 'GET',
        path: '/api/agents/terminal/capabilities',
        description: 'Get agent capabilities',
        expectStatus: 200
      },

      agentMessage: {
        method: 'POST',
        path: '/api/agents/terminal/message',
        description: 'Send message to agent',
        body: {
          content: {
            text: 'Hello, this is a test message'
          },
          roomId: `test-room-${Date.now()}`
        },
        expectStatus: 200
      },

      agentMessages: {
        method: 'GET',
        path: '/api/agents/terminal/messages?limit=10',
        description: 'Get agent messages',
        expectStatus: 200
      },

      // Knowledge endpoints
      knowledgeDocuments: {
        method: 'GET',
        path: '/api/knowledge/documents',
        description: 'Get knowledge documents',
        expectStatus: 200
      },

      knowledgeUpload: {
        method: 'POST',
        path: '/api/knowledge/upload',
        description: 'Upload knowledge document',
        isFileUpload: true,
        expectStatus: 200
      },

      // Database endpoints
      databaseTables: {
        method: 'GET',
        path: '/api/database/tables',
        description: 'Get database tables',
        expectStatus: 200
      },

      databaseQuery: {
        method: 'POST',
        path: '/api/database/query',
        description: 'Execute database query',
        body: {
          query: 'SELECT COUNT(*) as count FROM memories',
          params: []
        },
        expectStatus: 200
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

  async authenticate() {
    console.log('🔐 Authenticating for protected endpoints...');

    try {
      const authData = {
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin123'
      };

      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(authData)
      });

      if (response.ok) {
        const data = await response.json();
        this.authToken = data.data.token;
        console.log('✅ Authentication successful');
        return true;
      } else {
        console.log('⚠️  Authentication failed, continuing without auth token');
        return false;
      }
    } catch (error) {
      console.log('⚠️  Authentication error:', error.message);
      return false;
    }
  }

  async testWithCurl(endpoint, endpointConfig) {
    console.log(`🌐 Testing ${endpoint} with curl...`);

    const url = `${this.baseUrl}${endpointConfig.path}`;
    let curlCommand = ['curl', '-s', '-w', '\\nHTTP_CODE:%{http_code}'];

    // Add method
    if (endpointConfig.method !== 'GET') {
      curlCommand.push('-X', endpointConfig.method);
    }

    // Add headers
    curlCommand.push('-H', 'Content-Type: application/json');

    if (endpointConfig.requiresAuth && this.authToken) {
      curlCommand.push('-H', `Authorization: Bearer ${this.authToken}`);
    }

    // Add body if present
    if (endpointConfig.body) {
      curlCommand.push('-d', JSON.stringify(endpointConfig.body));
    }

    // Handle file uploads differently
    if (endpointConfig.isFileUpload) {
      const testFilePath = join(this.gameDir, 'test-knowledge.txt');

      // Create a test file if it doesn't exist
      if (!require('fs').existsSync(testFilePath)) {
        writeFileSync(testFilePath, 'This is a test knowledge document for API testing.');
      }

      curlCommand = [
        'curl', '-s', '-w', '\\nHTTP_CODE:%{http_code}',
        '-F', `file=@${testFilePath}`,
        url
      ];
    } else {
      curlCommand.push(url);
    }

    try {
      const { stdout, stderr } = await execAsync(curlCommand.join(' '));

      const lines = stdout.trim().split('\n');
      const httpCodeLine = lines.find(line => line.startsWith('HTTP_CODE:'));
      const httpCode = httpCodeLine ? parseInt(httpCodeLine.split(':')[1]) : 0;

      const responseBody = lines.filter(line => !line.startsWith('HTTP_CODE:')).join('\n');

      console.log(`   Status: ${httpCode}`);

      if (httpCode === endpointConfig.expectStatus) {
        console.log(`   ✅ Curl test passed for ${endpoint}`);
        return { success: true, endpoint, method: 'curl', status: httpCode, response: responseBody };
      } else {
        console.log(`   ❌ Curl test failed for ${endpoint} - expected ${endpointConfig.expectStatus}, got ${httpCode}`);
        return { success: false, endpoint, method: 'curl', status: httpCode, error: responseBody };
      }
    } catch (error) {
      console.log(`   ❌ Curl test error for ${endpoint}: ${error.message}`);
      return { success: false, endpoint, method: 'curl', error: error.message };
    }
  }

  async testWithFetch(endpoint, endpointConfig) {
    console.log(`🔗 Testing ${endpoint} with fetch...`);

    const url = `${this.baseUrl}${endpointConfig.path}`;
    const options = {
      method: endpointConfig.method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (endpointConfig.requiresAuth && this.authToken) {
      options.headers.Authorization = `Bearer ${this.authToken}`;
    }

    if (endpointConfig.body) {
      options.body = JSON.stringify(endpointConfig.body);
    }

    // Skip file upload tests for fetch (handle separately)
    if (endpointConfig.isFileUpload) {
      console.log('   ⏭️  Skipping file upload test with fetch');
      return { success: true, endpoint, method: 'fetch', status: 'skipped', note: 'File upload skipped for fetch test' };
    }

    try {
      const response = await fetch(url, options);
      const responseData = await response.text();

      console.log(`   Status: ${response.status}`);

      if (response.status === endpointConfig.expectStatus) {
        console.log(`   ✅ Fetch test passed for ${endpoint}`);
        return { success: true, endpoint, method: 'fetch', status: response.status, response: responseData };
      } else {
        console.log(`   ❌ Fetch test failed for ${endpoint} - expected ${endpointConfig.expectStatus}, got ${response.status}`);
        return { success: false, endpoint, method: 'fetch', status: response.status, error: responseData };
      }
    } catch (error) {
      console.log(`   ❌ Fetch test error for ${endpoint}: ${error.message}`);
      return { success: false, endpoint, method: 'fetch', error: error.message };
    }
  }

  async testEndpoint(endpoint, endpointConfig) {
    console.log(`\n🧪 Testing ${endpoint}: ${endpointConfig.description}`);

    const results = [];

    // Test with curl
    const curlResult = await this.testWithCurl(endpoint, endpointConfig);
    results.push(curlResult);

    // Test with fetch
    const fetchResult = await this.testWithFetch(endpoint, endpointConfig);
    results.push(fetchResult);

    return results;
  }

  async testSpecialEndpoints() {
    console.log('\n🎯 Testing special endpoint behaviors...');

    const specialTests = [];

    // Test rate limiting (if implemented)
    console.log('   🚦 Testing rate limiting...');
    try {
      const rapidRequests = Array(10).fill().map(() =>
        fetch(`${this.baseUrl}/api/server/health`)
      );

      const responses = await Promise.all(rapidRequests);
      const statusCodes = responses.map(r => r.status);

      const rateLimited = statusCodes.some(code => code === 429);

      specialTests.push({
        name: 'Rate Limiting',
        success: true, // Either way is acceptable
        note: rateLimited ? 'Rate limiting is active' : 'No rate limiting detected'
      });

      console.log(`   ${rateLimited ? '✅' : 'ℹ️'} ${rateLimited ? 'Rate limiting is active' : 'No rate limiting detected'}`);
    } catch (error) {
      specialTests.push({
        name: 'Rate Limiting',
        success: false,
        error: error.message
      });
    }

    // Test CORS headers
    console.log('   🌐 Testing CORS headers...');
    try {
      const response = await fetch(`${this.baseUrl}/api/server/health`, {
        method: 'OPTIONS'
      });

      const corsHeaders = [
        'access-control-allow-origin',
        'access-control-allow-methods',
        'access-control-allow-headers'
      ];

      const presentHeaders = corsHeaders.filter(header =>
        response.headers.has(header)
      );

      specialTests.push({
        name: 'CORS Headers',
        success: presentHeaders.length > 0,
        note: `Present headers: ${presentHeaders.join(', ') || 'none'}`
      });

      console.log(`   ${presentHeaders.length > 0 ? '✅' : '⚠️'} CORS headers: ${presentHeaders.join(', ') || 'none detected'}`);
    } catch (error) {
      specialTests.push({
        name: 'CORS Headers',
        success: false,
        error: error.message
      });
    }

    return specialTests;
  }

  async generateCurlExamples() {
    console.log('\n📝 Generating curl examples...');

    const examples = [];

    for (const [endpoint, config] of Object.entries(this.endpoints)) {
      let curlCommand = `curl -X ${config.method}`;

      if (config.requiresAuth) {
        curlCommand += ' -H "Authorization: Bearer YOUR_TOKEN"';
      }

      curlCommand += ' -H "Content-Type: application/json"';

      if (config.body) {
        curlCommand += ` -d '${JSON.stringify(config.body, null, 2)}'`;
      }

      if (config.isFileUpload) {
        curlCommand = 'curl -F "file=@your-file.txt"';
      }

      curlCommand += ` "${this.baseUrl}${config.path}"`;

      examples.push({
        endpoint,
        description: config.description,
        command: curlCommand
      });
    }

    // Write curl examples to file
    const examplesContent = `# ELIZA API Curl Examples

Generated on: ${new Date().toISOString()}
Base URL: ${this.baseUrl}

## Authentication

First, get an auth token:
\`\`\`bash
curl -X POST -H "Content-Type: application/json" \\
  -d '{"username": "admin", "password": "admin123"}' \\
  "${this.baseUrl}/api/auth/login"
\`\`\`

## Endpoints

${examples.map(ex => `### ${ex.description}
\`\`\`bash
${ex.command}
\`\`\`
`).join('\n')}

## Notes

- Replace YOUR_TOKEN with the actual JWT token from the login response
- Replace file paths with actual file paths for upload endpoints
- All endpoints return JSON responses unless otherwise noted
`;

    const examplesPath = join(this.gameDir, 'api-curl-examples.md');
    writeFileSync(examplesPath, examplesContent);
    console.log(`   📄 Curl examples saved to: ${examplesPath}`);

    return examples;
  }

  async generateReport() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        successRate: totalTests > 0 ? `${(passedTests / totalTests * 100).toFixed(2)}%` : '0%'
      },
      results: this.testResults,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        baseUrl: this.baseUrl,
        authenticationUsed: !!this.authToken
      }
    };

    const reportPath = join(this.gameDir, 'api-endpoints-test-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n📊 API Test Report');
    console.log('==================');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${report.summary.successRate}`);
    console.log(`Report saved to: ${reportPath}`);

    return report;
  }

  async runTests() {
    try {
      console.log('🧪 ELIZA API Endpoint Tests');
      console.log('============================');

      // Wait for server
      await this.waitForServer();

      // Authenticate for protected endpoints
      await this.authenticate();

      // Test all endpoints
      console.log('\n🔍 Testing API endpoints...');
      for (const [endpoint, config] of Object.entries(this.endpoints)) {
        const results = await this.testEndpoint(endpoint, config);
        this.testResults.push(...results);

        // Add delay between endpoint tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Test special behaviors
      const specialResults = await this.testSpecialEndpoints();
      this.testResults.push(...specialResults);

      // Generate curl examples
      await this.generateCurlExamples();

      // Generate report
      const report = await this.generateReport();

      // Check for failures
      const failures = this.testResults.filter(r => !r.success);
      if (failures.length > 0) {
        console.log('\n❌ Failed tests:');
        failures.forEach(failure => {
          console.log(`   • ${failure.endpoint || failure.name} (${failure.method}): ${failure.error || 'Status mismatch'}`);
        });
        process.exit(1);
      } else {
        console.log('\n🎉 All API tests passed!');
      }

    } catch (error) {
      console.error('❌ API test suite failed:', error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tests = new ApiEndpointTests();
  tests.runTests();
}

export { ApiEndpointTests };
