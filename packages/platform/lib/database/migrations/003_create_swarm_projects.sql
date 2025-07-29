-- Migration: Create swarm projects table for SwarmOrchestratorService
-- This table stores project state for N-engineer swarms managed via E2BAgentOrchestrator

-- Create swarm_projects table
CREATE TABLE IF NOT EXISTS swarm_projects (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(100) NOT NULL,
    specification JSONB NOT NULL,
    
    -- E2B integration fields
    task_id VARCHAR(255) NOT NULL UNIQUE,
    repository_url TEXT,
    
    -- Project lifecycle
    current_phase VARCHAR(50) NOT NULL DEFAULT 'analysis',
    status VARCHAR(50) NOT NULL DEFAULT 'initializing',
    
    -- Progress tracking (stored as JSONB for flexibility)
    progress JSONB NOT NULL DEFAULT '{"overall": 0, "analysis": 0, "planning": 0, "development": 0, "testing": 0, "deployment": 0}',
    
    -- Timeline management
    timeline JSONB NOT NULL DEFAULT '{"estimatedCompletion": null, "actualCompletion": null, "milestones": []}',
    
    -- Generated artifacts
    artifacts JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create swarm_project_agents table to track active agents per project
CREATE TABLE IF NOT EXISTS swarm_project_agents (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL REFERENCES swarm_projects(id) ON DELETE CASCADE,
    agent_id VARCHAR(255) NOT NULL,
    sandbox_id VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    specialization VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'initializing',
    
    -- Agent metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(project_id, agent_id)
);

-- Create swarm_project_tasks table for task tracking
CREATE TABLE IF NOT EXISTS swarm_project_tasks (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL REFERENCES swarm_projects(id) ON DELETE CASCADE,
    task_id VARCHAR(255) NOT NULL,
    agent_id VARCHAR(255),
    
    -- Task details
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    priority VARCHAR(50) NOT NULL DEFAULT 'medium',
    
    -- Task data
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB,
    dependencies JSONB NOT NULL DEFAULT '[]',
    
    -- Timing
    estimated_duration INTEGER, -- in minutes
    actual_duration INTEGER,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(project_id, task_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_swarm_projects_user_id ON swarm_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_swarm_projects_status ON swarm_projects(status);
CREATE INDEX IF NOT EXISTS idx_swarm_projects_current_phase ON swarm_projects(current_phase);
CREATE INDEX IF NOT EXISTS idx_swarm_projects_task_id ON swarm_projects(task_id);
CREATE INDEX IF NOT EXISTS idx_swarm_projects_created_at ON swarm_projects(created_at);

CREATE INDEX IF NOT EXISTS idx_swarm_project_agents_project_id ON swarm_project_agents(project_id);
CREATE INDEX IF NOT EXISTS idx_swarm_project_agents_status ON swarm_project_agents(status);
CREATE INDEX IF NOT EXISTS idx_swarm_project_agents_role ON swarm_project_agents(role);

CREATE INDEX IF NOT EXISTS idx_swarm_project_tasks_project_id ON swarm_project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_swarm_project_tasks_agent_id ON swarm_project_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_swarm_project_tasks_status ON swarm_project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_swarm_project_tasks_type ON swarm_project_tasks(type);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_swarm_projects_updated_at 
    BEFORE UPDATE ON swarm_projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_swarm_project_agents_updated_at 
    BEFORE UPDATE ON swarm_project_agents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_swarm_project_tasks_updated_at 
    BEFORE UPDATE ON swarm_project_tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE swarm_projects IS 'Stores project state for N-engineer swarms managed via E2BAgentOrchestrator';
COMMENT ON COLUMN swarm_projects.task_id IS 'References the E2B task ID for agent coordination';
COMMENT ON COLUMN swarm_projects.progress IS 'JSON object tracking progress percentages for each phase';
COMMENT ON COLUMN swarm_projects.timeline IS 'JSON object with estimated and actual completion dates plus milestones';
COMMENT ON COLUMN swarm_projects.artifacts IS 'JSON object storing generated project artifacts (code, docs, tests, etc.)';

COMMENT ON TABLE swarm_project_agents IS 'Tracks active agents working on swarm projects';
COMMENT ON COLUMN swarm_project_agents.sandbox_id IS 'E2B sandbox identifier for the agent';
COMMENT ON COLUMN swarm_project_agents.specialization IS 'Agent specialization (frontend, backend, testing, etc.)';

COMMENT ON TABLE swarm_project_tasks IS 'Individual tasks assigned to agents within swarm projects';
COMMENT ON COLUMN swarm_project_tasks.dependencies IS 'JSON array of task IDs that must complete before this task';
COMMENT ON COLUMN swarm_project_tasks.estimated_duration IS 'Estimated time to complete task in minutes';
COMMENT ON COLUMN swarm_project_tasks.actual_duration IS 'Actual time taken to complete task in minutes';