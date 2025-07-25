#!/usr/bin/env node
/**
 * Build Container Images Script
 *
 * This script builds and bundles pre-configured PostgreSQL and Ollama container images
 * for the ELIZA game to enable offline container deployment.
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESOURCES_DIR = path.join(__dirname, '..', 'src-tauri', 'resources');
const IMAGES_DIR = path.join(RESOURCES_DIR, 'container-images');
const CONTAINERS_DIR = path.join(__dirname, '..', 'containers');

async function buildContainerImages() {
  console.log('🚀 Building Container Images for ELIZA Game');
  console.log('='.repeat(50));

  // Create directories
  await fs.mkdir(RESOURCES_DIR, { recursive: true });
  await fs.mkdir(IMAGES_DIR, { recursive: true });
  await fs.mkdir(CONTAINERS_DIR, { recursive: true });

  // Create PostgreSQL Containerfile
  await createPostgresContainerfile();

  // Create Ollama Containerfile
  await createOllamaContainerfile();

  // Build PostgreSQL image
  await buildPostgresImage();

  // Build Ollama image
  await buildOllamaImage();

  console.log('');
  console.log('✅ Container images built and bundled successfully!');
  console.log(`📦 Images saved to: ${IMAGES_DIR}`);
  console.log('🎮 The ELIZA game can now deploy containers offline');
}

async function createPostgresContainerfile() {
  console.log('📝 Creating PostgreSQL Containerfile...');

  const containerfile = `FROM postgres:15-alpine

# Set environment variables for ELIZA
ENV POSTGRES_DB=eliza
ENV POSTGRES_USER=eliza
ENV POSTGRES_PASSWORD=eliza

# Add custom initialization scripts for ELIZA
COPY init-eliza.sql /docker-entrypoint-initdb.d/

# Add pgvector extension for embeddings support
RUN apk add --no-cache git build-base postgresql-dev \\
    && git clone https://github.com/pgvector/pgvector.git /tmp/pgvector \\
    && cd /tmp/pgvector \\
    && make && make install \\
    && rm -rf /tmp/pgvector \\
    && apk del git build-base

# Expose PostgreSQL port
EXPOSE 5432

# Health check to ensure database is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \\
    CMD pg_isready -U eliza -d eliza || exit 1
`;

  const initSql = `-- Initialize ELIZA database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- Create tables for ELIZA agent system
-- (Tables will be created automatically by ElizaOS migrations)

-- Set optimal configuration for ELIZA workloads
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Create ELIZA user with appropriate permissions
-- (This is already handled by environment variables)
`;

  await fs.writeFile(path.join(CONTAINERS_DIR, 'Containerfile.postgres'), containerfile);
  await fs.writeFile(path.join(CONTAINERS_DIR, 'init-eliza.sql'), initSql);

  console.log('✅ PostgreSQL Containerfile created');
}

async function createOllamaContainerfile() {
  console.log('📝 Creating Ollama Containerfile...');

  const containerfile = `FROM ollama/ollama:latest

# Set Ollama environment variables
ENV OLLAMA_HOST=0.0.0.0
ENV OLLAMA_PORT=11434

# Pre-download commonly used models for ELIZA
# Note: This significantly increases image size but enables offline operation
RUN ollama serve & sleep 10 && \\
    ollama pull llama3.2:3b && \\
    ollama pull phi3:mini && \\
    pkill ollama

# Create directory for persistent model storage
RUN mkdir -p /root/.ollama

# Expose Ollama API port
EXPOSE 11434

# Health check to ensure Ollama API is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \\
    CMD curl -f http://localhost:11434/api/version || exit 1

# Start Ollama service
CMD ["ollama", "serve"]
`;

  await fs.writeFile(path.join(CONTAINERS_DIR, 'Containerfile.ollama'), containerfile);

  console.log('✅ Ollama Containerfile created');
}

async function buildPostgresImage() {
  console.log('🔨 Building PostgreSQL image...');

  try {
    // Build the image
    execSync(
      `podman build -f ${path.join(CONTAINERS_DIR, 'Containerfile.postgres')} -t eliza-postgres:latest ${CONTAINERS_DIR}`,
      {
        stdio: 'inherit',
      }
    );

    // Save the image to tar file
    const imagePath = path.join(IMAGES_DIR, 'eliza-postgres.tar');
    console.log(`💾 Saving PostgreSQL image to ${imagePath}...`);

    execSync(`podman save eliza-postgres:latest -o "${imagePath}"`, {
      stdio: 'inherit',
    });

    console.log('✅ PostgreSQL image built and saved');
  } catch (error) {
    throw new Error(`PostgreSQL image build failed: ${error.message}`);
  }
}

async function buildOllamaImage() {
  console.log('🔨 Building Ollama image (this may take a while)...');
  console.log('ℹ️  This downloads AI models and will significantly increase image size');

  try {
    // Build the image (this takes a long time due to model downloads)
    execSync(
      `podman build -f ${path.join(CONTAINERS_DIR, 'Containerfile.ollama')} -t eliza-ollama:latest ${CONTAINERS_DIR}`,
      {
        stdio: 'inherit',
      }
    );

    // Save the image to tar file
    const imagePath = path.join(IMAGES_DIR, 'eliza-ollama.tar');
    console.log(`💾 Saving Ollama image to ${imagePath}...`);

    execSync(`podman save eliza-ollama:latest -o "${imagePath}"`, {
      stdio: 'inherit',
    });

    console.log('✅ Ollama image built and saved');
  } catch (error) {
    throw new Error(`Ollama image build failed: ${error.message}`);
  }
}

async function buildLightweightImages() {
  console.log('🪶 Building lightweight images (no pre-downloaded models)...');
  console.log('ℹ️  These images will download models on first run');

  // Create lightweight Ollama Containerfile without pre-downloaded models
  const lightweightOllamaContainerfile = `FROM ollama/ollama:latest

# Set Ollama environment variables
ENV OLLAMA_HOST=0.0.0.0
ENV OLLAMA_PORT=11434

# Create directory for persistent model storage
RUN mkdir -p /root/.ollama

# Expose Ollama API port
EXPOSE 11434

# Health check to ensure Ollama API is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \\
    CMD curl -f http://localhost:11434/api/version || exit 1

# Start Ollama service
CMD ["ollama", "serve"]
`;

  await fs.writeFile(
    path.join(CONTAINERS_DIR, 'Containerfile.ollama-lightweight'),
    lightweightOllamaContainerfile
  );

  // Build lightweight Ollama image
  execSync(
    `podman build -f ${path.join(CONTAINERS_DIR, 'Containerfile.ollama-lightweight')} -t eliza-ollama-lightweight:latest ${CONTAINERS_DIR}`,
    {
      stdio: 'inherit',
    }
  );

  const lightweightImagePath = path.join(IMAGES_DIR, 'eliza-ollama-lightweight.tar');
  execSync(`podman save eliza-ollama-lightweight:latest -o "${lightweightImagePath}"`, {
    stdio: 'inherit',
  });

  console.log('✅ Lightweight images built and saved');
}

// Check command line arguments
if (process.argv.includes('--lightweight')) {
  console.log('🪶 Building lightweight images only...');
  createPostgresContainerfile()
    .then(() => createOllamaContainerfile())
    .then(() => buildPostgresImage())
    .then(() => buildLightweightImages())
    .catch(console.error);
} else {
  buildContainerImages().catch(console.error);
}

// Export for use in other scripts
export { buildContainerImages, buildLightweightImages };
