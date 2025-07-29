-- ElizaOS Platform Authentication System Enhancements
-- Migration 0002: OAuth 2.0 Client Management, Device Authorization, and Rate Limiting

-- Device authorization codes for OAuth 2.0 Device Flow
CREATE TABLE IF NOT EXISTS device_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- OAuth 2.0 Device Flow fields
    device_code TEXT NOT NULL UNIQUE,
    user_code TEXT NOT NULL UNIQUE,
    client_id TEXT NOT NULL,
    scope TEXT NOT NULL,
    
    -- Timing and expiration
    expires_at TIMESTAMP NOT NULL,
    interval INTEGER NOT NULL DEFAULT 5, -- Polling interval in seconds
    
    -- Authorization status
    is_authorized BOOLEAN NOT NULL DEFAULT false,
    authorized_at TIMESTAMP,
    authorized_by_user_id UUID REFERENCES users(id),
    
    -- Access token (stored when authorization completes)
    access_token TEXT,
    
    -- Metadata
    user_agent TEXT,
    ip_address TEXT,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Rate limiting storage for production use
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Rate limiting key (IP + endpoint combination)
    limit_key TEXT NOT NULL UNIQUE,
    
    -- Counters and timing
    request_count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMP NOT NULL DEFAULT NOW(),
    window_end TIMESTAMP NOT NULL,
    
    -- Configuration
    max_requests INTEGER NOT NULL,
    window_duration INTEGER NOT NULL, -- seconds
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- OAuth 2.0 Client Configurations for configurable client management
CREATE TABLE IF NOT EXISTS oauth_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Client identification
    client_id TEXT NOT NULL UNIQUE,
    client_secret TEXT, -- For confidential clients
    client_name TEXT NOT NULL,
    client_description TEXT,
    
    -- Client type and configuration
    client_type TEXT NOT NULL DEFAULT 'public', -- public, confidential
    grant_types JSONB NOT NULL DEFAULT '["authorization_code", "device_code"]',
    scopes JSONB NOT NULL DEFAULT '["read", "write"]',
    
    -- Redirect URIs for authorization code flow
    redirect_uris JSONB NOT NULL DEFAULT '[]',
    
    -- Client metadata
    logo_url TEXT,
    homepage_url TEXT,
    terms_url TEXT,
    privacy_url TEXT,
    
    -- Security settings
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_trusted BOOLEAN NOT NULL DEFAULT false, -- Skip consent for trusted clients
    allowed_origins JSONB NOT NULL DEFAULT '[]',
    
    -- Usage tracking
    last_used_at TIMESTAMP,
    usage_count INTEGER NOT NULL DEFAULT 0,
    
    -- Access token settings
    access_token_ttl INTEGER NOT NULL DEFAULT 3600, -- seconds
    refresh_token_ttl INTEGER NOT NULL DEFAULT 86400, -- seconds
    
    metadata JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add missing tables for ElizaOS runtime integration
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    title TEXT,
    participant_ids JSONB NOT NULL DEFAULT '[]',
    
    -- Context and settings
    context JSONB NOT NULL DEFAULT '{}',
    settings JSONB NOT NULL DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_message_at TIMESTAMP,
    message_count INTEGER NOT NULL DEFAULT 0,
    
    metadata JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Message content
    content JSONB NOT NULL,
    
    -- Message metadata
    role TEXT NOT NULL, -- 'user', 'agent', 'system'
    parent_message_id UUID REFERENCES messages(id),
    embedding TEXT, -- Vector embedding as JSON string
    
    -- Processing information
    token_count INTEGER NOT NULL DEFAULT 0,
    cost DECIMAL(10,6) NOT NULL DEFAULT 0,
    processing_time INTEGER NOT NULL DEFAULT 0, -- milliseconds
    
    metadata JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Memory content
    content JSONB NOT NULL,
    
    -- Vector search
    embedding TEXT, -- Vector embedding as JSON string
    similarity DECIMAL(5,4),
    
    -- Memory type and importance
    type TEXT NOT NULL DEFAULT 'conversation', -- conversation, fact, preference, skill
    importance INTEGER NOT NULL DEFAULT 5, -- 1-10 scale
    is_unique BOOLEAN NOT NULL DEFAULT false,
    
    -- Context
    room_id TEXT, -- ElizaOS room identifier
    world_id TEXT, -- ElizaOS world identifier
    entity_id TEXT, -- Associated entity
    
    metadata JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Entity information
    name TEXT NOT NULL,
    names JSONB NOT NULL DEFAULT '[]', -- Alternative names
    type TEXT NOT NULL DEFAULT 'person', -- person, place, thing, concept
    
    -- Entity data
    components JSONB NOT NULL DEFAULT '[]',
    
    -- Relationships and context
    relationship_summary TEXT,
    last_interaction_at TIMESTAMP,
    interaction_count INTEGER NOT NULL DEFAULT 0,
    
    metadata JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT entities_agent_name_unique UNIQUE (agent_id, name)
);

