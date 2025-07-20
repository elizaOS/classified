#!/usr/bin/env node

/**
 * Debug Script for Knowledge Routes
 * Tests various knowledge API endpoints to determine which ones are working
 */

const API_BASE = 'http://localhost:7777';
const AGENT_ID = '00000000-0000-0000-0000-000000000001';

async function testEndpoint(method, path, data = null, headers = {}) {
  const url = `${API_BASE}${path}`;
  console.log(`\n🧪 Testing ${method} ${url}`);
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  };

  if (data && method !== 'GET') {
    if (data instanceof FormData) {
      delete options.headers['Content-Type'];
      options.body = data;
    } else {
      options.body = JSON.stringify(data);
    }
  }

  try {
    const response = await fetch(url, options);
    const responseText = await response.text();
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${typeof responseData === 'string' ? responseData : JSON.stringify(responseData, null, 2)}`);
    
    return { status: response.status, data: responseData };
  } catch (error) {
    console.log(`   Error: ${error.message}`);
    return { status: 'error', data: error.message };
  }
}

async function runDiagnostics() {
  console.log('🔍 Knowledge API Route Diagnostics');
  console.log('==================================');

  // Test 1: Check server health
  await testEndpoint('GET', '/api/server/health');

  // Test 2: Check if knowledge plugin routes are mounted (gameAPIPlugin routes)
  await testEndpoint('GET', '/knowledge/documents', null, { 'agentId': AGENT_ID });
  await testEndpoint('GET', `/knowledge/documents?agentId=${AGENT_ID}`);

  // Test 3: Check ElizaOS server knowledge routes (if they exist)
  await testEndpoint('GET', '/api/knowledge/documents', null, { 'agentId': AGENT_ID });
  await testEndpoint('GET', `/api/knowledge/documents?agentId=${AGENT_ID}`);

  // Test 4: Check plugin-mounted routes with agent ID in query
  await testEndpoint('GET', `/knowledge/documents?agentId=${AGENT_ID}`);

  // Test 5: Test different route patterns that might be registered
  await testEndpoint('GET', `/api/agents/${AGENT_ID}/knowledge/documents`);
  await testEndpoint('GET', `/agents/${AGENT_ID}/knowledge/documents`);

  // Test 6: Check if routes are available but need different parameters
  await testEndpoint('POST', '/knowledge/upload', {
    agentId: AGENT_ID,
    text: 'test content',
    filename: 'test.txt'
  });

  // Test 7: Debug plugin routes by checking all available routes
  await testEndpoint('GET', '/api/debug/runtime-state');

  console.log('\n✅ Diagnostics complete');
  console.log('\nNext steps:');
  console.log('1. Check which endpoints returned 200 vs 404');
  console.log('2. Look for working knowledge endpoints');
  console.log('3. Check the debug/runtime-state to see registered routes');
}

runDiagnostics().catch(console.error);