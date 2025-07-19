import { type UUID } from '@elizaos/core';

// Table definitions for PostgreSQL
export const SCHEMA_SQL = `
-- Core entity storage
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY,
    agent_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL,
    names TEXT[] NOT NULL,
    summary TEXT,
    trust_score DECIMAL(3,2) DEFAULT 0.50 CHECK (trust_score >= 0 AND trust_score <= 1),
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entities_agent ON entities(agent_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_trust ON entities(trust_score);
CREATE INDEX IF NOT EXISTS idx_entities_tags ON entities USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_entities_names ON entities USING GIN(names);

-- Platform identities
CREATE TABLE IF NOT EXISTS entity_platforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    handle VARCHAR(255) NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_id, platform, handle)
);

CREATE INDEX IF NOT EXISTS idx_platforms_entity ON entity_platforms(entity_id);
CREATE INDEX IF NOT EXISTS idx_platforms_platform ON entity_platforms(platform);

-- Relationships with bidirectional support
CREATE TABLE IF NOT EXISTS relationships (
    id UUID PRIMARY KEY,
    source_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    target_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    strength DECIMAL(3,2) DEFAULT 0.50 CHECK (strength >= 0 AND strength <= 1),
    sentiment DECIMAL(3,2) DEFAULT 0.00 CHECK (sentiment >= -1 AND sentiment <= 1),
    trust_impact DECIMAL(3,2) DEFAULT 0.00,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_entity_id, target_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_strength ON relationships(strength);
CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);

-- Interaction history for relationship analysis
CREATE TABLE IF NOT EXISTS interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    target_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    room_id UUID NOT NULL,
    message_id UUID,
    type VARCHAR(50) NOT NULL,
    content TEXT,
    sentiment DECIMAL(3,2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interactions_entities ON interactions(source_entity_id, target_entity_id);
CREATE INDEX IF NOT EXISTS idx_interactions_time ON interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_room ON interactions(room_id);

-- Follow-up tasks
CREATE TABLE IF NOT EXISTS follow_ups (
    id UUID PRIMARY KEY,
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL,
    message TEXT NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    priority VARCHAR(20) DEFAULT 'medium',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followups_entity ON follow_ups(entity_id);
CREATE INDEX IF NOT EXISTS idx_followups_scheduled ON follow_ups(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_followups_completed ON follow_ups(completed);
CREATE INDEX IF NOT EXISTS idx_followups_agent ON follow_ups(agent_id);

-- Trust events for audit trail
CREATE TABLE IF NOT EXISTS trust_events (
    id UUID PRIMARY KEY,
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    impact DECIMAL(3,2) NOT NULL CHECK (impact >= -0.5 AND impact <= 0.5),
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trust_entity ON trust_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_trust_time ON trust_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_type ON trust_events(event_type);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_entities_updated_at BEFORE UPDATE ON entities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_relationships_updated_at BEFORE UPDATE ON relationships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

// TypeScript interfaces matching the schema
export interface DbEntity {
  id: UUID;
  agent_id: UUID;
  type: 'person' | 'organization' | 'bot' | 'system';
  names: string[];
  summary: string | null;
  trust_score: number;
  tags: string[];
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface DbEntityPlatform {
  id: UUID;
  entity_id: UUID;
  platform: string;
  handle: string;
  verified: boolean;
  metadata: Record<string, any>;
  created_at: Date;
}

export interface DbRelationship {
  id: UUID;
  source_entity_id: UUID;
  target_entity_id: UUID;
  type: string;
  strength: number;
  sentiment: number;
  trust_impact: number;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface DbInteraction {
  id: UUID;
  source_entity_id: UUID;
  target_entity_id: UUID;
  room_id: UUID;
  message_id: UUID | null;
  type: string;
  content: string | null;
  sentiment: number | null;
  metadata: Record<string, any>;
  created_at: Date;
}

export interface DbFollowUp {
  id: UUID;
  entity_id: UUID;
  agent_id: UUID;
  message: string;
  scheduled_for: Date;
  completed: boolean;
  completed_at: Date | null;
  priority: 'low' | 'medium' | 'high';
  metadata: Record<string, any>;
  created_at: Date;
}

export interface DbTrustEvent {
  id: UUID;
  entity_id: UUID;
  event_type: string;
  impact: number;
  reason: string | null;
  metadata: Record<string, any>;
  created_at: Date;
}
