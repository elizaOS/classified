/**
 * Character Conversations API Routes - Start and manage character conversations
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { z } from 'zod';

// Use dynamic imports to avoid database connection during build
const getCharacterService = () =>
  import('@/lib/characters/service').then((m) => m.characterService);
const getAuthService = () =>
  import('@/lib/auth/session').then((m) => m.authService);

// Start conversation schema
const startConversationSchema = z.object({
  title: z.string().max(200).optional(),
});

/**
 * GET /api/characters/[id]/conversations - Get user's conversations with character
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Get character service
    const characterService = await getCharacterService();

    // Verify character exists and is accessible
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

    // Get conversations
    const conversations = await characterService.getUserConversations(
      user.organizationId,
      user.id,
      characterId,
      { limit, offset },
    );

    return NextResponse.json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/characters/[id]/conversations - Start new conversation with character
 */
async function handlePOST(
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

    // Parse and validate request body
    const rawBody = await request.json();
    const validation = startConversationSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validation.error.errors,
        },
        { status: 400 },
      );
    }

    const { title } = validation.data;

    // Get character service
    const characterService = await getCharacterService();

    // Verify character exists and is accessible
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

    // Start conversation
    const conversation = await characterService.startConversation(
      user.organizationId,
      user.id,
      characterId,
      title,
    );

    return NextResponse.json(
      {
        success: true,
        data: conversation,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error starting conversation:', error);
    return NextResponse.json(
      { error: 'Failed to start conversation' },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
