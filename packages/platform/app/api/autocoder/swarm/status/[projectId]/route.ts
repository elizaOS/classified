import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * GET /api/autocoder/swarm/status/[projectId]
 *
 * Gets the current status of a swarm project by querying the main ElizaOS agent.
 * Returns real-time progress, agent statuses, and project phase information.
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

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 },
      );
    }

    // Query the main ElizaOS agent for project status
    const agentResponse = await fetch(
      `${process.env.ELIZA_AGENT_URL}/api/swarm/status/${projectId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ELIZA_AGENT_TOKEN}`,
          'X-User-ID': session.user.id, // Pass user ID for authorization
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
          { error: 'Access denied - you can only view your own projects' },
          { status: 403 },
        );
      }

      const errorText = await agentResponse.text();
      console.error('Agent error:', errorText);
      return NextResponse.json(
        { error: 'Failed to get project status from agent' },
        { status: 500 },
      );
    }

    const statusData = await agentResponse.json();

    return NextResponse.json({
      success: true,
      project: statusData.project,
      agents: statusData.agents || [],
      progress: statusData.progress || {},
      timeline: statusData.timeline || {},
      artifacts: statusData.artifacts || {},
      lastUpdated: statusData.lastUpdated || new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting project status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/autocoder/swarm/status/[projectId]
 *
 * Updates project status via the main ElizaOS agent.
 * Allows pausing, resuming, or canceling projects.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const { action, reason } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 },
      );
    }

    if (!action || !['pause', 'resume', 'cancel'].includes(action)) {
      return NextResponse.json(
        { error: 'Valid action is required (pause, resume, cancel)' },
        { status: 400 },
      );
    }

    // Send status update to the main ElizaOS agent
    const agentResponse = await fetch(
      `${process.env.ELIZA_AGENT_URL}/api/swarm/status/${projectId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ELIZA_AGENT_TOKEN}`,
        },
        body: JSON.stringify({
          userId: session.user.id,
          action,
          reason: reason || `User requested ${action}`,
          requestId: `platform-status-${Date.now()}`,
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
          { error: 'Access denied - you can only modify your own projects' },
          { status: 403 },
        );
      }

      const errorText = await agentResponse.text();
      console.error('Agent error:', errorText);
      return NextResponse.json(
        { error: 'Failed to update project status via agent' },
        { status: 500 },
      );
    }

    const result = await agentResponse.json();

    return NextResponse.json({
      success: true,
      projectId,
      action,
      newStatus: result.newStatus,
      message: result.message || `Project ${action} successful`,
    });
  } catch (error) {
    console.error('Error updating project status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
