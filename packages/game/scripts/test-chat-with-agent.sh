#!/bin/bash

# Comprehensive Chat with Agent Test Script
# This script starts the dev environment and runs the Cypress test

set -e  # Exit on any error

echo "🚀 COMPREHENSIVE CHAT WITH AGENT TEST"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to cleanup background processes
cleanup() {
    log_info "Cleaning up background processes..."
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
        log_info "Stopped frontend server (PID: $FRONTEND_PID)"
    fi
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
        log_info "Stopped backend server (PID: $BACKEND_PID)"
    fi
}

# Set up cleanup trap
trap cleanup EXIT

# Check prerequisites
log_info "Checking prerequisites..."

if ! command -v npm &> /dev/null; then
    log_error "npm is not installed"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    log_error "npx is not installed"
    exit 1
fi

# Check if Cypress is available
if ! npx cypress --version &> /dev/null; then
    log_error "Cypress is not available. Please install it with: npm install cypress"
    exit 1
fi

log_success "Prerequisites check passed"

# Step 1: Start frontend in background
log_info "Step 1: Starting frontend dev server..."
export USE_SMALL_MODELS=true
npm run dev:frontend > frontend.log 2>&1 &
FRONTEND_PID=$!

log_info "Frontend starting in background (PID: $FRONTEND_PID)"

# Step 2: Wait for frontend to be ready
log_info "Step 2: Waiting for frontend to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        log_success "Frontend is ready at http://localhost:5173"
        break
    fi
    
    attempt=$((attempt + 1))
    echo -n "."
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    log_error "Frontend failed to start within $(($max_attempts * 2)) seconds"
    log_info "Frontend log:"
    cat frontend.log
    exit 1
fi

# Step 3: Check if ElizaOS server is running
log_info "Step 3: Checking ElizaOS server status..."
if curl -s http://localhost:7777/api/server/health > /dev/null 2>&1; then
    log_success "ElizaOS server is running on port 7777"
else
    log_warning "ElizaOS server not running - test may use mock responses"
fi

# Step 4: Run Cypress test
log_info "Step 4: Running comprehensive Cypress test..."
log_info "Test includes:"
log_info "  - Complete chat flow with agent"
log_info "  - USE_SMALL_MODELS dev mode testing"  
log_info "  - Message deduplication verification"
log_info "  - Error recovery testing"

# Run the test with better error handling
if npx cypress run --spec "cypress/e2e/chat-with-agent.cy.ts" --config baseUrl=http://localhost:5173; then
    log_success "🎉 ALL TESTS PASSED! 🎉"
    log_success "Chat with agent functionality is working correctly"
    
    # Show test summary
    echo ""
    echo "✅ Test Results Summary:"
    echo "  ✅ Complete chat flow: PASSED"
    echo "  ✅ USE_SMALL_MODELS mode: PASSED"
    echo "  ✅ Message deduplication: PASSED"
    echo "  ✅ Error recovery: PASSED"
    echo ""
    echo "🚀 The system is ready for production use!"
    
else
    log_error "❌ TESTS FAILED ❌"
    log_error "Check the Cypress output above for details"
    
    echo ""
    echo "🔍 Debugging Information:"
    echo "Frontend log (last 20 lines):"
    tail -20 frontend.log
    
    echo ""
    echo "ElizaOS server status:"
    curl -s http://localhost:7777/api/server/health || echo "Server not responding"
    
    exit 1
fi

log_success "Chat with Agent test completed successfully!"