-- Row Level Security (RLS) Policies for Multi-tenant ElizaOS Platform
-- These policies ensure organizations can only access their own data

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

-- Create a function to get the current organization ID from the session
CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS UUID AS $$
BEGIN
  -- This will be set by the application when establishing a database session
  -- using SET SESSION "app.current_organization_id" = 'uuid'
  RETURN NULLIF(current_setting('app.current_organization_id', true), '')::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get the current user ID from the session
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '')::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if current user is admin/owner
CREATE OR REPLACE FUNCTION current_user_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(current_setting('app.current_user_is_admin', true)::boolean, false);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organizations table policies
-- Users can only see their own organization
DROP POLICY IF EXISTS organizations_tenant_isolation ON organizations;
CREATE POLICY organizations_tenant_isolation ON organizations
  FOR ALL
  TO authenticated
  USING (id = current_organization_id());

-- Users table policies
-- Users can only see users from their organization
DROP POLICY IF EXISTS users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation ON users
  FOR ALL
  TO authenticated
  USING (organization_id = current_organization_id());

-- Additional policy for users to always see their own record
DROP POLICY IF EXISTS users_own_record ON users;
CREATE POLICY users_own_record ON users
  FOR ALL
  TO authenticated
  USING (id = current_user_id());

-- User sessions policies
-- Users can only access their own sessions
DROP POLICY IF EXISTS user_sessions_own_records ON user_sessions;
CREATE POLICY user_sessions_own_records ON user_sessions
  FOR ALL
  TO authenticated
  USING (
    user_id = current_user_id() 
    OR organization_id = current_organization_id()
  );

-- API Keys policies
-- Users can see API keys from their organization
-- But can only modify their own API keys unless they're admin
DROP POLICY IF EXISTS api_keys_tenant_isolation ON api_keys;
CREATE POLICY api_keys_tenant_isolation ON api_keys
  FOR SELECT
  TO authenticated
  USING (organization_id = current_organization_id());

DROP POLICY IF EXISTS api_keys_own_insert ON api_keys;
CREATE POLICY api_keys_own_insert ON api_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = current_organization_id() 
    AND (user_id = current_user_id() OR current_user_is_admin())
  );

DROP POLICY IF EXISTS api_keys_own_update ON api_keys;
CREATE POLICY api_keys_own_update ON api_keys
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = current_organization_id() 
    AND (user_id = current_user_id() OR current_user_is_admin())
  )
  WITH CHECK (
    organization_id = current_organization_id() 
    AND (user_id = current_user_id() OR current_user_is_admin())
  );

DROP POLICY IF EXISTS api_keys_own_delete ON api_keys;
CREATE POLICY api_keys_own_delete ON api_keys
  FOR DELETE
  TO authenticated
  USING (
    organization_id = current_organization_id() 
    AND (user_id = current_user_id() OR current_user_is_admin())
  );

-- Agents policies
-- Users can see all agents in their organization
-- But can only modify agents they created unless they're admin
DROP POLICY IF EXISTS agents_tenant_isolation ON agents;
CREATE POLICY agents_tenant_isolation ON agents
  FOR SELECT
  TO authenticated
  USING (organization_id = current_organization_id());

DROP POLICY IF EXISTS agents_insert_own ON agents;
CREATE POLICY agents_insert_own ON agents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = current_organization_id() 
    AND (created_by_user_id = current_user_id() OR current_user_is_admin())
  );

DROP POLICY IF EXISTS agents_update_own ON agents;
CREATE POLICY agents_update_own ON agents
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = current_organization_id() 
    AND (created_by_user_id = current_user_id() OR current_user_is_admin())
  )
  WITH CHECK (
    organization_id = current_organization_id() 
    AND (created_by_user_id = current_user_id() OR current_user_is_admin())
  );

DROP POLICY IF EXISTS agents_delete_own ON agents;
CREATE POLICY agents_delete_own ON agents
  FOR DELETE
  TO authenticated
  USING (
    organization_id = current_organization_id() 
    AND (created_by_user_id = current_user_id() OR current_user_is_admin())
  );

-- Organization plugins policies
-- Users can see plugins enabled for their organization
-- Only admins can modify plugin settings
DROP POLICY IF EXISTS organization_plugins_tenant_isolation ON organization_plugins;
CREATE POLICY organization_plugins_tenant_isolation ON organization_plugins
  FOR SELECT
  TO authenticated
  USING (organization_id = current_organization_id());

DROP POLICY IF EXISTS organization_plugins_insert_admin ON organization_plugins;
CREATE POLICY organization_plugins_insert_admin ON organization_plugins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = current_organization_id() 
    AND current_user_is_admin()
  );

DROP POLICY IF EXISTS organization_plugins_update_admin ON organization_plugins;
CREATE POLICY organization_plugins_update_admin ON organization_plugins
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = current_organization_id() 
    AND current_user_is_admin()
  )
  WITH CHECK (
    organization_id = current_organization_id() 
    AND current_user_is_admin()
  );

