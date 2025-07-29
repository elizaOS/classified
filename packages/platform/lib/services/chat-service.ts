/**
 * Chat Service
 * Provides AI-powered chat functionality for anonymous users with workflow guidance
 */

import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import type { ChatMessage } from '@/lib/database/repositories/anonymous-session';

export interface ChatContext {
  currentStep: string;
  userContext: Record<string, any>;
  chatHistory: ChatMessage[];
  sessionId: string;
}

export interface ChatResponse {
  content: string;
  suggestions?: string[];
  workflowStep?: string;
  generatedAsset?: any;
  nextStep?: string;
}

export interface AssetGenerationRequest {
  type: 'n8n_workflow' | 'mcp' | 'agent_config';
  description: string;
  requirements: Record<string, any>;
  userContext: Record<string, any>;
}

export interface GeneratedAsset {
  type: string;
  name: string;
  description: string;
  data: any;
  preview?: string;
  downloadUrl?: string;
}

export class ChatService {
  private model = process.env.AI_MODEL || 'claude-3-sonnet-20240229';
  private provider = process.env.AI_PROVIDER || 'anthropic';

  /**
   * Generate a chat response based on user message and context
   */
  async generateChatResponse(
    message: string,
    context: ChatContext,
  ): Promise<ChatResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const messages = this.buildMessageHistory(context.chatHistory, message);

      // Select the AI provider
      const aiModel = this.getAIModel();

      const result = await generateText({
        model: aiModel,
        system: systemPrompt,
        messages,
        temperature: 0.7,
        maxTokens: 1000,
      });

      // Parse the response to extract structured data
      const response = this.parseAIResponse(result.text, context);

