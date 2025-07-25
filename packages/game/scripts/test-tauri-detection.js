#!/usr/bin/env node

/**
 * Test script to validate Tauri detection updates
 * Verifies that the detection logic properly handles the new window.__TAURI_INTERNALS__ and window.isTauri
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Validating Tauri Detection Updates...\n');

const filesToCheck = [
  '../src/services/TauriService.ts',
  '../src/services/APIService.ts',
  '../src/components/StartupFlow.tsx'
];

let totalChecks = 0;
let passedChecks = 0;

for (const filePath of filesToCheck) {
  const fullPath = join(__dirname, filePath);
  const content = readFileSync(fullPath, 'utf-8');

  console.log(`📁 Checking ${filePath}:`);

  // Check for updated Tauri detection patterns
  const checks = [
    {
      name: 'Uses new __TAURI_INTERNALS__ detection',
      pattern: /__TAURI_INTERNALS__/,
      required: true
    },
    {
      name: 'Uses new window.isTauri detection',
      pattern: /window.*\.isTauri/,
      required: true
    },
    {
      name: 'Maintains legacy __TAURI__ support',
      pattern: /__TAURI__/,
      required: true
    },
    {
      name: 'No require() statements in ES modules',
      pattern: /require\s*\(/,
      required: false // Should NOT be present
    }
  ];

  for (const check of checks) {
    totalChecks++;
    const found = check.pattern.test(content);
    const passed = check.required ? found : !found;

    if (passed) {
      console.log(`  ✅ ${check.name}`);
      passedChecks++;
    } else {
      console.log(`  ❌ ${check.name}`);
    }
  }

  console.log('');
}

// Summary
console.log('📊 Validation Summary:');
console.log(`✅ Passed: ${passedChecks}/${totalChecks} checks`);
console.log(`❌ Failed: ${totalChecks - passedChecks}/${totalChecks} checks`);

if (passedChecks === totalChecks) {
  console.log('\n🎉 All Tauri detection updates validated successfully!');
  console.log('The application should now properly detect Tauri using:');
  console.log('- window.__TAURI_INTERNALS__ (new primary)');
  console.log('- window.isTauri (new secondary)');
  console.log('- window.__TAURI__ (legacy fallback)');
  process.exit(0);
} else {
  console.log('\n⚠️ Some validation checks failed. Please review the files above.');
  process.exit(1);
}
