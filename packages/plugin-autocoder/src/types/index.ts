import type { UUID } from '@elizaos/core';

/**
 * Core types for Plugin Autocoder
 */

/**
 * Project type enumeration
 */
export type ProjectType = 'plugin' | 'agent' | 'workflow' | 'mcp' | 'full-stack';

/**
 * Project status
 */
export type ProjectStatus = 'planning' | 'generating' | 'testing' | 'completed' | 'failed';

/**
 * Project metadata
 */
export interface ProjectMetadata {
  id: UUID;
  name: string;
  description: string;
  type: ProjectType;
  status: ProjectStatus;
  formId?: UUID; // Associated form ID during planning phase
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;

  // Project details collected from form
  details?: {
    // Basic info
    projectName?: string;
    projectDescription?: string;
    projectType?: ProjectType;

    // Technical requirements
    primaryFunction?: string;
    targetUsers?: string;
    keyFeatures?: string[];

    // Integration requirements
    requiredPlugins?: string[];
    externalServices?: string[];

    // Additional metadata
    complexity?: 'simple' | 'moderate' | 'complex';
    estimatedTime?: string;
  };

  // Generated artifacts
  artifacts?: {
    files?: Array<{
      path: string;
      content: string;
    }>;
    testResults?: {
      passed: boolean;
      summary: string;
      details: any;
    };
  };
}

/**
 * Project planning service interface
 */
export interface IProjectPlanningService {
  createProject(type: ProjectType, initialData?: any): Promise<ProjectMetadata>;
  updateProject(projectId: UUID, updates: Partial<ProjectMetadata>): Promise<ProjectMetadata>;
  getProject(projectId: UUID): Promise<ProjectMetadata | null>;
  listProjects(status?: ProjectStatus): Promise<ProjectMetadata[]>;
  generateProject(projectId: UUID): Promise<void>;
}

/**
 * Form step completion data
 */
export interface StepCompletionData {
  stepId: string;
  formData: Record<string, any>;
  projectId: UUID;
}
