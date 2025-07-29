import { describe, it, expect, vi, beforeEach } from 'bun:test';
import { AutocoderAgentService } from '../agent-service';

// Mock the createAgentRuntime function
mock.module('@/lib/agents/create-runtime', () => ({
  createAgentRuntime: mock().mockResolvedValue({
    agentId: 'test-agent-id',
    initialize: mock().mockResolvedValue(undefined),
    useModel: mock().mockResolvedValue('Mock response'),
    character: {
      name: 'Test Agent',
      bio: ['Test bio'],
    },
  }),
}));

// Mock fetch for agent server communication
global.fetch = mock();

describe('AutocoderAgentService', () => {
  let agentService: AutocoderAgentService;

  beforeEach(async () => {
    mock.restore();

    // Reset the createAgentRuntime mock to ensure fresh state
    const { createAgentRuntime } = await import('@/lib/agents/create-runtime');
    (createAgentRuntime as any).mockResolvedValue({
      agentId: 'test-agent-id',
      initialize: mock().mockResolvedValue(undefined),
      useModel: mock().mockResolvedValue('Mock response'),
      character: {
        name: 'Test Agent',
        bio: ['Test bio'],
      },
    });

    agentService = new AutocoderAgentService();
  });

  describe('initialization', () => {
    it('should initialize with local runtime when agent server is not available', async () => {
      // Mock failed agent server connection
      (global.fetch as any).mockRejectedValue(new Error('Connection failed'));

      await agentService.initialize();

      expect(agentService.getAgentId()).toBe('test-agent-id');
      expect(agentService.getIsConnectedToServer()).toBe(false);
    });

    it('should connect to agent server when available', async () => {
      // Mock successful agent server connection
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'ok' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: 'existing-agent',
                  characterName: 'Autocoder Agent',
                },
              ],
            }),
        });

      await agentService.initialize();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/runtime/health',
        expect.any(Object),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/agents',
        expect.any(Object),
      );
    });
  });

  describe('conversation processing', () => {
    beforeEach(async () => {
      // Setup with local runtime
      (global.fetch as any).mockRejectedValue(new Error('Connection failed'));
      await agentService.initialize();
    });

    it('should process conversation messages', async () => {
      const response = await agentService.processConversationMessage(
        'test-project-id',
        'Hello, how are you?',
        [{ type: 'user', message: 'Previous message', timestamp: new Date() }],
      );

      expect(response).toBe('Mock response');
    });

    it('should handle conversation errors gracefully', async () => {
      // Mock error in useModel
      const mockRuntime = {
        useModel: mock().mockRejectedValue(new Error('Model error')),
      };

      // Replace the runtime for this test
      (agentService as any).runtime = mockRuntime;

      const response = await agentService.processConversationMessage(
        'test-project-id',
        'Hello',
        [],
      );

      expect(response).toContain("I'm sorry, I'm having trouble");
    });
  });

  describe('project analysis', () => {
    beforeEach(async () => {
      (global.fetch as any).mockRejectedValue(new Error('Connection failed'));
      await agentService.initialize();
    });

    it('should analyze project requirements', async () => {
      const analysis = await agentService.analyzeProjectRequirements(
        'test-project-id',
        'Build a DeFi yield farming platform',
        'defi',
      );

      expect(analysis).toHaveProperty('analysis');
      expect(analysis).toHaveProperty('nextSteps');
      expect(analysis).toHaveProperty('estimatedTime');
      expect(analysis).toHaveProperty('complexity');
      expect(Array.isArray(analysis.nextSteps)).toBe(true);
    });

    it('should provide fallback analysis on JSON parsing failure', async () => {
      // Mock invalid JSON response
      const mockRuntime = {
        useModel: mock().mockResolvedValue('Invalid JSON response'),
      };
      (agentService as any).runtime = mockRuntime;

      const analysis = await agentService.analyzeProjectRequirements(
        'test-project-id',
        'Build something',
        'general',
      );

      expect(analysis.analysis).toContain('general project involves');
      expect(analysis.nextSteps.length).toBeGreaterThan(0);
      expect(analysis.complexity).toBe('moderate');
    });
  });

  describe('implementation suggestions', () => {
    beforeEach(async () => {
      (global.fetch as any).mockRejectedValue(new Error('Connection failed'));
      await agentService.initialize();
    });

    it('should generate implementation suggestions', async () => {
      const suggestions = await agentService.generateImplementationSuggestions(
        'trading',
        ['automated trading', 'risk management'],
        ['budget under $1000'],
      );

      expect(suggestions).toHaveProperty('recommendations');
      expect(suggestions).toHaveProperty('architecture');
      expect(suggestions).toHaveProperty('risks');
      expect(suggestions).toHaveProperty('timeline');
      expect(Array.isArray(suggestions.recommendations)).toBe(true);
      expect(Array.isArray(suggestions.risks)).toBe(true);
    });

    it('should provide fallback suggestions on JSON parsing failure', async () => {
      const mockRuntime = {
        useModel: mock().mockResolvedValue('Invalid JSON'),
      };
      (agentService as any).runtime = mockRuntime;

      const suggestions = await agentService.generateImplementationSuggestions(
        'defi',
        ['yield farming'],
        [],
      );

      expect(suggestions.recommendations.length).toBeGreaterThan(0);
      expect(suggestions.architecture).toContain('architecture');
      expect(suggestions.risks.length).toBeGreaterThan(0);
    });
  });

  describe('agent server integration', () => {
    it('should create agent on server when none exists', async () => {
      // Mock successful health check
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'ok' }),
        })
        // Mock empty agents list
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        })
        // Mock successful agent creation
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                id: 'new-agent-id',
                characterName: 'Autocoder Agent',
              },
            }),
        });

      await agentService.initialize();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/agents',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Autocoder Agent'),
        }),
      );
    });

    it('should handle server communication through wrapper', async () => {
      // Mock successful server setup
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'ok' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: 'server-agent-id',
                  characterName: 'Autocoder Agent',
                },
              ],
            }),
        })
        // Mock model request
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ response: 'Server response' }),
        });

      await agentService.initialize();

      // This should use the server wrapper
      const response = await agentService.processConversationMessage(
        'test-project',
        'Hello',
        [],
      );

      expect(response).toBe('Server response');
    });
  });

  describe('error handling', () => {
    it('should handle runtime initialization failure', async () => {
      const { createAgentRuntime } = await import(
        '@/lib/agents/create-runtime'
      );
      (createAgentRuntime as any).mockRejectedValue(new Error('Init failed'));
      (global.fetch as any).mockRejectedValue(new Error('Server failed'));

      await expect(agentService.initialize()).rejects.toThrow();
    });

    it('should handle server wrapper model failures gracefully', async () => {
      // Setup server connection
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: 'ok' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                {
                  id: 'server-agent-id',
                  characterName: 'Autocoder Agent',
                },
              ],
            }),
        })
        // Mock model request failure
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

      await agentService.initialize();

      // Should fallback to local model when server model fails
      const response = await agentService.processConversationMessage(
        'test-project',
        'Hello',
        [],
      );

      expect(response).toBe('Mock response'); // From local fallback
    });
  });
});
