/**
 * Platform Runtime Integration Tests
 *
 * These tests validate that the platform services work correctly with real ElizaOS runtime instances.
 * They replace mocked unit tests with real runtime tests as requested.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'bun:test';
import { IAgentRuntime, Character, Memory, UUID } from '@elizaos/core';
import {
  createTestRuntime,
  RuntimeTestHarness,
} from '@elizaos/core/test-utils';
import { anonymousSessionRepo } from '../../lib/database/repositories/anonymous-session';
import { chatService } from '../../lib/services/chat-service';
import { db, getDatabase, initializeDbProxy } from '../../lib/database';
import type {
  ChatMessage,
  WorkflowProgress,
} from '../../lib/database/repositories/anonymous-session';

// Test runtime configuration
const testCharacter: Character = {
  name: 'Platform Test Agent',
  username: 'platform_test',
  system:
    'You are a helpful test agent for platform integration testing. You help validate platform functionality and test real AI integration with ElizaOS runtime.',
  bio: [
    'I am a test agent used to validate platform functionality',
    'I help test real AI integration with ElizaOS runtime',
    'I provide accurate responses for testing scenarios',
  ],
  messageExamples: [
    [
      {
        name: '{{user1}}',
        content: { text: 'Hello' },
      },
      {
        name: 'platform_test',
        content: { text: 'Hello! How can I help you test the platform today?' },
      },
    ],
  ],
  postExamples: [],
  topics: [
    'testing',
    'platform validation',
    'AI integration',
    'workflow generation',
  ],
  style: {
    all: [
      'Be helpful and clear in testing scenarios',
      'Provide accurate responses for testing',
      'Acknowledge when functionality is being tested',
    ],
    chat: [
      'Be conversational but precise',
      'Explain what is being tested when appropriate',
    ],
    post: [
      'Keep responses concise for testing',
      'Focus on the specific functionality being validated',
    ],
  },
  knowledge: [],
  plugins: [],
};

describe('Platform Runtime Integration Tests', () => {
  let runtime: IAgentRuntime;
  let harness: RuntimeTestHarness;
  let testSessionId: string;
  let userId: UUID;
  let roomId: UUID;

  beforeAll(async () => {
    // Initialize database
    const database = await getDatabase();
    initializeDbProxy(database);

    try {
      // Create real ElizaOS runtime instance using test harness
      const result = await createTestRuntime({
        character: testCharacter,
        plugins: [],
        apiKeys: {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-token',
        },
      });

      runtime = result.runtime;
      harness = result.harness;

      // Verify runtime is properly initialized
      expect(runtime).toBeDefined();
      expect(runtime.agentId).toBeDefined();
      expect(runtime.character.name).toBe('Platform Test Agent');

      console.log('✅ Real ElizaOS runtime initialized for platform testing');
    } catch (error) {
      console.warn(
        'ElizaOS runtime creation failed, some tests will be skipped:',
        (error as Error).message,
      );
      // Set runtime to null so tests can check and skip appropriately
      runtime = null as any;
      harness = null as any;
    }
  });

  afterAll(async () => {
    // Cleanup runtime properly
    if (harness) {
      await harness.cleanup();
      console.log('✅ Runtime tests completed and cleaned up');
    }
  });

  beforeEach(async () => {
    // Create test session
    const sessionData = {
      sessionId: `test-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      chatHistory: [] as ChatMessage[],
      workflowProgress: {
        currentStep: 'discovery',
        workflowType: null,
        requirements: {},
        generatedAssets: [],
        customizations: [],
      } as WorkflowProgress,
      userPreferences: {
        theme: 'system' as const,
        language: 'en',
        notifications: true,
      },
      generatedContent: [],
      ipAddress: '127.0.0.1',
      userAgent: 'Platform-Test/1.0',
    };

    testSessionId = await anonymousSessionRepo.createSession(sessionData);
    expect(testSessionId).toBeDefined();

    // Create test user and room IDs for runtime
    userId = `user-${Date.now()}` as UUID;
    roomId = `room-${Date.now()}` as UUID;

    console.log(`✅ Test session created: ${testSessionId}`);
  });

  afterEach(async () => {
    // Cleanup test session
    if (testSessionId) {
      await anonymousSessionRepo.deleteSession(testSessionId);
    }
  });

  describe('Anonymous Session Management', () => {
    it('should create and retrieve anonymous sessions with real database', async () => {
      const session = await anonymousSessionRepo.getSession(testSessionId);

      expect(session).toBeDefined();
      expect(session?.sessionId).toBe(testSessionId);
      expect(session?.chatHistory).toEqual([]);
      expect(session?.workflowProgress.currentStep).toBe('discovery');
      expect(session?.ipAddress).toBe('127.0.0.1');
    });

    it('should persist chat messages to real database', async () => {
      const testMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: 'Hello, I want to create an n8n workflow',
        timestamp: new Date(),
        metadata: {},
      };

      const success = await anonymousSessionRepo.addMessage(
        testSessionId,
        testMessage,
      );
      expect(success).toBe(true);

      const session = await anonymousSessionRepo.getSession(testSessionId);
      expect(session?.chatHistory).toHaveLength(1);
      expect(session?.chatHistory[0].content).toBe(
        'Hello, I want to create an n8n workflow',
      );
      expect(session?.chatHistory[0].role).toBe('user');
    });

    it('should update workflow progress in real database', async () => {
      const updatedProgress = {
        currentStep: 'requirements',
        workflowType: 'n8n_workflow',
        requirements: {
          connectors: ['Google Sheets', 'Slack'],
          trigger: 'Form submission',
          actions: ['Send notification', 'Update database'],
        },
        generatedAssets: [],
        customizations: [],
      };

      const success = await anonymousSessionRepo.updateSession(testSessionId, {
        workflowProgress: updatedProgress,
      });
      expect(success).toBe(true);

      const session = await anonymousSessionRepo.getSession(testSessionId);
      expect(session?.workflowProgress.workflowType).toBe('n8n_workflow');
      expect(session?.workflowProgress.requirements.connectors).toContain(
        'Google Sheets',
      );
    });
  });

  describe('AI Chat Service Integration', () => {
    it('should generate real AI responses using OpenAI', async () => {
      const testMessage =
        'I want to create a workflow that connects Google Sheets to Slack';
      const chatContext = {
        currentStep: 'discovery',
        userContext: {
          interestedIn: 'n8n_workflow',
        },
        chatHistory: [],
        sessionId: testSessionId,
      };

      const response = await chatService.generateChatResponse(
        testMessage,
        chatContext,
      );

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(10); // Real AI should provide substantial response
      expect(response.suggestions).toBeDefined();
      expect(Array.isArray(response.suggestions)).toBe(true);

      // Verify response is contextually relevant
      const lowerContent = response.content.toLowerCase();
      expect(
        lowerContent.includes('google sheets') ||
          lowerContent.includes('slack') ||
          lowerContent.includes('workflow') ||
          lowerContent.includes('automation'),
      ).toBe(true);

      console.log(
        '✅ Real AI response generated:',
        `${response.content.substring(0, 100)}...`,
      );
    });

    it('should progress through workflow steps based on AI context', async () => {
      // Test discovery -> requirements progression
      const discoveryMessage =
        'I need an n8n workflow for my e-commerce business';
      const discoveryContext = {
        currentStep: 'discovery',
        userContext: {},
        chatHistory: [],
        sessionId: testSessionId,
      };

      const discoveryResponse = await chatService.generateChatResponse(
        discoveryMessage,
        discoveryContext,
      );
      expect(discoveryResponse.nextStep).toBeDefined();

      // Test requirements step
      const requirementsMessage =
        'I want to sync orders from Shopify to our CRM and send email notifications';
      const requirementsContext = {
        currentStep: 'requirements',
        userContext: {
          workflowType: 'n8n_workflow',
          domain: 'e-commerce',
        },
        chatHistory: [
          { role: 'user' as const, content: discoveryMessage },
          { role: 'assistant' as const, content: discoveryResponse.content },
        ],
        sessionId: testSessionId,
      };

      const requirementsResponse = await chatService.generateChatResponse(
        requirementsMessage,
        requirementsContext,
      );
      expect(requirementsResponse).toBeDefined();
      expect(requirementsResponse.content).toBeDefined();

      console.log(
        '✅ Workflow progression tested through AI context management',
      );
    });

    it('should handle AI service failures gracefully', async () => {
      // Test with invalid API context to trigger fallback
      const chatContext = {
        currentStep: 'discovery',
        userContext: {},
        chatHistory: [],
        sessionId: testSessionId,
      };

      // Create a context that might challenge the AI service
      const complexMessage = 'X'.repeat(10000); // Very long message that might cause issues

      const response = await chatService.generateChatResponse(
        complexMessage,
        chatContext,
      );

      // Should still return a valid response (either AI or fallback)
      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe('string');
      expect(response.suggestions).toBeDefined();

      console.log('✅ AI service graceful failure handling verified');
    });
  });

  describe('Asset Generation with Real AI', () => {
    it('should generate functional n8n workflow using real AI', async () => {
      const requirements = {
        type: 'n8n_workflow' as const,
        description: 'Sync customer data from CRM to email marketing platform',
        requirements: {
          source: 'HubSpot CRM',
          destination: 'Mailchimp',
          trigger: 'New contact created',
          frequency: 'Real-time',
        },
        userContext: {
          domain: 'marketing',
          tools: ['HubSpot', 'Mailchimp'],
        },
      };

      const asset = await chatService.generateAsset(requirements);

      expect(asset).toBeDefined();
      expect(asset.type).toBe('n8n_workflow');
      expect(asset.name).toBeDefined();
      expect(asset.description).toBeDefined();
      expect(asset.data).toBeDefined();

      // Verify the generated data is valid
      if (typeof asset.data === 'object' && asset.data !== null) {
        // Should have proper n8n workflow structure
        const workflow = asset.data as any;
        if (workflow.nodes) {
          expect(Array.isArray(workflow.nodes)).toBe(true);
        }
        if (workflow.connections) {
          expect(typeof workflow.connections).toBe('object');
        }
      }

      console.log('✅ N8N workflow generated with real AI:', asset.name);
    });

    it('should generate functional MCP server using real AI', async () => {
      const requirements = {
        type: 'mcp' as const,
        description: 'Database operations server for customer management',
        requirements: {
          database: 'PostgreSQL',
          operations: [
            'Create customer',
            'Update customer',
            'Search customers',
          ],
          authentication: 'API key',
        },
        userContext: {
          domain: 'customer_service',
          database: 'PostgreSQL',
        },
      };

      const asset = await chatService.generateAsset(requirements);

      expect(asset).toBeDefined();
      expect(asset.type).toBe('mcp');
      expect(asset.name).toBeDefined();
      expect(asset.description).toBeDefined();
      expect(asset.data).toBeDefined();

      // Verify the generated MCP server has code
      const mcpData = asset.data as any;
      expect(mcpData.code || mcpData.rawContent).toBeDefined();

      console.log('✅ MCP server generated with real AI:', asset.name);
    });

    it('should generate functional agent config using real AI', async () => {
      const requirements = {
        type: 'agent_config' as const,
        description:
          'Customer support agent with order management capabilities',
        requirements: {
          capabilities: [
            'Answer questions',
            'Check order status',
            'Process returns',
          ],
          personality: 'Helpful and professional',
          integrations: ['Order system', 'Knowledge base'],
        },
        userContext: {
          domain: 'customer_service',
          businessType: 'e-commerce',
        },
      };

      const asset = await chatService.generateAsset(requirements);

      expect(asset).toBeDefined();
      expect(asset.type).toBe('agent_config');
      expect(asset.name).toBeDefined();
      expect(asset.description).toBeDefined();
      expect(asset.data).toBeDefined();

      console.log('✅ Agent config generated with real AI:', asset.name);
    });

    it('should persist generated assets to real database', async () => {
      const generatedContent = {
        type: 'n8n_workflow' as const,
        name: 'Test Workflow',
        description: 'A test workflow for validation',
        data: { nodes: [], connections: {} },
        preview: '{}',
        downloadUrl: undefined,
        createdAt: new Date(),
      };

      const success = await anonymousSessionRepo.addGeneratedContent(
        testSessionId,
        generatedContent,
      );
      expect(success).toBe(true);

      const session = await anonymousSessionRepo.getSession(testSessionId);
      expect(session?.generatedContent).toHaveLength(1);
      expect(session?.generatedContent[0].name).toBe('Test Workflow');
      expect(session?.generatedContent[0].type).toBe('n8n_workflow');

      console.log('✅ Generated asset persisted to real database');
    });
  });

  describe('Runtime Memory Integration', () => {
    it('should create memories in ElizaOS runtime from platform data', async () => {
      // Create a memory in the ElizaOS runtime
      const testMemory: Memory = {
        id: `memory-${Date.now()}` as UUID,
        entityId: userId,
        content: {
          text: 'User wants to create an n8n workflow for e-commerce automation',
          source: 'platform_chat',
          metadata: {
            sessionId: testSessionId,
            workflowType: 'n8n_workflow',
            userRequirements: ['Shopify integration', 'Email notifications'],
          },
        },
        roomId,
        embedding: undefined, // Will be generated by runtime
      };

      await runtime.createMemory(testMemory, 'memories');

      // Retrieve memories to verify persistence
      const memories = await runtime.getMemories({
        roomId,
        count: 10,
        tableName: 'messages',
      });

      expect(memories).toBeDefined();
      expect(Array.isArray(memories)).toBe(true);

      // Find our test memory
      const testMemoryFound = memories.find((m) =>
        m.content.text?.includes('n8n workflow for e-commerce automation'),
      );
      expect(testMemoryFound).toBeDefined();
      expect((testMemoryFound?.content as any)?.metadata?.sessionId).toBe(
        testSessionId,
      );

      console.log('✅ Memory created in ElizaOS runtime from platform data');
    });

    it('should search memories using ElizaOS semantic search', async () => {
      // Create a memory with embedding
      const memory: Memory = {
        id: `memory-search-${Date.now()}` as UUID,
        entityId: userId,
        content: {
          text: 'Customer wants automated email marketing workflow with Mailchimp integration',
          source: 'platform_requirements',
        },
        roomId,
      };

      await runtime.createMemory(memory, 'memories');

      // Generate embedding for search query
      const searchQuery = 'email marketing automation';
      const searchEmbedding = await runtime.useModel('TEXT_EMBEDDING', {
        text: searchQuery,
      });

      // Perform semantic search
      const searchResults = await runtime.searchMemories({
        embedding: searchEmbedding,
        match_threshold: 0.1,
        count: 5,
        tableName: 'messages',
        roomId,
      });

      expect(searchResults).toBeDefined();
      expect(Array.isArray(searchResults)).toBe(true);

      console.log(
        `✅ Semantic search performed, found ${searchResults.length} relevant memories`,
      );
    });
  });

  describe('End-to-End Platform Integration', () => {
    it('should complete full workflow: session -> chat -> generation -> persistence', async () => {
      // Step 1: Start chat conversation
      const userMessage = 'I need help creating a Slack integration workflow';
      const chatContext = {
        currentStep: 'discovery',
        userContext: {},
        chatHistory: [],
        sessionId: testSessionId,
      };

      const chatResponse = await chatService.generateChatResponse(
        userMessage,
        chatContext,
      );
      expect(chatResponse).toBeDefined();

      // Step 2: Save chat to session
      const userChatMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
        metadata: {},
      };

      await anonymousSessionRepo.addMessage(testSessionId, userChatMessage);

      const assistantChatMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: chatResponse.content,
        timestamp: new Date(),
        metadata: {
          suggestions: chatResponse.suggestions,
          workflowStep: chatResponse.workflowStep,
        },
      };

      await anonymousSessionRepo.addMessage(
        testSessionId,
        assistantChatMessage,
      );

      // Step 3: Generate asset
      const assetRequirements = {
        type: 'n8n_workflow' as const,
        description: 'Slack integration workflow for team notifications',
        requirements: {
          platform: 'Slack',
          triggers: ['Webhook', 'Schedule'],
          actions: ['Send message', 'Create channel'],
        },
        userContext: {
          domain: 'team_collaboration',
          platform: 'Slack',
        },
      };

      const generatedAsset = await chatService.generateAsset(assetRequirements);
      expect(generatedAsset).toBeDefined();

      // Step 4: Save generated asset to session
      const success = await anonymousSessionRepo.addGeneratedContent(
        testSessionId,
        {
          type: generatedAsset.type,
          name: generatedAsset.name,
          description: generatedAsset.description,
          data: generatedAsset.data,
          preview: generatedAsset.preview,
          downloadUrl: generatedAsset.downloadUrl,
          createdAt: new Date(),
        },
      );
      expect(success).toBe(true);

      // Step 5: Verify complete session state
      const finalSession = await anonymousSessionRepo.getSession(testSessionId);
      expect(finalSession?.chatHistory).toHaveLength(2);
      expect(finalSession?.generatedContent).toHaveLength(1);
      expect(finalSession?.generatedContent[0].type).toBe('n8n_workflow');

      console.log('✅ Complete end-to-end platform workflow validated');
    });
  });
});
