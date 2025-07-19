#!/bin/bash

# Interactive Claude Code Test Runner
# This script demonstrates the interactive test capabilities

echo "🎯 Interactive Claude Code Sandbox Test"
echo "======================================="
echo ""

# Check for required environment variables
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ ANTHROPIC_API_KEY is required"
    echo "Please set your Anthropic API key:"
    echo "export ANTHROPIC_API_KEY='your_api_key_here'"
    echo ""
    exit 1
fi

# Check for optional environment variables
echo "📋 Environment Status:"
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "   ✅ ANTHROPIC_API_KEY"
else
    echo "   ❌ ANTHROPIC_API_KEY"
fi

if [ -n "$E2B_API_KEY" ]; then
    echo "   ✅ E2B_API_KEY"
else
    echo "   ❌ E2B_API_KEY (will use mock)"
fi

if [ -n "$GITHUB_TOKEN" ]; then
    echo "   ✅ GITHUB_TOKEN"
else
    echo "   ❌ GITHUB_TOKEN (GitHub features disabled)"
fi

echo ""
echo "🚀 Starting interactive test..."
echo "Type 'help' for available commands"
echo "Type 'exit' to quit"
echo ""

# Navigate to the plugin directory
cd "$(dirname "$0")/.."

# Run the interactive test
bun run test:interactive