CREATE TABLE IF NOT EXISTS agent_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES users(id),
    
    -- Task information
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL, -- scheduled, recurring, one_time
    
    -- Task configuration
    room_id TEXT,
    tags JSONB NOT NULL DEFAULT '[]',
    
    -- Execution settings
    scheduled_for TIMESTAMP,
    recurring_interval INTEGER, -- seconds
    max_retries INTEGER NOT NULL DEFAULT 3,
    retry_count INTEGER NOT NULL DEFAULT 0,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
    last_executed_at TIMESTAMP,
    next_execution_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Results
    result JSONB,
    error_message TEXT,
    
    metadata JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    
    -- Provider and model information
    provider TEXT NOT NULL, -- openai, anthropic, r2, etc.
    model TEXT NOT NULL, -- gpt-4o-mini, claude-3-sonnet, storage, etc.
    
    -- Usage metrics
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    
    -- Cost and billing
    cost DECIMAL(10,6) NOT NULL,
    duration INTEGER NOT NULL, -- milliseconds
    
    -- Status and error tracking
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    
    -- Request context
    ip_address TEXT,
    user_agent TEXT,
    request_id TEXT,
    
    -- Additional metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance on new tables

-- Device codes indexes
CREATE INDEX IF NOT EXISTS device_codes_device_code_idx ON device_codes(device_code);
CREATE INDEX IF NOT EXISTS device_codes_user_code_idx ON device_codes(user_code);
CREATE INDEX IF NOT EXISTS device_codes_client_id_idx ON device_codes(client_id);
CREATE INDEX IF NOT EXISTS device_codes_expires_at_idx ON device_codes(expires_at);
CREATE INDEX IF NOT EXISTS device_codes_is_authorized_idx ON device_codes(is_authorized);

-- Rate limits indexes
CREATE INDEX IF NOT EXISTS rate_limits_limit_key_idx ON rate_limits(limit_key);
CREATE INDEX IF NOT EXISTS rate_limits_window_end_idx ON rate_limits(window_end);

-- OAuth clients indexes
CREATE INDEX IF NOT EXISTS oauth_clients_client_id_idx ON oauth_clients(client_id);
CREATE INDEX IF NOT EXISTS oauth_clients_organization_id_idx ON oauth_clients(organization_id);
CREATE INDEX IF NOT EXISTS oauth_clients_is_active_idx ON oauth_clients(is_active);
CREATE INDEX IF NOT EXISTS oauth_clients_client_type_idx ON oauth_clients(client_type);

-- Conversations indexes
CREATE INDEX IF NOT EXISTS conversations_organization_id_idx ON conversations(organization_id);
CREATE INDEX IF NOT EXISTS conversations_agent_id_idx ON conversations(agent_id);
CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON conversations(user_id);
CREATE INDEX IF NOT EXISTS conversations_is_active_idx ON conversations(is_active);
CREATE INDEX IF NOT EXISTS conversations_last_message_at_idx ON conversations(last_message_at);

-- Messages indexes
CREATE INDEX IF NOT EXISTS messages_organization_id_idx ON messages(organization_id);
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_agent_id_idx ON messages(agent_id);
CREATE INDEX IF NOT EXISTS messages_user_id_idx ON messages(user_id);
CREATE INDEX IF NOT EXISTS messages_role_idx ON messages(role);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);
CREATE INDEX IF NOT EXISTS messages_parent_message_id_idx ON messages(parent_message_id);

