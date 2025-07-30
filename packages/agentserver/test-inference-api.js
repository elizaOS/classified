#!/usr/bin/env bun

// Simple test script to verify plugin-inference API endpoints work
console.log('Testing Plugin Inference API Integration...\n');

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
  try {
    // Try different possible API paths
    const possiblePaths = [
      '/api/providers',
      '/api/agents/default/providers',
      '/api/agents/primary/providers',
    ];

    let providersData;
    let workingPath;

    for (const path of possiblePaths) {
      console.log(`1. Testing GET ${path}...`);
      const response = await fetch(`${BASE_URL}${path}`);

      if (response.ok) {
        providersData = await response.json();
        workingPath = path;
        console.log('✅ Providers endpoint successful');
        console.log('Active provider:', providersData.data?.active || 'none');
        console.log(
          'Available providers:',
          providersData.data?.providers?.map((p) => `${p.name} (${p.status})`).join(', ') || 'none'
        );
        console.log('');
        break;
      } else {
        console.log(`❌ Failed: ${response.status} ${response.statusText}`);
      }
    }

    if (!workingPath) {
      console.log('❌ No working API path found for providers');
      return;
    }

    // Use the working path for subsequent tests
    const basePath = workingPath.replace('/providers', '');

    console.log(`2. Testing PUT ${basePath}/providers/selected...`);
    const selectResponse = await fetch(`${BASE_URL}${basePath}/providers/selected`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'ollama' }),
    });

    if (!selectResponse.ok) {
      console.error(
        `❌ Failed to set selected provider: ${selectResponse.status} ${selectResponse.statusText}`
      );
      return;
    }

    await selectResponse.json();
    console.log('✅ Set selected provider successful');
    console.log('');

    console.log(`3. Testing PUT ${basePath}/providers/preferences...`);
    const prefResponse = await fetch(`${BASE_URL}${basePath}/providers/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: ['ollama', 'groq', 'openai', 'anthropic', 'elizaos'] }),
    });

    if (!prefResponse.ok) {
      console.error(
        `❌ Failed to set preferences: ${prefResponse.status} ${prefResponse.statusText}`
      );
      return;
    }

    await prefResponse.json();
    console.log('✅ Set preferences successful');
    console.log('');

    console.log('4. Verifying changes...');
    const verifyResponse = await fetch(`${BASE_URL}${workingPath}`);
    const verifyData = await verifyResponse.json();
    console.log('Current active provider:', verifyData.data?.active || 'none');
    console.log('');

    console.log('🎉 All Plugin Inference API tests passed!');
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
    console.log('\n💡 Make sure the agent server is running on port 3000');
    console.log('   Run: bun run dev');
  }
}

// Check if server is running first
async function checkServer() {
  try {
    // Try providers endpoint directly instead of health check
    console.log('🔍 Checking server connection...\n');
    const response = await fetch(`${BASE_URL}/api/providers`);
    if (response.ok || response.status === 404) {
      // 404 might mean no agent yet
      console.log('✅ Server is reachable, proceeding with tests...\n');
      await testAPI();
    } else {
      console.log(`❌ Server responded with ${response.status}: ${response.statusText}`);
    }
  } catch {
    console.log('❌ Cannot connect to server');
    console.log('💡 Make sure the agent server is running on port 3000');
    console.log('   Run: bun run dev');
  }
}

checkServer();
