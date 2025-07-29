-- Autocoder Projects Table
CREATE TABLE IF NOT EXISTS autocoder_projects (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('mcp', 'plugin', 'service')),
  status VARCHAR(50) NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'building', 'testing', 'completed', 'failed')),
  specification JSONB,
  build_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for autocoder_projects
CREATE INDEX IF NOT EXISTS idx_autocoder_projects_user_id ON autocoder_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_autocoder_projects_status ON autocoder_projects(status);
CREATE INDEX IF NOT EXISTS idx_autocoder_projects_type ON autocoder_projects(type);
CREATE INDEX IF NOT EXISTS idx_autocoder_projects_updated_at ON autocoder_projects(updated_at);

-- Autocoder Messages Table (for agent conversations)
CREATE TABLE IF NOT EXISTS autocoder_messages (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES autocoder_projects(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('user', 'agent', 'system')),
  message TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB
);

-- Indexes for autocoder_messages
CREATE INDEX IF NOT EXISTS idx_autocoder_messages_project_id ON autocoder_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_autocoder_messages_user_id ON autocoder_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_autocoder_messages_timestamp ON autocoder_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_autocoder_messages_type ON autocoder_messages(type);

-- Autocoder Builds Table (for tracking build jobs)
CREATE TABLE IF NOT EXISTS autocoder_builds (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES autocoder_projects(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  specification JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  result JSONB,
  error TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for autocoder_builds
CREATE INDEX IF NOT EXISTS idx_autocoder_builds_project_id ON autocoder_builds(project_id);
CREATE INDEX IF NOT EXISTS idx_autocoder_builds_user_id ON autocoder_builds(user_id);
CREATE INDEX IF NOT EXISTS idx_autocoder_builds_status ON autocoder_builds(status);
CREATE INDEX IF NOT EXISTS idx_autocoder_builds_created_at ON autocoder_builds(created_at);

-- Autocoder Build Logs Table (for real-time build logging)
CREATE TABLE IF NOT EXISTS autocoder_build_logs (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES autocoder_projects(id) ON DELETE CASCADE,
  build_id VARCHAR(255) REFERENCES autocoder_builds(id) ON DELETE CASCADE,
  level VARCHAR(10) NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug')),
  message TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source VARCHAR(100) DEFAULT 'autocoder'
);

-- Indexes for autocoder_build_logs
CREATE INDEX IF NOT EXISTS idx_autocoder_build_logs_project_id ON autocoder_build_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_autocoder_build_logs_build_id ON autocoder_build_logs(build_id);
CREATE INDEX IF NOT EXISTS idx_autocoder_build_logs_level ON autocoder_build_logs(level);
CREATE INDEX IF NOT EXISTS idx_autocoder_build_logs_timestamp ON autocoder_build_logs(timestamp);

-- Autocoder Registry Table (for plugin publishing)
CREATE TABLE IF NOT EXISTS autocoder_registry (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES autocoder_projects(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version VARCHAR(50) NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT FALSE,
  github_url TEXT,
  npm_url TEXT,
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0.0,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for autocoder_registry
CREATE INDEX IF NOT EXISTS idx_autocoder_registry_user_id ON autocoder_registry(user_id);
CREATE INDEX IF NOT EXISTS idx_autocoder_registry_name ON autocoder_registry(name);
CREATE INDEX IF NOT EXISTS idx_autocoder_registry_is_public ON autocoder_registry(is_public);
CREATE INDEX IF NOT EXISTS idx_autocoder_registry_published_at ON autocoder_registry(published_at);
CREATE INDEX IF NOT EXISTS idx_autocoder_registry_downloads ON autocoder_registry(downloads);
CREATE INDEX IF NOT EXISTS idx_autocoder_registry_rating ON autocoder_registry(rating);

-- GIN index for tags array search
CREATE INDEX IF NOT EXISTS idx_autocoder_registry_tags ON autocoder_registry USING GIN(tags);

-- Autocoder Sessions Table (for E2B container sessions)
CREATE TABLE IF NOT EXISTS autocoder_sessions (
  id VARCHAR(255) PRIMARY KEY,
  project_id VARCHAR(255) REFERENCES autocoder_projects(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('build', 'live-test')),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'terminated')),
  e2b_session_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 minutes')
);

-- Indexes for autocoder_sessions
CREATE INDEX IF NOT EXISTS idx_autocoder_sessions_user_id ON autocoder_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_autocoder_sessions_project_id ON autocoder_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_autocoder_sessions_status ON autocoder_sessions(status);
CREATE INDEX IF NOT EXISTS idx_autocoder_sessions_expires_at ON autocoder_sessions(expires_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic updated_at updates
DROP TRIGGER IF EXISTS update_autocoder_projects_updated_at ON autocoder_projects;
CREATE TRIGGER update_autocoder_projects_updated_at 
    BEFORE UPDATE ON autocoder_projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_autocoder_registry_updated_at ON autocoder_registry;
CREATE TRIGGER update_autocoder_registry_updated_at 
    BEFORE UPDATE ON autocoder_registry 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM autocoder_sessions 
    WHERE status = 'active' AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE autocoder_projects IS 'Stores autocoder project information and build results';
COMMENT ON TABLE autocoder_messages IS 'Stores conversation messages between users and AI agents';
COMMENT ON TABLE autocoder_builds IS 'Tracks individual build jobs and their status';
COMMENT ON TABLE autocoder_build_logs IS 'Real-time build logs for monitoring progress';
COMMENT ON TABLE autocoder_registry IS 'Registry for published plugins and their metadata';
COMMENT ON TABLE autocoder_sessions IS 'Manages E2B container sessions for builds and testing';

COMMENT ON COLUMN autocoder_projects.specification IS 'JSON specification containing features, dependencies, tests, etc.';
COMMENT ON COLUMN autocoder_projects.build_result IS 'JSON containing generated files, tests, and quality metrics';
COMMENT ON COLUMN autocoder_messages.metadata IS 'Additional message metadata like step, progress, capabilities';
COMMENT ON COLUMN autocoder_builds.result IS 'Final build result with files, tests, and artifacts';
COMMENT ON COLUMN autocoder_registry.tags IS 'Array of tags for plugin discoverability';
COMMENT ON COLUMN autocoder_sessions.metadata IS 'Session-specific metadata and configuration';