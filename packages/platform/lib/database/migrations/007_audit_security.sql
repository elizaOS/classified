-- Migration 007: Audit Logs and Security Features
-- Create comprehensive audit logging and security tracking tables

-- Audit logs table for comprehensive security monitoring
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    entity_id UUID,
    entity_type VARCHAR(50),
    details JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security events table for real-time monitoring
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    source_ip INET,
    user_agent TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    details JSONB NOT NULL DEFAULT '{}',
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Failed login attempts tracking
CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255),
    ip_address INET NOT NULL,
    user_agent TEXT,
    attempt_count INTEGER DEFAULT 1,
    first_attempt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_attempt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    blocked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rate limit tracking
CREATE TABLE IF NOT EXISTS rate_limit_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_identifier VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    endpoint VARCHAR(255),
    limit_type VARCHAR(50) NOT NULL,
    limit_value INTEGER NOT NULL,
    current_count INTEGER NOT NULL,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API key usage tracking
CREATE TABLE IF NOT EXISTS api_key_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    response_status INTEGER,
    response_time_ms INTEGER,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session security tracking
CREATE TABLE IF NOT EXISTS session_security (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    user_agent TEXT,
    location_country VARCHAR(2),
    location_city VARCHAR(100),
    is_suspicious BOOLEAN DEFAULT FALSE,
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    security_flags JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data access logs for sensitive operations
CREATE TABLE IF NOT EXISTS data_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    operation VARCHAR(50) NOT NULL,
    access_level VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    data_size_bytes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security configurations per organization
CREATE TABLE IF NOT EXISTS security_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    config_type VARCHAR(100) NOT NULL,
    config_data JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, config_type)
);

