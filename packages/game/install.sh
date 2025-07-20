#!/bin/bash

# ElizaOS Terminal Installation Script

echo "🖥️  ElizaOS Terminal Installer"
echo "==============================="
echo ""

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if Rust is installed (for Tauri)
if command -v rustc &> /dev/null; then
    echo "✅ Rust $(rustc --version | cut -d' ' -f2) detected"
else
    echo "⚠️  Rust is not installed. You'll need it for desktop builds."
    echo "   Install from: https://rustup.rs/"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cat > .env << EOL
# ElizaOS Terminal Environment Configuration

# Server Configuration
PORT=7777
SERVER_PORT=7777

# Database Configuration (optional - defaults to PGLite)
# POSTGRES_URL=postgresql://user:password@localhost:5432/elizaos

# LLM Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Model overrides
# MODEL_PROVIDER=openai
# TEXT_MODEL=gpt-4-turbo-preview

# Log Level
LOG_LEVEL=info

# Optional: CORS Configuration
# CORS_ORIGIN=*
EOL
    echo "✅ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and add your OpenAI API key!"
    echo ""
fi

# Build backend
echo "🔨 Building backend server..."
npm run build:backend

if [ $? -eq 0 ]; then
    echo "✅ Backend built successfully"
else
    echo "❌ Backend build failed"
    exit 1
fi

# Install Playwright browsers for testing
echo ""
echo "🎭 Installing Playwright browsers for testing..."
npx playwright install chromium

echo ""
echo "✨ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your OpenAI API key"
echo "2. Run 'npm run dev' to start the web version"
echo "3. Run 'npm run tauri:dev' to start the desktop version"
echo "4. Run 'npm run test:e2e' to run tests"
echo ""
echo "Happy hacking! 💚" 