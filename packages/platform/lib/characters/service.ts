/**
 * Character Management Service
 * Handles frontend-only agents that run in the browser using user's API credits
 */

import {
  getDatabase,
  setDatabaseContext,
  clearDatabaseContext,
  agents,
  characterConversations,
  type Agent,
  type NewAgent,
  type CharacterConversation,
  type NewCharacterConversation,
  eq,
  and,
  desc,
  count,
  ilike,
} from '../database';

export interface CreateCharacterRequest {
  name: string;
  description?: string;
  slug: string;
  avatarUrl?: string;
  characterConfig: {
    name: string;
    bio: string;
    messageExamples?: Array<Array<{ user: string; assistant: string }>>;
    knowledge?: string[];
    personality?: string;
    style?: string;
    system?: string;
  };
  visibility: 'private' | 'organization' | 'public';
}

export interface UpdateCharacterRequest {
  name?: string;
  description?: string;
  slug?: string;
  avatarUrl?: string;
  characterConfig?: {
    name?: string;
    bio?: string;
    messageExamples?: Array<Array<{ user: string; assistant: string }>>;
    knowledge?: string[];
    personality?: string;
    style?: string;
    system?: string;
  };
  visibility?: 'private' | 'organization' | 'public';
}

export interface CharacterWithStats {
  id: string;
  name: string;
  description?: string;
  slug: string;
  avatarUrl?: string;
  characterConfig: {
    name: string;
    bio: string;
    messageExamples?: Array<Array<{ user: string; assistant: string }>>;
    knowledge?: string[];
    personality?: string;
    style?: string;
    system?: string;
  };
  visibility: string;
  isActive: boolean;
  totalConversations: number;
  totalMessages: number;
  createdBy: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface CharacterConversationWithMessages {
  id: string;
  characterId: string;
  userId: string;
  organizationId: string;
  title?: string;
  messages: CharacterConversationMessage[];
  metadata: Record<string, any>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterStats {
  totalCharacters: number;
  activeCharacters: number;
  totalConversations: number;
  totalMessages: number;
}

/**
 * Character Management Service
 * Characters are frontend-only agents with limited capabilities
 */
export class CharacterService {
  private async getDb() {
    return await getDatabase();
  }

  /**
   * Create a new character
   */
  async createCharacter(
    organizationId: string,
    userId: string,
    data: CreateCharacterRequest,
  ): Promise<CharacterWithStats> {
    await setDatabaseContext({
      organizationId,
      userId,
    });

    try {
      // Check if slug is unique within organization
      const existingCharacter = await this.getCharacterBySlug(
        organizationId,
        data.slug,
      );
      if (existingCharacter) {
        throw new Error('Character with this slug already exists');
      }

      // Validate character configuration
      const configValidation = this.validateCharacterConfig(
        data.characterConfig,
      );
      if (!configValidation.isValid) {
        throw new Error(
          `Invalid character configuration: ${configValidation.errors.join(', ')}`,
        );
      }

      const [created] = await (
        await this.getDb()
      )
        .insert(agents)
        .values({
          organizationId,
          createdBy: userId,
          name: data.name,
          description: data.description,
          slug: data.slug,
          type: 'character', // This is the key difference from regular agents
          avatarUrl: data.avatarUrl,
          characterConfig: data.characterConfig,
          plugins: [], // Characters have no plugins
          runtimeConfig: {}, // Characters have minimal runtime config
          visibility: data.visibility,
          isActive: true,
        })
        .returning();

      return this.mapCharacterToStats(created);
    } finally {
      await clearDatabaseContext();
    }
  }

  /**
   * Get characters for organization
   */
  async getCharacters(
    organizationId: string,
    options: {
      limit?: number;
      offset?: number;
      search?: string;
      visibility?: string;
      createdBy?: string;
    } = {},
  ): Promise<CharacterWithStats[]> {
    await setDatabaseContext({ organizationId });

    try {
      const { limit = 50, offset = 0, search, visibility, createdBy } = options;

      // Build where conditions - only return characters (type = 'character')
      const conditions: any[] = [
        eq(agents.organizationId, organizationId),
        eq(agents.type, 'character'),
      ];

      if (search) {
        conditions.push(ilike(agents.name, `%${search}%`));
      }

      if (visibility) {
        conditions.push(eq(agents.visibility, visibility));
      }

      if (createdBy) {
        conditions.push(eq(agents.createdBy, createdBy));
      }

      const results = await (
        await this.getDb()
      )
        .select()
        .from(agents)
        .where(and(...conditions))
        .orderBy(desc(agents.updatedAt))
        .limit(limit)
        .offset(offset);

      return results.map((character: Agent) =>
        this.mapCharacterToStats(character),
      );
    } finally {
      await clearDatabaseContext();
    }
  }

  /**
   * Get character by ID
   */
  async getCharacterById(
    organizationId: string,
    characterId: string,
  ): Promise<CharacterWithStats | null> {
    await setDatabaseContext({ organizationId });

    try {
      const [character] = await (
        await this.getDb()
      )
        .select()
        .from(agents)
        .where(and(eq(agents.id, characterId), eq(agents.type, 'character')))
        .limit(1);

      return character ? this.mapCharacterToStats(character) : null;
    } finally {
      await clearDatabaseContext();
    }
  }

  /**
   * Get character by slug
   */
  async getCharacterBySlug(
    organizationId: string,
    slug: string,
  ): Promise<CharacterWithStats | null> {
    await setDatabaseContext({ organizationId });

    try {
      const [character] = await (
        await this.getDb()
      )
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.organizationId, organizationId),
            eq(agents.slug, slug),
            eq(agents.type, 'character'),
          ),
        )
        .limit(1);

      return character ? this.mapCharacterToStats(character) : null;
    } finally {
      await clearDatabaseContext();
    }
  }

  /**
   * Update character
   */
  async updateCharacter(
    organizationId: string,
    characterId: string,
    updates: UpdateCharacterRequest,
    userId?: string,
  ): Promise<CharacterWithStats | null> {
    await setDatabaseContext({
      organizationId,
      userId,
    });

    try {
      // Check if slug is unique (if changing)
      if (updates.slug) {
        const existingCharacter = await this.getCharacterBySlug(
          organizationId,
          updates.slug,
        );
        if (existingCharacter && existingCharacter.id !== characterId) {
          throw new Error('Character with this slug already exists');
        }
      }

      // Validate character configuration if being updated
      if (updates.characterConfig) {
        const configValidation = this.validateCharacterConfig(
          updates.characterConfig,
        );
        if (!configValidation.isValid) {
          throw new Error(
            `Invalid character configuration: ${configValidation.errors.join(', ')}`,
          );
        }
      }

      const [updated] = await (
        await this.getDb()
      )
        .update(agents)
        .set({
          ...updates,
          updatedAt: Date.now(),
        })
        .where(and(eq(agents.id, characterId), eq(agents.type, 'character')))
        .returning();

      return updated ? this.mapCharacterToStats(updated) : null;
    } finally {
      await clearDatabaseContext();
    }
  }

  /**
   * Delete character
   */
  async deleteCharacter(
    organizationId: string,
    characterId: string,
  ): Promise<boolean> {
    await setDatabaseContext({
      organizationId,
      isAdmin: true,
    });

    try {
      await (await this.getDb())
        .delete(agents)
        .where(and(eq(agents.id, characterId), eq(agents.type, 'character')));

      return true;
    } finally {
      await clearDatabaseContext();
    }
  }

  /**
   * Start a conversation with a character
   */
  async startConversation(
    organizationId: string,
    userId: string,
    characterId: string,
    title?: string,
  ): Promise<CharacterConversationWithMessages> {
    await setDatabaseContext({ organizationId, userId });

    try {
      // Verify character exists and is accessible
      const character = await this.getCharacterById(
        organizationId,
        characterId,
      );
      if (!character) {
        throw new Error('Character not found');
      }

      // Create new conversation
      const [conversation] = await (
        await this.getDb()
      )
        .insert(characterConversations)
        .values({
          characterId,
          userId,
          organizationId,
          title: title || `Chat with ${character.name}`,
          messages: [],
          metadata: {},
          isActive: true,
        })
        .returning();

      return this.mapConversationWithMessages(conversation);
    } finally {
      await clearDatabaseContext();
    }
  }

  /**
   * Get conversation by ID
   */
  async getConversation(
    organizationId: string,
    userId: string,
    conversationId: string,
  ): Promise<CharacterConversationWithMessages | null> {
    await setDatabaseContext({ organizationId, userId });

    try {
      const [conversation] = await (
        await this.getDb()
      )
        .select()
        .from(characterConversations)
        .where(
          and(
            eq(characterConversations.id, conversationId),
            eq(characterConversations.userId, userId),
            eq(characterConversations.organizationId, organizationId),
          ),
        )
        .limit(1);

      return conversation
        ? this.mapConversationWithMessages(conversation)
        : null;
    } finally {
      await clearDatabaseContext();
    }
  }

  /**
   * Get user's conversations with a character
   */
  async getUserConversations(
    organizationId: string,
    userId: string,
    characterId?: string,
    options: {
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<CharacterConversationWithMessages[]> {
    await setDatabaseContext({ organizationId, userId });

    try {
      const { limit = 50, offset = 0 } = options;

      const conditions: any[] = [
        eq(characterConversations.userId, userId),
        eq(characterConversations.organizationId, organizationId),
        eq(characterConversations.isActive, true),
      ];

      if (characterId) {
        conditions.push(eq(characterConversations.characterId, characterId));
      }

      const results = await (
        await this.getDb()
      )
        .select()
        .from(characterConversations)
        .where(and(...conditions))
        .orderBy(desc(characterConversations.updatedAt))
        .limit(limit)
        .offset(offset);

      return results.map((conv: CharacterConversation) =>
        this.mapConversationWithMessages(conv),
      );
    } finally {
      await clearDatabaseContext();
    }
  }

  /**
   * Add message to conversation
   */
  async addMessage(
    organizationId: string,
    userId: string,
    conversationId: string,
    message: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      metadata?: Record<string, any>;
    },
  ): Promise<CharacterConversationWithMessages> {
    await setDatabaseContext({ organizationId, userId });

    try {
      // Get current conversation
      const conversation = await this.getConversation(
        organizationId,
        userId,
        conversationId,
      );
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Create new message
      const newMessage: CharacterConversationMessage = {
        id: crypto.randomUUID(),
        role: message.role,
        content: message.content,
        timestamp: Date.now(),
        metadata: message.metadata || {},
      };

      // Add message to conversation
      const updatedMessages = [...conversation.messages, newMessage];

      // Update conversation in database
      const [updated] = await (
        await this.getDb()
      )
        .update(characterConversations)
        .set({
          messages: updatedMessages,
          updatedAt: Date.now(),
        })
        .where(eq(characterConversations.id, conversationId))
        .returning();

      return this.mapConversationWithMessages(updated);
    } finally {
      await clearDatabaseContext();
    }
  }

  /**
   * Get character statistics
   */
  async getCharacterStats(organizationId: string): Promise<CharacterStats> {
    await setDatabaseContext({ organizationId });

    try {
      const [totalResult] = await (
        await this.getDb()
      )
        .select({ count: count() })
        .from(agents)
        .where(
          and(
            eq(agents.organizationId, organizationId),
            eq(agents.type, 'character'),
          ),
        );

      const [activeResult] = await (
        await this.getDb()
      )
        .select({ count: count() })
        .from(agents)
        .where(
          and(
            eq(agents.organizationId, organizationId),
            eq(agents.type, 'character'),
            eq(agents.isActive, true),
          ),
        );

      const [conversationsResult] = await (await this.getDb())
        .select({ count: count() })
        .from(characterConversations)
        .where(eq(characterConversations.organizationId, organizationId));

      // Calculate total messages by summing array lengths
      const allConversations = await (await this.getDb())
        .select()
        .from(characterConversations)
        .where(eq(characterConversations.organizationId, organizationId));

      const totalMessages = allConversations.reduce(
        (sum: number, conv: any) => {
          return (
            sum + (Array.isArray(conv.messages) ? conv.messages.length : 0)
          );
        },
        0,
      );

      return {
        totalCharacters: totalResult?.count || 0,
        activeCharacters: activeResult?.count || 0,
        totalConversations: conversationsResult?.count || 0,
        totalMessages,
      };
    } finally {
      await clearDatabaseContext();
    }
  }

  /**
   * Generate unique slug for character
   */
  async generateUniqueSlug(
    organizationId: string,
    baseName: string,
  ): Promise<string> {
    const baseSlug = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    let counter = 1;

    while (await this.getCharacterBySlug(organizationId, slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Validate character configuration
   */
  validateCharacterConfig(config: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Required fields
    if (!config.name) {
      errors.push('Character name is required');
    }
    if (!config.bio) {
      errors.push('Character bio is required');
    }

    // Type validations
    if (config.messageExamples && !Array.isArray(config.messageExamples)) {
      errors.push('Message examples must be an array');
    }

    if (config.knowledge && !Array.isArray(config.knowledge)) {
      errors.push('Knowledge must be an array');
    }

    // Length validations
    if (config.name && config.name.length > 100) {
      errors.push('Character name must be 100 characters or less');
    }

    if (config.bio && config.bio.length > 1000) {
      errors.push('Character bio must be 1000 characters or less');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Map agent to character stats object
   */
  private mapCharacterToStats(agent: Agent): CharacterWithStats {
    return {
      id: agent.id,
      name: agent.name,
      description: agent.description || undefined,
      slug: agent.slug,
      avatarUrl: agent.avatarUrl || undefined,
      characterConfig: agent.characterConfig as any,
      visibility: agent.visibility,
      isActive: agent.isActive,
      totalConversations: 0, // TODO: Calculate from conversations
      totalMessages: 0, // TODO: Calculate from conversations
      createdBy: agent.createdBy || '',
      organizationId: agent.organizationId,
      createdAt: new Date(agent.createdAt),
      updatedAt: new Date(agent.updatedAt),
    };
  }

  /**
   * Map conversation to conversation with messages
   */
  private mapConversationWithMessages(
    conv: CharacterConversation,
  ): CharacterConversationWithMessages {
    return {
      id: conv.id,
      characterId: conv.characterId,
      userId: conv.userId,
      organizationId: conv.organizationId,
      title: conv.title || undefined,
      messages: Array.isArray(conv.messages) ? conv.messages : [],
      metadata: conv.metadata as Record<string, any>,
      isActive: conv.isActive,
      createdAt: new Date(conv.createdAt),
      updatedAt: new Date(conv.updatedAt),
    };
  }
}

// Export singleton instance
export const characterService = new CharacterService();
