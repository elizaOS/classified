/**
 * Agent Stop API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';

// Use dynamic imports to avoid database connection during build
const getAuthService = () =>
  import('@/lib/auth/session').then((m) => m.authService);
const getAgentService = () =>
  import('@/lib/agents/service').then((m) => m.agentService);
const getAgentLifecycleManager = () =>
  import('@/lib/runtime/agent-lifecycle').then((m) => m.agentLifecycleManager);

/**
 * POST /api/v1/agents/[id]/stop - Stop a running agent
 */
async function handlePOST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    // During build time, return a stub response to prevent database access
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return NextResponse.json(
        { error: 'API not available during build time' },
        { status: 503 },
      );
    }

    const params = await props.params;

    // Get services using dynamic imports
    const authService = await getAuthService();
    const agentService = await getAgentService();
    const agentLifecycleManager = await getAgentLifecycleManager();

    // Get current user session
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 },
      );
    }

    // Check if agent exists
    const agent = await agentService.getAgentById(
      user.organizationId,
      params.id,
    );
    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: 'Agent not found',
        },
        { status: 404 },
      );
    }

    // Stop the agent
    await agentLifecycleManager.stopAgent(params.id as any);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Agent stopped successfully',
      },
    });
  } catch (error) {
    console.error('Error stopping agent:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to stop agent',
      },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
