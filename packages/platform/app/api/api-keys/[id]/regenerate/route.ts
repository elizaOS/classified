/**
 * API Key Regeneration Endpoint
 * Generates a new API key for an existing key record
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { sessionService } from '@/lib/auth/session';
import { getDatabase } from '@/lib/database';
import { apiKeys } from '@/lib/database/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

function generateApiKey(): string {
  const prefix = 'eli_';
  const key = nanoid(48);
  return prefix + key;
}

function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex') as string;
}

function getKeyPrefix(apiKey: string): string {
  return `${apiKey.substring(0, 8)}...`;
}

// POST /api/api-keys/[id]/regenerate - Regenerate API key
async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await sessionService.getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: keyId } = await params;

    // Verify the API key belongs to the user's organization
    const db = await getDatabase();
    const [existingKey] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.id, keyId),
          eq(apiKeys.organizationId, session.organizationId),
        ),
      )
      .limit(1);

    if (!existingKey) {
      return NextResponse.json(
        { error: { message: 'API key not found' } },
        { status: 404 },
      );
    }

    // Generate new API key
    const newApiKey = generateApiKey();
    const hashedKey = hashApiKey(newApiKey);
    const keyPrefix = getKeyPrefix(newApiKey);

    // Update the API key with new values
    const [updatedKey] = await db
      .update(apiKeys)
      .set({
        keyHash: hashedKey,
        keyPrefix,
        lastUsedAt: null, // Reset usage tracking
        usageCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, keyId))
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        key: newApiKey, // Full key shown only on regeneration
        apiKey: {
          id: updatedKey.id,
          name: updatedKey.name,
          description: updatedKey.description,
          keyPrefix: updatedKey.keyPrefix,
          permissions: updatedKey.permissions || [],
          rateLimit: updatedKey.rateLimit,
          isActive: updatedKey.isActive,
          expiresAt: updatedKey.expiresAt,
          lastUsedAt: updatedKey.lastUsedAt,
          usageCount: updatedKey.usageCount,
          createdAt: updatedKey.createdAt,
          updatedAt: updatedKey.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Failed to regenerate API key:', error);
    return NextResponse.json(
      { error: { message: 'Failed to regenerate API key' } },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
