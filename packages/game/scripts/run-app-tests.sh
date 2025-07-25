#!/bin/bash
# Test runner for Tauri application integration tests
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TESTS_DIR="$PROJECT_DIR/tests"
LOG_FILE="/tmp/eliza-app-tests.log"

echo -e "${BLUE}🧪 ElizaOS Terminal App Integration Tests${NC}"
echo "========================================"

# Check if BATS is installed
if ! command -v bats &> /dev/null; then
    echo -e "${YELLOW}⚠️  BATS not found. Installing...${NC}"
    
    # Install BATS using npm (works on most systems)
    if command -v npm &> /dev/null; then
        npm install -g bats-core
    elif command -v brew &> /dev/null; then
        brew install bats-core
    else
        echo -e "${RED}❌ Could not install BATS. Please install manually:${NC}"
        echo "  npm install -g bats-core"
        echo "  OR"
        echo "  brew install bats-core"
        exit 1
    fi
fi

# Function to cleanup any running processes
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up test environment...${NC}"
    pkill -f "ElizaOS Terminal" || true
    pkill -f "node.*server.js" || true
    rm -f /tmp/eliza-app-test.pid
    sleep 2
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Pre-test cleanup
cleanup

# Check if the application is built
TAURI_APP_PATH="$PROJECT_DIR/src-tauri/target/release/bundle/macos/ElizaOS Terminal.app"
if [[ ! -d "$TAURI_APP_PATH" ]]; then
    echo -e "${YELLOW}📦 Application not found. Building...${NC}"
    
    cd "$PROJECT_DIR"
    
    # Build backend
    echo "Building backend..."
    npm run build:backend
    
    # Build frontend  
    echo "Building frontend..."
    npm run build:frontend
    
    # Build Tauri app
    echo "Building Tauri application..."
    npm run tauri:build
    
    if [[ ! -d "$TAURI_APP_PATH" ]]; then
        echo -e "${RED}❌ Failed to build application${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Application built successfully${NC}"
fi

echo -e "${BLUE}🏗️  Application found at: $TAURI_APP_PATH${NC}"

# Run the tests
echo -e "${BLUE}🚀 Running integration tests...${NC}"
echo

cd "$PROJECT_DIR"

# Run BATS tests with verbose output
if bats --tap tests/app-integration.bats 2>&1 | tee "$LOG_FILE"; then
    echo
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo -e "${BLUE}📝 Test log saved to: $LOG_FILE${NC}"
    exit 0
else
    echo
    echo -e "${RED}❌ Some tests failed!${NC}"
    echo -e "${BLUE}📝 Test log saved to: $LOG_FILE${NC}"
    echo
    echo -e "${YELLOW}🔍 Last 20 lines of test output:${NC}"
    tail -n 20 "$LOG_FILE"
    exit 1
fi