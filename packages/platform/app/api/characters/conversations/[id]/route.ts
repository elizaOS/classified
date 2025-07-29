/**
 * Character Conversation Individual API Routes - Get and manage specific conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';

// Use dynamic imports to avoid database connection during build
const getCharacterService = () =>
  import('@/lib/characters/service').then((m) => m.characterService);
const getAuthService = () =>
  import('@/lib/auth/session').then((m) => m.authService);

/**
 * GET /api/characters/conversations/[id] - Get conversation by ID
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
    const conversationId = resolvedParams.id;

    const characterService = await getCharacterService();
    const conversation = await characterService.getConversation(
      user.organizationId,
      user.id,
      conversationId,
    );

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
