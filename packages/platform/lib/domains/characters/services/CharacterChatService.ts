/**
 * Character Chat Service
 * ElizaOS character file processing and conversation management
 */

import {
  CharacterChatRequest,
  CharacterChatSession,
  ChatMessage,
  ConversationContext,
  PersonalityState,
  MemoryItem,
} from '../../generation/types/enhanced-types';
import { getDatabaseClient } from '@/lib/database';
import { agents, conversations, messages } from '@/lib/database/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import {
  Character,
  IAgentRuntime,
  UUID,
  Memory,
  State,
  Content,
  ModelType,
} from '@elizaos/core';
import { AuthContext, PermissionChecker } from '@/lib/auth/context';
import { createAgentRuntime } from '@/lib/agents/create-runtime';

type DatabaseClient = ReturnType<typeof getDatabaseClient>;

interface CharacterChatConfig {
  database: DatabaseClient;
  memoryLimit?: number;
  contextWindow?: number;
  personalityDecay?: number;
  // ElizaOS runtime configuration
  modelProviders?: {
    TEXT_LARGE?: string;
    TEXT_SMALL?: string;
    TEXT_EMBEDDING?: string;
  };
  runtimeConfig?: {
    databaseUrl?: string;
    modelProvider?: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    [key: string]: string | undefined;
  };
}

export class CharacterChatService {
  private database: DatabaseClient;
  private config: {
    memoryLimit: number;
    contextWindow: number;
    personalityDecay: number;
    modelProviders: {
      TEXT_LARGE: string;
      TEXT_SMALL: string;
      TEXT_EMBEDDING: string;
    };
    runtimeConfig: Record<string, string>;
  };
  private characterCache = new Map<string, Character>();
  private sessionCache = new Map<string, CharacterChatSession>();
  private runtimeCache = new Map<string, IAgentRuntime>(); // Cache runtimes per character

  constructor(config: CharacterChatConfig) {
    this.database = config.database;
    this.config = {
      memoryLimit: config.memoryLimit || 100,
      contextWindow: config.contextWindow || 20,
      personalityDecay: config.personalityDecay || 0.1,
      modelProviders: {
        TEXT_LARGE: config.modelProviders?.TEXT_LARGE || 'gpt-4o-mini',
        TEXT_SMALL: config.modelProviders?.TEXT_SMALL || 'gpt-4o-mini',
        TEXT_EMBEDDING:
          config.modelProviders?.TEXT_EMBEDDING || 'text-embedding-3-small',
      },
      runtimeConfig: {
        DATABASE_URL:
          config.runtimeConfig?.databaseUrl || process.env.DATABASE_URL || '',
        OPENAI_API_KEY:
          config.runtimeConfig?.openaiApiKey ||
          process.env.OPENAI_API_KEY ||
          '',
        ANTHROPIC_API_KEY:
          config.runtimeConfig?.anthropicApiKey ||
          process.env.ANTHROPIC_API_KEY ||
          '',
        ...config.runtimeConfig,
      },
    };
  }

