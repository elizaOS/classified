/**
 * Integration tests for the agent-managed swarm orchestrator system
 * Tests the complete workflow from project creation to completion
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';

// Mock the session at the top level before any imports
const mockSession = {
  user: {
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
  },
};

// Mock next-auth before any route imports
mock.module('next-auth/next', () => ({
  getServerSession: mock(() => Promise.resolve(mockSession)),
}));

// Mock auth config
mock.module('@/lib/auth/auth-config', () => ({
  authOptions: {},
  getServerSession: mock(() => Promise.resolve(mockSession)),
}));
import { NextRequest } from 'next/server';
import { POST as createProject } from '../../app/api/autocoder/swarm/create/route';
import { GET as getProjects } from '../../app/api/autocoder/swarm/projects/route';
import {
  GET as getProjectStatus,
  PATCH as updateProjectStatus,
} from '../../app/api/autocoder/swarm/status/[projectId]/route';
import { POST as scaleProject } from '../../app/api/autocoder/swarm/scale/[projectId]/route';
import {
  GET as getMessages,
  POST as sendMessage,
} from '../../app/api/autocoder/swarm/messages/[projectId]/route';
import { POST as webhookHandler } from '../../app/api/autocoder/webhook/route';

// Mock session is defined above before imports

// Mock the agent API responses
const mockAgentResponses = {
  createProject: {
    success: true,
    id: 'project-123', // API expects .id, not .projectId
    taskId: 'task-456',
    agentCount: 3,
    estimatedCompletion: new Date(Date.now() + 3600000).toISOString(), // 1 hour
  },
  getProjects: {
    success: true,
    projects: [
      {
        id: 'project-123',
        name: 'Test Swarm Project',
        description: 'A test project for swarm orchestration',
        status: 'active',
        phase: 'development',
        progress: { overall: 60 },
        createdAt: new Date().toISOString(),
      },
    ],
    total: 1,
    hasMore: false,
  },
  getStatus: {
    success: true,
    project: {
      id: 'project-123',
      status: 'active',
      phase: 'development',
      progress: { overall: 60, development: 80 },
    },
    agents: [
      { id: 'agent-1', role: 'coder', status: 'active' },
      { id: 'agent-2', role: 'reviewer', status: 'active' },
      { id: 'agent-3', role: 'tester', status: 'idle' },
    ],
  },
  scaleProject: {
    success: true,
    previousAgentCount: 3,
    newAgentCount: 5,
    scalingOperation: 'scale_up',
    addedAgents: [
      { id: 'agent-4', role: 'coder' },
      { id: 'agent-5', role: 'reviewer' },
    ],
  },
  getMessages: {
    success: true,
    messages: [
      {
        id: 'msg-1',
        type: 'user',
        message: 'Hello, how is the project going?',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'msg-2',
        type: 'agent',
        message:
          'The project is progressing well! We are currently in the development phase.',
        timestamp: new Date().toISOString(),
      },
    ],
    total: 2,
    hasMore: false,
  },
  sendMessage: {
    success: true,
    messageId: 'msg-3',
    timestamp: new Date().toISOString(),
  },
};

// Mock setup for each test
beforeEach(() => {
  // Mock fetch for agent API calls
  global.fetch = mock() as any;
});

afterEach(() => {
  mock.restore();
  // Keep environment variables for subsequent tests
});

describe('Swarm Orchestrator Integration', () => {
  describe('Project Creation', () => {
    it('should create a new swarm project via agent', async () => {
      // Mock successful agent response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAgentResponses.createProject),
      });

      const request = new NextRequest(
        'http://localhost/api/autocoder/swarm/create',
        {
          method: 'POST',
          body: JSON.stringify({
            prompt: 'Create a Discord bot that can play music',
            projectName: 'Discord Music Bot',
            description:
              'A bot that can join voice channels and play music from YouTube',
          }),
        },
      );

      const response = await createProject(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.projectId).toBe('project-123');
      expect(data.swarmProject.agentCount).toBe(3);

      // Verify the agent API was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/swarm/create',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
          body: expect.stringContaining('Discord Music Bot'),
        }),
      );
    });

    it('should handle agent API errors gracefully', async () => {
      // Mock agent API error
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal server error'),
      });

      const request = new NextRequest(
        'http://localhost/api/autocoder/swarm/create',
        {
          method: 'POST',
          body: JSON.stringify({
            prompt: 'Create something',
            projectName: 'Test Project',
            description: 'A test project description',
          }),
        },
      );

      const response = await createProject(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to create swarm project with agent');
    });
  });

  describe('Project Retrieval', () => {
    it('should retrieve user projects from agent', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAgentResponses.getProjects),
      });

      const request = new NextRequest(
        'http://localhost/api/autocoder/swarm/projects',
      );
      const response = await getProjects(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.projects).toHaveLength(1);
      expect(data.projects[0].name).toBe('Test Swarm Project');
    });
  });

  describe('Project Status', () => {
    it('should get project status from agent', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAgentResponses.getStatus),
      });

      const request = new NextRequest(
        'http://localhost/api/autocoder/swarm/status/project-123',
      );
      const response = await getProjectStatus(request, {
        params: Promise.resolve({ projectId: 'project-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.project.status).toBe('active');
      expect(data.agents).toHaveLength(3);
    });

    it('should update project status via agent', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            newStatus: 'paused',
            message: 'Project paused successfully',
          }),
      });

      const request = new NextRequest(
        'http://localhost/api/autocoder/swarm/status/project-123',
        {
          method: 'PATCH',
          body: JSON.stringify({
            action: 'pause',
            reason: 'User requested pause',
          }),
        },
      );

      const response = await updateProjectStatus(request, {
        params: Promise.resolve({ projectId: 'project-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.action).toBe('pause');
      expect(data.newStatus).toBe('paused');
    });
  });

  describe('Project Scaling', () => {
    it('should scale project via agent', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAgentResponses.scaleProject),
      });

      const request = new NextRequest(
        'http://localhost/api/autocoder/swarm/scale/project-123',
        {
          method: 'POST',
          body: JSON.stringify({
            targetAgentCount: 5,
            specializations: ['frontend', 'backend'],
          }),
        },
      );

      const response = await scaleProject(request, {
        params: Promise.resolve({ projectId: 'project-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.scalingOperation).toBe('scale_up');
      expect(data.newAgentCount).toBe(5);
      expect(data.addedAgents).toHaveLength(2);
    });

    it('should validate agent count limits', async () => {
      const request = new NextRequest(
        'http://localhost/api/autocoder/swarm/scale/project-123',
        {
          method: 'POST',
          body: JSON.stringify({
            targetAgentCount: 100, // Too many agents
          }),
        },
      );

      const response = await scaleProject(request, {
        params: Promise.resolve({ projectId: 'project-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('between 1 and 50');
    });
  });

  describe('Project Messages', () => {
    it('should get project messages from agent', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAgentResponses.getMessages),
      });

      const request = new NextRequest(
        'http://localhost/api/autocoder/swarm/messages/project-123?limit=10',
      );
      const response = await getMessages(request, {
        params: Promise.resolve({ projectId: 'project-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.messages).toHaveLength(2);
      expect(data.messages[0].type).toBe('user');
      expect(data.messages[1].type).toBe('agent');
    });

    it('should send message to project via agent', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAgentResponses.sendMessage),
      });

      const request = new NextRequest(
        'http://localhost/api/autocoder/swarm/messages/project-123',
        {
          method: 'POST',
          body: JSON.stringify({
            message: 'Can you add error handling to the music playback?',
            messageType: 'instruction',
          }),
        },
      );

      const response = await sendMessage(request, {
        params: Promise.resolve({ projectId: 'project-123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.messageId).toBe('msg-3');
    });
  });

  describe('Agent Webhook', () => {
    it('should handle agent webhook updates', async () => {
      const request = new NextRequest(
        'http://localhost/api/autocoder/webhook',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer test-token-123',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'agent_message',
            projectId: 'project-123',
            message: 'I have completed the error handling implementation.',
            metadata: {
              agentId: 'agent-1',
              agentRole: 'coder',
            },
          }),
        },
      );

      const response = await webhookHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.type).toBe('agent_message');
      expect(data.projectId).toBe('project-123');
    });

    it('should reject unauthorized webhook requests', async () => {
      const request = new NextRequest(
        'http://localhost/api/autocoder/webhook',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer invalid-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'agent_message',
            projectId: 'project-123',
            message: 'Test message',
          }),
        },
      );

      const response = await webhookHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });
  });

  describe('End-to-End Workflow', () => {
    it('should complete a full project lifecycle via agent', async () => {
      // Step 1: Create project
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAgentResponses.createProject),
      });

      const createRequest = new NextRequest(
        'http://localhost/api/autocoder/swarm/create',
        {
          method: 'POST',
          body: JSON.stringify({
            prompt: 'Create a simple web scraper',
            projectName: 'Web Scraper',
            description: 'Scrapes product prices from e-commerce sites',
          }),
        },
      );

      const createResponse = await createProject(createRequest);
      const createData = await createResponse.json();

      expect(createResponse.status).toBe(200);
      expect(createData.success).toBe(true);

      // Step 2: Send message to project
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAgentResponses.sendMessage),
      });

      const messageRequest = new NextRequest(
        `http://localhost/api/autocoder/swarm/messages/${createData.projectId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            message: 'Please add support for multiple sites',
            messageType: 'instruction',
          }),
        },
      );

      const messageResponse = await sendMessage(messageRequest, {
        params: Promise.resolve({ projectId: createData.projectId }),
      });
      const messageData = await messageResponse.json();

      expect(messageResponse.status).toBe(200);
      expect(messageData.success).toBe(true);

      // Step 3: Scale project up
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAgentResponses.scaleProject),
      });

      const scaleRequest = new NextRequest(
        `http://localhost/api/autocoder/swarm/scale/${createData.projectId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            targetAgentCount: 4,
            specializations: ['web-scraping', 'data-parsing'],
          }),
        },
      );

      const scaleResponse = await scaleProject(scaleRequest, {
        params: Promise.resolve({ projectId: createData.projectId }),
      });
      const scaleData = await scaleResponse.json();

      expect(scaleResponse.status).toBe(200);
      expect(scaleData.success).toBe(true);
      expect(scaleData.newAgentCount).toBe(5);

      // Step 4: Check final status
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockAgentResponses.getStatus,
            project: {
              ...mockAgentResponses.getStatus.project,
              status: 'completed',
              phase: 'completed',
            },
          }),
      });

      const statusRequest = new NextRequest(
        `http://localhost/api/autocoder/swarm/status/${createData.projectId}`,
      );
      const statusResponse = await getProjectStatus(statusRequest, {
        params: Promise.resolve({ projectId: createData.projectId }),
      });
      const statusData = await statusResponse.json();

      expect(statusResponse.status).toBe(200);
      expect(statusData.project.status).toBe('completed');

      // Verify all agent API calls were made
      expect(global.fetch).toHaveBeenCalledTimes(4);
    });
  });
});

describe('Error Handling', () => {
  it('should handle missing environment variables', async () => {
    delete process.env.ELIZA_AGENT_URL;
    delete process.env.ELIZA_AGENT_TOKEN;

    const request = new NextRequest(
      'http://localhost/api/autocoder/swarm/create',
      {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test project',
          projectName: 'Test',
          description: 'A test project',
        }),
      },
    );

    const response = await createProject(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Internal server error');
  });

  it('should handle network errors to agent', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const request = new NextRequest(
      'http://localhost/api/autocoder/swarm/create',
      {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test project',
          projectName: 'Test',
          description: 'A test project',
        }),
      },
    );

    const response = await createProject(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Internal server error');
  });
});
