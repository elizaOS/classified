/**
 * SwarmOrchestratorService - Coordinates the N-Engineer Autocoder System
 *
 * This service integrates with the existing E2BAgentOrchestrator to coordinate
 * collaborative work of 1-50 specialized engineers based on project complexity.
 * It acts as a high-level coordinator for the platform's autocoder lander.
 */

import {
  IAgentRuntime,
  ModelType,
  Memory,
  State,
  Service,
  UUID,
  asUUID,
} from '@elizaos/core';
import { AutocoderAgentService } from './agent-service';
import { EnhancedAutocoderAgentService } from './enhanced-agent-service';
// Import types from local definitions
import type {
  E2BAgentRequest,
  E2BAgentHandle,
  GitCredentials,
  ProjectContext,
  RoomState,
  AutocodingPlan,
  ProjectRequirements,
  ProjectTask,
} from './types';
import { randomUUID } from 'crypto';
// Database removed - using agent memory for project storage

export interface SwarmProject {
  id: string;
  userId: string;
  name: string;
  description: string;
  type: string;
  specification: any;

  // Integration with E2B orchestration
  taskId: UUID;
  repositoryUrl?: string;
  projectRequirements?: ProjectRequirements;
  roomState?: RoomState;
  activeAgents: E2BAgentHandle[];

  // Project lifecycle
  currentPhase:
    | 'analysis'
    | 'planning'
    | 'development'
    | 'testing'
    | 'deployment'
    | 'completed';
  status: 'initializing' | 'active' | 'paused' | 'completed' | 'failed';

  // Progress tracking
  progress: {
    overall: number;
    analysis: number;
    planning: number;
    development: number;
    testing: number;
    deployment: number;
  };

  // Timeline management
  timeline: {
    estimatedCompletion: Date;
    actualCompletion?: Date;
    milestones: Array<{
      phase: string;
      estimatedDate: Date;
      actualDate?: Date;
      completed: boolean;
    }>;
  };

  // Generated artifacts
  artifacts: {
    researchReport?: any;
    architecturePlan?: any;
    codebase?: any;
    testSuite?: any;
    deploymentPackage?: any;
  };

  createdAt: Date;
  updatedAt: Date;
}

export interface SwarmConfiguration {
  minEngineers: number;
  maxEngineers: number;
  complexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
  specializations: string[];
  gitCredentials?: GitCredentials;
  timeoutMs: number;
}

/**
 * SwarmOrchestratorService - High-level coordinator that leverages E2BAgentOrchestrator
 * for managing N engineers (1-50) in collaborative development projects
 */
export class SwarmOrchestratorService extends Service {
  static serviceType = 'task' as const;

  private e2bOrchestrator: any | null = null; // Type as any since we can't import the actual class
  private complexityEstimator: any | null = null; // Type as any since we can't import the actual class
  private activeProjects: Map<string, SwarmProject> = new Map();
  private projectConfigurations: Map<string, SwarmConfiguration> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  capabilityDescription =
    'High-level coordinator for N-engineer swarms using E2B orchestration for complex project development (1-50 engineers)';

  constructor(runtime?: IAgentRuntime) {
    super(runtime);
  }

  static async start(
    runtime: IAgentRuntime,
  ): Promise<SwarmOrchestratorService> {
    const service = new SwarmOrchestratorService(runtime);
    await service.initialize();
    return service;
  }

  private async initialize(): Promise<void> {
    // Get the E2B orchestrator service
    this.e2bOrchestrator = this.runtime?.getService('e2b-agent-orchestrator');
    this.complexityEstimator = this.runtime?.getService(
      'project-complexity-estimator',
    );

    if (!this.e2bOrchestrator) {
      throw new Error(
        'E2BAgentOrchestrator service not available - required for swarm coordination',
      );
    }

    if (!this.complexityEstimator) {
      console.warn(
        'ProjectComplexityEstimator not available - using simplified complexity estimation',
      );
    }

    // Start project monitoring
    this.startProjectMonitoring();

    console.log('SwarmOrchestratorService initialized with E2B integration');
  }

