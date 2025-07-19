#!/bin/bash

# ElizaOS Terminal Test Runner with Loop

echo "🧪 ElizaOS Terminal Test Runner (Loop Mode)"
echo "============================================"
echo ""

# Function to run tests
run_tests() {
    echo "🧪 Running E2E tests..."
    
    # Run playwright tests with specific reporter and no HTML server
    npx playwright test --reporter=list 2>&1 | tee test-output.log
    
    # Check if the test output contains the HTML server message
    if grep -q "Serving HTML report at" test-output.log; then
        echo "⚠️ Detected HTML report server, stopping..."
        # Kill the HTML server
        lsof -ti:9323 | xargs kill -9 2>/dev/null || true
    fi
    
    # Return the exit code from playwright
    return ${PIPESTATUS[0]}
}

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Creating from example..."
    cat > .env << EOL
# ElizaOS Terminal Environment Configuration

# Server Configuration
PORT=3000
SERVER_PORT=3000

# LLM Configuration (using a test key for CI)
OPENAI_API_KEY=test_key_for_ci

# Log Level
LOG_LEVEL=info
EOL
    echo "✅ .env file created with test configuration"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build backend
echo "🔨 Building backend..."
npm run build:backend

# Install Playwright browsers if needed
echo "🎭 Ensuring Playwright browsers are installed..."
npx playwright install chromium

# Clean up any existing processes
echo "🧹 Cleaning up existing processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:9323 | xargs kill -9 2>/dev/null || true

# Start the dev server in background
echo "🚀 Starting development server..."
npm run dev &
DEV_PID=$!

# Wait for servers to start
echo "⏳ Waiting for servers to start..."
sleep 10

# Check if servers are running
if ! curl -s http://localhost:5173 > /dev/null; then
    echo "❌ Frontend server not responding on port 5173"
    kill $DEV_PID 2>/dev/null || true
    exit 1
fi

if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ Backend server not responding on port 3000"
    kill $DEV_PID 2>/dev/null || true
    exit 1
fi

echo "✅ Servers are running"

# Run tests
run_tests
TEST_EXIT_CODE=$?

# Clean up
echo ""
echo "🧹 Cleaning up..."
kill $DEV_PID 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:9323 | xargs kill -9 2>/dev/null || true
rm -f test-output.log

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ All tests passed!"
else
    echo ""
    echo "❌ Some tests failed. Exit code: $TEST_EXIT_CODE"
    exit $TEST_EXIT_CODE
fi 