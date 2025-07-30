#!/bin/bash

# ElizaOS Inference Plugin Verification Script
# This script helps verify the plugin-inference implementation

set -e

echo "=== ElizaOS Inference Plugin Verification ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "ok" ]; then
        echo -e "${GREEN}✓${NC} $message"
    elif [ "$status" = "warn" ]; then
        echo -e "${YELLOW}⚠${NC} $message"
    else
        echo -e "${RED}✗${NC} $message"
    fi
}

# 1. Check if the plugin directory exists
echo "1. Checking plugin structure..."
if [ -d "packages/plugin-inference" ]; then
    print_status "ok" "Plugin directory exists"
else
    print_status "error" "Plugin directory not found"
    exit 1
fi

# 2. Check required files
echo ""
echo "2. Checking required files..."
FILES=(
    "package.json"
    "tsup.config.ts"
    "vitest.config.ts"
    "README.md"
    "src/index.ts"
    "src/__tests__/index.test.ts"
    "src/__tests__/api.test.ts"
    "src/__tests__/e2e.test.ts"
)

for file in "${FILES[@]}"; do
    if [ -f "packages/plugin-inference/$file" ]; then
        print_status "ok" "$file exists"
    else
        print_status "error" "$file missing"
    fi
done

# 3. Check dependencies
echo ""
echo "3. Checking dependencies..."
cd packages/plugin-inference

# Check if node_modules needs to be installed
if [ ! -d "node_modules" ]; then
    print_status "warn" "Dependencies not installed. Running npm install..."
    npm install
fi

# 4. Run TypeScript compilation check
echo ""
echo "4. Checking TypeScript compilation..."
if npx tsc --noEmit --project tsconfig.build.json 2>/dev/null; then
    print_status "ok" "TypeScript compilation successful"
else
    print_status "warn" "TypeScript compilation has errors (this may be due to module resolution)"
fi

# 5. Run tests
echo ""
echo "5. Running tests..."
if npm test; then
    print_status "ok" "All tests passed"
else
    print_status "error" "Tests failed"
fi

# 6. Build the plugin
echo ""
echo "6. Building the plugin..."
if npm run build; then
    print_status "ok" "Build successful"
    # Check if dist files were created
    if [ -f "dist/index.js" ] && [ -f "dist/index.d.ts" ]; then
        print_status "ok" "Distribution files created"
    else
        print_status "error" "Distribution files missing"
    fi
else
    print_status "error" "Build failed"
fi

# 7. Check API endpoints documentation
echo ""
echo "7. API Endpoints Documentation:"
echo ""
echo "The following endpoints are available when using the plugin with agentserver:"
echo ""
echo "  GET  /api/providers              - Get provider status"
echo "  PUT  /api/providers/selected     - Set selected provider"
echo "  PUT  /api/providers/preferences  - Set provider preferences"
echo ""

# 8. Configuration check
echo "8. Configuration Guide:"
echo ""
echo "Set these environment variables to configure providers:"
echo ""
echo "  # OpenAI"
echo "  OPENAI_API_KEY=your-api-key"
echo ""
echo "  # Anthropic"
echo "  ANTHROPIC_API_KEY=your-api-key"
echo ""
echo "  # Ollama (local)"
echo "  OLLAMA_API_ENDPOINT=http://localhost:11434"
echo ""
echo "  # ElizaOS Cloud"
echo "  ELIZAOS_API_KEY=your-api-key"
echo ""
echo "  # Preferences (optional)"
echo "  INFERENCE_PREFERENCES=anthropic,openai,ollama,elizaos"
echo "  SELECTED_PROVIDER=openai"
echo ""

# 9. Example curl commands
echo "9. Example API Usage:"
echo ""
echo "# Check provider status:"
echo "curl http://localhost:3000/api/providers"
echo ""
echo "# Set selected provider:"
echo 'curl -X PUT http://localhost:3000/api/providers/selected \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{"provider": "anthropic"}'"'"
echo ""
echo "# Set provider preferences:"
echo 'curl -X PUT http://localhost:3000/api/providers/preferences \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{"preferences": ["anthropic", "openai", "ollama"]}'"'"
echo ""

# Return to original directory
cd ../..

echo ""
echo "=== Verification Complete ==="

# Summary
echo ""
echo "Summary:"
echo "- Plugin structure: ✓"
echo "- Tests: Check output above"
echo "- Build: Check output above"
echo ""
echo "Next steps:"
echo "1. Set up API keys for the providers you want to use"
echo "2. Start the agent server with the inference plugin"
echo "3. Use the API endpoints to manage providers"
echo "4. Monitor logs for provider switching behavior"