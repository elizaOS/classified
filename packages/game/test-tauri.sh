#!/bin/bash

echo "🧪 Running Tauri Runtime Tests..."

# Ensure containers are running
echo "Checking if containers are running..."
if ! podman ps | grep -q "eliza-agent"; then
    echo "❌ Agent container is not running. Please start it first with 'bun run dev'"
    exit 1
fi

# Run the Tauri tests with the environment variable set
cd src-tauri
RUN_TAURI_TESTS=true cargo run --release

# Capture the exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ All Tauri runtime tests passed!"
else
    echo "❌ Tauri runtime tests failed with exit code: $EXIT_CODE"
fi

exit $EXIT_CODE