  /**
   * Create a new swarm project with N engineers based on complexity
   */
  async createSwarmProject(
    projectId: string,
    userId: string,
    name: string,
    description: string,
    userPrompt: string,
    gitCredentials?: GitCredentials,
  ): Promise<SwarmProject> {
    try {
      // Analyze project complexity using E2B orchestrator
      const projectTeam = await this.e2bOrchestrator!.spawnProjectTeam(
        description,
        gitCredentials,
      );

      // Create swarm project
      const project: SwarmProject = {
        id: projectId,
        userId,
        name,
        description,
        type: this.detectProjectType(description),
        specification: { userPrompt, description },

        // E2B integration data
        taskId: projectTeam.taskId,
        repositoryUrl: projectTeam.repositoryUrl,
        projectRequirements: projectTeam.requirements,
        activeAgents: projectTeam.agents,

        // Project lifecycle
        currentPhase: 'analysis',
        status: 'active',

        // Progress tracking
        progress: {
          overall: 0,
          analysis: 0,
          planning: 0,
          development: 0,
          testing: 0,
          deployment: 0,
        },

        // Timeline based on E2B estimation
        timeline: {
          estimatedCompletion: new Date(
            Date.now() +
              projectTeam.requirements.estimatedHours * 60 * 60 * 1000,
          ),
          milestones: this.generateMilestones(projectTeam.requirements),
        },

        artifacts: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store project
      this.activeProjects.set(projectId, project);

      // Store project configuration
      this.projectConfigurations.set(projectId, {
        minEngineers: 1,
        maxEngineers: Math.min(50, projectTeam.agents.length),
        complexity: this.mapComplexity(projectTeam.requirements.complexity),
        specializations: projectTeam.agents.map(
          (a: E2BAgentHandle) => a.specialization || a.role,
        ),
        gitCredentials,
        timeoutMs: projectTeam.requirements.estimatedHours * 60 * 60 * 1000,
      });

      // Save to agent memory
      await this.saveProjectToAgentMemory(project);

      console.log(
        `Swarm project created with ${projectTeam.agents.length} engineers: ${projectId}`,
      );
      return project;
    } catch (error) {
      console.error('Failed to create swarm project:', error);
      throw error;
    }
  }

  /**
   * Get project status including real-time agent progress
   */
  async getProjectStatus(projectId: string): Promise<SwarmProject | null> {
    const project = this.activeProjects.get(projectId);
    if (!project) {
      return null;
    }

    try {
      // Get latest room state from E2B orchestrator
      const roomState = await this.e2bOrchestrator!.getRoomState(
        project.taskId,
      );
      if (roomState) {
        project.roomState = roomState;

        // Update progress based on room state
        this.updateProjectProgress(project, roomState);
      }

      // Get latest agent statuses
      const agents = await this.e2bOrchestrator!.listTaskAgents(project.taskId);
      project.activeAgents = agents;

      // Update timestamps
      project.updatedAt = new Date();

      return project;
    } catch (error) {
      console.error(`Failed to get project status for ${projectId}:`, error);
      return project;
    }
  }

  /**
   * Scale the swarm up or down based on project needs
   */
  async scaleSwarm(
    projectId: string,
    targetAgentCount: number,
    specializations?: string[],
  ): Promise<void> {
    const project = this.activeProjects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const config = this.projectConfigurations.get(projectId);
    if (!config) {
      throw new Error(`Configuration for project ${projectId} not found`);
    }

    // Validate target count
    if (
      targetAgentCount < config.minEngineers ||
      targetAgentCount > config.maxEngineers
    ) {
      throw new Error(
        `Target agent count must be between ${config.minEngineers} and ${config.maxEngineers}`,
      );
    }

    const currentAgents = await this.e2bOrchestrator!.listTaskAgents(
      project.taskId,
    );
    const currentCount = currentAgents.length;

    if (targetAgentCount > currentCount) {
      // Scale up - spawn additional agents
      await this.scaleUp(
        project,
        targetAgentCount - currentCount,
        specializations || [],
      );
    } else if (targetAgentCount < currentCount) {
      // Scale down - terminate excess agents
      await this.scaleDown(project, currentCount - targetAgentCount);
    }

    console.log(
      `Swarm scaled from ${currentCount} to ${targetAgentCount} agents`,
    );
  }

  /**
   * Monitor all active projects and redistribute tasks as needed
   */
  private startProjectMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        for (const [projectId, project] of this.activeProjects) {
          if (project.status === 'active') {
            await this.monitorProject(project);
          }
        }
      } catch (error) {
        console.error('Error during project monitoring:', error);
      }
    }, 30000); // Monitor every 30 seconds
  }

  /**
   * Monitor individual project and update status
   */
  private async monitorProject(project: SwarmProject): Promise<void> {
    try {
      // Use E2B orchestrator's monitoring
      await this.e2bOrchestrator!.monitorAndRedistribute(project.taskId);

      // Get updated status
      const updatedProject = await this.getProjectStatus(project.id);
      if (updatedProject) {
        // Check if project is complete
        if (this.isProjectComplete(updatedProject)) {
          await this.completeProject(updatedProject);
        }

        // Update agent memory
        await this.saveProjectToAgentMemory(updatedProject);
      }
    } catch (error) {
      console.error(`Error monitoring project ${project.id}:`, error);
    }
  }

  /**
   * Scale up the swarm by adding new agents
   */
  private async scaleUp(
    project: SwarmProject,
    additionalAgents: number,
    specializations: string[],
  ): Promise<void> {
    const config = this.projectConfigurations.get(project.id)!;

    for (let i = 0; i < additionalAgents; i++) {
      const specialization =
        specializations[i % specializations.length] || 'coder';
      const role = this.mapSpecializationToRole(specialization);

      const request: E2BAgentRequest = {
        role,
        taskId: project.taskId,
        requirements: [
          `Specialized in ${specialization}`,
          'Collaborative development',
        ],
        gitCredentials: config.gitCredentials,
        projectContext: {
          repositoryUrl: project.repositoryUrl || '',
          projectType: project.type,
        },
        priority: 'medium',
        specialization,
      };

      const agent = await this.e2bOrchestrator!.spawnE2BAgent(request);
      project.activeAgents.push(agent);
    }
  }

  /**
   * Scale down the swarm by terminating agents
   */
  private async scaleDown(
    project: SwarmProject,
    agentsToRemove: number,
  ): Promise<void> {
    // Remove agents with lowest priority or those not currently working
    const agents = await this.e2bOrchestrator!.listTaskAgents(project.taskId);
    const agentsToTerminate = agents
      .filter(
        (a: E2BAgentHandle) => a.status === 'ready' || a.status === 'failed',
      )
      .slice(0, agentsToRemove);

    for (const agent of agentsToTerminate) {
      await this.e2bOrchestrator!.terminateAgent(agent.sandboxId);

      // Remove from project agents list
      const index = project.activeAgents.findIndex(
        (a) => a.sandboxId === agent.sandboxId,
      );
      if (index > -1) {
        project.activeAgents.splice(index, 1);
      }
    }
  }

  /**
   * Update project progress based on room state
   */
  private updateProjectProgress(
    project: SwarmProject,
    roomState: RoomState,
  ): void {
    if (!roomState.plan) {
      return;
    }

    const plan = roomState.plan;

    // Calculate overall progress
    const overallProgress =
      plan.totalSteps > 0 ? (plan.completedSteps / plan.totalSteps) * 100 : 0;

    project.progress.overall = Math.round(overallProgress);

    // Update phase-specific progress
    switch (plan.currentPhase) {
      case 'initialization':
      case 'planning':
        project.progress.analysis = Math.round(overallProgress * 0.2);
        project.progress.planning = Math.round(overallProgress * 0.8);
        break;
      case 'development':
        project.progress.analysis = 100;
        project.progress.planning = 100;
        project.progress.development = Math.round(overallProgress);
        break;
      case 'testing':
        project.progress.analysis = 100;
        project.progress.planning = 100;
        project.progress.development = 100;
        project.progress.testing = Math.round(overallProgress);
        break;
      case 'deployment':
        project.progress.analysis = 100;
        project.progress.planning = 100;
        project.progress.development = 100;
        project.progress.testing = 100;
        project.progress.deployment = Math.round(overallProgress);
        break;
    }

    // Update current phase
    if (plan.currentPhase === 'development') {
      project.currentPhase = 'development';
    } else if (plan.currentPhase === 'testing') {
      project.currentPhase = 'testing';
    } else if (plan.currentPhase === 'deployment') {
      project.currentPhase = 'deployment';
    }
  }

  /**
   * Check if project is complete
   */
  private isProjectComplete(project: SwarmProject): boolean {
    return (
      project.roomState?.plan?.status === 'completed' ||
      project.progress.overall >= 100
    );
  }

  /**
   * Complete a project and clean up resources
   */
  private async completeProject(project: SwarmProject): Promise<void> {
    project.status = 'completed';
    project.currentPhase = 'completed';
    project.timeline.actualCompletion = new Date();

    // Collect final artifacts from room state
    if (project.roomState) {
      project.artifacts = {
        researchReport: project.roomState.knowledge.get('research'),
        architecturePlan: project.roomState.knowledge.get('architecture'),
        codebase: project.roomState.knowledge.get('codebase'),
        testSuite: project.roomState.knowledge.get('tests'),
        deploymentPackage: project.roomState.knowledge.get('deployment'),
      };
    }

    // Terminate all agents for this project
    await this.e2bOrchestrator!.terminateTaskAgents(project.taskId);

    console.log(`Project ${project.id} completed successfully`);
  }

  /**
   * Utility methods
   */
  private detectProjectType(description: string): string {
    const lower = description.toLowerCase();

    if (/react|next|vue|angular|svelte/.test(lower)) {
      return 'frontend';
    }
    if (/api|backend|server|express|fastify/.test(lower)) {
      return 'backend';
    }
    if (/fullstack|full-stack/.test(lower)) {
      return 'fullstack';
    }
    if (/mobile|react native|flutter/.test(lower)) {
      return 'mobile';
    }
    if (/cli|command line|terminal/.test(lower)) {
      return 'cli';
    }
    if (/library|package|npm|module/.test(lower)) {
      return 'library';
    }
    if (/plugin|extension/.test(lower)) {
      return 'plugin';
    }

    return 'web';
  }

  private mapComplexity(complexity: string): SwarmConfiguration['complexity'] {
    switch (complexity.toLowerCase()) {
      case 'low':
        return 'simple';
      case 'medium':
        return 'moderate';
      case 'high':
        return 'complex';
      case 'very high':
        return 'enterprise';
      default:
        return 'moderate';
    }
  }

  private mapSpecializationToRole(
    specialization: string,
  ): 'coder' | 'reviewer' | 'tester' {
    if (specialization.includes('test') || specialization.includes('qa')) {
      return 'tester';
    }
    if (specialization.includes('review') || specialization.includes('audit')) {
      return 'reviewer';
    }
    return 'coder';
  }

  private generateMilestones(
    requirements: ProjectRequirements,
  ): SwarmProject['timeline']['milestones'] {
    const totalHours = requirements.estimatedHours;
    const now = Date.now();

    return [
      {
        phase: 'analysis',
        estimatedDate: new Date(now + totalHours * 0.1 * 60 * 60 * 1000),
        completed: false,
      },
      {
        phase: 'planning',
        estimatedDate: new Date(now + totalHours * 0.2 * 60 * 60 * 1000),
        completed: false,
      },
      {
        phase: 'development',
        estimatedDate: new Date(now + totalHours * 0.7 * 60 * 60 * 1000),
        completed: false,
      },
      {
        phase: 'testing',
        estimatedDate: new Date(now + totalHours * 0.9 * 60 * 60 * 1000),
        completed: false,
      },
      {
        phase: 'deployment',
        estimatedDate: new Date(now + totalHours * 60 * 60 * 1000),
        completed: false,
      },
    ];
  }

  /**
   * Store project in agent's memory system instead of platform database
   */
  private async saveProjectToAgentMemory(project: SwarmProject): Promise<void> {
    try {
      if (!this.runtime) {
        return;
      }

      // Store project as agent memory
      await this.runtime.createMemory(
        {
          content: {
            text: `Swarm project: ${project.name} - ${project.description}`,
            type: 'swarm_project',
            projectData: project,
          },
          entityId: this.runtime.agentId,
          roomId: asUUID(`project-${project.id}`),
          metadata: {
            type: 'swarm_project',
            projectId: project.id,
            userId: project.userId,
            status: project.status,
            phase: project.currentPhase,
          },
        },
        'swarm_projects',
      );

      console.log(`Project ${project.id} saved to agent memory`);
    } catch (error) {
      console.error('Failed to save project to agent memory:', error);
    }
  }

  /**
   * Get all projects for a user from agent memory
   */
  async getUserProjects(userId: string): Promise<SwarmProject[]> {
    try {
      if (!this.runtime) {
        return [];
      }

      const memories = await this.runtime.getMemories({
        count: 100,
        tableName: 'swarm_projects',
      });

      const projectMemories = memories.filter(
        (memory) =>
          memory.metadata?.type === 'swarm_project' &&
          memory.metadata?.userId === userId,
      );

      return projectMemories
        .map((memory) => memory.content.projectData as SwarmProject)
        .filter(Boolean);
    } catch (error) {
      console.error('Failed to get user projects from agent memory:', error);
      return [];
    }
  }

  /**
   * Get a specific project by ID from agent memory
   */
  async getProjectById(projectId: string): Promise<SwarmProject | null> {
    try {
      if (!this.runtime) {
        return null;
      }

      const memories = await this.runtime.getMemories({
        roomId: asUUID(`project-${projectId}`),
        count: 1,
        tableName: 'swarm_projects',
      });

      const projectMemory = memories.find(
        (memory) =>
          memory.metadata?.type === 'swarm_project' &&
          memory.metadata?.projectId === projectId,
      );

      return (projectMemory?.content.projectData as SwarmProject) || null;
    } catch (error) {
      console.error('Failed to get project from agent memory:', error);
      return null;
    }
  }

  async stop(): Promise<void> {
    console.log('Stopping SwarmOrchestratorService');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Complete any active projects
    for (const [projectId, project] of this.activeProjects) {
      if (project.status === 'active') {
        await this.e2bOrchestrator?.terminateTaskAgents(project.taskId);
      }
    }

    this.activeProjects.clear();
    this.projectConfigurations.clear();

    console.log('SwarmOrchestratorService stopped');
  }
}

export default SwarmOrchestratorService;
