#!/bin/bash

# Create a podman network if it doesn't exist
podman network create eliza-network 2>/dev/null || true

# Run PostgreSQL container if not already running
if ! podman ps | grep -q eliza-postgres; then
    echo "Starting PostgreSQL container..."
    podman run -d \
        --name eliza-postgres \
        --network eliza-network \
        -e POSTGRES_USER=eliza \
        -e POSTGRES_PASSWORD=eliza_secure_pass \
        -e POSTGRES_DB=eliza \
        -p 5433:5432 \
        -v eliza-postgres-data:/var/lib/postgresql/data \
        pgvector/pgvector:pg16
    
    # Wait for PostgreSQL to be ready
    echo "Waiting for PostgreSQL to be ready..."
    sleep 5
fi

# Run the ElizaOS agent container
echo "Starting ElizaOS agent container..."
podman run -it \
    --rm \
    --name eliza-agent \
    --network eliza-network \
    -p 7777:7777 \
    ${1:-eliza-agent:latest}

# Note: Pass your image ID or tag as the first argument, defaults to eliza-agent:latest 