  /**
   * Get or create ElizaOS runtime for a character
   */
  private async getCharacterRuntime(
    character: Character,
    authContext: AuthContext,
  ): Promise<IAgentRuntime> {
    const cacheKey = `${character.id}-${authContext.organizationId}`;

    // Check cache first
    if (this.runtimeCache.has(cacheKey)) {
      return this.runtimeCache.get(cacheKey)!;
    }

    try {
      // Create ElizaOS runtime for this character
      const runtime = await createAgentRuntime({
        character,
        modelProvider: this.config.modelProviders.TEXT_LARGE.includes('gpt')
          ? 'openai'
          : 'anthropic',
      });

      // Store in cache
      this.runtimeCache.set(cacheKey, runtime);

      logger.info('Created ElizaOS runtime for character', {
        characterId: character.id,
        characterName: character.name,
        organizationId: authContext.organizationId,
        plugins: character.plugins?.length || 0,
      });

      return runtime;
    } catch (error) {
      logger.error(
        'Failed to create ElizaOS runtime',
        error instanceof Error ? error : new Error(String(error)),
        {
          characterId: character.id,
          characterName: character.name,
        },
      );
      throw new Error(
        `Failed to initialize character runtime: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Load character from ElizaOS character file
   */
  async loadCharacter(
    characterData: Character,
    authContext: AuthContext,
  ): Promise<string> {
    try {
      // Check permissions
      PermissionChecker.requirePermission(
        authContext,
        'agents:write',
        'Cannot create characters',
      );

      // Validate character data
      const validation = this.validateCharacter(characterData);
      if (!validation.valid) {
        throw new Error(`Invalid character: ${validation.errors.join(', ')}`);
      }

      // Generate character ID if not provided
      const characterId = characterData.id || uuidv4();
      const character: Character = {
        ...characterData,
        id: characterId as UUID,
      };

      // Store character in database using agents table with proper auth context
      const db = await getDatabaseClient();
      const insertResult = await db
        .insert(agents)
        .values({
          organizationId: authContext.organizationId,
          createdByUserId: authContext.userId,
          name: character.name,
          slug: character.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          character: character as any, // Store full character config in character field
          deploymentStatus: 'draft',
          visibility: 'private',
        })
        .returning();

      // Update character with the generated ID
      const dbCharacter = insertResult[0];
      character.id = dbCharacter.id as UUID;

      // Cache character
      this.characterCache.set(character.id!, character);

      logger.info('Character loaded successfully', {
        characterId,
        name: character.name,
        plugins: character.plugins?.length || 0,
        knowledge: character.knowledge?.length || 0,
      });

      return characterId;
    } catch (error) {
      logger.error(
        'Failed to load character',
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  }

  /**
   * Start or continue a chat session with a character
   */
  async chatWithCharacter(
    request: CharacterChatRequest,
    authContext: AuthContext,
  ): Promise<{
    response: string;
    session_id: string;
    tokens_used: number;
    cost: number;
    personality_update?: Partial<PersonalityState>;
  }> {
    try {
      // Check permissions
      PermissionChecker.requirePermission(
        authContext,
        'chat:write',
        'Cannot send chat messages',
      );

      // Verify character access
      const character = await this.getCharacter(
        request.character_id,
        authContext,
      );

      // Get or create session
      const session = await this.getOrCreateSession(
        request.character_id,
        authContext.userId,
        authContext,
      );

      // Update conversation context
      await this.updateContext(session, request.message, 'user', authContext);

      // Generate response using ElizaOS runtime
      const responseData = await this.generateCharacterResponse(
        character,
        session,
        request,
        authContext,
      );

      // Update session with response
      await this.updateContext(
        session,
        responseData.response,
        'assistant',
        authContext,
      );

      // Update personality state
      const personalityUpdate = await this.updatePersonalityState(
        character,
        session,
        request,
        responseData.response,
      );

      // Calculate cost
      const cost = this.calculateChatCost(
        responseData.tokens_used,
        request.max_tokens || 500,
      );

      // Save session
      await this.saveSession(session);

      logger.info('Character chat completed', {
        character_id: request.character_id,
        session_id: session.id,
        tokens_used: responseData.tokens_used,
        cost,
        message_count: session.message_count,
      });

      return {
        response: responseData.response,
        session_id: session.id,
        tokens_used: responseData.tokens_used,
        cost,
        personality_update: personalityUpdate,
      };
    } catch (error) {
      logger.error(
        'Character chat failed',
        error instanceof Error ? error : new Error(String(error)),
        { character_id: request.character_id },
      );
      throw error;
    }
  }

  /**
   * Get character chat session
   */
  async getSession(sessionId: string): Promise<CharacterChatSession | null> {
    try {
      // Check cache first
      if (this.sessionCache.has(sessionId)) {
        return this.sessionCache.get(sessionId)!;
      }

      // Load from database using conversations table
      const db = await getDatabaseClient();
      const result = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, sessionId))
        .limit(1);
      if (result.length === 0) {
        return null;
      }

      const conversation = result[0];

      // Get messages for this conversation
      const messageResults = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, sessionId))
        .orderBy(messages.createdAt);

      // Convert to CharacterChatSession format
      const session: CharacterChatSession = {
        id: conversation.id,
        character_id: conversation.agentId,
        user_id: conversation.userId,
        messages: messageResults.map((msg: any) => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content.text || '',
          timestamp: msg.createdAt,
          tokens_used: msg.tokenCount,
        })),
        context: conversation.context as ConversationContext,
        personality_state: {
          current_mood: 'neutral',
          energy_level: 0.7,
          conversation_style: 'chat',
          topics_of_interest: [],
          recent_memories: [],
        },
        created_at: conversation.createdAt,
        updated_at: conversation.updatedAt,
        last_active: conversation.lastMessageAt || conversation.updatedAt,
        message_count: conversation.messageCount,
        total_tokens: 0,
      };

      this.sessionCache.set(sessionId, session);
      return session;
    } catch (error) {
      logger.error(
        'Failed to get session',
        error instanceof Error ? error : new Error(String(error)),
        { sessionId },
      );
      return null;
    }
  }

  /**
   * Get character by ID with proper access control
   */
  async getCharacter(
    characterId: string,
    authContext: AuthContext,
  ): Promise<Character> {
    // Check permissions
    PermissionChecker.requirePermission(
      authContext,
      'agents:read',
      'Cannot access characters',
    );

    // Check cache first
    if (this.characterCache.has(characterId)) {
      const cachedCharacter = this.characterCache.get(characterId)!;
      // Verify organization access
      await this.verifyCharacterAccess(characterId, authContext);
      return cachedCharacter;
    }

    // Load from database using agents table with organization filtering
    const db = await getDatabaseClient();
    const result = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.id, characterId),
          eq(agents.organizationId, authContext.organizationId),
        ),
      )
      .limit(1);

    if (result.length === 0) {
      throw new Error(`Character not found or access denied: ${characterId}`);
    }

    const agent = result[0];
    const character = agent.character as Character;

    this.characterCache.set(characterId, character);
    return character;
  }

  /**
   * Verify user has access to character
   */
  private async verifyCharacterAccess(
    characterId: string,
    authContext: AuthContext,
  ): Promise<void> {
    const db = await getDatabaseClient();
    const result = await db
      .select({ organizationId: agents.organizationId })
      .from(agents)
      .where(eq(agents.id, characterId))
      .limit(1);

    if (result.length === 0) {
      throw new Error(`Character not found: ${characterId}`);
    }

    if (result[0].organizationId !== authContext.organizationId) {
      throw new Error(`Access denied to character: ${characterId}`);
    }
  }

  /**
   * List all available characters
   */
  async listCharacters(userId?: string): Promise<Character[]> {
    try {
      const db = await getDatabaseClient();
      // Query agents table for characters
      const agentResults = userId
        ? await db
            .select()
            .from(agents)
            .where(eq(agents.createdByUserId, userId))
        : await db.select().from(agents);

      // Extract character data from agents
      return agentResults.map((agent: any) => agent.character as Character);
    } catch (error: any) {
      logger.error('Failed to list characters', error);
      throw error;
    }
  }

  private async getOrCreateSession(
    characterId: string,
    userId: string,
    authContext: AuthContext,
  ): Promise<CharacterChatSession> {
    // Try to find existing active session using conversations table
    const db = await getDatabaseClient();
    const existingConversations = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.agentId, characterId),
          eq(conversations.userId, userId),
          eq(conversations.isActive, true),
        ),
      )
      .limit(1);

    if (existingConversations.length > 0) {
      const sessionId = existingConversations[0].id;
      const session = await this.getSession(sessionId);
      if (session) {
        return session;
      }
    }

    // Create new session
    const character = await this.getCharacter(characterId, authContext);
    const sessionId = uuidv4();

    // Create conversation in database
    await db.insert(conversations).values({
      id: sessionId,
      organizationId: authContext.organizationId, // Use proper organization from auth context
      agentId: characterId,
      userId,
      title: `Chat with ${character.name}`,
      context: {
        summary: `Starting conversation with ${character.name}`,
        key_topics: [],
        emotional_state: 'neutral',
        relationship_level: 0,
        memory_items: [],
      },
      isActive: true,
      messageCount: 0,
    });

    const session: CharacterChatSession = {
      id: sessionId,
      character_id: characterId,
      user_id: userId,
      messages: [],
      context: {
        summary: `Starting conversation with ${character.name}`,
        key_topics: [],
        emotional_state: 'neutral',
        relationship_level: 0,
        memory_items: [],
      },
      personality_state: {
        current_mood: 'neutral',
        energy_level: 0.7,
        conversation_style: 'chat',
        topics_of_interest: (character as any).topics || [],
        recent_memories: [],
      },
      created_at: new Date(),
      updated_at: new Date(),
      last_active: new Date(),
      message_count: 0,
      total_tokens: 0,
    };

    this.sessionCache.set(session.id, session);
    return session;
  }

  private async generateCharacterResponse(
    character: Character,
    session: CharacterChatSession,
    request: CharacterChatRequest,
    authContext: AuthContext,
  ): Promise<{ response: string; tokens_used: number }> {
    try {
      // Get ElizaOS runtime for this character
      const runtime = await this.getCharacterRuntime(character, authContext);

      // Create ElizaOS-compatible message memory
      const messageMemory: Memory = {
        id: uuidv4() as UUID,
        entityId: session.user_id as UUID,
        agentId: runtime.agentId,
        roomId: session.id as UUID,
        content: {
          text: request.message,
          source: 'user',
        } as Content,
        createdAt: Date.now(),
      };

      // Compose state for the runtime
      const state = await runtime.composeState(messageMemory);

      // Use ElizaOS runtime to generate response
      const response = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt: this.buildElizaPrompt(character, session, request, state),
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 500,
        stop: ['\nUser:', '\nHuman:', '###'],
      });

      // Extract response text (ElizaOS may return different formats)
      const responseText =
        typeof response === 'string'
          ? response
          : (response as any).text || (response as any).content || '';

      // Calculate actual tokens used (if available from runtime)
      const tokens_used =
        typeof response === 'string'
          ? Math.ceil(responseText.length / 4)
          : (response as any).usage?.total_tokens ||
            Math.ceil(responseText.length / 4);

      // Store message in ElizaOS memory system
      const responseMemory: Memory = {
        id: uuidv4() as UUID,
        entityId: runtime.agentId,
        agentId: runtime.agentId,
        roomId: session.id as UUID,
        content: {
          text: responseText.trim(),
          thought: 'Generated response for user',
          source: 'agent',
        } as Content,
        createdAt: Date.now(),
      };

      // Store memory if runtime supports it
      if ('memoryManager' in runtime && runtime.memoryManager) {
        await (runtime as any).memoryManager.createMemory(responseMemory);
      } else if (
        'createMemory' in runtime &&
        typeof runtime.createMemory === 'function'
      ) {
        await (runtime as any).createMemory(responseMemory, {
          preserveEmptySets: true,
        });
      }

      logger.info('Generated character response using ElizaOS runtime', {
        characterId: character.id,
        sessionId: session.id,
        tokensUsed: tokens_used,
        responseLength: responseText.length,
      });

      return { response: responseText.trim(), tokens_used };
    } catch (error) {
      logger.error(
        'Failed to generate character response',
        error instanceof Error ? error : new Error(String(error)),
        {
          characterId: character.id,
          sessionId: session.id,
        },
      );

      // Fallback to a simple error response
      return {
        response:
          "I'm having trouble processing your message right now. Please try again.",
        tokens_used: 10,
      };
    }
  }

  /**
   * Build ElizaOS-compatible prompt with proper state context
   */
  private buildElizaPrompt(
    character: Character,
    session: CharacterChatSession,
    request: CharacterChatRequest,
    state: State,
  ): string {
    const bio = Array.isArray(character.bio)
      ? character.bio.join('\n')
      : character.bio;

    // Use ElizaOS state context for more accurate responses
    const context = state.providers || {};
    const recentMessages = session.messages.slice(-this.config.contextWindow);

    let prompt = `# Character: ${character.name}\n\n`;

    // Add character bio
    prompt += `## Bio\n${bio}\n\n`;

    if ((character as any).topics && (character as any).topics.length > 0) {
      prompt += `- Topics of interest: ${(character as any).topics.join(', ')}\n`;
    }

    prompt += `- Current mood: ${session.personality_state.current_mood}\n`;
    prompt += `- Energy level: ${Math.round(session.personality_state.energy_level * 100)}%\n\n`;

    // Add style guidelines from character
    if (character.style) {
      prompt += '## Style Guidelines\n';
      if (character.style.all && character.style.all.length > 0) {
        prompt += `- General style: ${character.style.all.join(', ')}\n`;
      }
      if (character.style.chat && character.style.chat.length > 0) {
        prompt += `- Chat style: ${character.style.chat.join(', ')}\n`;
      }
    }

    // Add message examples from character
    if (character.messageExamples && character.messageExamples.length > 0) {
      prompt += '\n## Example Interactions\n';
      character.messageExamples.slice(0, 2).forEach((example) => {
        example.forEach((msg) => {
          prompt += `${msg.name}: ${msg.content.text}\n`;
        });
        prompt += '\n';
      });
    }

    // Add conversation context
    prompt += '## Current Conversation\n';
    recentMessages.forEach((msg) => {
      const role = msg.role === 'user' ? 'User' : character.name;
      prompt += `${role}: ${msg.content}\n`;
    });

    // Add current user message and response prompt
    prompt += `User: ${request.message}\n${character.name}:`;

    return prompt;
  }

  private buildCharacterPrompt(
    character: Character,
    session: CharacterChatSession,
    request: CharacterChatRequest,
  ): string {
    const bio = Array.isArray(character.bio)
      ? character.bio.join('\n')
      : character.bio;
    const style = this.buildStyleGuidance(character, request.response_style);

    const prompt = `# Character: ${character.name}

## Bio
${bio}


## Personality
- Topics of interest: ${character.topics?.join(', ') || 'general conversation'}
- Current mood: ${session.personality_state.current_mood}
- Energy level: ${Math.round(session.personality_state.energy_level * 100)}%

## Style Guidelines
${style}

## Example Interactions
${this.buildExamples(character)}

## Current Conversation Context
${this.buildConversationContext(session)}

## Instructions
You are ${character.name}. Respond in character, maintaining consistency with your personality, bio, and conversation history. ${request.maintain_personality ? 'Stay true to your established personality traits and speaking style.' : 'You may adapt your personality slightly based on the conversation.'}

Current conversation:
${this.buildRecentMessages(session)}

User: ${request.message}
${character.name}:`;

    return prompt;
  }

  private buildStyleGuidance(
    character: Character,
    responseStyle?: string,
  ): string {
    const styleArray =
      responseStyle === 'chat'
        ? character.style?.chat
        : responseStyle === 'post'
          ? character.style?.post
          : character.style?.all || [];

    if (styleArray && styleArray.length > 0) {
      return `- Writing style: ${styleArray.join(', ')}`;
    }

    return '- Writing style: natural, conversational';
  }

  private buildExamples(character: Character): string {
    if (!character.messageExamples || character.messageExamples.length === 0) {
      return 'No specific examples provided.';
    }

    return character.messageExamples
      .slice(0, 3) // Limit to 3 examples
      .map((example) => {
        return example
          .map((msg) => `${msg.name}: ${msg.content.text}`)
          .join('\n');
      })
      .join('\n\n');
  }

  private buildConversationContext(session: CharacterChatSession): string {
    const context = session.context;
    let contextStr = `Summary: ${context.summary}\n`;

    if (context.key_topics.length > 0) {
      contextStr += `Key topics discussed: ${context.key_topics.join(', ')}\n`;
    }

    contextStr += `Emotional state: ${context.emotional_state}\n`;
    contextStr += `Relationship level: ${Math.round(context.relationship_level * 100)}%\n`;

    if (context.memory_items.length > 0) {
      const recentMemories = context.memory_items
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 3)
        .map((m) => `- ${m.content}`)
        .join('\n');
      contextStr += `Important memories:\n${recentMemories}\n`;
    }

    return contextStr;
  }

  private buildRecentMessages(session: CharacterChatSession): string {
    return session.messages
      .slice(-this.config.contextWindow)
      .map(
        (msg) =>
          `${msg.role === 'user' ? 'User' : session.character_id}: ${msg.content}`,
      )
      .join('\n');
  }

  private async updateContext(
    session: CharacterChatSession,
    message: string,
    role: 'user' | 'assistant',
    authContext: AuthContext,
  ): Promise<void> {
    // Add message to session
    const chatMessage: ChatMessage = {
      id: uuidv4(),
      role,
      content: message,
      timestamp: new Date(),
      tokens_used: Math.ceil(message.length / 4),
    };

    // Save message to database
    const db = await getDatabaseClient();
    await db.insert(messages).values({
      id: chatMessage.id,
      organizationId: authContext.organizationId, // Use proper organization from auth context
      conversationId: session.id,
      agentId: session.character_id,
      userId: role === 'user' ? session.user_id : undefined,
      content: {
        text: message,
        thought: role === 'assistant' ? 'Generated response' : undefined,
      },
      role,
      tokenCount: chatMessage.tokens_used || 0,
      cost: '0', // This could be calculated based on actual token usage
      processingTime: 0,
    });

    session.messages.push(chatMessage);
    session.message_count++;
    session.total_tokens += chatMessage.tokens_used || 0;
    session.last_active = new Date();

    // Update conversation summary periodically
    if (session.messages.length % 10 === 0) {
      await this.updateConversationSummary(session, authContext);
    }

    // Extract and store important information
    if (role === 'user') {
      await this.extractMemories(session, message);
    }
  }

  private async updateConversationSummary(
    session: CharacterChatSession,
    authContext: AuthContext,
  ): Promise<void> {
    try {
      // Get character for this session
      const character = await this.getCharacter(
        session.character_id,
        authContext,
      );
      const runtime = await this.getCharacterRuntime(character, authContext);

      const recentMessages = session.messages
        .slice(-20)
        .map((m) => m.content)
        .join('\n');
      const summaryPrompt = `Summarize this conversation in 2-3 sentences, focusing on key topics and relationship development:\n\n${recentMessages}`;

      const summary = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt: summaryPrompt,
        max_tokens: 150,
        temperature: 0.3,
      });

      const summaryText =
        typeof summary === 'string'
          ? summary
          : (summary as any).text || (summary as any).content || '';
      session.context.summary = summaryText.trim();

      // Extract key topics
      const topics = await this.extractTopics(recentMessages, runtime);
      session.context.key_topics = [
        ...new Set([...session.context.key_topics, ...topics]),
      ].slice(0, 10);
    } catch (error) {
      logger.warn(
        'Failed to update conversation summary',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  private async extractMemories(
    session: CharacterChatSession,
    message: string,
  ): Promise<void> {
    try {
      // Simple keyword-based memory extraction
      const importantKeywords = [
        'remember',
        'important',
        'never forget',
        'always',
        'my name is',
        'i am',
        'i like',
        'i hate',
      ];

      if (
        importantKeywords.some((keyword) =>
          message.toLowerCase().includes(keyword),
        )
      ) {
        const memory: MemoryItem = {
          content: message,
          importance: 0.8,
          timestamp: new Date(),
          tags: await this.extractTags(message),
          emotional_weight: this.analyzeEmotionalWeight(message),
        };

        session.context.memory_items.push(memory);

        // Keep only most important memories
        if (session.context.memory_items.length > this.config.memoryLimit) {
          session.context.memory_items = session.context.memory_items
            .sort((a, b) => b.importance - a.importance)
            .slice(0, this.config.memoryLimit);
        }
      }
    } catch (error: any) {
      logger.warn('Failed to extract memories', error);
    }
  }

  private async extractTopics(
    text: string,
    runtime?: IAgentRuntime,
  ): Promise<string[]> {
    try {
      if (runtime) {
        // Use ElizaOS runtime for intelligent topic extraction
        const topicPrompt = `Extract 3-5 key topics from this conversation:\n\n${text}\n\nTopics (comma-separated):`;

        const response = await runtime.useModel(ModelType.TEXT_SMALL, {
          prompt: topicPrompt,
          max_tokens: 50,
          temperature: 0.1,
        });

        const responseText =
          typeof response === 'string'
            ? response
            : (response as any).text || (response as any).content || '';
        const topics = responseText
          .split(',')
          .map((t: string) => t.trim().toLowerCase())
          .filter((t: string) => t.length > 2);
        return topics.slice(0, 5);
      }
    } catch (error) {
      logger.warn(
        'Failed to extract topics using runtime, falling back to simple extraction',
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    // Fallback: Simple topic extraction - keyword filtering
    const words = text.toLowerCase().split(/\s+/);
    const commonWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'can',
      'must',
      'this',
      'that',
      'these',
      'those',
    ]);

    return words
      .filter((word) => word.length > 3 && !commonWords.has(word))
      .slice(0, 5);
  }

  private async extractTags(text: string): Promise<string[]> {
    const words = text.toLowerCase().split(/\s+/);
    return words.filter((word) => word.length > 2).slice(0, 3);
  }

  private analyzeEmotionalWeight(text: string): number {
    const positiveWords = [
      'love',
      'like',
      'happy',
      'joy',
      'excited',
      'wonderful',
      'great',
      'amazing',
    ];
    const negativeWords = [
      'hate',
      'dislike',
      'sad',
      'angry',
      'terrible',
      'awful',
      'bad',
      'horrible',
    ];

    const words = text.toLowerCase().split(/\s+/);
    let weight = 0;

    words.forEach((word) => {
      if (positiveWords.includes(word)) {
        weight += 0.3;
      }
      if (negativeWords.includes(word)) {
        weight -= 0.3;
      }
    });

    return Math.max(-1, Math.min(1, weight));
  }

  private async updatePersonalityState(
    character: Character,
    session: CharacterChatSession,
    request: CharacterChatRequest,
    response: string,
  ): Promise<Partial<PersonalityState>> {
    const currentState = session.personality_state;
    const updates: Partial<PersonalityState> = {};

    // Update mood based on conversation
    const emotionalWeight = this.analyzeEmotionalWeight(
      `${request.message} ${response}`,
    );
    if (Math.abs(emotionalWeight) > 0.3) {
      const moodShift = emotionalWeight > 0 ? 'cheerful' : 'contemplative';
      if (currentState.current_mood !== moodShift) {
        updates.current_mood = moodShift;
      }
    }

    // Update energy level (gradually decreases with conversation length)
    const energyDecay = this.config.personalityDecay * session.message_count;
    const newEnergyLevel = Math.max(
      0.2,
      currentState.energy_level - energyDecay,
    );
    if (Math.abs(newEnergyLevel - currentState.energy_level) > 0.05) {
      updates.energy_level = newEnergyLevel;
    }

    // Update recent memories
    const recentMemory = `User discussed: ${request.message.substring(0, 100)}`;
    const newRecentMemories = [
      recentMemory,
      ...currentState.recent_memories,
    ].slice(0, 5);
    if (
      JSON.stringify(newRecentMemories) !==
      JSON.stringify(currentState.recent_memories)
    ) {
      updates.recent_memories = newRecentMemories;
    }

    // Apply updates
    Object.assign(session.personality_state, updates);

    return updates;
  }

  private async saveSession(session: CharacterChatSession): Promise<void> {
    try {
      session.updated_at = new Date();

      // Update conversation record
      const db = await getDatabaseClient();
      await db
        .update(conversations)
        .set({
          context: session.context,
          messageCount: session.message_count,
          lastMessageAt: session.last_active,
          updatedAt: session.updated_at,
        })
        .where(eq(conversations.id, session.id));
    } catch (error) {
      logger.error(
        'Failed to save session',
        error instanceof Error ? error : new Error(String(error)),
        { sessionId: session.id },
      );
    }
  }

  private calculateChatCost(tokensUsed: number, maxTokens: number): number {
    // Example pricing: $0.03 per 1K tokens for input, $0.06 per 1K tokens for output
    const inputCost = ((tokensUsed * 0.7) / 1000) * 0.03; // Assume 70% input
    const outputCost = ((tokensUsed * 0.3) / 1000) * 0.06; // Assume 30% output
    const baseCost = inputCost + outputCost;

    // Add 20% markup
    return baseCost * 1.2;
  }

  private validateCharacter(character: Character): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!character.name?.trim()) {
      errors.push('Character name is required');
    }

    if (
      !character.bio ||
      (Array.isArray(character.bio)
        ? character.bio.length === 0
        : !character.bio.trim())
    ) {
      errors.push('Character bio is required');
    }

    if (
      character.messageExamples &&
      !Array.isArray(character.messageExamples)
    ) {
      errors.push('messageExamples must be an array');
    }

    if (character.knowledge && !Array.isArray(character.knowledge)) {
      errors.push('knowledge must be an array');
    }

    return { valid: errors.length === 0, errors };
  }