      return response;
    } catch (error) {
      console.error('Failed to generate chat response:', error);

      // Fallback response
      return {
        content:
          "I apologize, but I'm having trouble processing your request. Could you please try rephrasing it?",
        suggestions: [
          'Tell me more about your project',
          'What specific features do you need?',
          'What platform are you building for?',
        ],
      };
    }
  }

  /**
   * Generate an asset (workflow, MCP server, agent config) based on requirements
   */
  async generateAsset(
    request: AssetGenerationRequest,
  ): Promise<GeneratedAsset> {
    try {
      const systemPrompt = this.buildAssetGenerationPrompt(request.type);
      const userPrompt = this.buildAssetUserPrompt(request);

      const aiModel = this.getAIModel();

      const result = await generateText({
        model: aiModel,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.3, // Lower temperature for more consistent output
        maxTokens: 4000, // More tokens for complex assets
      });

      // Parse and validate the generated asset
      const asset = this.parseGeneratedAsset(result.text, request.type);

      return {
        type: request.type,
        name: asset.name || `Generated ${request.type}`,
        description: asset.description || request.description,
        data: asset.data,
        preview: this.generatePreview(asset.data, request.type),
        downloadUrl: this.generateDownloadUrl(asset.data, request.type),
      };
    } catch (error) {
      console.error('Failed to generate asset:', error);
      throw new Error('Asset generation failed. Please try again.');
    }
  }

  private getAIModel() {
    if (this.provider === 'openai') {
      return openai(this.model);
    }
    return anthropic(this.model);
  }

  private buildSystemPrompt(context: ChatContext): string {
    return `You are an AI assistant helping users create automation workflows, MCP servers, and AI agent configurations. 
You are currently in the "${context.currentStep}" step of the workflow.

Current workflow type: ${context.userContext.workflowType || 'not selected'}
User requirements: ${JSON.stringify(context.userContext.requirements || {})}

Your role is to:
1. Guide users through the workflow creation process
2. Ask clarifying questions when needed
3. Provide specific suggestions based on their needs
4. Help them refine their requirements

Always be helpful, concise, and focused on moving the workflow forward.
If the user seems stuck, offer specific suggestions or examples.

Format your responses to include:
- Main response content
- Suggested next actions (if applicable)
- Current workflow step (if changed)
- Next step in the workflow (if moving forward)`;
  }

  private buildMessageHistory(
    chatHistory: ChatMessage[],
    currentMessage: string,
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages = chatHistory.slice(-10).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    messages.push({ role: 'user' as const, content: currentMessage });

    return messages;
  }

  private parseAIResponse(text: string, context: ChatContext): ChatResponse {
    // Try to extract structured data from the response
    // This is a simplified version - in production, you might use
    // a more sophisticated parsing approach or ask the AI to return JSON

    const response: ChatResponse = {
      content: text,
    };

    // Extract suggestions if present
    const suggestionsMatch = text.match(
      /Suggestions?:\s*\n((?:[-•]\s*.+\n?)+)/i,
    );
    if (suggestionsMatch) {
      response.suggestions = suggestionsMatch[1]
        .split('\n')
        .filter((s) => s.trim())
        .map((s) => s.replace(/^[-•]\s*/, '').trim())
        .filter((s) => s.length > 0);
    }

    // Determine if we should move to the next step
    if (
      text.toLowerCase().includes('next step') ||
      text.toLowerCase().includes('moving forward') ||
      text.toLowerCase().includes('proceed to')
    ) {
      response.nextStep = this.determineNextStep(context.currentStep);
      response.workflowStep = context.currentStep;
    }

    return response;
  }

  private determineNextStep(currentStep: string): string {
    const stepFlow: Record<string, string> = {
      initial: 'requirements',
      requirements: 'design',
      design: 'implementation',
      implementation: 'testing',
      testing: 'deployment',
      deployment: 'complete',
    };

    return stepFlow[currentStep] || currentStep;
  }

  private buildAssetGenerationPrompt(type: string): string {
    const prompts: Record<string, string> = {
      n8n_workflow: `You are an expert at creating n8n workflows. Generate a complete, valid n8n workflow JSON based on the user's requirements.
The workflow should be production-ready and include error handling where appropriate.
Return the response as a JSON object with the following structure:
{
  "name": "Workflow Name",
  "description": "Brief description",
  "data": { /* Complete n8n workflow JSON */ }
}`,

      mcp: `You are an expert at creating Model Context Protocol (MCP) servers. Generate a complete MCP server implementation based on the user's requirements.
Include all necessary files and configurations.
Return the response as a JSON object with the following structure:
{
  "name": "MCP Server Name",
  "description": "Brief description",
  "data": {
    "files": {
      "package.json": "...",
      "index.js": "...",
      "config.json": "..."
    }
  }
}`,

      agent_config: `You are an expert at creating AI agent configurations. Generate a complete agent configuration based on the user's requirements.
Include personality, capabilities, tools, and behaviors.
Return the response as a JSON object with the following structure:
{
  "name": "Agent Name",
  "description": "Brief description",
  "data": {
    "name": "...",
    "personality": { ... },
    "capabilities": [ ... ],
    "tools": [ ... ],
    "behaviors": { ... }
  }
}`,
    };

    return prompts[type] || prompts.agent_config;
  }

  private buildAssetUserPrompt(request: AssetGenerationRequest): string {
    return `Generate a ${request.type} with the following requirements:

Description: ${request.description}

Specific Requirements:
${Object.entries(request.requirements)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}

User Context:
${Object.entries(request.userContext)
  .filter(([key]) => key !== 'sessionId')
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}

Please generate a complete, production-ready solution.`;
  }

  private parseGeneratedAsset(text: string, type: string): any {
    try {
      // Try to parse as JSON first
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Failed to parse generated asset as JSON:', error);
    }

    // Fallback: create a basic structure
    return {
      name: `Generated ${type}`,
      description: 'AI-generated asset',
      data: this.createFallbackAsset(type),
    };
  }

  private createFallbackAsset(type: string): any {
    switch (type) {
      case 'n8n_workflow':
        return {
          name: 'Generated Workflow',
          nodes: [],
          connections: {},
          settings: {},
        };

      case 'mcp':
        return {
          files: {
            'package.json': JSON.stringify(
              {
                name: 'mcp-server',
                version: '1.0.0',
                main: 'index.js',
              },
              null,
              2,
            ),
            'index.js': '// MCP Server implementation',
          },
        };

      case 'agent_config':
        return {
          name: 'AI Assistant',
          personality: {
            traits: ['helpful', 'professional'],
          },
          capabilities: ['conversation', 'task_completion'],
          tools: [],
        };

      default:
        return {};
    }
  }

  private generatePreview(data: any, type: string): string {
    switch (type) {
      case 'n8n_workflow':
        return `Workflow with ${data.nodes?.length || 0} nodes`;

      case 'mcp':
        const fileCount = Object.keys(data.files || {}).length;
        return `MCP server with ${fileCount} files`;

      case 'agent_config':
        return `Agent: ${data.name || 'Unnamed'}`;

      default:
        return 'Generated asset';
    }
  }

  private generateDownloadUrl(data: any, type: string): string {
    // In a real implementation, this would upload the asset to storage
    // and return a real download URL
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });

    return URL.createObjectURL(blob);
  }
}

// Export singleton instance
export const chatService = new ChatService();
