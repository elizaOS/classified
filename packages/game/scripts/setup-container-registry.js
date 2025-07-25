#!/usr/bin/env node
/**
 * Container Registry Setup Script
 *
 * This script helps set up container registry publishing for ELIZA Game containers.
 * It can push to Docker Hub, GitHub Container Registry, or other registries.
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GAME_ROOT = path.join(__dirname, '..');

// Registry configurations
const REGISTRIES = {
  dockerhub: {
    name: 'Docker Hub',
    prefix: 'elizaos',
    loginCommand: 'docker login',
    pushCommand: (tag) => `docker push ${tag}`
  },
  ghcr: {
    name: 'GitHub Container Registry',
    prefix: 'ghcr.io/ai16z/eliza',
    loginCommand: 'docker login ghcr.io',
    pushCommand: (tag) => `docker push ${tag}`
  },
  custom: {
    name: 'Custom Registry',
    prefix: process.env.CUSTOM_REGISTRY_PREFIX || 'my-registry.com/eliza',
    loginCommand: process.env.CUSTOM_LOGIN_COMMAND || 'docker login my-registry.com',
    pushCommand: (tag) => `docker push ${tag}`
  }
};

const IMAGES = [
  'eliza-agent',
  'eliza-postgres',
  'eliza-ollama',
  'eliza-ollama-lightweight'
];

async function setupContainerRegistry() {
  console.log('🚀 ELIZA Game Container Registry Setup');
  console.log('='.repeat(50));

  const registry = process.argv[2] || 'dockerhub';

  if (!REGISTRIES[registry]) {
    console.error('❌ Invalid registry. Available options: dockerhub, ghcr, custom');
    process.exit(1);
  }

  const config = REGISTRIES[registry];
  console.log(`📦 Setting up ${config.name}...`);

  try {
    // Check if images exist locally
    await checkLocalImages();

    // Login to registry
    await loginToRegistry(config);

    // Tag and push images
    await tagAndPushImages(config);

    // Create updated docker-compose file
    await createRegistryDockerCompose(config);

    console.log(`\n✅ Successfully published to ${config.name}!`);
    console.log(`📋 Users can now pull images with prefix: ${config.prefix}`);

  } catch (error) {
    console.error('❌ Registry setup failed:', error.message);
    process.exit(1);
  }
}

async function checkLocalImages() {
  console.log('🔍 Checking for local images...');

  for (const image of IMAGES) {
    try {
      const result = execSync(`docker images -q elizaos/${image}:latest`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      if (!result.trim()) {
        console.log(`⚠️  Image elizaos/${image}:latest not found locally`);
        console.log('   Run: npm run container:build-production first');
      } else {
        console.log(`✅ Found elizaos/${image}:latest`);
      }
    } catch (error) {
      console.log(`⚠️  Could not check elizaos/${image}:latest`);
    }
  }
}

async function loginToRegistry(config) {
  console.log(`🔐 Logging into ${config.name}...`);

  try {
    execSync(config.loginCommand, {
      stdio: 'inherit'
    });
    console.log(`✅ Successfully logged into ${config.name}`);
  } catch (error) {
    throw new Error(`Failed to login to ${config.name}: ${error.message}`);
  }
}

async function tagAndPushImages(config) {
  console.log(`🏷️  Tagging and pushing images to ${config.name}...`);

  for (const image of IMAGES) {
    const localTag = `elizaos/${image}:latest`;
    const remoteTag = `${config.prefix}/${image}:latest`;
    const versionTag = `${config.prefix}/${image}:v2.0.0`;

    try {
      // Check if local image exists
      const result = execSync(`docker images -q ${localTag}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });

      if (!result.trim()) {
        console.log(`⏭️  Skipping ${image} (not found locally)`);
        continue;
      }

      console.log(`📤 Pushing ${image}...`);

      // Tag for registry
      execSync(`docker tag ${localTag} ${remoteTag}`, {
        stdio: 'inherit'
      });

      execSync(`docker tag ${localTag} ${versionTag}`, {
        stdio: 'inherit'
      });

      // Push to registry
      execSync(config.pushCommand(remoteTag), {
        stdio: 'inherit'
      });

      execSync(config.pushCommand(versionTag), {
        stdio: 'inherit'
      });

      console.log(`✅ Successfully pushed ${image}`);

    } catch (error) {
      console.error(`❌ Failed to push ${image}:`, error.message);
      // Continue with other images
    }
  }
}

async function createRegistryDockerCompose(config) {
  console.log('📝 Creating docker-compose file for registry...');

  try {
    // Read the template docker-compose file
    const templatePath = path.join(GAME_ROOT, 'dist-containers', 'docker-compose.yml');
    let dockerCompose = await fs.readFile(templatePath, 'utf8');

    // Replace image references with registry prefix
    dockerCompose = dockerCompose.replace(/elizaos\/eliza-/g, `${config.prefix}/eliza-`);

    // Add registry information as comment
    const registryHeader = `# Container images from ${config.name}
# Registry prefix: ${config.prefix}
# Generated on: ${new Date().toISOString()}

`;

    dockerCompose = registryHeader + dockerCompose;

    // Write the new file
    const outputPath = path.join(GAME_ROOT, 'dist-containers', `docker-compose.${registry}.yml`);
    await fs.writeFile(outputPath, dockerCompose);

    console.log(`✅ Created ${outputPath}`);

    // Also create a quick-start script for this registry
    const quickStartScript = `#!/bin/bash
# ELIZA Game Quick Start Script for ${config.name}

set -e

echo "🚀 Starting ELIZA Game containers from ${config.name}..."

# Check if .env exists
if [ ! -f .env ]; then
  echo "📋 Creating .env file from template..."
  cp .env.example .env
  echo "⚠️  Please edit .env file with your API keys before continuing!"
  echo "   At minimum, you need to set OPENAI_API_KEY or ANTHROPIC_API_KEY"
  exit 1
fi

# Use the registry-specific docker-compose file
export COMPOSE_FILE=docker-compose.${registry}.yml

# Pull latest images
echo "📥 Pulling latest container images from ${config.name}..."
docker-compose pull

# Start services
echo "🏃 Starting ELIZA services..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check status
echo "📊 Service status:"
docker-compose ps

echo ""
echo "✅ ELIZA Game is starting up!"
echo "🌐 Agent API will be available at: http://localhost:7777"
echo "📦 Images pulled from: ${config.name}"
echo ""
echo "📋 To view logs: docker-compose logs -f"
echo "🛑 To stop: docker-compose down"
echo "🔄 To restart: docker-compose restart"
`;

    const quickStartPath = path.join(GAME_ROOT, 'dist-containers', `quick-start.${registry}.sh`);
    await fs.writeFile(quickStartPath, quickStartScript);

    // Make executable
    try {
      execSync(`chmod +x "${quickStartPath}"`, { stdio: 'inherit' });
    } catch (error) {
      console.log('Note: Could not make script executable (Windows?)');
    }

    console.log(`✅ Created ${quickStartPath}`);

  } catch (error) {
    console.error('⚠️  Could not create registry docker-compose file:', error.message);
  }
}

// Usage information
function showUsage() {
  console.log(`
Usage: node setup-container-registry.js [registry]

Available registries:
  dockerhub  - Docker Hub (default)
  ghcr       - GitHub Container Registry
  custom     - Custom registry (set CUSTOM_REGISTRY_PREFIX env var)

Examples:
  node setup-container-registry.js dockerhub
  node setup-container-registry.js ghcr
  
  # For custom registry
  CUSTOM_REGISTRY_PREFIX=my-registry.com/eliza node setup-container-registry.js custom

Prerequisites:
  1. Build images first: npm run container:build-production
  2. Login credentials for the target registry
  3. Push permissions to the registry
`);
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showUsage();
  } else {
    setupContainerRegistry();
  }
}

export { setupContainerRegistry };
