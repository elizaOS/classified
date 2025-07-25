#!/usr/bin/env bun
// Unified build script for ElizaOS Agent Server
// Builds everything: backend, Linux binary, and Podman image

import { $ } from 'bun';
import { existsSync } from 'fs';

async function buildEverything() {
  console.log('🚀 ElizaOS Agent Server - Complete Build Process\n');

  try {
    // Step 1: Build the backend
    console.log('📦 Step 1/3: Building backend...');
    await $`bun build.js`;

    // Verify backend build
    if (!existsSync('./dist-backend/server.js')) {
      throw new Error('Backend build failed - server.js not found');
    }
    console.log('✅ Backend built successfully\n');

    // Step 2: Build Linux binary
    console.log('🔨 Step 2/3: Building Linux binary...');

    // Ensure DOM polyfill exists
    if (!existsSync('./dom-polyfill.ts')) {
      throw new Error('DOM polyfill file missing - required for server-only environment');
    }

    // Create output directory
    await $`mkdir -p ./dist-binaries`;

    const backendFile = './dist-backend/server.js';
    
    // Build both Linux architectures for containers
    const targets = [
      { target: 'bun-linux-x64', output: './dist-binaries/server-linux-amd64' },
      { target: 'bun-linux-arm64', output: './dist-binaries/server-linux-arm64' }
    ];

    for (const { target, output } of targets) {
      try {
        console.log(`📦 Cross-compiling for ${target}...`);
        await $`bun build --compile --target=${target} ${backendFile} --outfile ${output}`;
        await $`chmod +x ${output}`;
        console.log(`✅ Built ${target} successfully`);
      } catch (error) {
        console.warn(`⚠️  Failed to build ${target}: ${error.message}`);
        // Continue with other targets even if one fails
      }
    }

    // Verify at least one binary was created
    const primaryBinary = './dist-binaries/server-linux-amd64';
    if (!existsSync(primaryBinary)) {
      throw new Error('Binary compilation failed - no usable Linux binary created');
    }

    const stats = await $`ls -lh ./dist-binaries/server-linux-*`.text();
    console.log(`✅ Linux binaries created:\n${stats.trim()}\n`);

    // Step 3: Build Podman image
    console.log('🐳 Step 3/3: Building Podman image...');

    // Verify podman is available
    try {
      await $`podman --version`.quiet();
    } catch {
      throw new Error('Podman not found. Please install Podman.');
    }

    // Build the image for the native platform architecture
    const imageName = 'eliza-agent-server:latest';
    
    // Build for native architecture to avoid Rosetta issues
    const arch = process.arch;
    const platform = arch === 'arm64' ? 'linux/arm64' : 'linux/amd64';
    
    console.log(`📦 Building container for platform: ${platform}`);
    await $`podman build --platform ${platform} -t ${imageName} -f Dockerfile .`;

    // Tag for Rust compatibility
    await $`podman tag ${imageName} eliza-agent:latest`;

    console.log('✅ Podman image built successfully\n');

    // Show final summary
    console.log('🎉 Build completed successfully!\n');
    console.log('📋 Artifacts created:');
    console.log('   - Backend: dist-backend/server.js');
    console.log('   - Binaries: dist-binaries/server-linux-amd64, server-linux-arm64');
    console.log('   - Image:   eliza-agent-server:latest');
    console.log('\n🚀 The Rust container manager can now start the agent using:');
    console.log('   podman run -p 7777:7777 eliza-agent-server:latest');

  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run the complete build
await buildEverything();