  private getRandomFromArray<T>(array?: T[]): T | undefined {
    if (!array || array.length === 0) {
      return undefined;
    }
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Cleanup method
   */
  async cleanup(): Promise<void> {
    // Cleanup all cached runtimes
    for (const [cacheKey, runtime] of this.runtimeCache.entries()) {
      try {
        // Gracefully shutdown ElizaOS runtime if it has a cleanup method
        if (typeof (runtime as any).cleanup === 'function') {
          await (runtime as any).cleanup();
        }
      } catch (error) {
        logger.warn('Error cleaning up runtime', { error, cacheKey });
      }
    }

    this.characterCache.clear();
    this.sessionCache.clear();
    this.runtimeCache.clear();

    logger.info('Character chat service cleanup completed');
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    const details: Record<string, any> = {
      timestamp: new Date().toISOString(),
      cachedCharacters: this.characterCache.size,
      cachedSessions: this.sessionCache.size,
      activeRuntimes: this.runtimeCache.size,
      runtimes: {},
    };

    let healthyRuntimes = 0;
    const totalRuntimes = this.runtimeCache.size;

    // Check health of cached runtimes
    for (const [cacheKey, runtime] of this.runtimeCache.entries()) {
      try {
        // Check if runtime is responsive
        const agentId = runtime.agentId;
        details.runtimes[cacheKey] = {
          healthy: true,
          agentId,
          character: runtime.character?.name || 'Unknown',
        };
        healthyRuntimes++;
      } catch (error) {
        details.runtimes[cacheKey] = {
          healthy: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy';

    if (totalRuntimes === 0) {
      status = 'healthy'; // No runtimes is fine
    } else if (healthyRuntimes === totalRuntimes) {
      status = 'healthy';
    } else if (healthyRuntimes > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    details.healthyRuntimes = healthyRuntimes;
    details.totalRuntimes = totalRuntimes;

    return { status, details };
  }
}
