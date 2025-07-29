#!/bin/bash

# E2E Test Runner Script for ElizaOS Game
# This script ensures backend is running before tests and cleans up afterwards

set -e

echo "🚀 Starting E2E Test Suite..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Server settings
BACKEND_PORT=7777
BACKEND_DIR="../agentserver"
BACKEND_LOG="backend-test.log"
FRONTEND_PORT=5173
FRONTEND_LOG="frontend-test.log"

# Function to check if backend is running
check_backend() {
    curl -s http://localhost:$BACKEND_PORT/api/server/health > /dev/null 2>&1
}

# Function to check if frontend is running
check_frontend() {
    curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1
}

# Function to start backend
start_backend() {
    echo -e "${YELLOW}Starting backend server...${NC}"
    cd $BACKEND_DIR
    bun run dev > $BACKEND_LOG 2>&1 &
    BACKEND_PID=$!
    cd - > /dev/null
    
    # Wait for backend to be ready
    echo -n "Waiting for backend to start"
    for i in {1..30}; do
        if check_backend; then
            echo -e "\n${GREEN}✓ Backend is ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
    done
    echo -e "\n${RED}✗ Backend failed to start${NC}"
    return 1
}

# Function to start frontend
start_frontend() {
    echo -e "${YELLOW}Starting frontend server...${NC}"
    # Use vite directly for faster startup
    npx vite --host > $FRONTEND_LOG 2>&1 &
    FRONTEND_PID=$!
    
    # Wait for frontend to be ready
    echo -n "Waiting for frontend to start"
    for i in {1..60}; do
        if check_frontend; then
            echo -e "\n${GREEN}✓ Frontend is ready!${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
    done
    echo -e "\n${RED}✗ Frontend failed to start${NC}"
    cat $FRONTEND_LOG | tail -20
    return 1
}

# Function to cleanup
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        echo "Stopping backend server (PID: $BACKEND_PID)"
        kill $BACKEND_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        echo "Stopping frontend server (PID: $FRONTEND_PID)"
        kill $FRONTEND_PID 2>/dev/null || true
        wait $FRONTEND_PID 2>/dev/null || true
    fi
    # Kill any orphaned processes on the ports
    lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
    lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null || true
}

# Set up trap to cleanup on exit
trap cleanup EXIT INT TERM

# Main execution
echo -e "${YELLOW}Checking backend status...${NC}"
if check_backend; then
    echo -e "${GREEN}✓ Backend is already running${NC}"
else
    start_backend || exit 1
fi

echo -e "${YELLOW}Checking frontend status...${NC}"
if check_frontend; then
    echo -e "${GREEN}✓ Frontend is already running${NC}"
else
    start_frontend || exit 1
fi

# Run the E2E tests
echo -e "\n${YELLOW}Running E2E tests...${NC}"
echo "================================="

# Run Cypress tests with better error handling
npx cypress run --spec 'cypress/e2e/**/*.cy.ts' --reporter spec || TEST_EXIT_CODE=$?

# Summary
echo "================================="
if [ "${TEST_EXIT_CODE:-0}" -eq 0 ]; then
    echo -e "${GREEN}✓ All E2E tests passed!${NC}"
else
    echo -e "${RED}✗ Some tests failed (exit code: ${TEST_EXIT_CODE:-1})${NC}"
    echo -e "${YELLOW}Check the screenshots and videos in cypress/screenshots and cypress/videos${NC}"
fi

exit ${TEST_EXIT_CODE:-0}