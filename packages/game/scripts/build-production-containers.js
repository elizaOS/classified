#!/usr/bin/env node
/**
 * Build Production Container Images Script
 *
 * This script builds all container images for the ELIZA game in their final production versions
 * and sets up easy pulling/distribution for users.
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GAME_ROOT = path.join(__dirname, '..');
const CONTAINERS_DIR = path.join(GAME_ROOT, 'containers');
const DIST_DIR = path.join(GAME_ROOT, 'dist-containers');

// Container configurations
const CONTAINERS = {
  'eliza-agent': {
    dockerfile: 'Dockerfile',
    context: GAME_ROOT,
    tag: 'elizaos/eliza-agent:latest',
    description: 'ElizaOS Agent Runtime Container'
  },
  'eliza-postgres': {
    dockerfile: 'containers/Dockerfile.postgres',
    context: CONTAINERS_DIR,
    tag: 'elizaos/eliza-postgres:latest',
    description: 'PostgreSQL with pgvector for ElizaOS'
  },
  'eliza-ollama': {
    dockerfile: 'containers/Dockerfile.ollama',
    context: CONTAINERS_DIR,
    tag: 'elizaos/eliza-ollama:latest',
    description: 'Ollama with pre-loaded models for ElizaOS'
  },
  'eliza-ollama-lightweight': {
    dockerfile: 'containers/Dockerfile.ollama-lightweight',
    context: CONTAINERS_DIR,
    tag: 'elizaos/eliza-ollama-lightweight:latest',
    description: 'Lightweight Ollama container (downloads models on demand)'
  }
};

async function buildProductionContainers() {
  console.log('🚀 Building Production Container Images for ELIZA Game');
  console.log('='.repeat(60));

  try {
    // Create necessary directories
    await fs.mkdir(CONTAINERS_DIR, { recursive: true });
    await fs.mkdir(DIST_DIR, { recursive: true });

    // Create container definitions
    await createContainerDefinitions();

    // Build all containers
    for (const [name, config] of Object.entries(CONTAINERS)) {
      await buildContainer(name, config);
    }

    // Create distribution artifacts
    await createDistributionArtifacts();

    console.log('\n✅ All container images built successfully!');
    console.log(`📦 Distribution artifacts saved to: ${DIST_DIR}`);
    console.log('🎮 Users can now easily pull and run ELIZA containers');

  } catch (error) {
    console.error('❌ Container build failed:', error.message);
    process.exit(1);
  }
}

async function createContainerDefinitions() {
  console.log('📝 Creating container definitions...');

  // PostgreSQL with pgvector
  const postgresDockerfile = `FROM pgvector/pgvector:pg16

# Set environment variables for ELIZA
ENV POSTGRES_DB=eliza_game
ENV POSTGRES_USER=eliza
ENV POSTGRES_PASSWORD=eliza_secure_pass

# Copy initialization scripts
COPY init-scripts/ /docker-entrypoint-initdb.d/

# Expose PostgreSQL port
EXPOSE 5432

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \\
  CMD pg_isready -U eliza -d eliza_game || exit 1

# Optimal configuration for ELIZA workloads
RUN echo "shared_preload_libraries = 'pg_stat_statements'" >> /usr/share/postgresql/postgresql.conf.sample && \\
    echo "max_connections = 200" >> /usr/share/postgresql/postgresql.conf.sample && \\
    echo "shared_buffers = 256MB" >> /usr/share/postgresql/postgresql.conf.sample && \\
    echo "effective_cache_size = 1GB" >> /usr/share/postgresql/postgresql.conf.sample
`;

  // Ollama with pre-loaded models
  const ollamaDockerfile = `FROM ollama/ollama:latest

# Set Ollama environment variables
ENV OLLAMA_HOST=0.0.0.0
ENV OLLAMA_PORT=11434

# Create directory for persistent model storage
RUN mkdir -p /root/.ollama

# Pre-download commonly used models for ELIZA
# This significantly increases image size but enables offline operation
RUN nohup ollama serve & \\
    sleep 30 && \\
    ollama pull llama3.2:3b && \\
    ollama pull phi3:mini && \\
    ollama pull qwen2.5:3b && \\
    pkill ollama || true

# Expose Ollama API port
EXPOSE 11434

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \\
  CMD curl -f http://localhost:11434/api/version || exit 1

# Start Ollama service
CMD ["ollama", "serve"]
`;

  // Lightweight Ollama
  const ollamaLightweightDockerfile = `FROM ollama/ollama:latest

# Set Ollama environment variables
ENV OLLAMA_HOST=0.0.0.0
ENV OLLAMA_PORT=11434

# Create directory for persistent model storage
RUN mkdir -p /root/.ollama

# Expose Ollama API port
EXPOSE 11434

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \\
  CMD curl -f http://localhost:11434/api/version || exit 1

# Start Ollama service
CMD ["ollama", "serve"]
`;

  // PostgreSQL initialization script
  const initScript = `-- Initialize ELIZA database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create optimal indexes for ELIZA workloads
-- (Tables will be created automatically by ElizaOS migrations)

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE eliza_game TO eliza;

-- Log initialization
\\echo 'ELIZA database initialized successfully'
`;

  // Write container files
  await fs.writeFile(path.join(CONTAINERS_DIR, 'Dockerfile.postgres'), postgresDockerfile);
  await fs.writeFile(path.join(CONTAINERS_DIR, 'Dockerfile.ollama'), ollamaDockerfile);
  await fs.writeFile(path.join(CONTAINERS_DIR, 'Dockerfile.ollama-lightweight'), ollamaLightweightDockerfile);

  // Create init scripts directory
  const initScriptsDir = path.join(CONTAINERS_DIR, 'init-scripts');
  await fs.mkdir(initScriptsDir, { recursive: true });
  await fs.writeFile(path.join(initScriptsDir, '01-init-eliza.sql'), initScript);

  console.log('✅ Container definitions created');
}

async function buildContainer(name, config) {
  console.log(`🔨 Building ${name} (${config.description})...`);

  const dockerfilePath = path.join(GAME_ROOT, config.dockerfile);

  // Check if Dockerfile exists
  try {
    await fs.access(dockerfilePath);
  } catch (error) {
    console.log(`⚠️  Dockerfile not found at ${dockerfilePath}, skipping ${name}`);
    return;
  }

  try {
    // Build with Podman (as required by architecture)
    const buildCommand = `podman build -f "${dockerfilePath}" -t "${config.tag}" "${config.context}"`;

    console.log(`  Running: ${buildCommand}`);
    execSync(buildCommand, {
      stdio: 'inherit',
      cwd: GAME_ROOT
    });

    // Also tag with version
    const versionTag = config.tag.replace(':latest', ':v2.0.0');
    execSync(`podman tag "${config.tag}" "${versionTag}"`, {
      stdio: 'inherit'
    });

    console.log(`✅ ${name} built successfully`);

  } catch (error) {
    throw new Error(`Failed to build ${name} with podman: ${error.message}`);
  }
}

async function createDistributionArtifacts() {
  console.log('📦 Creating distribution artifacts...');

  // Create production docker-compose file
  const dockerCompose = `# ELIZA Game - Production Container Stack
# This docker-compose file pulls pre-built images instead of building from source

version: '3.8'

services:
  # PostgreSQL Database with pgvector
  eliza-postgres:
    image: elizaos/eliza-postgres:latest
    container_name: eliza-postgres
    environment:
      POSTGRES_DB: eliza_game
      POSTGRES_USER: eliza
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-eliza_secure_pass}
      POSTGRES_INITDB_ARGS: '--encoding=UTF-8 --locale=C'
    ports:
      - '7771:5432'
    volumes:
      - eliza_postgres_data:/var/lib/postgresql/data
    networks:
      - eliza-network
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U eliza -d eliza_game']
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # ElizaOS Agent Runtime
  eliza-agent:
    image: elizaos/eliza-agent:latest
    container_name: eliza-agent
    depends_on:
      eliza-postgres:
        condition: service_healthy
    environment:
      # Database connection
      DATABASE_URL: 'postgresql://eliza:\${POSTGRES_PASSWORD:-eliza_secure_pass}@eliza-postgres:5432/eliza_game'
      POSTGRES_HOST: eliza-postgres
      POSTGRES_PORT: 5432
      POSTGRES_DB: eliza_game
      POSTGRES_USER: eliza
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-eliza_secure_pass}

      # Agent configuration
      NODE_ENV: production
      PORT: 7777
      SERVER_PORT: 7777

      # API Keys (provide these in your .env file)
      OPENAI_API_KEY: \${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: \${ANTHROPIC_API_KEY}
      OLLAMA_URL: \${OLLAMA_URL:-http://eliza-ollama:11434}

      # Security
      JWT_SECRET: \${JWT_SECRET:-eliza_jwt_secret_change_me}

    ports:
      - '\${AGENT_PORT:-7777}:7777'
    volumes:
      - eliza_agent_data:/app/data
      - eliza_logs:/app/logs
    networks:
      - eliza-network
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:7777/api/server/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    restart: unless-stopped

  # Ollama AI Models (optional - comment out if using external API)
  eliza-ollama:
    image: \${OLLAMA_IMAGE:-elizaos/eliza-ollama-lightweight:latest}
    container_name: eliza-ollama
    environment:
      OLLAMA_HOST: 0.0.0.0
      OLLAMA_PORT: 11434
    ports:
      - '\${OLLAMA_PORT:-11434}:11434'
    volumes:
      - eliza_ollama_data:/root/.ollama
    networks:
      - eliza-network
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:11434/api/version']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 120s
    restart: unless-stopped
    # Uncomment for GPU access
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: 1
    #           capabilities: [gpu]

  # Redis for caching (optional)
  eliza-redis:
    image: redis:7-alpine
    container_name: eliza-redis
    ports:
      - '\${REDIS_PORT:-6379}:6379'
    volumes:
      - eliza_redis_data:/data
    networks:
      - eliza-network
    command: redis-server --appendonly yes --requirepass \${REDIS_PASSWORD:-redis_pass}
    healthcheck:
      test: ['CMD', 'redis-cli', '--raw', 'incr', 'ping']
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped

networks:
  eliza-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

volumes:
  eliza_postgres_data:
    driver: local
  eliza_agent_data:
    driver: local
  eliza_ollama_data:
    driver: local
  eliza_logs:
    driver: local
  eliza_redis_data:
    driver: local
`;

  // Create .env.example for users
  const envExample = `# ELIZA Game Environment Configuration
# Copy this file to .env and customize the values

# Database Configuration
POSTGRES_PASSWORD=eliza_secure_pass

# API Keys (required for AI functionality)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: Use external Ollama instead of containerized version
# OLLAMA_URL=http://localhost:11434

# Port Configuration (optional overrides)
AGENT_PORT=7777
OLLAMA_PORT=11434
REDIS_PORT=6379

# Ollama Image Selection
# Use 'elizaos/eliza-ollama:latest' for pre-loaded models (larger download)
# Use 'elizaos/eliza-ollama-lightweight:latest' for on-demand model downloads (smaller)
OLLAMA_IMAGE=elizaos/eliza-ollama-lightweight:latest

# Security
JWT_SECRET=change_this_to_a_secure_random_string
REDIS_PASSWORD=secure_redis_password

# Logging
LOG_LEVEL=info
`;

  // Create quick start script
  const quickStartScript = `#!/bin/bash
# ELIZA Game Quick Start Script

set -e

echo "🚀 Starting ELIZA Game containers..."

# Check if .env exists
if [ ! -f .env ]; then
  echo "📋 Creating .env file from template..."
  cp .env.example .env
  echo "⚠️  Please edit .env file with your API keys before continuing!"
  echo "   At minimum, you need to set OPENAI_API_KEY or ANTHROPIC_API_KEY"
  exit 1
fi

# Pull latest images
echo "📥 Pulling latest container images..."
podman-compose pull

# Start services
echo "🏃 Starting ELIZA services..."
podman-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check status
echo "📊 Service status:"
podman-compose ps

echo ""
echo "✅ ELIZA Game is starting up!"
echo "🌐 Agent API will be available at: http://localhost:7777"
echo "🗄️  Database admin: http://localhost:5050 (if pgAdmin is enabled)"
echo "🤖 Ollama API: http://localhost:11434 (if Ollama container is used)"
echo ""
echo "📋 To view logs: podman-compose logs -f"
echo "🛑 To stop: podman-compose down"
echo "🔄 To restart: podman-compose restart"
`;

  // Create Windows batch file
  const quickStartBat = `@echo off
REM ELIZA Game Quick Start Script for Windows

echo 🚀 Starting ELIZA Game containers...

REM Check if .env exists
if not exist .env (
  echo 📋 Creating .env file from template...
  copy .env.example .env
  echo ⚠️  Please edit .env file with your API keys before continuing!
  echo    At minimum, you need to set OPENAI_API_KEY or ANTHROPIC_API_KEY
  pause
  exit /b 1
)

REM Pull latest images
echo 📥 Pulling latest container images...
podman-compose pull

REM Start services
echo 🏃 Starting ELIZA services...
podman-compose up -d

REM Wait for services
echo ⏳ Waiting for services to be ready...
timeout /t 30 /nobreak > nul

REM Check status
echo 📊 Service status:
podman-compose ps

echo.
echo ✅ ELIZA Game is starting up!
echo 🌐 Agent API will be available at: http://localhost:7777
echo 🗄️  Database admin: http://localhost:5050 (if pgAdmin is enabled)
echo 🤖 Ollama API: http://localhost:11434 (if Ollama container is used)
echo.
echo 📋 To view logs: podman-compose logs -f
echo 🛑 To stop: podman-compose down
echo 🔄 To restart: podman-compose restart
pause
`;

  // Create README
  const readme = `# ELIZA Game - Container Distribution

This directory contains everything needed to run ELIZA Game using pre-built container images.

## Quick Start

### Prerequisites
- Podman installed
- podman-compose or docker-compose

### Linux/macOS
\`\`\`bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit .env with your API keys
nano .env  # or your preferred editor

# 3. Start ELIZA
./quick-start.sh
\`\`\`

### Windows
\`\`\`batch
REM 1. Copy environment template
copy .env.example .env

REM 2. Edit .env with your API keys
notepad .env

REM 3. Start ELIZA
quick-start.bat
\`\`\`

## Configuration

### Required API Keys
At minimum, set one of these in your .env file:
- \`OPENAI_API_KEY\` - For OpenAI models
- \`ANTHROPIC_API_KEY\` - For Claude models

### Ollama Configuration
Choose your Ollama setup in .env:
- \`elizaos/eliza-ollama:latest\` - Pre-loaded models (larger download, offline capable)
- \`elizaos/eliza-ollama-lightweight:latest\` - Downloads models on demand (smaller, requires internet)

## Available Services

- **Agent API**: http://localhost:7777
- **PostgreSQL**: localhost:7771
- **Ollama API**: http://localhost:11434
- **Redis**: localhost:6379

## Management Commands

\`\`\`bash
# View logs
podman-compose logs -f

# Stop all services
podman-compose down

# Restart services
podman-compose restart

# Update images
podman-compose pull && podman-compose up -d

# Clean up (removes data!)
podman-compose down -v
\`\`\`

## Troubleshooting

### Services won't start
1. Check if ports are available: \`netstat -tulpn | grep :7777\`
2. View logs: \`podman-compose logs\`
3. Ensure API keys are set in .env

### Database issues
1. Check PostgreSQL logs: \`podman-compose logs eliza-postgres\`
2. Reset database: \`podman-compose down -v && podman-compose up -d\`

### Ollama issues
1. Switch to lightweight image in .env: \`OLLAMA_IMAGE=elizaos/eliza-ollama-lightweight:latest\`
2. Check Ollama logs: \`podman-compose logs eliza-ollama\`

## Container Images

All images are available on Docker Hub:
- \`elizaos/eliza-agent:latest\` - Main agent runtime
- \`elizaos/eliza-postgres:latest\` - PostgreSQL with pgvector
- \`elizaos/eliza-ollama:latest\` - Ollama with pre-loaded models
- \`elizaos/eliza-ollama-lightweight:latest\` - Ollama lightweight

## Support

For issues and support, visit: https://github.com/ai16z/eliza
`;

  // Write all distribution files
  await fs.writeFile(path.join(DIST_DIR, 'docker-compose.yml'), dockerCompose);
  await fs.writeFile(path.join(DIST_DIR, '.env.example'), envExample);
  await fs.writeFile(path.join(DIST_DIR, 'quick-start.sh'), quickStartScript);
  await fs.writeFile(path.join(DIST_DIR, 'quick-start.bat'), quickStartBat);
  await fs.writeFile(path.join(DIST_DIR, 'README.md'), readme);

  // Make scripts executable
  try {
    execSync(`chmod +x "${path.join(DIST_DIR, 'quick-start.sh')}"`, { stdio: 'inherit' });
  } catch (error) {
    console.log('Note: Could not make quick-start.sh executable (Windows?)');
  }

  console.log('✅ Distribution artifacts created');
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  buildProductionContainers();
}

export { buildProductionContainers };
