import { UUID } from '@elizaos/core';

// Type definitions for E2BAgentOrchestrator types
// These are copied from the autocoder plugin since they're not exported

export interface GitCredentials {
  githubToken?: string;
  username?: string;
  email?: string;
}

export interface ProjectContext {
  repositoryUrl: string;
  projectType: string;
}

export interface E2BAgentRequest {
  role: 'coder' | 'reviewer' | 'tester';
  taskId: UUID;
  requirements: string[];
  gitCredentials?: GitCredentials;
  projectContext?: ProjectContext;
  priority: 'low' | 'medium' | 'high';
  specialization?: string;
}

export interface E2BAgentHandle {
  agentId: UUID;
  sandboxId: string;
  role: string;
  status: 'initializing' | 'ready' | 'working' | 'failed' | 'terminated';
  specialization?: string;
}

export interface AutocodingPlan {
  totalSteps: number;
  completedSteps: number;
  currentPhase:
    | 'initialization'
    | 'planning'
    | 'development'
    | 'testing'
    | 'deployment';
  status: 'active' | 'completed' | 'failed';
}

export interface RoomState {
  plan?: AutocodingPlan;
  knowledge: Map<string, any>;
}

export interface ProjectRequirements {
  complexity: string;
  estimatedHours: number;
}

export interface ProjectTask {
  id: string;
  description: string;
  status: string;
}

// Interface for the E2BAgentOrchestrator service
export interface E2BAgentOrchestrator {
  spawnProjectTeam(
    description: string,
    gitCredentials?: GitCredentials,
  ): Promise<{
    taskId: UUID;
    repositoryUrl?: string;
    requirements: ProjectRequirements;
    agents: E2BAgentHandle[];
  }>;
  getRoomState(taskId: UUID): Promise<RoomState | null>;
  listTaskAgents(taskId: UUID): Promise<E2BAgentHandle[]>;
  spawnE2BAgent(request: E2BAgentRequest): Promise<E2BAgentHandle>;
  terminateAgent(sandboxId: string): Promise<void>;
  monitorAndRedistribute(taskId: UUID): Promise<void>;
}

// Interface for the ProjectComplexityEstimator service
export interface ProjectComplexityEstimator {
  estimateComplexity(description: string): Promise<ProjectRequirements>;
}
