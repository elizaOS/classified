import {
  Action,
  Handler,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ModelType,
  elizaLogger,
  ActionResult,
} from '@elizaos/core';
import { query } from '@anthropic-ai/claude-code';

// Local type definitions
interface ProjectMetadata {
  id: string;
  name: string;
  type: 'plugin' | 'agent' | 'workflow' | 'mcp' | 'app';
  description: string;
  createdAt: Date;
  status: string;
}

// Helper function to extract project name from message
function extractProjectName(text: string): string | null {
  // Look for patterns like "create a plugin called X" or "build X plugin"
  const patterns = [
    /(?:create|build|make|develop)\s+(?:a\s+)?(?:plugin|agent|workflow|mcp|app)\s+(?:called|named)\s+["']?([^"']+)["']?/i,
    /(?:create|build|make|develop)\s+["']?([^"']+)["']?\s+(?:plugin|agent|workflow|mcp|app)/i,
    /["']([^"']+)["']/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // If no specific name found, generate one
  return `project-${Date.now()}`;
}

// Extract project type from message text (simplified version)
function extractProjectType(text: string): 'plugin' | 'agent' | 'workflow' | 'mcp' | 'app' {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('plugin')) return 'plugin';
  if (lowerText.includes('agent')) return 'agent';
  if (lowerText.includes('workflow')) return 'workflow';
  if (lowerText.includes('mcp') || lowerText.includes('model context protocol')) return 'mcp';
  if (lowerText.includes('app') || lowerText.includes('application')) return 'app';
  
  return 'plugin'; // default
}

// Get form template based on project type
function getFormTemplate(projectType: string) {
  const baseTemplate = {
    name: `${projectType}-configuration`,
    description: `Configure your ${projectType} project`,
    steps: [
      {
        name: 'basic-info',
        fields: [
          {
            name: 'projectName',
            type: 'text',
            label: 'Project Name',
            required: true,
          },
          {
            name: 'description',
            type: 'textarea',
            label: 'Project Description',
            required: true,
          },
        ],
      },
      {
        name: 'requirements',
        fields: [
          {
            name: 'requirements',
            type: 'textarea',
            label: 'Project Requirements',
            description: 'What should this project do?',
            required: true,
          },
        ],
      },
    ],
  };

  // Add type-specific fields
  if (projectType === 'plugin') {
    baseTemplate.steps.push({
      name: 'plugin-config',
      fields: [
        {
          name: 'actions',
          type: 'textarea',
          label: 'Actions',
          description: 'What actions should this plugin provide?',
          required: false,
        },
        {
          name: 'providers',
          type: 'textarea',
          label: 'Providers',
          description: 'What data providers should this plugin include?',
          required: false,
        },
      ],
    });
  }

  return baseTemplate;
}

export const createProjectAction: Action = {
  name: 'CREATE_PROJECT',
  description: 'Create a new ElizaOS project (plugin, agent, workflow, MCP server, or full-stack app)',
  examples: [
    [
      {
        name: 'user',
        content: {
          text: 'I want to create a new plugin for weather data',
        },
      },
      {
        name: 'assistant',
        content: {
          text: "I'll help you create a weather data plugin. Let me set that up for you.",
          action: 'CREATE_PROJECT',
        },
      },
    ],
    [
      {
        name: 'user',
        content: {
          text: 'Build a new agent for customer support',
        },
      },
      {
        name: 'assistant',
        content: {
          text: "I'll help you create a customer support agent. Let me guide you through the configuration.",
          action: 'CREATE_PROJECT',
        },
      },
    ],
  ],

  validate: async (runtime: IAgentRuntime, message: Memory) => {
    const text = message.content.text?.toLowerCase() || '';
    const projectKeywords = ['create', 'build', 'make', 'develop', 'generate', 'scaffold'];
    const typeKeywords = ['plugin', 'agent', 'workflow', 'mcp', 'app', 'application', 'project'];

    // Check if message contains project creation intent
    const hasProjectIntent = projectKeywords.some((keyword) => text.includes(keyword));
    const hasTypeKeyword = typeKeywords.some((keyword) => text.includes(keyword));

    return hasProjectIntent && hasTypeKeyword;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      elizaLogger.info('CREATE_PROJECT action triggered');

      const planningService = runtime.getService('project-planning');
      const formsService = runtime.getService('forms');

      if (!planningService || !formsService) {
        const error = 'Required services not available';
        if (callback) {
          callback({
            text: error,
            success: false,
          });
        }
        return {
          text: error,
          success: false,
          data: { error },
        };
      }

      // Extract project info from message
      const projectName = extractProjectName(message.content.text || '');
      const projectType = extractProjectType(message.content.text || '');

      if (!projectName) {
        const error = 'Could not determine project name from message';
        if (callback) {
          callback({
            text: error,
            success: false,
          });
        }
        return {
          text: error,
          success: false,
          data: { error },
        };
      }

      // Create project metadata
      const project: ProjectMetadata = {
        id: `proj_${Date.now()}`,
        name: projectName,
        type: projectType,
        description: message.content.text || '',
        createdAt: new Date(),
        status: 'planning',
      };

      // Store project in planning service
      await (planningService as any).createProject(project);

      // Create configuration form
      const formTemplate = getFormTemplate(projectType);
      const form = await (formsService as any).createForm({
        ...formTemplate,
        data: {
          projectId: project.id,
          projectName: project.name,
          projectType: project.type,
        },
      });

      const responseText = `I've created a new ${projectType} project "${projectName}". Let's configure it together.\n\nForm ID: ${form.id}`;

      if (callback) {
        callback({
          text: responseText,
          success: true,
        });
      }

      return {
        text: responseText,
        success: true,
        data: { project },
      };
    } catch (error) {
      elizaLogger.error('Failed to create project:', error);
      const errorMessage = `Failed to create project: ${error instanceof Error ? error.message : String(error)}`;

      if (callback) {
        callback({
          text: errorMessage,
          success: false,
        });
      }

      return {
        text: errorMessage,
        success: false,
        data: { error },
      };
    }
  },
};
