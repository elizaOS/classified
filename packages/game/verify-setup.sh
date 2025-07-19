#!/bin/bash

# ElizaOS Terminal Setup Verification

echo "🔍 ElizaOS Terminal Setup Verification"
echo "======================================"
echo ""

ERRORS=0

# Check Node.js
echo -n "✓ Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "Found $NODE_VERSION"
else
    echo "❌ Not found"
    ERRORS=$((ERRORS + 1))
fi

# Check npm
echo -n "✓ Checking npm... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo "Found v$NPM_VERSION"
else
    echo "❌ Not found"
    ERRORS=$((ERRORS + 1))
fi

# Check .env file
echo -n "✓ Checking .env file... "
if [ -f .env ]; then
    if grep -q "your_openai_api_key_here" .env; then
        echo "Found (but API key not configured)"
    else
        echo "Found and configured"
    fi
else
    echo "❌ Not found"
    ERRORS=$((ERRORS + 1))
fi

# Check dependencies
echo -n "✓ Checking node_modules... "
if [ -d node_modules ]; then
    echo "Found"
else
    echo "❌ Not found (run: npm install)"
    ERRORS=$((ERRORS + 1))
fi

# Check backend build
echo -n "✓ Checking backend build... "
if [ -f dist-backend/server.js ]; then
    echo "Found"
else
    echo "❌ Not found (run: npm run build:backend)"
    ERRORS=$((ERRORS + 1))
fi

# Check required files
echo ""
echo "📁 Checking required files:"

FILES=(
    "src/App.tsx"
    "src/main.tsx"
    "src/components/TerminalContainer.tsx"
    "src/components/ChatPanel.tsx"
    "src/components/LogPanel.tsx"
    "src/contexts/SocketContext.tsx"
    "src/contexts/ChatContext.tsx"
    "src-backend/server.ts"
    "e2e/frontend-ui.test.ts"
    "e2e/chat-flow.test.ts"
)

for FILE in "${FILES[@]}"; do
    echo -n "  ✓ $FILE... "
    if [ -f "$FILE" ]; then
        echo "Found"
    else
        echo "❌ Missing"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check scripts
echo ""
echo "🔧 Checking scripts:"

SCRIPTS=(
    "install.sh"
    "quick-start.sh"
    "run-tests.sh"
)

for SCRIPT in "${SCRIPTS[@]}"; do
    echo -n "  ✓ $SCRIPT... "
    if [ -f "$SCRIPT" ] && [ -x "$SCRIPT" ]; then
        echo "Found and executable"
    elif [ -f "$SCRIPT" ]; then
        echo "Found (not executable - run: chmod +x $SCRIPT)"
    else
        echo "❌ Missing"
        ERRORS=$((ERRORS + 1))
    fi
done

# Summary
echo ""
echo "======================================"
if [ $ERRORS -eq 0 ]; then
    echo "✅ All checks passed! Setup is complete."
    echo ""
    echo "Next steps:"
    echo "1. Configure your OpenAI API key in .env"
    echo "2. Run: ./quick-start.sh"
else
    echo "❌ Found $ERRORS issue(s). Please fix them before running the app."
    echo ""
    echo "Quick fix:"
    echo "1. Run: ./install.sh"
fi 