/**
 * Large Character File Regression Test
 * Tests specifically for the "request entity too large" bug fix
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { NextRequest } from 'next/server';
import { POST } from '../../../app/api/characters/route';

// Mock the auth service
mock.module('@/lib/auth/session', () => ({
  authService: {
    getCurrentUser: mock(),
  },
}));

// Mock the character service
mock.module('@/lib/characters/service', () => ({
  characterService: {
    createCharacter: mock(),
  },
}));

import { authService } from '@/lib/auth/session';
import { characterService } from '@/lib/characters/service';

describe('Large Character File Regression Test', () => {
  const mockUser = {
    id: 'test-user-id',
    organizationId: 'test-org-id',
    email: 'test@example.com',
  };

  beforeEach(() => {
    mock.restore();
    (authService.getCurrentUser as any).mockResolvedValue(mockUser);
  });

  it('should handle ~150KB character files without request entity too large error', async () => {
    // Create a large character config (~150KB)
    const largeKnowledge = Array(5000)
      .fill('')
      .map(
        (_, i) =>
          `Knowledge item ${i}: This is substantial content for testing large character files. ` +
          'Adding sufficient text to reach the target size for testing the request entity too large bug fix.',
      );

    const largeCharacterData = {
      name: 'Large Test Character',
      description: 'Testing large character file upload',
      slug: 'large-test-character',
      characterConfig: {
        name: 'Large Test Character',
        bio: 'A comprehensive character for testing large payload handling.',
        knowledge: largeKnowledge,
        messageExamples: Array(300).fill([
          {
            user: 'Test message',
            assistant: 'Test response with substantial content',
          },
        ]),
      },
      visibility: 'private' as const,
    };

    // Mock successful creation
    (characterService.createCharacter as any).mockResolvedValue({
      id: 'char-large',
      ...largeCharacterData,
      createdAt: new Date().toISOString(),
    });

    const requestBody = JSON.stringify(largeCharacterData);
    const payloadSizeKB = (requestBody.length / 1024).toFixed(2);
    console.log(`Testing payload size: ${payloadSizeKB} KB`);

    // Ensure payload is actually large enough to test the fix
    expect(parseFloat(payloadSizeKB)).toBeGreaterThan(100);

    const request = new NextRequest('http://localhost/api/characters', {
      method: 'POST',
      body: requestBody,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    // The critical test: should NOT return 413 "Request Entity Too Large"
    expect(response.status).not.toBe(413);
    expect(response.status).not.toBe(500);

    // Should succeed
    expect(response.status).toBe(201);
    expect(data.success).toBe(true);

    console.log(`✅ Successfully processed ${payloadSizeKB} KB character file`);
  });

  it('should handle very large character files (>200KB)', async () => {
    // Create an extremely large character config (>200KB)
    const extremelyLargeKnowledge = Array(8000)
      .fill('')
      .map(
        (_, i) =>
          `Extremely large knowledge item ${i}: This is very substantial content for stress testing large character files. ` +
          'Adding even more text to reach very large target sizes for comprehensive testing of the request entity too large bug fix. ' +
          'Additional content to ensure we exceed 200KB for stress testing purposes.',
      );

    const extremelyLargeCharacterData = {
      name: 'Extremely Large Test Character',
      description: 'Stress testing extremely large character file upload',
      slug: 'extremely-large-test-character',
      characterConfig: {
        name: 'Extremely Large Test Character',
        bio: 'An extremely comprehensive character for stress testing large payload handling with extensive content.',
        knowledge: extremelyLargeKnowledge,
        messageExamples: Array(500).fill([
          {
            user: 'Stress test message with substantial content',
            assistant:
              'Stress test response with very substantial content for comprehensive testing',
          },
        ]),
        system:
          'Extremely comprehensive system prompt with detailed instructions and extensive guidelines for stress testing.',
      },
      visibility: 'public' as const,
    };

    // Mock successful creation
    (characterService.createCharacter as any).mockResolvedValue({
      id: 'char-extremely-large',
      ...extremelyLargeCharacterData,
      createdAt: new Date().toISOString(),
    });

    const requestBody = JSON.stringify(extremelyLargeCharacterData);
    const payloadSizeKB = (requestBody.length / 1024).toFixed(2);
    console.log(`Testing extremely large payload size: ${payloadSizeKB} KB`);

    // Ensure payload is extremely large
    expect(parseFloat(payloadSizeKB)).toBeGreaterThan(200);

    const request = new NextRequest('http://localhost/api/characters', {
      method: 'POST',
      body: requestBody,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    // The critical test: should NOT return 413 "Request Entity Too Large"
    expect(response.status).not.toBe(413);
    expect(response.status).not.toBe(500);

    // Should succeed
    expect(response.status).toBe(201);
    expect(data.success).toBe(true);

    console.log(
      `✅ Successfully processed ${payloadSizeKB} KB extremely large character file`,
    );
  });
});
