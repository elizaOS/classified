import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * POST /api/autocoder/swarm/scale/[projectId]
 *
 * Scales a swarm project up or down by adding or removing engineers.
 * Communicates with the main ElizaOS agent to coordinate scaling operations.
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
    const { targetAgentCount, specializations } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 },
      );
    }

    if (
      !targetAgentCount ||
      typeof targetAgentCount !== 'number' ||
      targetAgentCount < 1 ||
      targetAgentCount > 50
    ) {
      return NextResponse.json(
        { error: 'Target agent count must be a number between 1 and 50' },
        { status: 400 },
      );
    }

    // Send scaling request to the main ElizaOS agent
    const agentResponse = await fetch(
      `${process.env.ELIZA_AGENT_URL}/api/swarm/scale/${projectId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ELIZA_AGENT_TOKEN}`,
        },
        body: JSON.stringify({
          userId: session.user.id,
          targetAgentCount,
          specializations: specializations || [],
          requestId: `platform-scale-${Date.now()}`,
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
          { error: 'Access denied - you can only scale your own projects' },
          { status: 403 },
        );
      }

      const errorText = await agentResponse.text();
      console.error('Agent error:', errorText);
      return NextResponse.json(
        { error: 'Failed to scale project via agent' },
        { status: 500 },
      );
    }

    const result = await agentResponse.json();

    return NextResponse.json({
      success: true,
      projectId,
      previousAgentCount: result.previousAgentCount,
      newAgentCount: result.newAgentCount,
      scalingOperation: result.scalingOperation, // 'scale_up' or 'scale_down'
      addedAgents: result.addedAgents || [],
      removedAgents: result.removedAgents || [],
    });
  } catch (error) {
    console.error('Error scaling swarm project:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
