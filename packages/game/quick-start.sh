#!/bin/bash

# ElizaOS Terminal Quick Start

echo "🚀 ElizaOS Terminal Quick Start"
echo "================================"
echo ""

# Check for .env file
if [ ! -f .env ]; then
    echo "❌ No .env file found!"
    echo ""
    echo "Please create a .env file with your OpenAI API key:"
    echo ""
    echo "  cp .env.example .env"
    echo "  # Edit .env and add your OPENAI_API_KEY"
    echo ""
    echo "Or run: ./install.sh"
    exit 1
fi

# Check if OpenAI API key is set
if grep -q "your_openai_api_key_here" .env; then
    echo "⚠️  Warning: OpenAI API key not configured in .env"
    echo "   The agent won't be able to respond without a valid API key."
    echo ""
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build backend if needed
if [ ! -d "dist-backend" ]; then
    echo "🔨 Building backend..."
    npm run build:backend
fi

# Start the application
echo ""
echo "🚀 Starting ElizaOS Terminal..."
echo ""
echo "Backend will start on: http://localhost:3000"
echo "Frontend will start on: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop"
echo ""

npm run dev 