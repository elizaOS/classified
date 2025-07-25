#!/usr/bin/env node

/**
 * Pre-release check script for ElizaOS Game
 * Validates that everything is ready for a release build
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GAME_DIR = path.dirname(__dirname);
const TAURI_CONFIG = path.join(GAME_DIR, 'src-tauri', 'tauri.conf.json');
const PACKAGE_JSON = path.join(GAME_DIR, 'package.json');

console.log('🔍 ElizaOS Game Pre-Release Check\n');

const errors = [];
const warnings = [];

// Check if package.json exists and is valid
console.log('📦 Checking package.json...');
try {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  console.log(`   ✅ Version: ${pkg.version}`);
  console.log(`   ✅ Name: ${pkg.name}`);

  if (!pkg.version || !pkg.version.match(/^\d+\.\d+\.\d+/)) {
    errors.push('Invalid version format in package.json');
  }
} catch (err) {
  errors.push(`Cannot read package.json: ${err.message}`);
}

// Check Tauri configuration
console.log('⚙️  Checking Tauri configuration...');
try {
  const tauriConfig = JSON.parse(fs.readFileSync(TAURI_CONFIG, 'utf8'));

  if (tauriConfig.version !== '../package.json') {
    warnings.push('Tauri config should use "../package.json" for version sync');
  }

  console.log(`   ✅ Product: ${tauriConfig.productName}`);
  console.log(`   ✅ Identifier: ${tauriConfig.identifier}`);

  // Check if icons exist
  const iconDir = path.join(GAME_DIR, 'src-tauri', 'icons');
  const requiredIcons = ['icon.ico', 'icon.icns', '32x32.png', '128x128.png'];

  for (const icon of requiredIcons) {
    const iconPath = path.join(iconDir, icon);
    if (!fs.existsSync(iconPath)) {
      errors.push(`Missing icon: ${icon}`);
    }
  }

  console.log('   ✅ Icons present');
} catch (err) {
  errors.push(`Cannot read Tauri config: ${err.message}`);
}

// Check if build dependencies are available
console.log('🛠️  Checking build dependencies...');

try {
  // Check Node.js version
  const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
  console.log(`   ✅ Node.js: ${nodeVersion}`);

  if (!nodeVersion.startsWith('v23.3')) {
    warnings.push(`Expected Node.js v23.3.x, got ${nodeVersion}`);
  }
} catch (err) {
  errors.push('Node.js not available');
}

try {
  // Check Bun
  const bunVersion = execSync('bun --version', { encoding: 'utf8' }).trim();
  console.log(`   ✅ Bun: ${bunVersion}`);
} catch (err) {
  errors.push('Bun not available');
}

try {
  // Check Rust
  const rustVersion = execSync('rustc --version', { encoding: 'utf8' }).trim();
  console.log(`   ✅ Rust: ${rustVersion}`);
} catch (err) {
  errors.push('Rust not available');
}

// Check if we can build
console.log('🏗️  Testing build process...');
try {
  console.log('   Building frontend and backend...');
  execSync('npm run build', { cwd: GAME_DIR, stdio: 'pipe' });
  console.log('   ✅ Build successful');
} catch (err) {
  errors.push('Build failed - fix build errors before release');
}

// Check git status
console.log('📋 Checking git status...');
try {
  const gitStatus = execSync('git status --porcelain', { cwd: GAME_DIR, encoding: 'utf8' });

  if (gitStatus.trim()) {
    warnings.push('Working directory has uncommitted changes');
    console.log('   ⚠️  Uncommitted changes detected');
  } else {
    console.log('   ✅ Working directory clean');
  }

  // Check if on main branch
  const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
    cwd: GAME_DIR,
    encoding: 'utf8',
  }).trim();
  if (currentBranch !== 'main') {
    warnings.push(`Currently on branch '${currentBranch}', consider releasing from 'main'`);
  } else {
    console.log('   ✅ On main branch');
  }
} catch (err) {
  warnings.push('Cannot check git status - ensure you are in a git repository');
}

// Summary
console.log('\n📊 Summary:');

if (errors.length > 0) {
  console.log('\n❌ ERRORS (must fix before release):');
  errors.forEach((error) => console.log(`   • ${error}`));
}

if (warnings.length > 0) {
  console.log('\n⚠️  WARNINGS (recommended to fix):');
  warnings.forEach((warning) => console.log(`   • ${warning}`));
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All checks passed! Ready for release.');
  console.log('\nTo create a release:');
  console.log('  npm run release:patch   # for bug fixes');
  console.log('  npm run release:minor   # for new features');
  console.log('  npm run release:major   # for breaking changes');
} else if (errors.length === 0) {
  console.log('✅ No critical errors found. Ready for release (with warnings).');
} else {
  console.log('❌ Cannot release until errors are fixed.');
  process.exit(1);
}
