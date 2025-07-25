#!/usr/bin/env node

import http from 'http';

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// Test endpoint function
async function testEndpoint(method, path, body = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 7777,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: parsed,
            success: res.statusCode >= 200 && res.statusCode < 300
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data,
            success: false,
            error: 'Failed to parse response'
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        status: 0,
        data: null,
        success: false,
        error: e.message
      });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Run tests
async function runTests() {
  console.log(`${colors.blue}Testing ElizaOS Capability Routes${colors.reset}\n`);

  // Test health check first
  console.log(`${colors.yellow}Testing health endpoint...${colors.reset}`);
  const health = await testEndpoint('GET', '/api/server/health');
  if (!health.success) {
    console.log(`${colors.red}❌ Server is not running on port 7777${colors.reset}`);
    console.log(`${colors.red}   Error: ${health.error}${colors.reset}`);
    process.exit(1);
  }
  console.log(`${colors.green}✅ Server is healthy${colors.reset}\n`);

  // Test autonomy routes
  console.log(`${colors.yellow}Testing autonomy routes...${colors.reset}`);

  const autonomyStatus = await testEndpoint('GET', '/autonomy/status');
  console.log(`GET /autonomy/status: ${autonomyStatus.success ? `${colors.green}✅` : `${colors.red}❌`} ${colors.reset}`);
  if (autonomyStatus.success) {
    console.log(`   Data: ${JSON.stringify(autonomyStatus.data.data)}`);
  }

  const enableAutonomy = await testEndpoint('POST', '/autonomy/enable');
  console.log(`POST /autonomy/enable: ${enableAutonomy.success ? `${colors.green}✅` : `${colors.red}❌`} ${colors.reset}`);

  const disableAutonomy = await testEndpoint('POST', '/autonomy/disable');
  console.log(`POST /autonomy/disable: ${disableAutonomy.success ? `${colors.green}✅` : `${colors.red}❌`} ${colors.reset}\n`);

  // Test capability routes
  console.log(`${colors.yellow}Testing capability routes...${colors.reset}`);

  const capabilities = ['shell', 'browser'];
  for (const cap of capabilities) {
    console.log(`\n${colors.blue}Testing ${cap} capability:${colors.reset}`);

    const status = await testEndpoint('GET', `/api/agents/default/capabilities/${cap}`);
    console.log(`GET /api/agents/default/capabilities/${cap}: ${status.success ? `${colors.green}✅` : `${colors.red}❌`} ${colors.reset}`);
    if (status.success) {
      console.log(`   Data: ${JSON.stringify(status.data.data)}`);
    }

    const toggle = await testEndpoint('POST', `/api/agents/default/capabilities/${cap}/toggle`);
    console.log(`POST /api/agents/default/capabilities/${cap}/toggle: ${toggle.success ? `${colors.green}✅` : `${colors.red}❌`} ${colors.reset}`);
    if (toggle.success) {
      console.log(`   New state: ${toggle.data.data.enabled}`);
    }
  }

  // Test vision settings
  console.log(`\n${colors.yellow}Testing vision settings...${colors.reset}`);

  const visionSettings = await testEndpoint('GET', '/api/agents/default/settings/vision');
  console.log(`GET /api/agents/default/settings/vision: ${visionSettings.success ? `${colors.green}✅` : `${colors.red}❌`} ${colors.reset}`);
  if (visionSettings.success) {
    console.log(`   Camera: ${visionSettings.data.data.ENABLE_CAMERA}`);
    console.log(`   Screen: ${visionSettings.data.data.ENABLE_SCREEN_CAPTURE}`);
    console.log(`   Microphone: ${visionSettings.data.data.ENABLE_MICROPHONE}`);
    console.log(`   Speaker: ${visionSettings.data.data.ENABLE_SPEAKER}`);
  }

  // Test settings update
  console.log(`\n${colors.yellow}Testing settings update...${colors.reset}`);

  const updateSetting = await testEndpoint('POST', '/api/agents/default/settings', {
    key: 'TEST_SETTING',
    value: 'test_value'
  });
  console.log(`POST /api/agents/default/settings: ${updateSetting.success ? `${colors.green}✅` : `${colors.red}❌`} ${colors.reset}`);

  console.log(`\n${colors.green}Testing complete!${colors.reset}`);
}

// Run the tests
runTests().catch(console.error);
