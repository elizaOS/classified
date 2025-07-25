#!/bin/bash

# Build ElizaOS Agent Container Image
# This script builds the agent container image that the Rust backend will start

set -e

echo "🏗️  Building ElizaOS Agent container image..."

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "📁 Project root: ${PROJECT_ROOT}"
echo "📁 Script directory: ${SCRIPT_DIR}"

# Build the agent image using the agent Dockerfile
echo "🔨 Building eliza-agent:latest..."

docker build \
  -t eliza-agent:latest \
  -f "${SCRIPT_DIR}/src-backend/Dockerfile.agent" \
  "${PROJECT_ROOT}"

echo "✅ Agent image built successfully!"

# Also tag with alternative name for compatibility
docker tag eliza-agent:latest eliza-agent:v1

echo "✅ Agent image tagged as eliza-agent:v1"

# Optional: Build with Podman if available
if command -v podman &> /dev/null; then
  echo "🐙 Also building with Podman..."
  
  podman build \
    -t eliza-agent:latest \
    -f "${SCRIPT_DIR}/src-backend/Dockerfile.agent" \
    "${PROJECT_ROOT}"
    
  podman tag eliza-agent:latest eliza-agent:v1
  
  echo "✅ Podman image built successfully!"
fi

echo "🎉 All done! Agent container images are ready."
echo ""
echo "Images built:"
echo "  - eliza-agent:latest"
echo "  - eliza-agent:v1"
echo ""
echo "You can now start the ELIZA game and the agent container will be available."