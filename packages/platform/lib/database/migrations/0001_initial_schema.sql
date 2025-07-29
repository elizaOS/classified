-- ElizaOS Platform Initial Schema Migration
-- This migration creates the complete multi-tenant database schema

-- Create the authenticated role for RLS
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
    END IF;
END
$$;

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    domain TEXT,
    logo_url TEXT,
    subscription_tier TEXT NOT NULL DEFAULT 'free',
    subscription_status TEXT NOT NULL DEFAULT 'active',
    max_users INTEGER NOT NULL DEFAULT 5,
    max_agents INTEGER NOT NULL DEFAULT 3,
    max_api_requests INTEGER NOT NULL DEFAULT 10000,
    max_tokens_per_request INTEGER NOT NULL DEFAULT 4096,
    max_storage_gb INTEGER NOT NULL DEFAULT 1,
    
    -- WorkOS integration
    workos_organization_id TEXT UNIQUE,
    
    -- Billing
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    billing_email TEXT,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    
    -- Credits system
    credit_balance DECIMAL(10,6) NOT NULL DEFAULT 0,
    credit_threshold DECIMAL(10,6) NOT NULL DEFAULT 10,
    auto_top_up_enabled BOOLEAN NOT NULL DEFAULT false,
    auto_top_up_amount DECIMAL(10,6) NOT NULL DEFAULT 50,
    
    -- Settings
    settings JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- WorkOS user data
    workos_user_id TEXT UNIQUE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    profile_picture_url TEXT,
    
    -- Platform specific
    role TEXT NOT NULL DEFAULT 'member',
    is_active BOOLEAN NOT NULL DEFAULT true,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    email_verified_at TIMESTAMP,
    
    -- Preferences
    preferences JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT users_org_email_unique UNIQUE (organization_id, email)
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    refresh_token TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    last_active_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    
    -- Permissions and limits
    permissions JSONB NOT NULL DEFAULT '[]',
    rate_limit INTEGER NOT NULL DEFAULT 100,
    
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    usage_count INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT NOT NULL,
    avatar_url TEXT,
    
    -- Agent configuration
    character JSONB NOT NULL,
    plugins JSONB NOT NULL DEFAULT '[]',
    
    -- Runtime configuration
    runtime_config JSONB NOT NULL DEFAULT '{}',
    
    -- Deployment status
    deployment_status TEXT NOT NULL DEFAULT 'draft',
    deployment_url TEXT,
    deployment_error TEXT,
    last_deployed_at TIMESTAMP,
    
    -- Visibility and sharing
    visibility TEXT NOT NULL DEFAULT 'private',
    is_published BOOLEAN NOT NULL DEFAULT false,
    
    -- Analytics
    total_interactions INTEGER NOT NULL DEFAULT 0,
    total_cost DECIMAL(10,6) NOT NULL DEFAULT 0,
    
    metadata JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT agents_org_slug_unique UNIQUE (organization_id, slug)
);

-- Plugins table
CREATE TABLE IF NOT EXISTS plugins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL,
    author TEXT,
    repository_url TEXT,
    documentation_url TEXT,
    
    -- Package information
    npm_package TEXT,
    package_version TEXT,
    
    -- Security and approval
    is_approved BOOLEAN NOT NULL DEFAULT false,
    is_public BOOLEAN NOT NULL DEFAULT false,
    security_review_status TEXT NOT NULL DEFAULT 'pending',
    security_review_notes TEXT,
    
    -- Capabilities and requirements
    capabilities JSONB NOT NULL DEFAULT '[]',
    required_permissions JSONB NOT NULL DEFAULT '[]',
    dependencies JSONB NOT NULL DEFAULT '[]',
    
    -- Usage statistics
    install_count INTEGER NOT NULL DEFAULT 0,
    rating DECIMAL(3,2),
    
    metadata JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Organization plugins table
CREATE TABLE IF NOT EXISTS organization_plugins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
    
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    configuration JSONB NOT NULL DEFAULT '{}',
    permissions JSONB NOT NULL DEFAULT '[]',
    
    installed_by_user_id UUID REFERENCES users(id),
    installed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT organization_plugins_org_plugin_unique UNIQUE (organization_id, plugin_id)
);

