import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * GET /api/autocoder/swarm/messages/[projectId]
 *
 * Retrieves messages for a swarm project by querying the main ElizaOS agent.
 * Returns conversation history, agent communications, and system messages.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const messageType = searchParams.get('type'); // 'agent', 'user', 'system', 'build'
    const since = searchParams.get('since'); // ISO timestamp

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 },
      );
    }

    // Build query parameters for agent
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      userId: session.user.id,
      ...(messageType && { type: messageType }),
      ...(since && { since }),
    });

    // Query the main ElizaOS agent for project messages
    const agentResponse = await fetch(
      `${process.env.ELIZA_AGENT_URL}/api/swarm/messages/${projectId}?${queryParams}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ELIZA_AGENT_TOKEN}`,
        },
      },
    );

    if (!agentResponse.ok) {
      if (agentResponse.status === 404) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 },
        );
      }

      if (agentResponse.status === 403) {
        return NextResponse.json(
          {
            error:
              'Access denied - you can only view your own project messages',
          },
          { status: 403 },
        );
      }

      const errorText = await agentResponse.text();
      console.error('Agent error:', errorText);
      return NextResponse.json(
        { error: 'Failed to get project messages from agent' },
        { status: 500 },
      );
    }

    const messagesData = await agentResponse.json();

    return NextResponse.json({
      success: true,
      messages: messagesData.messages || [],
      total: messagesData.total || 0,
      hasMore: messagesData.hasMore || false,
      lastUpdated: messagesData.lastUpdated || new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting project messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/autocoder/swarm/messages/[projectId]
 *
 * Sends a message to a swarm project via the main ElizaOS agent.
 * Allows users to communicate with the project team.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const { message, messageType = 'user', metadata } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 },
      );
    }

    if (
      !message ||
      typeof message !== 'string' ||
      message.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 },
      );
    }

    if (!['user', 'instruction', 'feedback'].includes(messageType)) {
      return NextResponse.json(
        {
          error:
            'Invalid message type. Must be: user, instruction, or feedback',
        },
        { status: 400 },
      );
    }

    // Send message to the main ElizaOS agent
    const agentResponse = await fetch(
      `${process.env.ELIZA_AGENT_URL}/api/swarm/messages/${projectId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ELIZA_AGENT_TOKEN}`,
        },
        body: JSON.stringify({
          userId: session.user.id,
          message: message.trim(),
          messageType,
          metadata: metadata || {},
          timestamp: new Date().toISOString(),
          requestId: `platform-msg-${Date.now()}`,
        }),
      },
    );

    if (!agentResponse.ok) {
      if (agentResponse.status === 404) {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 },
        );
      }

      if (agentResponse.status === 403) {
        return NextResponse.json(
          {
            error:
              'Access denied - you can only send messages to your own projects',
          },
          { status: 403 },
        );
      }

      const errorText = await agentResponse.text();
      console.error('Agent error:', errorText);
      return NextResponse.json(
        { error: 'Failed to send message via agent' },
        { status: 500 },
      );
    }

    const result = await agentResponse.json();

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      projectId,
      message: result.message || 'Message sent successfully',
      timestamp: result.timestamp || new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error sending project message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
