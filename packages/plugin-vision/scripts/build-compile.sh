#!/bin/bash

echo "🚀 Building plugin-vision with embedded sharp for compilation..."

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PACKAGE_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PACKAGE_ROOT"

# Step 1: Install dependencies and patch-package
echo "📦 Installing dependencies..."
npm install --include=optional
npm install --save-dev patch-package

# Step 2: Apply the sharp patch
echo "🔧 Applying sharp patch..."
npx patch-package

# Step 3: Build sharp from source if needed
echo "🏗️  Checking sharp native module..."
if [ ! -f "node_modules/sharp/src/build/Release/sharp-*.node" ]; then
    echo "📨 Building sharp from source..."
    cd node_modules/sharp
    npm run install -- --build-from-source
    cd "$PACKAGE_ROOT"
fi

# Step 4: Generate the embed file
echo "📝 Generating embed file..."
bun ./scripts/embed-sharp.ts

# Step 5: Build the package
echo "🔨 Building package..."
bun run build

# Step 6: Create entrypoint that includes the embed
echo "✨ Creating compilation entrypoint..."
cat > "$PACKAGE_ROOT/compile/entrypoint.ts" << 'EOF'
// Import the embedded sharp module
import './sharp';

// Import and re-export the main plugin
export * from '../dist/index.js';

// Log that we're using the embedded version
console.log('[PLUGIN-VISION] Using embedded sharp module');
EOF

echo "✅ Build complete!"
echo ""
echo "📋 Next steps:"
echo "1. To compile a standalone binary:"
echo "   bun build --compile --outfile my-binary compile/entrypoint.ts"
echo ""
echo "2. For cross-platform compilation:"
echo "   - Build sharp for the target platform first"
echo "   - Use Docker or a VM with the target OS"
echo "   - Or manually download the correct .node file" 