-- Compliance audit trails
CREATE TABLE IF NOT EXISTS compliance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    compliance_type VARCHAR(50) NOT NULL, -- GDPR, SOC2, HIPAA, etc.
    event_type VARCHAR(100) NOT NULL,
    subject_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    data_subject_id VARCHAR(255), -- External identifier for data subject
    action_taken TEXT NOT NULL,
    legal_basis TEXT,
    retention_period INTEGER, -- Days to retain data
    details JSONB DEFAULT '{}',
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_created ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_organization ON security_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity_unresolved ON security_events(severity, resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_source_ip ON security_events(source_ip);

CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_email ON failed_login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_ip ON failed_login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_blocked ON failed_login_attempts(blocked_until) WHERE blocked_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_key ON rate_limit_violations(key_identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_ip ON rate_limit_violations(ip_address);
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_window ON rate_limit_violations(window_start, window_end);

CREATE INDEX IF NOT EXISTS idx_api_key_usage_key_created ON api_key_usage(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_organization ON api_key_usage(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_endpoint ON api_key_usage(endpoint);

CREATE INDEX IF NOT EXISTS idx_session_security_user ON session_security(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_security_suspicious ON session_security(is_suspicious, risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_session_security_ip ON session_security(ip_address);

CREATE INDEX IF NOT EXISTS idx_data_access_logs_user ON data_access_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_resource ON data_access_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_data_access_logs_organization ON data_access_logs(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_configurations_org ON security_configurations(organization_id, config_type);

CREATE INDEX IF NOT EXISTS idx_compliance_events_organization ON compliance_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_events_type ON compliance_events(compliance_type, event_type);
CREATE INDEX IF NOT EXISTS idx_compliance_events_subject ON compliance_events(data_subject_id);

-- Create partitions for high-volume tables (optional, for large deployments)
-- These would typically be created by a partition management system

-- Function to clean up old audit logs (data retention)
CREATE OR REPLACE FUNCTION cleanup_old_audit_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete audit logs older than 2 years
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - INTERVAL '2 years';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old rate limit violations (keep 30 days)
    DELETE FROM rate_limit_violations 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Delete old failed login attempts (keep 90 days)
    DELETE FROM failed_login_attempts 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Delete old API key usage logs (keep 1 year)
    DELETE FROM api_key_usage 
    WHERE created_at < NOW() - INTERVAL '1 year';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update security risk scores
CREATE OR REPLACE FUNCTION update_security_risk_score(
    p_user_id UUID,
    p_organization_id UUID,
    p_ip_address INET,
    p_user_agent TEXT
)
RETURNS INTEGER AS $$
DECLARE
    risk_score INTEGER := 0;
    failed_attempts INTEGER;
    suspicious_activity INTEGER;
    location_changes INTEGER;
BEGIN
    -- Calculate risk score based on various factors
    
    -- Check recent failed login attempts
    SELECT COUNT(*) INTO failed_attempts
    FROM failed_login_attempts 
    WHERE (email = (SELECT email FROM users WHERE id = p_user_id) OR ip_address = p_ip_address)
    AND last_attempt > NOW() - INTERVAL '24 hours';
    
    risk_score := risk_score + (failed_attempts * 10);
    
    -- Check for suspicious security events
    SELECT COUNT(*) INTO suspicious_activity
    FROM security_events 
    WHERE (user_id = p_user_id OR source_ip = p_ip_address)
    AND severity IN ('high', 'critical')
    AND created_at > NOW() - INTERVAL '7 days';
    
    risk_score := risk_score + (suspicious_activity * 15);
    
    -- Check for rapid location changes (different IPs)
    SELECT COUNT(DISTINCT ip_address) INTO location_changes
    FROM session_security 
    WHERE user_id = p_user_id 
    AND created_at > NOW() - INTERVAL '1 hour';
    
    IF location_changes > 3 THEN
        risk_score := risk_score + 20;
    END IF;
    
    -- Cap risk score at 100
    risk_score := LEAST(risk_score, 100);
    
    RETURN risk_score;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update session security risk scores
CREATE OR REPLACE FUNCTION update_session_risk_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.risk_score := update_security_risk_score(
        NEW.user_id,
        NEW.organization_id,
        NEW.ip_address,
        NEW.user_agent
    );
    
    -- Mark as suspicious if risk score is high
    IF NEW.risk_score >= 70 THEN
        NEW.is_suspicious := TRUE;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_security_risk_update
    BEFORE INSERT OR UPDATE ON session_security
    FOR EACH ROW
    EXECUTE FUNCTION update_session_risk_trigger();

-- Views for common security queries
CREATE OR REPLACE VIEW security_dashboard AS
SELECT 
    o.name AS organization_name,
    COUNT(CASE WHEN se.severity = 'critical' AND se.created_at > NOW() - INTERVAL '24 hours' THEN 1 END) AS critical_events_24h,
    COUNT(CASE WHEN se.severity = 'high' AND se.created_at > NOW() - INTERVAL '24 hours' THEN 1 END) AS high_events_24h,
    COUNT(CASE WHEN fla.last_attempt > NOW() - INTERVAL '1 hour' THEN 1 END) AS failed_logins_1h,
    COUNT(CASE WHEN ss.is_suspicious AND ss.created_at > NOW() - INTERVAL '24 hours' THEN 1 END) AS suspicious_sessions_24h,
    MAX(se.created_at) AS last_security_event
FROM organizations o
LEFT JOIN security_events se ON o.id = se.organization_id
LEFT JOIN failed_login_attempts fla ON fla.created_at > NOW() - INTERVAL '24 hours'
LEFT JOIN session_security ss ON o.id = ss.organization_id
GROUP BY o.id, o.name;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON audit_logs TO platform_user;
GRANT SELECT, INSERT, UPDATE ON security_events TO platform_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON failed_login_attempts TO platform_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limit_violations TO platform_user;
GRANT SELECT, INSERT ON api_key_usage TO platform_user;
GRANT SELECT, INSERT, UPDATE ON session_security TO platform_user;
GRANT SELECT, INSERT ON data_access_logs TO platform_user;
GRANT SELECT, INSERT, UPDATE ON security_configurations TO platform_user;
GRANT SELECT, INSERT ON compliance_events TO platform_user;
GRANT SELECT ON security_dashboard TO platform_user;
GRANT EXECUTE ON FUNCTION cleanup_old_audit_data() TO platform_user;
GRANT EXECUTE ON FUNCTION update_security_risk_score(UUID, UUID, INET, TEXT) TO platform_user;