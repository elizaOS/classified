/**
 * Characters API Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { NextRequest } from 'next/server';
import { GET, POST } from '../../../app/api/characters/route';
import {
  clearTestDatabase,
  createTestOrganization,
  createTestUser,
} from '@/lib/test-utils';

// Mock the auth service
mock.module('@/lib/auth/session', () => ({
  authService: {
    getCurrentUser: mock(),
  },
}));

// Mock the character service
mock.module('@/lib/characters/service', () => ({
  characterService: {
    getCharacters: mock(),
    getCharacterStats: mock(),
    createCharacter: mock(),
  },
}));

import { authService } from '@/lib/auth/session';
import { characterService } from '@/lib/characters/service';

describe('/api/characters', () => {
  let organizationId: string;
  let userId: string;
  let mockUser: any;

  beforeEach(async () => {
    await clearTestDatabase();

    // Create test organization and user
    const org = await createTestOrganization();
    organizationId = org.id;

    const user = await createTestUser(organizationId);
    userId = user.id;

    mockUser = {
      id: userId,
      organizationId,
      email: 'test@example.com',
    };

    // Reset mocks
    mock.restore();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  describe('GET /api/characters', () => {
    it('should return characters and stats for authenticated user', async () => {
      // Mock auth
      (authService.getCurrentUser as any).mockResolvedValue(mockUser);

      // Mock service responses
      const mockCharacters = [
        {
          id: 'char-1',
          name: 'Test Character',
          slug: 'test-character',
          characterConfig: {
            name: 'Test Character',
            bio: 'A test character',
          },
          visibility: 'private',
          organizationId,
        },
      ];

      const mockStats = {
        totalCharacters: 1,
        activeCharacters: 1,
        totalConversations: 0,
        totalMessages: 0,
      };

      (characterService.getCharacters as any).mockResolvedValue(
        mockCharacters as any,
      );
      (characterService.getCharacterStats as any).mockResolvedValue(mockStats);

      // Create request
      const request = new NextRequest('http://localhost/api/characters');

      // Call handler
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.characters).toEqual(mockCharacters);
      expect(data.data.stats).toEqual(mockStats);

      // Verify service calls
      expect(characterService.getCharacters).toHaveBeenCalledWith(
        organizationId,
        {
          limit: 50,
          offset: 0,
          search: undefined,
          visibility: undefined,
          createdBy: undefined,
        },
      );
      expect(characterService.getCharacterStats).toHaveBeenCalledWith(
        organizationId,
      );
    });

    it('should handle query parameters', async () => {
      (authService.getCurrentUser as any).mockResolvedValue(mockUser);
      (characterService.getCharacters as any).mockResolvedValue([]);
      (characterService.getCharacterStats as any).mockResolvedValue({
        totalCharacters: 0,
        activeCharacters: 0,
        totalConversations: 0,
        totalMessages: 0,
      });

      const request = new NextRequest(
        'http://localhost/api/characters?limit=10&offset=20&search=test&visibility=public&createdBy=user-123',
      );

      await GET(request);

      expect(characterService.getCharacters).toHaveBeenCalledWith(
        organizationId,
        {
          limit: 10,
          offset: 20,
          search: 'test',
          visibility: 'public',
          createdBy: 'user-123',
        },
      );
    });

    it('should return 401 for unauthenticated user', async () => {
      (authService.getCurrentUser as any).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/characters');
      const response = await GET(request);

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
    });

    it('should handle service errors', async () => {
      (authService.getCurrentUser as any).mockResolvedValue(mockUser);
      (characterService.getCharacters as any).mockRejectedValue(
        new Error('Database error'),
      );

      const request = new NextRequest('http://localhost/api/characters');
      const response = await GET(request);

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        success: false,
        error: 'Failed to fetch characters',
      });
    });
  });

  describe('POST /api/characters', () => {
    const validCharacterData = {
      name: 'Test Character',
      description: 'A test character',
      slug: 'test-character',
      avatarUrl: 'https://example.com/avatar.png',
      characterConfig: {
        name: 'Test Character',
        bio: 'A friendly test character',
        personality: 'Helpful and engaging',
        messageExamples: [[{ user: 'Hello', assistant: 'Hi there!' }]],
      },
      visibility: 'private',
    };

    it('should create character successfully', async () => {
      (authService.getCurrentUser as any).mockResolvedValue(mockUser);

      const mockCreatedCharacter = {
        id: 'char-1',
        ...validCharacterData,
        organizationId,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (characterService.createCharacter as any).mockResolvedValue(
        mockCreatedCharacter as any,
      );

      const request = new NextRequest('http://localhost/api/characters', {
        method: 'POST',
        body: JSON.stringify(validCharacterData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('char-1');

      expect(characterService.createCharacter).toHaveBeenCalledWith(
        organizationId,
        userId,
        validCharacterData,
      );
    });

    it('should validate required fields', async () => {
      (authService.getCurrentUser as any).mockResolvedValue(mockUser);

      const invalidData = {
        name: '', // Required
        characterConfig: {
          bio: '', // Required
        },
      };

      const request = new NextRequest('http://localhost/api/characters', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
      expect(data.details).toBeDefined();
    });

    it('should validate character config fields', async () => {
      (authService.getCurrentUser as any).mockResolvedValue(mockUser);

      const invalidData = {
        ...validCharacterData,
        characterConfig: {
          name: 'Test Character',
          bio: '', // Required
        },
      };

      const request = new NextRequest('http://localhost/api/characters', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
    });

    it('should validate visibility enum', async () => {
      (authService.getCurrentUser as any).mockResolvedValue(mockUser);

      const invalidData = {
        ...validCharacterData,
        visibility: 'invalid', // Should be private, organization, or public
      };

      const request = new NextRequest('http://localhost/api/characters', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request data');
    });

    it('should return 401 for unauthenticated user', async () => {
      (authService.getCurrentUser as any).mockResolvedValue(null);

      const request = new NextRequest('http://localhost/api/characters', {
        method: 'POST',
        body: JSON.stringify(validCharacterData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
    });

    it('should handle duplicate slug error', async () => {
      (authService.getCurrentUser as any).mockResolvedValue(mockUser);
      (characterService.createCharacter as any).mockRejectedValue(
        new Error('Character with this slug already exists'),
      );

      const request = new NextRequest('http://localhost/api/characters', {
        method: 'POST',
        body: JSON.stringify(validCharacterData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Character with this slug already exists');
    });

    it('should handle service errors', async () => {
      (authService.getCurrentUser as any).mockResolvedValue(mockUser);
      (characterService.createCharacter as any).mockRejectedValue(
        new Error('Database error'),
      );

      const request = new NextRequest('http://localhost/api/characters', {
        method: 'POST',
        body: JSON.stringify(validCharacterData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create character');
    });

    it('should handle invalid JSON', async () => {
      (authService.getCurrentUser as any).mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost/api/characters', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should handle large character files (~150KB) without request entity too large error', async () => {
      (authService.getCurrentUser as any).mockResolvedValue(mockUser);

      // Create a large character config (~150KB)
      const largeKnowledge = Array(5000)
        .fill('')
        .map(
          (_, i) =>
            `This is knowledge item ${i} with some substantial content that makes it larger. ` +
            'Adding more text to reach the target size for testing large character files. ' +
            'This should be enough content to make each knowledge item fairly substantial.',
        );

      const largeMessageExamples = Array(500)
        .fill('')
        .map((_, i) => [
          {
            user: `This is user message ${i} with substantial content for testing large character files`,
            assistant: `This is assistant response ${i} with substantial content for testing large character files. The response should be detailed and comprehensive to increase the overall size of the character file.`,
          },
        ]);

      const largeCharacterData = {
        name: 'Large Test Character',
        description:
          'A test character with large configuration for testing payload limits',
        slug: 'large-test-character',
        avatarUrl: 'https://example.com/avatar.png',
        characterConfig: {
          name: 'Large Test Character',
          bio:
            'A comprehensive character with extensive knowledge and examples for testing large payload handling. ' +
            'This bio is intentionally long to contribute to the overall size of the character configuration.',
          personality:
            'Detailed personality description with extensive traits and characteristics. ' +
            'This personality section is designed to be comprehensive and substantial.',
          knowledge: largeKnowledge,
          messageExamples: largeMessageExamples,
          system:
            'Extensive system prompt with detailed instructions and comprehensive guidelines. ' +
            'This system prompt is intentionally verbose to contribute to the payload size.',
        },
        visibility: 'private',
      };

      const mockCreatedCharacter = {
        id: 'char-large',
        ...largeCharacterData,
        organizationId,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      (characterService.createCharacter as any).mockResolvedValue(
        mockCreatedCharacter as any,
      );

      const requestBody = JSON.stringify(largeCharacterData);
      console.log(
        `Large character payload size: ${(requestBody.length / 1024).toFixed(2)} KB`,
      );

      const request = new NextRequest('http://localhost/api/characters', {
        method: 'POST',
        body: requestBody,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const data = await response.json();

      // Should succeed, not return 413 (Request Entity Too Large) or 500
      expect(response.status).toBe(201);
      expect(response.status).not.toBe(413); // Specifically check not "Request Entity Too Large"
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('char-large');

      expect(characterService.createCharacter).toHaveBeenCalledWith(
        organizationId,
        userId,
        largeCharacterData,
      );
    });
  });
});
