#!/bin/bash

echo "🌍 Cross-Platform Compilation Helper for plugin-vision"
echo ""

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PACKAGE_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Parse command line arguments
TARGET_PLATFORM=""
TARGET_ARCH=""
OUTPUT_FILE="vision-binary"

while [[ $# -gt 0 ]]; do
    case $1 in
        --platform)
            TARGET_PLATFORM="$2"
            shift 2
            ;;
        --arch)
            TARGET_ARCH="$2"
            shift 2
            ;;
        --output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate inputs
if [[ -z "$TARGET_PLATFORM" || -z "$TARGET_ARCH" ]]; then
    echo "Usage: $0 --platform <linux|darwin|win32> --arch <x64|arm64> [--output <filename>]"
    echo ""
    echo "Examples:"
    echo "  $0 --platform linux --arch x64"
    echo "  $0 --platform darwin --arch arm64 --output my-app"
    exit 1
fi

TARGET="${TARGET_PLATFORM}-${TARGET_ARCH}"
echo "🎯 Target platform: $TARGET"

cd "$PACKAGE_ROOT"

# Step 1: Download pre-built sharp binaries for target platform
echo "📥 Downloading sharp binaries for $TARGET..."
SHARP_VERSION=$(node -p "require('./package.json').dependencies.sharp")
SHARP_VERSION=${SHARP_VERSION#^}  # Remove ^ prefix

mkdir -p temp-sharp
cd temp-sharp

# Download the appropriate sharp package
NPM_PLATFORM=""
case "$TARGET_PLATFORM" in
    linux)
        NPM_PLATFORM="linux"
        ;;
    darwin)
        NPM_PLATFORM="darwin"
        ;;
    win32)
        NPM_PLATFORM="win32"
        ;;
esac

# Try to download pre-built binaries
echo "Attempting to download @img/sharp-${NPM_PLATFORM}-${TARGET_ARCH}@${SHARP_VERSION}..."
npm pack "@img/sharp-${NPM_PLATFORM}-${TARGET_ARCH}@${SHARP_VERSION}" 2>/dev/null || {
    echo "⚠️  Pre-built binaries not available for ${TARGET}"
    echo "💡 You'll need to build from source on the target platform"
    cd ..
    rm -rf temp-sharp
    exit 1
}

# Extract the package
tar -xzf *.tgz
SHARP_NATIVE_PATH="package/sharp.node"

if [[ -f "$SHARP_NATIVE_PATH" ]]; then
    # Copy to the expected location
    mkdir -p "../node_modules/sharp/src/build/Release"
    cp "$SHARP_NATIVE_PATH" "../node_modules/sharp/src/build/Release/sharp-${TARGET}.node"
    echo "✅ Sharp binary copied for $TARGET"
else
    echo "❌ Could not find sharp.node in the package"
    cd ..
    rm -rf temp-sharp
    exit 1
fi

cd ..
rm -rf temp-sharp

# Step 2: Generate embed file for the target platform
echo "📝 Generating embed file for $TARGET..."
cat > "$PACKAGE_ROOT/compile/sharp-${TARGET}.ts" << EOF
// Auto-generated embed file for ${TARGET}
import '../node_modules/sharp/src/build/Release/sharp-${TARGET}.node' with { type: 'file' };
export const embeddedPlatform = '${TARGET}';
EOF

# Step 3: Create platform-specific entrypoint
echo "✨ Creating platform-specific entrypoint..."
cat > "$PACKAGE_ROOT/compile/entrypoint-${TARGET}.ts" << EOF
// Platform-specific entrypoint for ${TARGET}
import './sharp-${TARGET}';
export * from '../dist/index.js';
console.log('[PLUGIN-VISION] Compiled for platform: ${TARGET}');
EOF

# Step 4: Run the build
echo "🔨 Building..."
bun run build

# Step 5: Compile the binary
echo "📦 Compiling binary for $TARGET..."
bun build --compile --target="bun-${NPM_PLATFORM}-${TARGET_ARCH}" --outfile "${OUTPUT_FILE}-${TARGET}" "compile/entrypoint-${TARGET}.ts"

echo ""
echo "✅ Compilation complete!"
echo "📋 Output: ${OUTPUT_FILE}-${TARGET}"
echo ""
echo "⚠️  Note: This binary will only work on ${TARGET_PLATFORM} ${TARGET_ARCH}"
echo "💡 For true cross-platform builds, use Docker or GitHub Actions with matrix builds" 