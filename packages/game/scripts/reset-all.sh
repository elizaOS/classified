#!/bin/bash

echo "🔄 ELIZA Game - Reset All Processes and Containers"
echo "================================================="

# Kill all Node.js processes that might be running our servers
echo "🛑 Killing Node.js server processes..."
pkill -f "node.*server.ts" 2>/dev/null || true
pkill -f "node.*simple-server" 2>/dev/null || true
pkill -f "tsx.*server" 2>/dev/null || true
pkill -f "bun.*server" 2>/dev/null || true

# Kill processes on common ports
echo "🛑 Killing processes on common ports..."
for port in 3000 3001 5173 7777 7778 8080 8081 8888 9000; do
    echo "  - Checking port $port..."
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
done

# Kill any Tauri processes
echo "🛑 Killing Tauri processes..."
pkill -f "tauri" 2>/dev/null || true
pkill -f "ELIZA" 2>/dev/null || true

# Kill any Vite dev servers
echo "🛑 Killing Vite dev servers..."
pkill -f "vite" 2>/dev/null || true

# Stop and remove Docker/Podman containers
echo "🐳 Stopping Docker containers..."
if command -v docker &> /dev/null; then
    docker ps -q --filter "name=eliza" | xargs -r docker stop 2>/dev/null || true
    docker ps -q --filter "name=postgres" | xargs -r docker stop 2>/dev/null || true
    docker ps -a -q --filter "name=eliza" | xargs -r docker rm 2>/dev/null || true
    docker ps -a -q --filter "name=postgres" | xargs -r docker rm 2>/dev/null || true
fi

echo "🐳 Stopping Podman containers..."
if command -v podman &> /dev/null; then
    podman ps -q --filter "name=eliza" | xargs -r podman stop 2>/dev/null || true
    podman ps -q --filter "name=postgres" | xargs -r podman stop 2>/dev/null || true
    podman ps -a -q --filter "name=eliza" | xargs -r podman rm 2>/dev/null || true
    podman ps -a -q --filter "name=postgres" | xargs -r podman rm 2>/dev/null || true
fi

# Clean up any temporary files
echo "🧹 Cleaning temporary files..."
rm -rf /tmp/eliza-* 2>/dev/null || true
rm -rf /tmp/*eliza* 2>/dev/null || true

# Kill any remaining processes that might be holding ports
echo "🛑 Final cleanup of any remaining processes..."
ps aux | grep -E "(eliza|ELIZA)" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true

# Wait a moment for processes to fully terminate
echo "⏳ Waiting for processes to terminate..."
sleep 3

# Verify no processes are still running on our ports
echo "✅ Verifying ports are free..."
for port in 3000 3001 5173 7777 7778 8080 8081 8888 9000; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "  ⚠️  Port $port is still in use"
    else
        echo "  ✅ Port $port is free"
    fi
done

echo ""
echo "🎉 Reset complete! All processes and containers should be stopped."
echo "💡 You can now start fresh with:"
echo "   - Frontend: npm run dev (from packages/game)"
echo "   - Backend: npm run dev:backend (from packages/game)"
echo "   - Or both: npm run dev:full (from packages/game)"