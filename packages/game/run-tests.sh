#!/bin/bash

# ElizaOS Terminal Test Runner

echo "🧪 ElizaOS Terminal Test Runner"
echo "================================"
echo ""

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

# Run tests
echo ""
echo "🧪 Running E2E tests..."
npm run test:e2e

# Capture exit code
TEST_EXIT_CODE=$?

# Clean up
echo ""
echo "🧹 Cleaning up..."
# Kill any remaining node processes on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ All tests passed!"
else
    echo ""
    echo "❌ Some tests failed. Check the output above."
    exit $TEST_EXIT_CODE
fi 