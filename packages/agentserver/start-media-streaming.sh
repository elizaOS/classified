#!/bin/bash

# ElizaOS Media Streaming Setup Script
# This script starts all necessary containers for the media streaming demo

set -e

echo "🚀 Starting ElizaOS Media Streaming Environment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Detect container runtime
if command -v podman &> /dev/null; then
    CONTAINER_CMD="podman"
    echo "Using Podman as container runtime"
elif command -v docker &> /dev/null; then
    CONTAINER_CMD="docker"
    echo "Using Docker as container runtime"
else
    echo "${RED}Error: Neither podman nor docker found!${NC}"
    exit 1
fi

# Create network if it doesn't exist
echo -e "${YELLOW}Creating network...${NC}"
${CONTAINER_CMD} network create eliza-network 2>/dev/null || echo "Network already exists"

# Stop and remove existing containers if they exist
echo -e "${YELLOW}Cleaning up existing containers...${NC}"
${CONTAINER_CMD} stop eliza-postgres eliza-ollama eliza-agent 2>/dev/null || true
${CONTAINER_CMD} rm eliza-postgres eliza-ollama eliza-agent 2>/dev/null || true

# Start PostgreSQL with pgvector
echo -e "${YELLOW}Starting PostgreSQL...${NC}"
${CONTAINER_CMD} run -d \
  --name eliza-postgres \
  --network eliza-network \
  -e POSTGRES_USER=eliza \
  -e POSTGRES_PASSWORD=eliza_secure_pass \
  -e POSTGRES_DB=eliza \
  -p 5432:5432 \
  pgvector/pgvector:pg16

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
  if ${CONTAINER_CMD} exec eliza-postgres pg_isready -U eliza &>/dev/null; then
    echo -e "${GREEN}PostgreSQL is ready!${NC}"
    break
  fi
  echo "Waiting for PostgreSQL... ($i/30)"
  sleep 1
done

# Start Ollama
echo -e "${YELLOW}Starting Ollama...${NC}"
${CONTAINER_CMD} run -d \
  --name eliza-ollama \
  --network eliza-network \
  -p 11434:11434 \
  -v ollama:/root/.ollama \
  ollama/ollama

# Wait for Ollama to be ready
echo "Waiting for Ollama to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:11434/api/version &>/dev/null; then
    echo -e "${GREEN}Ollama is ready!${NC}"
    break
  fi
  echo "Waiting for Ollama... ($i/30)"
  sleep 1
done

# Pull Ollama models
echo -e "${YELLOW}Pulling Ollama models...${NC}"
${CONTAINER_CMD} exec eliza-ollama ollama pull llama3.2:1b || echo "Model may already exist"
${CONTAINER_CMD} exec eliza-ollama ollama pull nomic-embed-text || echo "Model may already exist"
${CONTAINER_CMD} exec eliza-ollama ollama pull ZimaBlueAI/whisper-large-v3 || echo "Model may already exist"

# Test network connectivity from host
echo -e "${YELLOW}Testing network connectivity...${NC}"
${CONTAINER_CMD} exec eliza-postgres hostname -I | xargs -n1 echo "PostgreSQL IP:"
${CONTAINER_CMD} exec eliza-ollama hostname -I | xargs -n1 echo "Ollama IP:"

# Start ElizaOS Agent with media streaming
echo -e "${YELLOW}Starting ElizaOS Agent...${NC}"
${CONTAINER_CMD} run -d \
  --name eliza-agent \
  --network eliza-network \
  -p 7777:7777 \
  -p 5901:5900 \
  --add-host eliza-postgres:$(${CONTAINER_CMD} exec eliza-postgres hostname -I | awk '{print $1}') \
  --add-host eliza-ollama:$(${CONTAINER_CMD} exec eliza-ollama hostname -I | awk '{print $1}') \
  -e POSTGRES_URL="postgresql://eliza:eliza_secure_pass@eliza-postgres:5432/eliza" \
  -e DATABASE_URL="postgresql://eliza:eliza_secure_pass@eliza-postgres:5432/eliza" \
  -e OLLAMA_BASE_URL="http://eliza-ollama:11434" \
  -e OLLAMA_API_ENDPOINT="http://eliza-ollama:11434/api" \
  -e WHISPER_MODEL="ZimaBlueAI/whisper-large-v3" \
  -e LOG_LEVEL="info" \
  eliza-agent:latest

# Wait for agent to start
echo "Waiting for agent to start..."
for i in {1..60}; do
  if curl -s http://localhost:7777/api/server/health | grep -q '"status":"healthy"'; then
    echo -e "${GREEN}Agent is ready!${NC}"
    break
  fi
  echo "Waiting for agent... ($i/60)"
  sleep 1
done

# Check status
echo -e "\n${GREEN}✅ Checking services status...${NC}"
echo "----------------------------------------"

# Check PostgreSQL
if ${CONTAINER_CMD} exec eliza-postgres pg_isready -U eliza &>/dev/null; then
    echo -e "PostgreSQL: ${GREEN}✓ Running${NC}"
else
    echo -e "PostgreSQL: ${RED}✗ Not ready${NC}"
fi

# Check Ollama
if curl -s http://localhost:11434/api/version &>/dev/null; then
    echo -e "Ollama: ${GREEN}✓ Running${NC}"
else
    echo -e "Ollama: ${RED}✗ Not ready${NC}"
fi

# Check Agent
if curl -s http://localhost:7777/api/server/health | grep -q '"status":"healthy"'; then
    echo -e "Agent: ${GREEN}✓ Running${NC}"
else
    echo -e "Agent: ${RED}✗ Not ready${NC}"
fi

echo "----------------------------------------"

# Display access URLs
echo -e "\n${GREEN}🎉 ElizaOS Media Streaming Environment is ready!${NC}"
echo ""
echo "Access points:"
echo "  - Messaging UI: http://localhost:7777/messaging"
echo "  - API: http://localhost:7777/api"
echo "  - VNC (agent screen): vnc://localhost:5901"
echo ""
echo "To view logs:"
echo "  ${CONTAINER_CMD} logs -f eliza-agent"
echo ""
echo "To stop all containers:"
echo "  ${CONTAINER_CMD} stop eliza-agent eliza-postgres eliza-ollama"
echo "  ${CONTAINER_CMD} rm eliza-agent eliza-postgres eliza-ollama" 