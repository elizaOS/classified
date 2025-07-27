#!/bin/bash

echo "[STARTUP] ElizaOS Agent Server starting..."

# Check if database reset is requested
if [ "$RESET_DB" = "true" ]; then
    echo "[STARTUP] Database reset requested (RESET_DB=true)"
    
    # Wait for PostgreSQL to be available
    echo "[STARTUP] Waiting for PostgreSQL to be ready..."
    until PGPASSWORD=eliza_secure_pass psql -h eliza-postgres -U eliza -d postgres -c '\q' 2>/dev/null; do
        echo "[STARTUP] PostgreSQL is unavailable - sleeping"
        sleep 1
    done
    
    echo "[STARTUP] PostgreSQL is ready - resetting database"
    
    # Drop and recreate the database
    PGPASSWORD=eliza_secure_pass psql -h eliza-postgres -U eliza -d postgres <<EOF
DROP DATABASE IF EXISTS eliza;
CREATE DATABASE eliza;
EOF
    
    echo "[STARTUP] Database created - installing extensions"
    
    # Install required extensions in the new database
    PGPASSWORD=eliza_secure_pass psql -h eliza-postgres -U eliza -d eliza <<EOF
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";
EOF
    
    echo "[STARTUP] Database reset complete with extensions"
else
    echo "[STARTUP] Keeping existing database (RESET_DB=false)"
fi

# Start the server
echo "[STARTUP] Starting ElizaOS server..."
exec ./server 