DROP POLICY IF EXISTS organization_plugins_delete_admin ON organization_plugins;
CREATE POLICY organization_plugins_delete_admin ON organization_plugins
  FOR DELETE
  TO authenticated
  USING (
    organization_id = current_organization_id() 
    AND current_user_is_admin()
  );

-- Uploads policies
-- Users can see all uploads in their organization
-- Can only modify their own uploads unless they're admin
DROP POLICY IF EXISTS uploads_tenant_isolation ON uploads;
CREATE POLICY uploads_tenant_isolation ON uploads
  FOR SELECT
  TO authenticated
  USING (organization_id = current_organization_id());

DROP POLICY IF EXISTS uploads_insert_own ON uploads;
CREATE POLICY uploads_insert_own ON uploads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = current_organization_id() 
    AND (uploaded_by_user_id = current_user_id() OR current_user_is_admin())
  );

DROP POLICY IF EXISTS uploads_update_own ON uploads;
CREATE POLICY uploads_update_own ON uploads
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = current_organization_id() 
    AND (uploaded_by_user_id = current_user_id() OR current_user_is_admin())
  )
  WITH CHECK (
    organization_id = current_organization_id() 
    AND (uploaded_by_user_id = current_user_id() OR current_user_is_admin())
  );

DROP POLICY IF EXISTS uploads_delete_own ON uploads;
CREATE POLICY uploads_delete_own ON uploads
  FOR DELETE
  TO authenticated
  USING (
    organization_id = current_organization_id() 
    AND (uploaded_by_user_id = current_user_id() OR current_user_is_admin())
  );

-- Credit transactions policies
-- Users can see all transactions in their organization (for transparency)
-- Only system can insert transactions
DROP POLICY IF EXISTS credit_transactions_tenant_isolation ON credit_transactions;
CREATE POLICY credit_transactions_tenant_isolation ON credit_transactions
  FOR SELECT
  TO authenticated
  USING (organization_id = current_organization_id());

DROP POLICY IF EXISTS credit_transactions_insert_admin ON credit_transactions;
CREATE POLICY credit_transactions_insert_admin ON credit_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = current_organization_id() 
    AND current_user_is_admin()
  );

DROP POLICY IF EXISTS credit_transactions_update_admin ON credit_transactions;
CREATE POLICY credit_transactions_update_admin ON credit_transactions
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = current_organization_id() 
    AND current_user_is_admin()
  )
  WITH CHECK (
    organization_id = current_organization_id() 
    AND current_user_is_admin()
  );

DROP POLICY IF EXISTS credit_transactions_delete_admin ON credit_transactions;
CREATE POLICY credit_transactions_delete_admin ON credit_transactions
  FOR DELETE
  TO authenticated
  USING (
    organization_id = current_organization_id() 
    AND current_user_is_admin()
  );

-- Audit logs policies
-- Only admins can see audit logs for their organization
DROP POLICY IF EXISTS audit_logs_admin_only ON audit_logs;
CREATE POLICY audit_logs_admin_only ON audit_logs
  FOR ALL
  TO authenticated
  USING (
    organization_id = current_organization_id() 
    AND current_user_is_admin()
  );

-- Webhooks policies
-- Users can see webhooks in their organization
-- Can only modify webhooks they created unless they're admin
DROP POLICY IF EXISTS webhooks_tenant_isolation ON webhooks;
CREATE POLICY webhooks_tenant_isolation ON webhooks
  FOR SELECT
  TO authenticated
  USING (organization_id = current_organization_id());

DROP POLICY IF EXISTS webhooks_insert_own ON webhooks;
CREATE POLICY webhooks_insert_own ON webhooks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = current_organization_id() 
    AND (created_by_user_id = current_user_id() OR current_user_is_admin())
  );

DROP POLICY IF EXISTS webhooks_update_own ON webhooks;
CREATE POLICY webhooks_update_own ON webhooks
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = current_organization_id() 
    AND (created_by_user_id = current_user_id() OR current_user_is_admin())
  )
  WITH CHECK (
    organization_id = current_organization_id() 
    AND (created_by_user_id = current_user_id() OR current_user_is_admin())
  );

DROP POLICY IF EXISTS webhooks_delete_own ON webhooks;
CREATE POLICY webhooks_delete_own ON webhooks
  FOR DELETE
  TO authenticated
  USING (
    organization_id = current_organization_id() 
    AND (created_by_user_id = current_user_id() OR current_user_is_admin())
  );

-- Grant permissions to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Create indexes for RLS performance
CREATE INDEX IF NOT EXISTS idx_users_org_id_user_id ON users(organization_id, id);
CREATE INDEX IF NOT EXISTS idx_agents_org_id_created_by ON agents(organization_id, created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id_user_id ON api_keys(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_uploads_org_id_user_id ON uploads(organization_id, uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_org_id_user_id ON webhooks(organization_id, created_by_user_id);

-- Comments for documentation
COMMENT ON FUNCTION current_organization_id() IS 'Returns the current organization ID from session context';
COMMENT ON FUNCTION current_user_id() IS 'Returns the current user ID from session context';
COMMENT ON FUNCTION current_user_is_admin() IS 'Returns true if current user has admin privileges';