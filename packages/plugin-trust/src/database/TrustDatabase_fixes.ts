// Fixes for TrustDatabase to support PostgreSQL
// This file contains the changes needed to make TrustDatabase work with PostgreSQL

export const PostgreSQLMigrations = `
-- PostgreSQL compatible table creation scripts

-- Create trust_profiles table with UUID type
CREATE TABLE IF NOT EXISTS trust_profiles (
  entity_id UUID PRIMARY KEY,
  overall_trust NUMERIC NOT NULL DEFAULT 50,
  reliability NUMERIC NOT NULL DEFAULT 50,
  competence NUMERIC NOT NULL DEFAULT 50,
  integrity NUMERIC NOT NULL DEFAULT 50,
  benevolence NUMERIC NOT NULL DEFAULT 50,
  transparency NUMERIC NOT NULL DEFAULT 50,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  interaction_count INTEGER NOT NULL DEFAULT 0,
  last_calculated BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  evidence JSONB -- JSONB for PostgreSQL
);

-- Create trust_evidence table
CREATE TABLE IF NOT EXISTS trust_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  type VARCHAR(255) NOT NULL,
  impact NUMERIC NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 1.0,
  description TEXT,
  timestamp BIGINT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  reported_by UUID,
  context JSONB,
  metadata JSONB
);

-- Create trust_comments table
CREATE TABLE IF NOT EXISTS trust_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  evaluator_id UUID NOT NULL,
  trust_score NUMERIC NOT NULL,
  trust_change NUMERIC NOT NULL,
  comment TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  metadata JSONB
);

-- Create permission_delegations table
CREATE TABLE IF NOT EXISTS permission_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_id UUID NOT NULL,
  delegatee_id UUID NOT NULL,
  permission VARCHAR(255) NOT NULL,
  resource VARCHAR(255),
  granted_at BIGINT NOT NULL,
  expires_at BIGINT,
  active BOOLEAN NOT NULL DEFAULT true,
  conditions JSONB
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trust_evidence_entity ON trust_evidence(entity_id);
CREATE INDEX IF NOT EXISTS idx_trust_evidence_timestamp ON trust_evidence(timestamp);
CREATE INDEX IF NOT EXISTS idx_trust_comments_entity ON trust_comments(entity_id, evaluator_id);
CREATE INDEX IF NOT EXISTS idx_trust_comments_timestamp ON trust_comments(timestamp);
CREATE INDEX IF NOT EXISTS idx_delegations_delegator ON permission_delegations(delegator_id);
`;

export const SQLiteMigrations = `
-- SQLite compatible table creation scripts (original)

CREATE TABLE IF NOT EXISTS trust_profiles (
  entity_id TEXT PRIMARY KEY,
  overall_trust REAL NOT NULL DEFAULT 50,
  reliability REAL NOT NULL DEFAULT 50,
  competence REAL NOT NULL DEFAULT 50,
  integrity REAL NOT NULL DEFAULT 50,
  benevolence REAL NOT NULL DEFAULT 50,
  transparency REAL NOT NULL DEFAULT 50,
  confidence REAL NOT NULL DEFAULT 0.5,
  interaction_count INTEGER NOT NULL DEFAULT 0,
  last_calculated INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  evidence TEXT -- JSON array of evidence
);

CREATE TABLE IF NOT EXISTS trust_evidence (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  type TEXT NOT NULL,
  impact REAL NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  description TEXT,
  timestamp INTEGER NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT 0,
  reported_by TEXT,
  context TEXT, -- JSON object
  metadata TEXT -- JSON object
);

CREATE TABLE IF NOT EXISTS trust_comments (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  evaluator_id TEXT NOT NULL,
  trust_score REAL NOT NULL,
  trust_change REAL NOT NULL,
  comment TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  metadata TEXT -- JSON object
);

CREATE TABLE IF NOT EXISTS permission_delegations (
  id TEXT PRIMARY KEY,
  delegator_id TEXT NOT NULL,
  delegatee_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  resource TEXT,
  granted_at INTEGER NOT NULL,
  expires_at INTEGER,
  active BOOLEAN NOT NULL DEFAULT 1,
  conditions TEXT -- JSON object
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trust_evidence_entity ON trust_evidence(entity_id);
CREATE INDEX IF NOT EXISTS idx_trust_evidence_timestamp ON trust_evidence(timestamp);
CREATE INDEX IF NOT EXISTS idx_trust_comments_entity ON trust_comments(entity_id, evaluator_id);
CREATE INDEX IF NOT EXISTS idx_trust_comments_timestamp ON trust_comments(timestamp);
CREATE INDEX IF NOT EXISTS idx_delegations_delegator ON permission_delegations(delegator_id);
`;

// Helper function to detect if database is PostgreSQL
export function isPostgreSQL(db: any): boolean {
  // Check for common PostgreSQL indicators
  if (db.constructor?.name?.toLowerCase().includes('pg')) return true;
  if (db.adapter?.name?.toLowerCase().includes('pg')) return true;
  if (db.dialect === 'postgresql' || db.dialect === 'postgres') return true;
  if (typeof db.executeSQL === 'function' && db.executeSQL.toString().includes('RETURNING'))
    return true;

  // Check if it's PGLite
  if (db.constructor?.name === 'PGlite') return true;

  return false;
}

// Helper to convert UUID strings to proper format for database
export function formatUUID(uuid: string, isPostgres: boolean): string {
  if (!isPostgres) return uuid;
  // PostgreSQL expects UUIDs without quotes in certain contexts
  return uuid;
}

// Cache table fix for PostgreSQL
export const CacheTableFix = `
-- Fix for cache table with proper primary key
CREATE TABLE IF NOT EXISTS "cache" (
  "key" TEXT NOT NULL,
  "value" JSONB,
  "expiresAt" TIMESTAMP,
  PRIMARY KEY ("key")
);
`;
