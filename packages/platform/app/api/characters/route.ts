/**
 * Characters API Routes - CRUD operations for characters
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { z } from 'zod';

// Use dynamic imports to avoid database connection during build
const getCharacterService = () =>
  import('@/lib/characters/service').then((m) => m.characterService);
const getAuthService = () =>
  import('@/lib/auth/session').then((m) => m.authService);

// Character creation schema
const createCharacterSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  slug: z.string().min(1).max(50),
  avatarUrl: z.string().url().optional(),
  characterConfig: z.object({
    name: z.string().min(1).max(100),
    bio: z.string().min(1).max(1000),
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
  }),
  visibility: z.enum(['private', 'organization', 'public']),
});

/**
 * GET /api/characters - List characters for current organization
 */
async function handleGET(request: NextRequest) {
  // During build time, return a stub response to prevent database access
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json(
      { error: 'API not available during build time' },
      { status: 503 },
    );
  }

  try {
    // Get current user session
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search') || undefined;
    const visibility = searchParams.get('visibility') || undefined;
    const createdBy = searchParams.get('createdBy') || undefined;

    // Get characters and stats
    const characterService = await getCharacterService();
    const characters = await characterService.getCharacters(
      user.organizationId,
      {
        limit,
        offset,
        search,
        visibility,
        createdBy,
      },
    );

    const stats = await characterService.getCharacterStats(user.organizationId);

    return NextResponse.json({
      success: true,
      data: {
        characters,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching characters:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch characters',
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/characters - Create new character
 */
async function handlePOST(request: NextRequest) {
  // During build time, return a stub response to prevent database access
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json(
      { error: 'API not available during build time' },
      { status: 503 },
    );
  }

  try {
    // Get current user session
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const rawBody = await request.json();
    const validation = createCharacterSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validation.error.errors,
        },
        { status: 400 },
      );
    }

    const data = validation.data;

    // Create the character
    const characterService = await getCharacterService();
    const character = await characterService.createCharacter(
      user.organizationId,
      user.id,
      data,
    );

    return NextResponse.json(
      {
        success: true,
        data: character,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating character:', error);

    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Failed to create character' },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
