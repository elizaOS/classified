-- PostgreSQL initialization script for ElizaOS
-- This script sets up the database for the ElizaOS agent server

-- Ensure the database exists
CREATE DATABASE IF NOT EXISTS eliza_game;

-- Switch to the eliza_game database
\c eliza_game;

-- Create necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create eliza user with proper permissions
CREATE USER IF NOT EXISTS eliza WITH PASSWORD 'eliza_secure_pass';
GRANT ALL PRIVILEGES ON DATABASE eliza_game TO eliza;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO eliza;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO eliza;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO eliza;

-- Grant future permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO eliza;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO eliza;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO eliza;

-- Basic health check table
CREATE TABLE IF NOT EXISTS health_check (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'healthy'
);

-- Insert initial health check record
INSERT INTO health_check (status) VALUES ('initialized') ON CONFLICT DO NOTHING;

-- Set proper timezone
SET timezone = 'UTC';

COMMIT;