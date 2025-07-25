#!/usr/bin/env node

/**
 * Release Setup Verification Script
 * Checks if all components are ready for the release pipeline
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

console.log('🔍 Verifying Release Setup...\n');

let allPassed = true;
const issues = [];

// Check 1: Lander package.json and build setup
console.log('📦 Checking Lander Setup...');
try {
  const landerPackageJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'packages/lander/package.json'), 'utf8')
  );

  if (landerPackageJson.scripts?.build) {
    console.log('  ✅ Lander build script found');
  } else {
    issues.push('❌ Lander build script missing');
    allPassed = false;
  }

  const landerViteConfig = fs.readFileSync(
    path.join(rootDir, 'packages/lander/vite.config.ts'),
    'utf8'
  );
  if (landerViteConfig.includes('/thegame/')) {
    console.log('  ✅ Lander base path configured for GitHub Pages');
  } else {
    issues.push('❌ Lander base path not configured');
    allPassed = false;
  }
} catch (e) {
  issues.push('❌ Lander configuration files missing');
  allPassed = false;
}

// Check 2: Game/Tauri setup
console.log('\n🎮 Checking Game/Tauri Setup...');
try {
  const gamePackageJson = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'packages/game/package.json'), 'utf8')
  );

  if (gamePackageJson.scripts?.['tauri:build']) {
    console.log('  ✅ Tauri build script found');
  } else {
    issues.push('❌ Tauri build script missing');
    allPassed = false;
  }

  const tauriConfig = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'packages/game/src-tauri/tauri.conf.json'), 'utf8')
  );

  if (tauriConfig.productName === 'ELIZA') {
    console.log('  ✅ Tauri app name configured');
  } else {
    issues.push('❌ Tauri app name not configured correctly');
    allPassed = false;
  }

  if (tauriConfig.identifier === 'com.classified.eliza') {
    console.log('  ✅ Tauri identifier configured');
  } else {
    issues.push('❌ Tauri identifier not configured correctly');
    allPassed = false;
  }
} catch (e) {
  issues.push('❌ Game/Tauri configuration files missing or invalid');
  allPassed = false;
}

// Check 3: GitHub Actions workflows
console.log('\n⚙️  Checking GitHub Actions Workflows...');
const workflows = ['lander-deploy.yml', 'tauri-release.yml', 'manual-release.yml'];

for (const workflow of workflows) {
  try {
    const workflowContent = fs.readFileSync(
      path.join(rootDir, '.github/workflows', workflow),
      'utf8'
    );
    console.log(`  ✅ ${workflow} found`);

    // Check for workflow dispatch capability
    if (workflowContent.includes('workflow_dispatch')) {
      console.log(`    ✅ ${workflow} can be manually triggered`);
    }
  } catch (e) {
    issues.push(`❌ Workflow ${workflow} missing`);
    allPassed = false;
  }
}

// Check 4: GitHub release hook configuration
console.log('\n🔗 Checking Release Hook Configuration...');
try {
  const hookContent = fs.readFileSync(
    path.join(rootDir, 'packages/lander/src/hooks/useGithubReleases.ts'),
    'utf8'
  );

  if (
    hookContent.includes("REPO_OWNER = 'lalalune'") &&
    hookContent.includes("REPO_NAME = 'thegame'")
  ) {
    console.log('  ✅ GitHub release hook configured for correct repository');
  } else {
    issues.push('❌ GitHub release hook has wrong repository configuration');
    allPassed = false;
  }
} catch (e) {
  issues.push('❌ GitHub release hook missing');
  allPassed = false;
}

// Summary
console.log('\n' + '='.repeat(50));
if (allPassed) {
  console.log('🎉 All checks passed! Release setup is ready.');
  console.log('\nTo create a release:');
  console.log('1. Go to GitHub Actions → Manual Release');
  console.log('2. Enter a version like "v1.0.0"');
  console.log('3. Click "Run workflow"');
  console.log('\nThis will:');
  console.log('- Build Tauri apps for all platforms');
  console.log('- Create a GitHub release');
  console.log('- Update the lander to show new downloads');
} else {
  console.log('❌ Some issues found:');
  issues.forEach((issue) => console.log(`  ${issue}`));
  process.exit(1);
}
