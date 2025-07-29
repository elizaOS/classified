import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';

interface AnonymousSession {
  sessionId: string;
  createdAt: Date;
  lastActivity: Date;
  chatHistory: any[];
  workflowProgress: any;
  userPreferences: any;
  generatedContent: any[];
  expiryTime?: Date;
}

// In-memory storage for demo purposes
// In production, this would use Redis or a database
const sessionStore = new Map<string, AnonymousSession>();

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 },
      );
    }

    const session = sessionStore.get(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check if session has expired
    if (session.expiryTime && new Date() > session.expiryTime) {
      sessionStore.delete(sessionId);
      return NextResponse.json({ error: 'Session expired' }, { status: 404 });
    }

    // Remove expiry time from response
    const { expiryTime, ...sessionData } = session;

    return NextResponse.json(sessionData);
  } catch (error) {
    console.error('Session retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params;
    const updates: Partial<AnonymousSession> = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 },
      );
    }

    const existingSession = sessionStore.get(sessionId);

    if (!existingSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check if session has expired
    if (existingSession.expiryTime && new Date() > existingSession.expiryTime) {
      sessionStore.delete(sessionId);
      return NextResponse.json({ error: 'Session expired' }, { status: 404 });
    }

    // Update session
    const updatedSession = {
      ...existingSession,
      ...updates,
      sessionId, // Ensure sessionId cannot be changed
      lastActivity: new Date(),
    };

    sessionStore.set(sessionId, updatedSession);

    // Remove expiry time from response
    const { expiryTime, ...sessionData } = updatedSession;

    return NextResponse.json(sessionData);
  } catch (error) {
    console.error('Session update error:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: sessionId } = await params;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 },
      );
    }

    const deleted = sessionStore.delete(sessionId);

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

export const { GET } = wrapHandlers({ handleGET });
