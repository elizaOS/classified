#!/usr/bin/env bun
// Fast development build script for ElizaOS Agent Server
// Only builds the backend JavaScript, skips container building
// For full build including containers, use build-all.js

import { $ } from 'bun';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkContainerImage } from './check-container.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('🚀 ElizaOS Agent Server - Fast Development Build\n');

  // Check if container image exists
  console.log('🔍 Checking for existing container image...');
  const hasContainer = await checkContainerImage();

  if (!hasContainer) {
    console.log('\n⚠️  Container image missing! The game may not function properly.');
    console.log('   Run "npm run start" or "bun run build" to create it.\n');
  }

  console.log('\n📦 Building backend only (skipping container build for speed)...');

  try {
    await $`bun ${path.join(__dirname, 'build.js')}`;
    console.log('✅ Backend built successfully');
    console.log(`   ${path.join(__dirname, '..', 'dist', 'server.js')}`);

    console.log('\n💡 Development tips:');
    console.log('   - Use "npm run dev:fast" to skip backend rebuild');
    console.log('   - Use "npm run start" for full build with containers');
    console.log('   - Container builds are cached after first run');
  } catch (error) {
    console.error('❌ Failed to build backend:', error);
    process.exit(1);
  }
}

main();
