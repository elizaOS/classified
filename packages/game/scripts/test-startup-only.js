#!/usr/bin/env node

/**
 * Startup Test - Verify USE_SMALL_MODELS and basic functionality
 *
 * This test focuses on verifying:
 * 1. USE_SMALL_MODELS environment variable is set
 * 2. Frontend starts correctly
 * 3. Backend connects properly
 * 4. Health checks pass
 */

import { spawn } from 'child_process';
import fs from 'fs';

console.log('🚀 STARTUP AND USE_SMALL_MODELS TEST');
console.log('=====================================');

async function testFrontendStartup() {
  return new Promise((resolve) => {
    console.log('📱 Starting frontend with USE_SMALL_MODELS=true...');

    const frontend = spawn('npm', ['run', 'dev:frontend'], {
      env: { ...process.env, USE_SMALL_MODELS: 'true' },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    frontend.stdout.on('data', (data) => {
      output += data.toString();

      // Check if server is ready
      if (output.includes('Local:   http://localhost:5173/')) {
        console.log('✅ Frontend started successfully');
        console.log('   URL: http://localhost:5173/');
        frontend.kill();
        resolve(true);
      }
    });

    frontend.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.includes('Error') || error.includes('failed')) {
        console.log('❌ Frontend startup failed:', error);
        frontend.kill();
        resolve(false);
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      console.log('⏰ Frontend startup timeout (30s)');
      frontend.kill();
      resolve(false);
    }, 30000);
  });
}

async function testHealthEndpoint() {
  try {
    console.log('🏥 Testing agent server health...');
    const response = await fetch('http://localhost:7777/api/server/health');
    const data = await response.json();

    if (data.status === 'OK') {
      console.log('✅ Agent server health check passed');
      console.log(`   Status: ${data.status}`);
      console.log(`   Dependencies: ${JSON.stringify(data.dependencies)}`);
      return true;
    } else {
      console.log('❌ Health check failed:', data);
      return false;
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
    return false;
  }
}

async function testEnvironmentVariables() {
  console.log('🔧 Testing environment variables...');

  // Check if USE_SMALL_MODELS is set correctly
  if (process.env.USE_SMALL_MODELS === 'true') {
    console.log('✅ USE_SMALL_MODELS environment variable is set correctly');
  } else {
    console.log('⚠️ USE_SMALL_MODELS environment variable not set');
  }

  // Check package.json scripts contain the flag
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const devScript = packageJson.scripts.dev;

    if (devScript && devScript.includes('USE_SMALL_MODELS=true')) {
      console.log('✅ package.json dev script includes USE_SMALL_MODELS=true');
    } else {
      console.log('❌ package.json dev script missing USE_SMALL_MODELS=true');
      return false;
    }

    return true;
  } catch (error) {
    console.log('❌ Failed to read package.json:', error.message);
    return false;
  }
}

async function main() {
  console.log('Running comprehensive startup test...\n');

  let allPassed = true;

  // Test 1: Environment Variables
  const envTest = await testEnvironmentVariables();
  if (!envTest) {allPassed = false;}

  console.log('');

  // Test 2: Frontend Startup
  const frontendTest = await testFrontendStartup();
  if (!frontendTest) {allPassed = false;}

  console.log('');

  // Test 3: Backend Health
  const healthTest = await testHealthEndpoint();
  if (!healthTest) {allPassed = false;}

  console.log('');
  console.log('=== TEST RESULTS ===');
  console.log(`Environment Variables: ${envTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Frontend Startup: ${frontendTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Backend Health: ${healthTest ? '✅ PASS' : '❌ FAIL'}`);

  if (allPassed) {
    console.log('\n🎉 ALL STARTUP TESTS PASSED! 🎉');
    console.log('✅ USE_SMALL_MODELS flag is working correctly');
    console.log('✅ Frontend starts up properly');
    console.log('✅ Backend server is healthy');
    console.log('✅ System is ready for chat testing');
  } else {
    console.log('\n❌ SOME TESTS FAILED ❌');
    console.log('Please check the errors above');
    process.exit(1);
  }
}

main();
