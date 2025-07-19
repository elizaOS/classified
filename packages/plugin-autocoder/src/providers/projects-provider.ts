import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '@elizaos/core';
import { ProjectPlanningService, type ProjectPlan } from '../services/ProjectPlanningService';

/**
 * Provider that exposes active projects context to the agent
 */
export const projectsProvider: Provider = {
  name: 'PROJECTS_CONTEXT',
  description: 'Provides context about active projects and their current status',
  dynamic: true, // Only called when needed

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State
  ): Promise<ProviderResult> => {
    const projectsService = runtime.getService<ProjectPlanningService>('project-planning');
    if (!projectsService) {
      return {
        text: 'Project planning service is not available.',
        values: {},
        data: {},
      };
    }

    try {
      // Get all projects
      const projects = await projectsService.listProjectPlans();

      if (projects.length === 0) {
        return {
          text: 'No projects found.',
          values: {},
          data: {},
        };
      }

      // Format projects for context
      let contextText = '[PROJECTS]\n';

      // Group projects by status
      const activeProjects = projects.filter(
        (p: ProjectPlan) => (p as any).status === 'planning' || (p as any).status === 'generating' || (p as any).status === 'testing'
      );
      const completedProjects = projects.filter((p: ProjectPlan) => (p as any).status === 'completed');
      const failedProjects = projects.filter((p: ProjectPlan) => (p as any).status === 'failed');

      if (activeProjects.length > 0) {
        contextText += '\nActive Projects:\n';
        activeProjects.forEach((project: ProjectPlan) => {
          contextText += `- ${project.name} (${project.type}): ${(project as any).status}\n`;
          if ((project as any).formId) {
            contextText += `  Form ID: ${(project as any).formId}\n`;
          }
          if ((project as any).details?.projectName) {
            contextText += `  Project Name: ${(project as any).details.projectName}\n`;
          }
          if ((project as any).error) {
            contextText += `  Error: ${(project as any).error}\n`;
          }
        });
      }

      if (completedProjects.length > 0) {
        contextText += '\nCompleted Projects:\n';
        completedProjects.forEach((project: ProjectPlan) => {
          contextText += `- ${project.name} (${project.type})\n`;
          if ((project as any).details?.projectName) {
            contextText += `  Project Name: ${(project as any).details.projectName}\n`;
          }
          if ((project as any).artifacts?.files) {
            contextText += `  Generated ${(project as any).artifacts.files.length} files\n`;
          }
        });
      }

      if (failedProjects.length > 0) {
        contextText += '\nFailed Projects:\n';
        failedProjects.forEach((project: ProjectPlan) => {
          contextText += `- ${project.name} (${project.type})\n`;
          if ((project as any).error) {
            contextText += `  Error: ${(project as any).error}\n`;
          }
        });
      }

      return {
        text: contextText,
        values: {
          activeProjectsCount: activeProjects.length,
          completedProjectsCount: completedProjects.length,
          failedProjectsCount: failedProjects.length,
          totalProjectsCount: projects.length,
        },
        data: {
          projects,
          activeProjects,
          completedProjects,
          failedProjects,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        text: `Error retrieving projects context: ${errorMessage}`,
        values: {},
        data: {},
      };
    }
  },
};
