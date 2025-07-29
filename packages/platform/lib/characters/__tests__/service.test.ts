/**
 * Character Service Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { characterService, CharacterService } from '../service';
import {
  clearTestDatabase,
  createTestOrganization,
  createTestUser,
} from '@/lib/test-utils';

// Mock the database context functions
mock.module('../../database/context', () => ({
  setDatabaseContext: mock(),
  clearDatabaseContext: mock(),
}));

describe('CharacterService', () => {
  let organizationId: string;
  let userId: string;
  let service: CharacterService;

  beforeEach(async () => {
    await clearTestDatabase();

    // Create test organization and user
    const org = await createTestOrganization();
    organizationId = org.id;

    const user = await createTestUser(organizationId);
    userId = user.id;

    service = new CharacterService();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  describe('createCharacter', () => {
    it('should create a character successfully', async () => {
      const characterData = {
        name: 'Test Character',
        description: 'A test character',
        slug: 'test-character',
        avatarUrl: 'https://example.com/avatar.png',
        characterConfig: {
          name: 'Test Character',
          bio: 'A friendly test character',
          personality: 'Helpful and engaging',
          style: 'Casual and friendly',
          system: 'You are a helpful assistant',
          knowledge: ['testing', 'AI'],
          messageExamples: [
            [
              {
                user: 'Hello',
                assistant: 'Hi there! How can I help you today?',
              },
            ],
          ],
        },
        visibility: 'private' as const,
      };

      const character = await service.createCharacter(
        organizationId,
        userId,
        characterData,
      );

      expect(character).toBeDefined();
      expect(character.name).toBe(characterData.name);
      expect(character.slug).toBe(characterData.slug);
      expect(character.characterConfig.bio).toBe(
        characterData.characterConfig.bio,
      );
      expect(character.visibility).toBe('private');
      expect(character.organizationId).toBe(organizationId);
      expect(character.createdBy).toBe(userId);
    });

    it('should reject duplicate slugs within organization', async () => {
      const characterData = {
        name: 'Test Character',
        slug: 'test-character',
        characterConfig: {
          name: 'Test Character',
          bio: 'A test character',
        },
        visibility: 'private' as const,
      };

      // Create first character
      await service.createCharacter(organizationId, userId, characterData);

      // Try to create second character with same slug
      await expect(
        service.createCharacter(organizationId, userId, characterData),
      ).rejects.toThrow('Character with this slug already exists');
    });

    it('should validate character configuration', async () => {
      const invalidCharacterData = {
        name: 'Test Character',
        slug: 'test-character',
        characterConfig: {
          name: '', // Invalid: empty name
          bio: '', // Invalid: empty bio
        },
        visibility: 'private' as const,
      };

      await expect(
        service.createCharacter(organizationId, userId, invalidCharacterData),
      ).rejects.toThrow('Invalid character configuration');
    });
  });

  describe('getCharacters', () => {
    beforeEach(async () => {
      // Create test characters
      await service.createCharacter(organizationId, userId, {
        name: 'Public Character',
        slug: 'public-character',
        characterConfig: {
          name: 'Public Character',
          bio: 'A public character',
        },
        visibility: 'public',
      });

      await service.createCharacter(organizationId, userId, {
        name: 'Private Character',
        slug: 'private-character',
        characterConfig: {
          name: 'Private Character',
          bio: 'A private character',
        },
        visibility: 'private',
      });
    });

    it('should return all characters for organization', async () => {
      const characters = await service.getCharacters(organizationId);

      expect(characters).toHaveLength(2);
      expect(characters.some((c) => c.name === 'Public Character')).toBe(true);
      expect(characters.some((c) => c.name === 'Private Character')).toBe(true);
    });

    it('should filter by search query', async () => {
      const characters = await service.getCharacters(organizationId, {
        search: 'public',
      });

      expect(characters).toHaveLength(1);
      expect(characters[0].name).toBe('Public Character');
    });

    it('should filter by visibility', async () => {
      const characters = await service.getCharacters(organizationId, {
        visibility: 'private',
      });

      expect(characters).toHaveLength(1);
      expect(characters[0].name).toBe('Private Character');
    });

    it('should support pagination', async () => {
      const characters = await service.getCharacters(organizationId, {
        limit: 1,
        offset: 0,
      });

      expect(characters).toHaveLength(1);
    });
  });

  describe('getCharacterById', () => {
    it('should return character by ID', async () => {
      const created = await service.createCharacter(organizationId, userId, {
        name: 'Test Character',
        slug: 'test-character',
        characterConfig: {
          name: 'Test Character',
          bio: 'A test character',
        },
        visibility: 'private',
      });

      const character = await service.getCharacterById(
        organizationId,
        created.id,
      );

      expect(character).toBeDefined();
      expect(character!.id).toBe(created.id);
      expect(character!.name).toBe('Test Character');
    });

    it('should return null for non-existent character', async () => {
      const character = await service.getCharacterById(
        organizationId,
        'non-existent-id',
      );

      expect(character).toBeNull();
    });
  });

  describe('updateCharacter', () => {
    it('should update character successfully', async () => {
      const created = await service.createCharacter(organizationId, userId, {
        name: 'Test Character',
        slug: 'test-character',
        characterConfig: {
          name: 'Test Character',
          bio: 'A test character',
        },
        visibility: 'private',
      });

      const updated = await service.updateCharacter(
        organizationId,
        created.id,
        {
          name: 'Updated Character',
          characterConfig: {
            bio: 'An updated character',
          },
        },
        userId,
      );

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Updated Character');
      expect(updated!.characterConfig.bio).toBe('An updated character');
    });

    it('should validate updated character configuration', async () => {
      const created = await service.createCharacter(organizationId, userId, {
        name: 'Test Character',
        slug: 'test-character',
        characterConfig: {
          name: 'Test Character',
          bio: 'A test character',
        },
        visibility: 'private',
      });

      await expect(
        service.updateCharacter(
          organizationId,
          created.id,
          {
            characterConfig: {
              name: '', // Invalid: empty name
            },
          },
          userId,
        ),
      ).rejects.toThrow('Invalid character configuration');
    });
  });

  describe('deleteCharacter', () => {
    it('should delete character successfully', async () => {
      const created = await service.createCharacter(organizationId, userId, {
        name: 'Test Character',
        slug: 'test-character',
        characterConfig: {
          name: 'Test Character',
          bio: 'A test character',
        },
        visibility: 'private',
      });

      const success = await service.deleteCharacter(organizationId, created.id);

      expect(success).toBe(true);

      // Verify character is deleted
      const character = await service.getCharacterById(
        organizationId,
        created.id,
      );
      expect(character).toBeNull();
    });
  });

  describe('conversation management', () => {
    let characterId: string;

    beforeEach(async () => {
      const character = await service.createCharacter(organizationId, userId, {
        name: 'Test Character',
        slug: 'test-character',
        characterConfig: {
          name: 'Test Character',
          bio: 'A test character',
        },
        visibility: 'private',
      });
      characterId = character.id;
    });

    describe('startConversation', () => {
      it('should start conversation successfully', async () => {
        const conversation = await service.startConversation(
          organizationId,
          userId,
          characterId,
          'Test Conversation',
        );

        expect(conversation).toBeDefined();
        expect(conversation.characterId).toBe(characterId);
        expect(conversation.userId).toBe(userId);
        expect(conversation.title).toBe('Test Conversation');
        expect(conversation.messages).toEqual([]);
        expect(conversation.isActive).toBe(true);
      });

      it('should reject conversation with non-existent character', async () => {
        await expect(
          service.startConversation(organizationId, userId, 'non-existent-id'),
        ).rejects.toThrow('Character not found');
      });
    });

    describe('addMessage', () => {
      let conversationId: string;

      beforeEach(async () => {
        const conversation = await service.startConversation(
          organizationId,
          userId,
          characterId,
        );
        conversationId = conversation.id;
      });

      it('should add message to conversation', async () => {
        const updatedConversation = await service.addMessage(
          organizationId,
          userId,
          conversationId,
          {
            role: 'user',
            content: 'Hello, character!',
            metadata: { test: true },
          },
        );

        expect(updatedConversation.messages).toHaveLength(1);
        expect(updatedConversation.messages[0].role).toBe('user');
        expect(updatedConversation.messages[0].content).toBe(
          'Hello, character!',
        );
        expect(updatedConversation.messages[0].metadata).toEqual({
          test: true,
        });
      });

      it('should preserve message order', async () => {
        // Add first message
        await service.addMessage(organizationId, userId, conversationId, {
          role: 'user',
          content: 'First message',
        });

        // Add second message
        const conversation = await service.addMessage(
          organizationId,
          userId,
          conversationId,
          {
            role: 'assistant',
            content: 'Second message',
          },
        );

        expect(conversation.messages).toHaveLength(2);
        expect(conversation.messages[0].content).toBe('First message');
        expect(conversation.messages[1].content).toBe('Second message');
      });
    });

    describe('getUserConversations', () => {
      it('should return user conversations', async () => {
        const conversation1 = await service.startConversation(
          organizationId,
          userId,
          characterId,
          'Conversation 1',
        );

        const conversation2 = await service.startConversation(
          organizationId,
          userId,
          characterId,
          'Conversation 2',
        );

        const conversations = await service.getUserConversations(
          organizationId,
          userId,
        );

        expect(conversations).toHaveLength(2);
        expect(conversations.some((c) => c.title === 'Conversation 1')).toBe(
          true,
        );
        expect(conversations.some((c) => c.title === 'Conversation 2')).toBe(
          true,
        );
      });

      it('should filter by character ID', async () => {
        const conversation1 = await service.startConversation(
          organizationId,
          userId,
          characterId,
          'Conversation 1',
        );

        const conversations = await service.getUserConversations(
          organizationId,
          userId,
          characterId,
        );

        expect(conversations).toHaveLength(1);
        expect(conversations[0].id).toBe(conversation1.id);
      });
    });
  });

  describe('generateUniqueSlug', () => {
    it('should generate slug from name', async () => {
      const slug = await service.generateUniqueSlug(
        organizationId,
        'Test Character',
      );

      expect(slug).toBe('test-character');
    });

    it('should handle special characters', async () => {
      const slug = await service.generateUniqueSlug(
        organizationId,
        'Test & Character!',
      );

      expect(slug).toBe('test-character');
    });

    it('should make slug unique when conflicts exist', async () => {
      // Create character with base slug
      await service.createCharacter(organizationId, userId, {
        name: 'Test Character',
        slug: 'test-character',
        characterConfig: {
          name: 'Test Character',
          bio: 'A test character',
        },
        visibility: 'private',
      });

      const slug = await service.generateUniqueSlug(
        organizationId,
        'Test Character',
      );

      expect(slug).toBe('test-character-1');
    });
  });

  describe('validateCharacterConfig', () => {
    it('should validate valid configuration', () => {
      const config = {
        name: 'Test Character',
        bio: 'A test character',
        personality: 'Friendly',
        knowledge: ['testing'],
        messageExamples: [[{ user: 'Hi', assistant: 'Hello!' }]],
      };

      const result = service.validateCharacterConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject missing required fields', () => {
      const config = {
        name: '',
        bio: '',
      };

      const result = service.validateCharacterConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Character name is required');
      expect(result.errors).toContain('Character bio is required');
    });

    it('should validate field types', () => {
      const config = {
        name: 'Test Character',
        bio: 'A test character',
        messageExamples: 'invalid', // Should be array
        knowledge: 'invalid', // Should be array
      };

      const result = service.validateCharacterConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message examples must be an array');
      expect(result.errors).toContain('Knowledge must be an array');
    });

    it('should validate field lengths', () => {
      const config = {
        name: 'x'.repeat(101), // Too long
        bio: 'x'.repeat(1001), // Too long
      };

      const result = service.validateCharacterConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Character name must be 100 characters or less',
      );
      expect(result.errors).toContain(
        'Character bio must be 1000 characters or less',
      );
    });
  });

  describe('getCharacterStats', () => {
    beforeEach(async () => {
      // Create test characters and conversations
      const character1 = await service.createCharacter(organizationId, userId, {
        name: 'Character 1',
        slug: 'character-1',
        characterConfig: {
          name: 'Character 1',
          bio: 'First character',
        },
        visibility: 'private',
      });

      const character2 = await service.createCharacter(organizationId, userId, {
        name: 'Character 2',
        slug: 'character-2',
        characterConfig: {
          name: 'Character 2',
          bio: 'Second character',
        },
        visibility: 'public',
      });

      // Create conversations
      const conversation = await service.startConversation(
        organizationId,
        userId,
        character1.id,
      );
      await service.addMessage(organizationId, userId, conversation.id, {
        role: 'user',
        content: 'Hello',
      });
      await service.addMessage(organizationId, userId, conversation.id, {
        role: 'assistant',
        content: 'Hi there!',
      });
    });

    it('should return character statistics', async () => {
      const stats = await service.getCharacterStats(organizationId);

      expect(stats.totalCharacters).toBe(2);
      expect(stats.activeCharacters).toBe(2); // Both are active by default
      expect(stats.totalConversations).toBe(1);
      expect(stats.totalMessages).toBe(2);
    });
  });
});
