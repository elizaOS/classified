-- Initialize ElizaOS Database with pgvector extension
-- This script runs when the PostgreSQL container starts for the first time

-- Create pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create schema for ElizaOS
CREATE SCHEMA IF NOT EXISTS eliza;

-- Set default search path
ALTER DATABASE eliza_game SET search_path TO eliza, public;

-- Create user for application if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'eliza_app') THEN
        CREATE ROLE eliza_app WITH LOGIN PASSWORD 'eliza_app_pass';
    END IF;
END
$$;

-- Grant permissions (initial)
GRANT USAGE ON SCHEMA eliza TO eliza_app;
GRANT CREATE ON SCHEMA eliza TO eliza_app;

-- Create core tables that ElizaOS expects
SET search_path TO eliza, public;

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enabled BOOLEAN DEFAULT true NOT NULL,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    name TEXT NOT NULL,
    username TEXT,
    system TEXT DEFAULT '',
    bio JSONB DEFAULT '[]'::jsonb,
    messageExamples JSONB DEFAULT '[]'::jsonb NOT NULL,
    postExamples JSONB DEFAULT '[]'::jsonb NOT NULL,
    topics JSONB DEFAULT '[]'::jsonb NOT NULL,
    adjectives JSONB DEFAULT '[]'::jsonb NOT NULL,
    knowledge JSONB DEFAULT '[]'::jsonb NOT NULL,
    plugins JSONB DEFAULT '[]'::jsonb NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb NOT NULL,
    style JSONB DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT name_unique UNIQUE (name)
);

-- Worlds table
CREATE TABLE IF NOT EXISTS worlds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agentId UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    metadata JSONB,
    serverId TEXT NOT NULL DEFAULT 'local',
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agentId UUID REFERENCES agents(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    type TEXT NOT NULL,
    serverId TEXT,
    worldId UUID,
    name TEXT,
    metadata JSONB,
    channelId TEXT,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Entities table
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY NOT NULL,
    agentId UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    names TEXT[] DEFAULT '{}'::text[] NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT id_agentId_unique UNIQUE (id, agentId)
);

-- Memories table (core ElizaOS table)
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    content JSONB NOT NULL,
    entityId UUID REFERENCES entities(id) ON DELETE CASCADE,
    agentId UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    roomId UUID REFERENCES rooms(id) ON DELETE CASCADE,
    worldId UUID,
    "unique" BOOLEAN DEFAULT true NOT NULL,
    metadata JSONB DEFAULT '{}' NOT NULL,
    embedding vector(1536)
);

-- Relationships table
CREATE TABLE IF NOT EXISTS relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sourceEntityId UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    targetEntityId UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    agentId UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    tags TEXT[],
    metadata JSONB,
    CONSTRAINT unique_relationship UNIQUE (sourceEntityId, targetEntityId, agentId)
);

-- Participants table
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entityId UUID REFERENCES entities(id) ON DELETE CASCADE,
    roomId UUID REFERENCES rooms(id) ON DELETE CASCADE,
    agentId UUID REFERENCES agents(id) ON DELETE CASCADE,
    roomState TEXT,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Components table
