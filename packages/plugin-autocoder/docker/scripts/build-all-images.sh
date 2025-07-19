#!/bin/bash
# Build all Docker images for distributed SWE-bench

set -e

echo "🐳 Building all Docker images for distributed SWE-bench..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the root directory (assuming script is in docker/scripts/)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "Working directory: $ROOT_DIR"

# Function to build image
build_image() {
    local dockerfile=$1
    local tag=$2
    local context=${3:-.}
    
    echo -e "${YELLOW}Building $tag...${NC}"
    
    if docker build -f "$dockerfile" -t "$tag" "$context"; then
        echo -e "${GREEN}✓ Successfully built $tag${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed to build $tag${NC}"
        return 1
    fi
}

# Build base image
echo -e "\n${YELLOW}=== Building Base Image ===${NC}"
build_image "docker/base/Dockerfile.base" "plugin-autocoder-base:latest" .

# Build language-specific images
echo -e "\n${YELLOW}=== Building Language Images ===${NC}"
build_image "docker/languages/Dockerfile.node-langs" "plugin-autocoder-node:latest" .
build_image "docker/languages/Dockerfile.compiled-langs" "plugin-autocoder-compiled:latest" .
build_image "docker/languages/Dockerfile.jvm-langs" "plugin-autocoder-jvm:latest" .

# Build bridge server
echo -e "\n${YELLOW}=== Building Bridge Server ===${NC}"
build_image "docker/bridge/Dockerfile.bridge-server" "plugin-autocoder-bridge:latest" .

# List all built images
echo -e "\n${YELLOW}=== Built Images ===${NC}"
docker images | grep plugin-autocoder

# Calculate total size
TOTAL_SIZE=$(docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep plugin-autocoder | awk '{print $3}' | sed 's/GB/*1024/;s/MB//' | paste -sd+ | bc)
echo -e "\n${GREEN}Total image size: ~${TOTAL_SIZE}MB${NC}"

echo -e "\n${GREEN}✅ All images built successfully!${NC}"
echo -e "\nTo start the distributed infrastructure, run:"
echo -e "  ${YELLOW}docker-compose -f docker/compose/docker-compose.swe-bench.yml up -d${NC}" 