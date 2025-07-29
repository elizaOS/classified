/**
 * Agent Stop API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';

// Use dynamic imports to avoid database connection during build
const getAgentService = () =>
  import('@/lib/agents/service').then((m) => m.agentService);
const getAuthService = () =>
  import('@/lib/auth/session').then((m) => m.authService);

/**
 * POST /api/agents/[id]/stop - Stop a deployed agent
 */
async function handlePOST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const params = await props.params;

    // Get current user session
    const authService = await getAuthService();
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

    // Get agent service
    const agentService = await getAgentService();

    // Check if agent exists
    const existingAgent = await agentService.getAgentById(
      user.organizationId,
      params.id,
    );
    if (!existingAgent) {
      return NextResponse.json(
        {
          success: false,
          error: 'Agent not found',
        },
        { status: 404 },
      );
    }

    // Check if agent is active (using isActive as proxy for deployed)
    // TODO: Add deploymentStatus field to schema and use proper deployment status check
    // if (existingAgent.deploymentStatus !== 'deployed') {
    //   return NextResponse.json(
    //     {
    //       success: false,
    //       error: 'Agent is not currently deployed',
    //     },
    //     { status: 400 },
    //   );
    // }

    // Stop the agent
    const success = await agentService.stopAgent(
      user.organizationId,
      params.id,
    );

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to stop agent',
        },
        { status: 500 },
      );
    }

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
