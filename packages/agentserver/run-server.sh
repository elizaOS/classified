#!/bin/bash
export POSTGRES_URL="postgresql://eliza:eliza_secure_pass@localhost:5432/eliza_game"
export NODE_ENV="development"
echo "Starting ElizaOS AgentServer..."
echo "PostgreSQL URL: $POSTGRES_URL"
exec bun server.ts 