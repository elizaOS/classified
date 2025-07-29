/**
 * Agent Deploy API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';

// Use dynamic imports to avoid database connection during build
const getAgentService = () =>
  import('@/lib/agents/service').then((m) => m.agentService);
const getAuthService = () =>
  import('@/lib/auth/session').then((m) => m.authService);

/**
 * POST /api/agents/[id]/deploy - Deploy an agent (start runtime)
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

    // Deploy the agent
    const deployed = await agentService.deployAgent(
      user.organizationId,
      params.id,
    );

    if (!deployed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to deploy agent',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Agent deployed successfully',
        agentId: params.id,
      },
    });
  } catch (error) {
    console.error('Error deploying agent:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to deploy agent',
      },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
