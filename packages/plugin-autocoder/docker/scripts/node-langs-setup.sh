#!/bin/bash
# Setup script for Node.js languages (TypeScript/JavaScript)

set -e

echo "Setting up Node.js languages environment..."

# Export environment variables
export LANGUAGE_TYPE="node"
export NODE_ENV=${NODE_ENV:-development}

# Create necessary directories
mkdir -p $WORKSPACE $CACHE_DIR $RESULTS_DIR

# Detect and setup package manager
setup_package_manager() {
    local dir=$1
    
    if [ -f "$dir/package-lock.json" ]; then
        echo "Detected npm project"
        cd "$dir" && npm ci
    elif [ -f "$dir/yarn.lock" ]; then
        echo "Detected yarn project"
        cd "$dir" && yarn install --frozen-lockfile
    elif [ -f "$dir/pnpm-lock.yaml" ]; then
        echo "Detected pnpm project"
        cd "$dir" && pnpm install --frozen-lockfile
    elif [ -f "$dir/bun.lockb" ]; then
        echo "Detected bun project"
        cd "$dir" && bun install
    elif [ -f "$dir/package.json" ]; then
        echo "No lockfile found, using npm"
        cd "$dir" && npm install
    fi
}

# Function to detect test framework
detect_test_framework() {
    local dir=$1
    
    if [ -f "$dir/vitest.config.ts" ] || [ -f "$dir/vitest.config.js" ]; then
        echo "vitest"
    elif [ -f "$dir/jest.config.js" ] || [ -f "$dir/jest.config.ts" ]; then
        echo "jest"
    elif grep -q "mocha" "$dir/package.json" 2>/dev/null; then
        echo "mocha"
    elif grep -q "jasmine" "$dir/package.json" 2>/dev/null; then
        echo "jasmine"
    else
        echo "npm test"
    fi
}

# Setup TypeScript if needed
setup_typescript() {
    local dir=$1
    
    if [ -f "$dir/tsconfig.json" ]; then
        echo "TypeScript project detected"
        if [ ! -d "$dir/node_modules/typescript" ]; then
            cd "$dir" && npm install --save-dev typescript @types/node
        fi
    fi
}

# Log environment info
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"
echo "TypeScript version: $(tsc --version 2>/dev/null || echo 'Not installed globally')"

# Start bridge client if no other command specified
if [ $# -eq 0 ]; then
    exec node /bridge/bridge-client.js
else
    exec "$@"
fi 