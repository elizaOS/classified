import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * GET /api/autocoder/swarm/projects
 *
 * Retrieves all swarm projects for the authenticated user by querying the main ElizaOS agent.
 * Projects are stored in the agent's memory system and filtered by user ID.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // Filter by status (active, completed, failed)
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Query the main ElizaOS agent for user's projects
    const queryParams = new URLSearchParams({
      userId: session.user.id,
      limit: limit.toString(),
      offset: offset.toString(),
      ...(status && { status }),
    });

    const agentResponse = await fetch(
      `${process.env.ELIZA_AGENT_URL}/api/swarm/projects?${queryParams}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ELIZA_AGENT_TOKEN}`,
        },
      },
    );

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      console.error('Agent error:', errorText);
      return NextResponse.json(
        { error: 'Failed to get projects from agent' },
        { status: 500 },
      );
    }

    const projectsData = await agentResponse.json();

    return NextResponse.json({
      success: true,
      projects: projectsData.projects || [],
      total: projectsData.total || 0,
      hasMore: projectsData.hasMore || false,
    });
  } catch (error) {
    console.error('Error getting user projects:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
