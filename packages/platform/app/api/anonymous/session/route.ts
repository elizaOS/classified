import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { anonymousSessionRepo } from '@/lib/database/repositories/anonymous-session';
import type { SessionData } from '@/lib/database/repositories/anonymous-session';

async function handlePOST(request: NextRequest) {
  try {
    const sessionData: SessionData = await request.json();

    if (!sessionData.sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 },
      );
    }

    // Extract IP and User Agent from request
    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Create session in database
    const sessionId = await anonymousSessionRepo.createSession({
      ...sessionData,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, id: sessionId });
  } catch (error) {
    console.error('Session save error:', error);
    return NextResponse.json(
      { error: 'Failed to save session' },
      { status: 500 },
    );
  }
}

async function handleGET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 },
      );
    }

    // Get session from database
    const session = await anonymousSessionRepo.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 },
      );
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Session retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 },
      );
    }

    // Delete session from database
    const deleted = await anonymousSessionRepo.deleteSession(sessionId);

    if (!deleted) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Session deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 },
    );
  }
}

// Cleanup expired sessions - this could be moved to a scheduled job
if (typeof setInterval !== 'undefined') {
  setInterval(
    async () => {
      try {
        const cleanedCount =
          await anonymousSessionRepo.cleanupExpiredSessions();
        if (cleanedCount > 0) {
          console.log(`Cleaned up ${cleanedCount} expired anonymous sessions`);
        }
      } catch (error) {
        console.error('Failed to cleanup expired sessions:', error);
      }
    },
    60 * 60 * 1000,
  ); // Run every hour
}

export const { POST, GET } = wrapHandlers({ handlePOST, handleGET });
