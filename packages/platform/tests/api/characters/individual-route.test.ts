/**
 * Character Individual API Routes Tests - Large Character File Regression Test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { NextRequest } from 'next/server';
import { PUT } from '../../../app/api/characters/[id]/route';
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
    getCharacterById: mock(),
    updateCharacter: mock(),
  },
}));

import { authService } from '@/lib/auth/session';
import { characterService } from '@/lib/characters/service';

describe('/api/characters/[id] - Large Character File Tests', () => {
  let organizationId: string;
  let userId: string;
  let mockUser: any;
  const characterId = 'test-char-id';

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

  describe('PUT /api/characters/[id] - Large Character Updates', () => {
    it('should handle large character updates (~150KB) without request entity too large error', async () => {
      mock.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);

      // Mock existing character
      const existingCharacter = {
        id: characterId,
        name: 'Existing Character',
        organizationId,
        createdBy: userId,
      };
      mock
        .mocked(characterService.getCharacterById)
        .mockResolvedValue(existingCharacter as any);

      // Create a large character update (~150KB)
      const largeKnowledge = Array(5000)
        .fill('')
        .map(
          (_, i) =>
            `Updated knowledge item ${i} with substantial content that makes it larger. ` +
            'Adding more text to reach the target size for testing large character file updates. ' +
            'This should be enough content to make each knowledge item fairly substantial.',
        );

      const largeMessageExamples = Array(500)
        .fill('')
        .map((_, i) => [
          {
            user: `Updated user message ${i} with substantial content for testing large character files`,
            assistant: `Updated assistant response ${i} with substantial content for testing large character files. The response should be detailed and comprehensive to increase the overall size of the character file.`,
          },
        ]);

      const largeCharacterUpdate = {
        name: 'Updated Large Character',
        description:
          'An updated character with large configuration for testing payload limits',
        characterConfig: {
          name: 'Updated Large Character',
          bio:
            'An updated comprehensive character with extensive knowledge and examples for testing large payload handling. ' +
            'This bio is intentionally long to contribute to the overall size of the character configuration.',
          personality:
            'Updated detailed personality description with extensive traits and characteristics. ' +
            'This personality section is designed to be comprehensive and substantial.',
          knowledge: largeKnowledge,
          messageExamples: largeMessageExamples,
          system:
            'Updated extensive system prompt with detailed instructions and comprehensive guidelines. ' +
            'This system prompt is intentionally verbose to contribute to the payload size.',
        },
        visibility: 'organization' as const,
      };

      const mockUpdatedCharacter = {
        id: characterId,
        ...largeCharacterUpdate,
        organizationId,
        createdBy: userId,
        updatedAt: new Date(),
      };

      mock
        .mocked(characterService.updateCharacter)
        .mockResolvedValue(mockUpdatedCharacter as any);

      const requestBody = JSON.stringify(largeCharacterUpdate);
      console.log(
        `Large character update payload size: ${(requestBody.length / 1024).toFixed(2)} KB`,
      );

      const request = new NextRequest(
        `http://localhost/api/characters/${characterId}`,
        {
          method: 'PUT',
          body: requestBody,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: characterId }),
      });
      const data = await response.json();

      // Should succeed, not return 413 (Request Entity Too Large) or 500
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockUpdatedCharacter);

      expect(characterService.updateCharacter).toHaveBeenCalledWith(
        organizationId,
        characterId,
        largeCharacterUpdate,
        userId,
      );
    });

    it('should handle extremely large character updates (>200KB)', async () => {
      mock.mocked(authService.getCurrentUser).mockResolvedValue(mockUser);

      // Mock existing character
      const existingCharacter = {
        id: characterId,
        name: 'Existing Character',
        organizationId,
        createdBy: userId,
      };
      mock
        .mocked(characterService.getCharacterById)
        .mockResolvedValue(existingCharacter as any);

      // Create an extremely large character update (>200KB)
      const extremelyLargeKnowledge = Array(8000)
        .fill('')
        .map(
          (_, i) =>
            `Extremely large knowledge item ${i} with very substantial content that makes it much larger. ` +
            'Adding even more text to reach a very large target size for testing extremely large character file updates. ' +
            'This should be enough content to make each knowledge item extremely substantial and comprehensive. ' +
            'Additional padding text to increase the overall payload size significantly for stress testing purposes.',
        );

      const extremelyLargeMessageExamples = Array(800)
        .fill('')
        .map((_, i) => [
          {
            user: `Extremely large user message ${i} with very substantial content for testing very large character files. Adding more content to increase payload size.`,
            assistant: `Extremely large assistant response ${i} with very substantial content for testing very large character files. The response should be extremely detailed and comprehensive to significantly increase the overall size of the character file. Adding more content for stress testing.`,
          },
        ]);

      const extremelyLargeCharacterUpdate = {
        name: 'Extremely Large Updated Character',
        description:
          'An updated character with extremely large configuration for stress testing payload limits',
        characterConfig: {
          name: 'Extremely Large Updated Character',
          bio:
            'An extremely comprehensive character with very extensive knowledge and examples for stress testing large payload handling. ' +
            'This bio is intentionally very long to contribute significantly to the overall size of the character configuration. ' +
            'Adding more content to reach extreme sizes for comprehensive testing.',
          personality:
            'Extremely detailed personality description with very extensive traits and characteristics. ' +
            'This personality section is designed to be extremely comprehensive and substantial for stress testing.',
          knowledge: extremelyLargeKnowledge,
          messageExamples: extremelyLargeMessageExamples,
          system:
            'Extremely extensive system prompt with very detailed instructions and extremely comprehensive guidelines. ' +
            'This system prompt is intentionally very verbose to contribute significantly to the payload size for stress testing.',
        },
        visibility: 'public' as const,
      };

      const mockUpdatedCharacter = {
        id: characterId,
        ...extremelyLargeCharacterUpdate,
        organizationId,
        createdBy: userId,
        updatedAt: new Date(),
      };

      mock
        .mocked(characterService.updateCharacter)
        .mockResolvedValue(mockUpdatedCharacter as any);

      const requestBody = JSON.stringify(extremelyLargeCharacterUpdate);
      console.log(
        `Extremely large character update payload size: ${(requestBody.length / 1024).toFixed(2)} KB`,
      );

      const request = new NextRequest(
        `http://localhost/api/characters/${characterId}`,
        {
          method: 'PUT',
          body: requestBody,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: characterId }),
      });
      const data = await response.json();

      // Should succeed, not return 413 (Request Entity Too Large) or 500
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockUpdatedCharacter);

      expect(characterService.updateCharacter).toHaveBeenCalledWith(
        organizationId,
        characterId,
        extremelyLargeCharacterUpdate,
        userId,
      );
    });
  });
});
