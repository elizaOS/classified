#!/usr/bin/env node

/**
 * Build Verification Script
 * Verifies that all expected build outputs are present and functional
 */

import { existsSync, statSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// ANSI colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = (color, message) => console.log(`${color}${message}${colors.reset}`);
const success = (message) => log(colors.green, `✅ ${message}`);
const error = (message) => log(colors.red, `❌ ${message}`);
const warning = (message) => log(colors.yellow, `⚠️  ${message}`);
const info = (message) => log(colors.blue, `ℹ️  ${message}`);

// Expected build outputs
const expectedOutputs = [
  // Core packages
  { path: 'packages/core/dist/index.js', name: 'ElizaOS Core', required: true },
  { path: 'packages/core/dist/index.d.ts', name: 'ElizaOS Core Types', required: true },
  
  // Essential plugins
  { path: 'packages/plugin-bootstrap/dist/index.js', name: 'Bootstrap Plugin', required: true },
  { path: 'packages/plugin-sql/dist/index.js', name: 'SQL Plugin', required: true },
  { path: 'packages/plugin-goals/dist/index.js', name: 'Goals Plugin', required: true },
  { path: 'packages/plugin-todo/dist/index.js', name: 'Todo Plugin', required: true },
  { path: 'packages/plugin-autonomy/dist/index.js', name: 'Autonomy Plugin', required: true },
  
  // Server components
  { path: 'packages/server/dist/index.js', name: 'ElizaOS Server', required: true },
  
  // Game components
  { path: 'packages/game/dist/index.html', name: 'Game Frontend', required: true },
  { path: 'packages/game/src-tauri/target/release/app', name: 'Tauri Binary', required: false },
  
  // Agent server
  { path: 'packages/agentserver/dist-backend/server.js', name: 'AgentServer Backend', required: true },
  { path: 'packages/agentserver/dist-binaries/server-local', name: 'Local Binary', required: true },
  { path: 'packages/agentserver/dist-binaries/server-linux-arm64', name: 'Linux ARM64 Binary', required: false },
  { path: 'packages/agentserver/dist-binaries/server-linux-x64', name: 'Linux x64 Binary', required: false },
];

async function verifyBuildOutputs() {
  info('🔍 Verifying build outputs...\n');
  
  let totalChecks = 0;
  let passedChecks = 0;
  let requiredFailures = 0;
  
  for (const output of expectedOutputs) {
    totalChecks++;
    const fullPath = resolve(rootDir, output.path);
    
    if (existsSync(fullPath)) {
      const stats = statSync(fullPath);
      const size = (stats.size / 1024).toFixed(1);
      success(`${output.name}: ${size}KB`);
      passedChecks++;
    } else {
      if (output.required) {
        error(`${output.name}: MISSING (required)`);
        requiredFailures++;
      } else {
        warning(`${output.name}: MISSING (optional)`);
      }
    }
  }
  
  console.log();
  
  // Verify DOM polyfill is present
  const domPolyfillPath = resolve(rootDir, 'packages/agentserver/dom-polyfill.ts');
  if (existsSync(domPolyfillPath)) {
    success('DOM Polyfill: Present');
    passedChecks++;
  } else {
    error('DOM Polyfill: MISSING (required for server-only environment)');
    requiredFailures++;
  }
  totalChecks++;
  
  // Check for package.json files
  const packageJsonFiles = [
    'package.json',
    'packages/core/package.json',
    'packages/agentserver/package.json',
    'packages/game/package.json'
  ];
  
  for (const pkgPath of packageJsonFiles) {
    totalChecks++;
    const fullPath = resolve(rootDir, pkgPath);
    if (existsSync(fullPath)) {
      try {
        const pkg = JSON.parse(readFileSync(fullPath, 'utf8'));
        success(`Package ${pkg.name}: v${pkg.version}`);
        passedChecks++;
      } catch (e) {
        error(`Package at ${pkgPath}: Invalid JSON`);
        requiredFailures++;
      }
    } else {
      error(`Package at ${pkgPath}: MISSING`);
      requiredFailures++;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  info(`Build Verification Summary:`);
  console.log(`Total checks: ${totalChecks}`);
  console.log(`${colors.green}Passed: ${passedChecks}${colors.reset}`);
  console.log(`${colors.red}Required failures: ${requiredFailures}${colors.reset}`);
  console.log(`${colors.yellow}Optional failures: ${totalChecks - passedChecks - requiredFailures}${colors.reset}`);
  
  if (requiredFailures === 0) {
    console.log();
    success('🎉 All required build outputs are present!');
    success('✨ Build verification PASSED');
    return true;
  } else {
    console.log();
    error(`💥 ${requiredFailures} required build outputs are missing!`);
    error('🚨 Build verification FAILED');
    return false;
  }
}

async function main() {
  console.log(`${colors.bold}${colors.cyan}ELIZA Build Verification${colors.reset}\n`);
  
  const success = await verifyBuildOutputs();
  
  if (!success) {
    process.exit(1);
  }
}

main().catch(console.error);