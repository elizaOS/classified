/**
 * Character Individual API Routes - Get, Update, Delete specific character
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { z } from 'zod';

// Use dynamic imports to avoid database connection during build
const getCharacterService = () =>
  import('@/lib/characters/service').then((m) => m.characterService);
const getAuthService = () =>
  import('@/lib/auth/session').then((m) => m.authService);

// Character update schema
const updateCharacterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  slug: z.string().min(1).max(50).optional(),
  avatarUrl: z.string().url().optional(),
  characterConfig: z
    .object({
      name: z.string().min(1).max(100).optional(),
      bio: z.string().min(1).max(1000).optional(),
      messageExamples: z
        .array(
          z.array(
            z.object({
              user: z.string(),
              assistant: z.string(),
            }),
          ),
        )
        .optional(),
      knowledge: z.array(z.string()).optional(),
      personality: z.string().max(500).optional(),
      style: z.string().max(500).optional(),
      system: z.string().max(1000).optional(),
    })
    .optional(),
  visibility: z.enum(['private', 'organization', 'public']).optional(),
});

/**
 * GET /api/characters/[id] - Get character by ID
 */
async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // During build time, return a stub response to prevent database access
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json(
      { error: 'API not available during build time' },
      { status: 503 },
    );
  }

  try {
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const characterId = resolvedParams.id;

    const characterService = await getCharacterService();
    const character = await characterService.getCharacterById(
      user.organizationId,
      characterId,
    );

    if (!character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 },
      );
    }

    // Check visibility permissions
    if (character.visibility === 'private' && character.createdBy !== user.id) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: character,
    });
  } catch (error) {
    console.error('Error fetching character:', error);
    return NextResponse.json(
      { error: 'Failed to fetch character' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/characters/[id] - Update character
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // During build time, return a stub response to prevent database access
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json(
      { error: 'API not available during build time' },
      { status: 503 },
    );
  }

  try {
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const characterId = resolvedParams.id;

    const characterService = await getCharacterService();
    // Check if character exists and user has permission
    const existingCharacter = await characterService.getCharacterById(
      user.organizationId,
      characterId,
    );
    if (!existingCharacter) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 },
      );
    }

    if (existingCharacter.createdBy !== user.id) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Parse and validate request body
    const rawBody = await request.json();
    const validation = updateCharacterSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validation.error.errors,
        },
        { status: 400 },
      );
    }

    const updates = validation.data;

    // Update the character
    const updatedCharacter = await characterService.updateCharacter(
      user.organizationId,
      characterId,
      updates,
      user.id,
    );

    if (!updatedCharacter) {
      return NextResponse.json(
        { error: 'Failed to update character' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedCharacter,
    });
  } catch (error) {
    console.error('Error updating character:', error);

    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Failed to update character' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/characters/[id] - Delete character
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // During build time, return a stub response to prevent database access
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json(
      { error: 'API not available during build time' },
      { status: 503 },
    );
  }

  try {
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const characterId = resolvedParams.id;

    const characterService = await getCharacterService();
    // Check if character exists and user has permission
    const existingCharacter = await characterService.getCharacterById(
      user.organizationId,
      characterId,
    );
    if (!existingCharacter) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 },
      );
    }

    if (existingCharacter.createdBy !== user.id) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Delete the character
    const success = await characterService.deleteCharacter(
      user.organizationId,
      characterId,
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete character' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Character deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting character:', error);
    return NextResponse.json(
      { error: 'Failed to delete character' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