CREATE TABLE IF NOT EXISTS components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    entityId UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    agentId UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    roomId UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    worldId UUID REFERENCES worlds(id) ON DELETE CASCADE,
    sourceEntityId UUID REFERENCES entities(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Cache table
CREATE TABLE IF NOT EXISTS cache (
    key TEXT NOT NULL,
    agentId UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    value JSONB NOT NULL,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expiresAt TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (key, agentId)
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    roomId UUID,
    worldId UUID,
    entityId UUID,
    agentId UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    tags TEXT[] DEFAULT '{}'::text[],
    metadata JSONB DEFAULT '{}'::jsonb,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Logs table
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    entityId UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    body JSONB NOT NULL,
    type TEXT NOT NULL,
    roomId UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE
);

-- Goals table (for goals plugin)
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agentId UUID REFERENCES agents(id) ON DELETE CASCADE,
    roomId UUID REFERENCES rooms(id) ON DELETE CASCADE,
    entityId UUID REFERENCES entities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    objectives JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Todos table (for todo plugin)
CREATE TABLE IF NOT EXISTS todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agentId UUID REFERENCES agents(id) ON DELETE CASCADE,
    roomId UUID REFERENCES rooms(id) ON DELETE CASCADE,
    entityId UUID REFERENCES entities(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'medium',
    dueDate TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge documents table (for knowledge plugin)
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agentId UUID REFERENCES agents(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    filePath VARCHAR(500),
    mimeType VARCHAR(100),
    fileSize INTEGER,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_memories_entityId ON memories(entityId);
CREATE INDEX IF NOT EXISTS idx_memories_roomId ON memories(roomId);
CREATE INDEX IF NOT EXISTS idx_memories_worldId ON memories(worldId);
CREATE INDEX IF NOT EXISTS idx_memories_createdAt ON memories(createdAt);
CREATE INDEX IF NOT EXISTS idx_memories_type_room ON memories(type, roomId);
CREATE INDEX IF NOT EXISTS idx_memories_metadata_type ON memories((metadata->>'type'));
CREATE INDEX IF NOT EXISTS idx_memories_documentId ON memories((metadata->>'documentId'));
CREATE INDEX IF NOT EXISTS idx_fragments_order ON memories((metadata->>'documentId'), (metadata->>'position'));
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_entities_agentId ON entities(agentId);
CREATE INDEX IF NOT EXISTS idx_entities_names ON entities USING GIN(names);

CREATE INDEX IF NOT EXISTS idx_participants_entityId ON participants(entityId);
CREATE INDEX IF NOT EXISTS idx_participants_roomId ON participants(roomId);
CREATE INDEX IF NOT EXISTS idx_participants_agentId ON participants(agentId);

CREATE INDEX IF NOT EXISTS idx_relationships_users ON relationships(sourceEntityId, targetEntityId);

CREATE INDEX IF NOT EXISTS idx_goals_agentId ON goals(agentId);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_roomId ON goals(roomId);

CREATE INDEX IF NOT EXISTS idx_todos_agentId ON todos(agentId);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_roomId ON todos(roomId);

CREATE INDEX IF NOT EXISTS idx_knowledge_agentId ON knowledge_documents(agentId);
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding ON knowledge_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Add check constraints for memories table metadata validation
ALTER TABLE memories ADD CONSTRAINT fragment_metadata_check CHECK (
    CASE 
        WHEN metadata->>'type' = 'fragment' THEN
            metadata ? 'documentId' AND 
            metadata ? 'position'
        ELSE true
    END
);

ALTER TABLE memories ADD CONSTRAINT document_metadata_check CHECK (
    CASE 
        WHEN metadata->>'type' = 'document' THEN
            metadata ? 'timestamp'
        ELSE true
    END
);

-- Create triggers for updatedAt timestamps
CREATE OR REPLACE FUNCTION update_updatedAt_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedAt = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agents_updatedAt BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER update_entities_updatedAt BEFORE UPDATE ON entities FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER update_memories_updatedAt BEFORE UPDATE ON memories FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER update_relationships_updatedAt BEFORE UPDATE ON relationships FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER update_goals_updatedAt BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER update_todos_updatedAt BEFORE UPDATE ON todos FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
CREATE TRIGGER update_knowledge_updatedAt BEFORE UPDATE ON knowledge_documents FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();

-- Insert default admin user if not exists
INSERT INTO agents (id, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'SystemAdmin')
ON CONFLICT (id) DO NOTHING;

-- Insert default server agent if not exists  
INSERT INTO agents (id, name)
VALUES ('00000000-0000-0000-0000-000000000002', 'DefaultServerAgent')
ON CONFLICT (id) DO NOTHING;

-- Grant all permissions to eliza_app after all tables are created
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA eliza TO eliza_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA eliza TO eliza_app;
GRANT USAGE ON SCHEMA eliza TO eliza_app;
GRANT CREATE ON SCHEMA eliza TO eliza_app;

COMMENT ON DATABASE eliza_game IS 'ElizaOS Game Database with pgvector for embeddings';
COMMENT ON SCHEMA eliza IS 'Main schema for ElizaOS agent data';
COMMENT ON TABLE memories IS 'Core memory storage with vector embeddings for semantic search';
COMMENT ON TABLE entities IS 'Entities (users, agents, concepts) that can participate in conversations';
COMMENT ON TABLE goals IS 'Agent goals and objectives tracking';
COMMENT ON TABLE todos IS 'Task management for agents';
COMMENT ON TABLE knowledge_documents IS 'Document storage and retrieval system';