#!/usr/bin/env bun
// Script to check if the eliza-agent container image exists
// Used to provide helpful messages when running dev mode

import { $ } from 'bun';

async function getContainerRuntime() {
  // Check for Podman first (preferred), then Docker
  try {
    await $`podman --version`.quiet();
    return 'podman';
  } catch {
    try {
      await $`docker info`.quiet();
      return 'docker';
    } catch {
      return null;
    }
  }
}

async function checkContainerImage() {
  const runtime = await getContainerRuntime();

  if (!runtime) {
    console.warn('⚠️  No container runtime (Podman/Docker) found.');
    console.warn('   The game will not be able to start the agent container.');
    console.warn('   Please install Podman or Docker.');
    return false;
  }

  try {
    // Check if eliza-agent:latest exists
    await $`${runtime} image inspect eliza-agent:latest`.quiet();
    console.log('✅ Container image eliza-agent:latest exists');
    return true;
  } catch {
    console.warn('⚠️  Container image eliza-agent:latest not found!');
    console.warn('   Please run one of the following commands:');
    console.warn('   - npm run start (to build everything including container)');
    console.warn('   - cd ../agentserver && bun run build (to build container only)');
    console.warn('');
    console.warn('   For faster development after initial build, use:');
    console.warn('   - npm run dev (rebuilds backend only)');
    console.warn('   - npm run dev:fast (no backend rebuild)');
    return false;
  }
}

// Run if called directly
if (import.meta.main) {
  await checkContainerImage();
}

export { checkContainerImage, getContainerRuntime };