-- Memories indexes
CREATE INDEX IF NOT EXISTS memories_organization_id_idx ON memories(organization_id);
CREATE INDEX IF NOT EXISTS memories_agent_id_idx ON memories(agent_id);
CREATE INDEX IF NOT EXISTS memories_user_id_idx ON memories(user_id);
CREATE INDEX IF NOT EXISTS memories_conversation_id_idx ON memories(conversation_id);
CREATE INDEX IF NOT EXISTS memories_type_idx ON memories(type);
CREATE INDEX IF NOT EXISTS memories_importance_idx ON memories(importance);
CREATE INDEX IF NOT EXISTS memories_room_id_idx ON memories(room_id);
CREATE INDEX IF NOT EXISTS memories_entity_id_idx ON memories(entity_id);
CREATE INDEX IF NOT EXISTS memories_created_at_idx ON memories(created_at);

-- Entities indexes
CREATE INDEX IF NOT EXISTS entities_organization_id_idx ON entities(organization_id);
CREATE INDEX IF NOT EXISTS entities_agent_id_idx ON entities(agent_id);
CREATE INDEX IF NOT EXISTS entities_user_id_idx ON entities(user_id);
CREATE INDEX IF NOT EXISTS entities_name_idx ON entities(name);
CREATE INDEX IF NOT EXISTS entities_type_idx ON entities(type);
CREATE INDEX IF NOT EXISTS entities_last_interaction_at_idx ON entities(last_interaction_at);

-- Agent tasks indexes
CREATE INDEX IF NOT EXISTS agent_tasks_organization_id_idx ON agent_tasks(organization_id);
CREATE INDEX IF NOT EXISTS agent_tasks_agent_id_idx ON agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS agent_tasks_status_idx ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS agent_tasks_scheduled_for_idx ON agent_tasks(scheduled_for);
CREATE INDEX IF NOT EXISTS agent_tasks_next_execution_at_idx ON agent_tasks(next_execution_at);
CREATE INDEX IF NOT EXISTS agent_tasks_room_id_idx ON agent_tasks(room_id);

-- Usage records indexes
CREATE INDEX IF NOT EXISTS usage_records_organization_id_idx ON usage_records(organization_id);
CREATE INDEX IF NOT EXISTS usage_records_api_key_id_idx ON usage_records(api_key_id);
CREATE INDEX IF NOT EXISTS usage_records_provider_idx ON usage_records(provider);
CREATE INDEX IF NOT EXISTS usage_records_created_at_idx ON usage_records(created_at);
CREATE INDEX IF NOT EXISTS usage_records_success_idx ON usage_records(success);
CREATE INDEX IF NOT EXISTS usage_records_org_provider_date_idx ON usage_records(organization_id, provider, created_at);

-- Add updated_at triggers for new tables with updated_at columns
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema = 'public'
        AND table_name IN ('device_codes', 'rate_limits', 'oauth_clients', 'conversations', 'messages', 'memories', 'entities', 'agent_tasks')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', t, t);
        EXECUTE format('CREATE TRIGGER update_%I_updated_at 
                       BEFORE UPDATE ON %I 
                       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END $$;

-- Seed default OAuth clients
INSERT INTO oauth_clients (
    client_id,
    client_name,
    client_description,
    client_type,
    grant_types,
    scopes,
    is_trusted,
    organization_id,
    metadata
) VALUES 
(
    'elizaos-cli',
    'ElizaOS CLI',
    'Official ElizaOS Command Line Interface',
    'public',
    '["device_code"]'::jsonb,
    '["read", "write", "agents:manage"]'::jsonb,
    true,
    NULL, -- Global client
    '{"version": "1.0.0", "official": true}'::jsonb
),
(
    'elizaos-web',
    'ElizaOS Web Platform',
    'Official ElizaOS Web Platform',
    'public',
    '["authorization_code", "device_code"]'::jsonb,
    '["read", "write", "agents:manage", "billing:manage"]'::jsonb,
    true,
    NULL, -- Global client
    '{"version": "1.0.0", "official": true}'::jsonb
)
ON CONFLICT (client_id) DO NOTHING;