#!/bin/bash

# Build script for ElizaOS AutoCoder Agent images
set -e

echo "Building ElizaOS AutoCoder Agent Docker images..."

# Get the directory containing this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Build base image context (from project root)
cd "$PROJECT_ROOT/../.."

echo "Building autocoder agent image..."
docker build -f "$PROJECT_ROOT/docker/Dockerfile.autocoder-agent" \
  -t elizaos/autocoder-agent:latest \
  --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
  --build-arg VCS_REF="$(git rev-parse --short HEAD)" \
  .

echo "Building review agent image..."
docker build -f "$PROJECT_ROOT/docker/Dockerfile.review-agent" \
  -t elizaos/review-agent:latest \
  --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
  --build-arg VCS_REF="$(git rev-parse --short HEAD)" \
  .

echo "Building test agent image..."
docker build -f "$PROJECT_ROOT/docker/Dockerfile.test-agent" \
  -t elizaos/test-agent:latest \
  --build-arg BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
  --build-arg VCS_REF="$(git rev-parse --short HEAD)" \
  .

echo "✅ All agent images built successfully!"

# List the created images
echo ""
echo "Created images:"
docker images | grep "elizaos.*agent"