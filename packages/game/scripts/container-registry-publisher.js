#!/usr/bin/env node

/**
 * Container Registry Publisher
 * Publishes ELIZA containers to GitHub Container Registry (GHCR)
 * and other registries for easy distribution
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

class ContainerRegistryPublisher {
  constructor() {
    this.gameDir = join(__dirname, '..');
    this.projectRoot = join(__dirname, '../../..');
    this.packagePath = join(this.gameDir, 'package.json');
    this.pkg = JSON.parse(readFileSync(this.packagePath, 'utf-8'));

    // Container registry configurations
    this.registries = {
      ghcr: {
        name: 'GitHub Container Registry',
        url: 'ghcr.io',
        namespace: 'ai16z/eliza',  // Update this to match your org
        loginCmd: 'gh auth token | docker login ghcr.io -u USERNAME --password-stdin'
      },
      docker: {
        name: 'Docker Hub',
        url: 'docker.io',
        namespace: 'elizaos/game',
        loginCmd: 'docker login'
      }
    };

    this.images = [
      {
        name: 'eliza-backend',
        dockerfile: 'src-backend/Dockerfile.bun',
        description: 'ELIZA Backend Server (Bun-built)',
        context: this.projectRoot
      },
      {
        name: 'eliza-postgres',
        dockerfile: 'containers/Dockerfile.postgres',
        description: 'PostgreSQL with pgvector extension',
        context: this.gameDir
      }
    ];
  }

  async detectContainerRuntime() {
    const runtimes = ['docker', 'podman'];

    for (const runtime of runtimes) {
      try {
        const { stdout } = await execAsync(`${runtime} --version`);
        if (stdout) {
          console.log(`✅ Container runtime detected: ${runtime}`);
          return runtime;
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error('No container runtime found. Please install Docker or Podman.');
  }

  async checkGitHubCLI() {
    try {
      const { stdout } = await execAsync('gh --version');
      console.log(`✅ GitHub CLI detected: ${stdout.split('\n')[0]}`);
      return true;
    } catch (error) {
      console.log('⚠️  GitHub CLI not found. Installing...');
      return this.installGitHubCLI();
    }
  }

  async installGitHubCLI() {
    try {
      const platform = process.platform;

      if (platform === 'darwin') {
        await execAsync('brew install gh');
      } else if (platform === 'linux') {
        await execAsync(`
          type -p curl >/dev/null || (sudo apt update && sudo apt install curl -y)
          curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
          sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
          echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
          sudo apt update
          sudo apt install gh -y
        `);
      } else {
        console.log('Please install GitHub CLI manually: https://cli.github.com/');
        return false;
      }

      console.log('✅ GitHub CLI installed');
      return true;
    } catch (error) {
      console.error('❌ Failed to install GitHub CLI:', error.message);
      return false;
    }
  }

  async loginToRegistry(registryKey, runtime) {
    const registry = this.registries[registryKey];
    console.log(`🔐 Logging into ${registry.name}...`);

    try {
      if (registryKey === 'ghcr') {
        // Use GitHub CLI for GHCR authentication
        const { stdout: token } = await execAsync('gh auth token');
        const loginProcess = spawn(runtime, ['login', 'ghcr.io', '-u', process.env.GITHUB_USERNAME || 'token', '--password-stdin'], {
          stdio: ['pipe', 'inherit', 'inherit']
        });

        loginProcess.stdin.write(token.trim());
        loginProcess.stdin.end();

        return new Promise((resolve, reject) => {
          loginProcess.on('close', (code) => {
            if (code === 0) {
              console.log(`✅ Logged into ${registry.name}`);
              resolve();
            } else {
              reject(new Error(`Login failed with exit code ${code}`));
            }
          });
        });
      } else if (registryKey === 'docker') {
        console.log('Please login to Docker Hub manually:');
        await execAsync(`${runtime} login`);
        console.log(`✅ Logged into ${registry.name}`);
      }
    } catch (error) {
      throw new Error(`Failed to login to ${registry.name}: ${error.message}`);
    }
  }

  async buildImage(runtime, image) {
    console.log(`🔨 Building ${image.name}...`);

    const dockerfilePath = join(this.gameDir, image.dockerfile);
    if (!existsSync(dockerfilePath)) {
      throw new Error(`Dockerfile not found: ${dockerfilePath}`);
    }

    const buildArgs = [
      'build',
      '-t', image.name,
      '-f', dockerfilePath,
      image.context
    ];

    return new Promise((resolve, reject) => {
      const buildProcess = spawn(runtime, buildArgs, {
        stdio: 'inherit',
        cwd: this.projectRoot
      });

      buildProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Built ${image.name}`);
          resolve();
        } else {
          reject(new Error(`Build failed for ${image.name} with exit code ${code}`));
        }
      });

      buildProcess.on('error', reject);
    });
  }

  async tagAndPushImage(runtime, image, registryKey) {
    const registry = this.registries[registryKey];
    const version = this.pkg.version;
    const fullImageName = `${registry.url}/${registry.namespace}/${image.name}`;

    console.log(`🏷️  Tagging ${image.name} for ${registry.name}...`);

    // Tag with version and latest
    const tags = [version, 'latest'];

    for (const tag of tags) {
      const taggedName = `${fullImageName}:${tag}`;
      await execAsync(`${runtime} tag ${image.name} ${taggedName}`);
      console.log(`   Tagged: ${taggedName}`);
    }

    // Push all tags
    console.log(`📤 Pushing ${image.name} to ${registry.name}...`);

    for (const tag of tags) {
      const taggedName = `${fullImageName}:${tag}`;

      return new Promise((resolve, reject) => {
        const pushProcess = spawn(runtime, ['push', taggedName], {
          stdio: 'inherit'
        });

        pushProcess.on('close', (code) => {
          if (code === 0) {
            console.log(`   ✅ Pushed: ${taggedName}`);
            resolve();
          } else {
            reject(new Error(`Push failed for ${taggedName} with exit code ${code}`));
          }
        });

        pushProcess.on('error', reject);
      });
    }
  }

  async createDockerCompose(registryKey) {
    const registry = this.registries[registryKey];
    const version = this.pkg.version;

    const dockerCompose = {
      version: '3.8',
      services: {
        postgres: {
          image: `${registry.url}/${registry.namespace}/eliza-postgres:${version}`,
          container_name: 'eliza-postgres',
          environment: {
            'POSTGRES_DB': 'eliza',
            'POSTGRES_USER': 'eliza',
            'POSTGRES_PASSWORD': 'eliza'
          },
          ports: ['5432:5432'],
          volumes: ['eliza-postgres-data:/var/lib/postgresql/data'],
          networks: ['eliza-network']
        },
        backend: {
          image: `${registry.url}/${registry.namespace}/eliza-backend:${version}`,
          container_name: 'eliza-backend',
          ports: ['7777:7777'],
          environment: {
            'DATABASE_URL': 'postgresql://eliza:eliza@postgres:5432/eliza',
            'NODE_ENV': 'production'
          },
          volumes: ['eliza-data:/app/data'],
          depends_on: ['postgres'],
          networks: ['eliza-network']
        }
      },
      networks: {
        'eliza-network': {
          driver: 'bridge'
        }
      },
      volumes: {
        'eliza-postgres-data': {},
        'eliza-data': {}
      }
    };

    const outputPath = join(this.gameDir, 'dist-containers', 'docker-compose.yml');
    writeFileSync(outputPath, `# ELIZA Container Stack
# Generated automatically - do not edit manually
# Version: ${version}
# Registry: ${registry.name}

${JSON.stringify(dockerCompose, null, 2).replace(/"/g, '')}
`);

    console.log(`📄 Created docker-compose.yml for ${registry.name}`);
    return outputPath;
  }

  async createInstallScript(registryKey) {
    const registry = this.registries[registryKey];
    const version = this.pkg.version;

    const installScript = `#!/bin/bash

# ELIZA Installation Script
# Downloads and runs ELIZA containers from ${registry.name}

set -e

echo "🎮 ELIZA Installation"
echo "===================="
echo "Registry: ${registry.name}"
echo "Version: ${version}"
echo ""

# Detect container runtime
RUNTIME=""
if command -v docker &> /dev/null; then
    RUNTIME="docker"
    echo "✅ Docker detected"
elif command -v podman &> /dev/null; then
    RUNTIME="podman"
    echo "✅ Podman detected"
else
    echo "❌ No container runtime found"
    echo "Please install Docker or Podman:"
    echo "  Docker: https://docs.docker.com/get-docker/"
    echo "  Podman: https://podman.io/getting-started/installation"
    exit 1
fi

# Pull images
echo ""
echo "📥 Pulling ELIZA images..."
\$RUNTIME pull ${registry.url}/${registry.namespace}/eliza-postgres:${version}
\$RUNTIME pull ${registry.url}/${registry.namespace}/eliza-backend:${version}

# Create network
echo ""
echo "🌐 Creating network..."
\$RUNTIME network create eliza-network 2>/dev/null || echo "Network already exists"

# Start PostgreSQL
echo ""
echo "🗄️  Starting PostgreSQL..."
\$RUNTIME run -d \\
  --name eliza-postgres \\
  --network eliza-network \\
  -e POSTGRES_DB=eliza \\
  -e POSTGRES_USER=eliza \\
  -e POSTGRES_PASSWORD=eliza \\
  -p 5432:5432 \\
  -v eliza-postgres-data:/var/lib/postgresql/data \\
  ${registry.url}/${registry.namespace}/eliza-postgres:${version}

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 10

# Start ELIZA Backend
echo ""
echo "🚀 Starting ELIZA Backend..."
\$RUNTIME run -d \\
  --name eliza-backend \\
  --network eliza-network \\
  -p 7777:7777 \\
  -e DATABASE_URL=postgresql://eliza:eliza@eliza-postgres:5432/eliza \\
  -e NODE_ENV=production \\
  -v eliza-data:/app/data \\
  ${registry.url}/${registry.namespace}/eliza-backend:${version}

echo ""
echo "🎉 ELIZA is starting up!"
echo ""
echo "Access the application at: http://localhost:7777"
echo ""
echo "To stop ELIZA:"
echo "  \$RUNTIME stop eliza-backend eliza-postgres"
echo ""
echo "To view logs:"
echo "  \$RUNTIME logs eliza-backend"
echo "  \$RUNTIME logs eliza-postgres"
echo ""
echo "To remove everything:"
echo "  \$RUNTIME rm -f eliza-backend eliza-postgres"
echo "  \$RUNTIME volume rm eliza-data eliza-postgres-data"
echo "  \$RUNTIME network rm eliza-network"

`;

    const scriptPath = join(this.gameDir, 'dist-containers', 'install.sh');
    writeFileSync(scriptPath, installScript);
    await execAsync(`chmod +x "${scriptPath}"`);

    console.log('📜 Created installation script');
    return scriptPath;
  }

  async publish(registryKey = 'ghcr') {
    try {
      console.log('🚀 ELIZA Container Publisher');
      console.log('============================');

      if (!this.registries[registryKey]) {
        throw new Error(`Unknown registry: ${registryKey}`);
      }

      const registry = this.registries[registryKey];
      console.log(`📦 Publishing to: ${registry.name}`);
      console.log(`🏷️  Version: ${this.pkg.version}`);

      // Detect container runtime
      const runtime = await this.detectContainerRuntime();

      // Setup GitHub CLI for GHCR
      if (registryKey === 'ghcr') {
        const ghCliAvailable = await this.checkGitHubCLI();
        if (!ghCliAvailable) {
          throw new Error('GitHub CLI is required for GHCR publishing');
        }
      }

      // Login to registry
      await this.loginToRegistry(registryKey, runtime);

      // Build, tag, and push each image
      for (const image of this.images) {
        await this.buildImage(runtime, image);
        await this.tagAndPushImage(runtime, image, registryKey);
      }

      // Create distribution files
      await this.createDockerCompose(registryKey);
      await this.createInstallScript(registryKey);

      console.log('');
      console.log('🎉 Publishing complete!');
      console.log('');
      console.log(`Images published to ${registry.name}:`);
      for (const image of this.images) {
        console.log(`   📦 ${registry.url}/${registry.namespace}/${image.name}:${this.pkg.version}`);
        console.log(`   📦 ${registry.url}/${registry.namespace}/${image.name}:latest`);
      }
      console.log('');
      console.log('Distribution files created:');
      console.log('   📄 dist-containers/docker-compose.yml');
      console.log('   📜 dist-containers/install.sh');

    } catch (error) {
      console.error('❌ Publishing failed:', error.message);
      process.exit(1);
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const registry = process.argv[2] || 'ghcr';
  const publisher = new ContainerRegistryPublisher();
  publisher.publish(registry);
}

export { ContainerRegistryPublisher };
