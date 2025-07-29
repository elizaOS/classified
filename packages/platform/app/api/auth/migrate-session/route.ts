import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { anonymousSessionRepo } from '@/lib/database/repositories/anonymous-session';
import type { MigrationResult } from '@/lib/database/repositories/anonymous-session';

interface MigrationRequest {
  sessionId: string;
  userId: string;
  userEmail: string;
}

async function handlePOST(request: NextRequest) {
  try {
    const body: MigrationRequest = await request.json();
    const { sessionId, userId, userEmail } = body;

    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: 'Session ID and user ID are required' },
        { status: 400 },
      );
    }

    // Migrate the session using the repository
    const migrationResult = await anonymousSessionRepo.migrateToUser(
      sessionId,
      userId,
    );

    return NextResponse.json(migrationResult);
  } catch (error) {
    console.error('Session migration error:', error);
    return NextResponse.json(
      { error: 'Failed to migrate session' },
      { status: 500 },
    );
  }
}

// Endpoint to get session statistics
async function handleGET(request: NextRequest) {
  try {
    const stats = await anonymousSessionRepo.getSessionStats();
    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Get session stats error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session statistics' },
      { status: 500 },
    );
  }
}

export const { POST, GET } = wrapHandlers({ handlePOST, handleGET });