-- Uploads table
CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    uploaded_by_user_id UUID NOT NULL REFERENCES users(id),
    
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    
    -- Storage information
    storage_provider TEXT NOT NULL DEFAULT 'r2',
    storage_path TEXT NOT NULL,
    storage_url TEXT,
    
    -- File metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Usage tracking
    download_count INTEGER NOT NULL DEFAULT 0,
    is_public BOOLEAN NOT NULL DEFAULT false,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Credit transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    
    type TEXT NOT NULL,
    amount DECIMAL(10,6) NOT NULL,
    description TEXT NOT NULL,
    
    -- Payment information
    stripe_payment_intent_id TEXT,
    stripe_charge_id TEXT,
    crypto_transaction_hash TEXT,
    payment_method TEXT,
    
    -- Usage context
    agent_id UUID REFERENCES agents(id),
    usage_record_id TEXT,
    
    -- Balance tracking
    balance_after DECIMAL(10,6) NOT NULL,
    
    metadata JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id UUID,
    
    -- Request context
    ip_address TEXT,
    user_agent TEXT,
    request_id TEXT,
    
    -- Changes
    old_values JSONB,
    new_values JSONB,
    
    metadata JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    
    -- Event configuration
    events JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Delivery status
    last_delivery_at TIMESTAMP,
    last_delivery_status TEXT,
    failure_count INTEGER NOT NULL DEFAULT 0,
    
    metadata JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS organizations_slug_idx ON organizations(slug);
CREATE INDEX IF NOT EXISTS organizations_workos_org_idx ON organizations(workos_organization_id);
CREATE INDEX IF NOT EXISTS organizations_stripe_customer_idx ON organizations(stripe_customer_id);

CREATE INDEX IF NOT EXISTS users_organization_id_idx ON users(organization_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_workos_user_idx ON users(workos_user_id);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_sessions_session_token_idx ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS user_sessions_refresh_token_idx ON user_sessions(refresh_token);

CREATE INDEX IF NOT EXISTS api_keys_organization_id_idx ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys(user_id);

CREATE INDEX IF NOT EXISTS agents_organization_id_idx ON agents(organization_id);
CREATE INDEX IF NOT EXISTS agents_created_by_user_idx ON agents(created_by_user_id);
CREATE INDEX IF NOT EXISTS agents_deployment_status_idx ON agents(deployment_status);
CREATE INDEX IF NOT EXISTS agents_visibility_idx ON agents(visibility);

CREATE INDEX IF NOT EXISTS plugins_name_idx ON plugins(name);
CREATE INDEX IF NOT EXISTS plugins_is_approved_idx ON plugins(is_approved);
CREATE INDEX IF NOT EXISTS plugins_is_public_idx ON plugins(is_public);

CREATE INDEX IF NOT EXISTS organization_plugins_organization_id_idx ON organization_plugins(organization_id);
CREATE INDEX IF NOT EXISTS organization_plugins_plugin_id_idx ON organization_plugins(plugin_id);

CREATE INDEX IF NOT EXISTS uploads_organization_id_idx ON uploads(organization_id);
CREATE INDEX IF NOT EXISTS uploads_uploaded_by_user_idx ON uploads(uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS uploads_storage_path_idx ON uploads(storage_path);
CREATE INDEX IF NOT EXISTS uploads_mime_type_idx ON uploads(mime_type);

CREATE INDEX IF NOT EXISTS credit_transactions_organization_id_idx ON credit_transactions(organization_id);
CREATE INDEX IF NOT EXISTS credit_transactions_type_idx ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS credit_transactions_created_at_idx ON credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS credit_transactions_stripe_payment_intent_idx ON credit_transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS credit_transactions_agent_id_idx ON credit_transactions(agent_id);

CREATE INDEX IF NOT EXISTS audit_logs_organization_id_idx ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS webhooks_organization_id_idx ON webhooks(organization_id);
CREATE INDEX IF NOT EXISTS webhooks_created_by_user_idx ON webhooks(created_by_user_id);
CREATE INDEX IF NOT EXISTS webhooks_is_active_idx ON webhooks(is_active);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to tables that have updated_at columns
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', t, t);
        EXECUTE format('CREATE TRIGGER update_%I_updated_at 
                       BEFORE UPDATE ON %I 
                       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END $$;