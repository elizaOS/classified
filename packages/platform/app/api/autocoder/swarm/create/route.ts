import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * POST /api/autocoder/swarm/create
 *
 * Creates a new swarm project by communicating with the main ElizaOS agent.
 * The agent manages all project state through its memory system.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, projectName, description } = await request.json();

    if (!prompt || !projectName || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: prompt, projectName, description' },
        { status: 400 },
      );
    }

    // Send request to the main ElizaOS agent via its API
    const agentResponse = await fetch(
      `${process.env.ELIZA_AGENT_URL}/api/swarm/create`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.ELIZA_AGENT_TOKEN}`,
        },
        body: JSON.stringify({
          userId: session.user.id,
          prompt,
          projectName,
          description,
          requestId: `platform-${Date.now()}`,
        }),
      },
    );

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      console.error('Agent error:', errorText);
      return NextResponse.json(
        { error: 'Failed to create swarm project with agent' },
        { status: 500 },
      );
    }

    const swarmProject = await agentResponse.json();

    return NextResponse.json({
      success: true,
      projectId: swarmProject.id,
      swarmProject,
    });
  } catch (error) {
    console.error('Error creating swarm project:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
