/**
 * Individual Agent Management Routes
 * Handles operations on specific agents
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { wrapHandlers } from '@/lib/api/route-wrapper';

// Use dynamic imports to avoid database connection during build
const getAgentService = () =>
  import('@/lib/agents/service').then((m) => m.agentService);
const getAuthService = () =>
  import('@/lib/auth/session').then((m) => m.authService);

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/agents/[id] - Get specific agent details
 */
async function handleGET(request: NextRequest, { params }: RouteParams) {
  try {
    // Get current user session
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agentService = await getAgentService();
    const agent = await agentService.getAgentById(
      user.organizationId,
      params.id,
    );

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { agent },
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/agents/[id] - Update agent
 */
async function handlePUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Get current user session
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validation schema for agent updates
    const updateAgentSchema = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(1000).optional(),
      character: z
        .object({
          name: z.string().min(1).max(100).optional(),
          bio: z.string().min(1).max(1000).optional(),
          system: z.string().optional(),
          messageExamples: z.array(z.array(z.any())).optional(),
          knowledge: z.array(z.any()).optional(),
        })
        .optional(),
      plugins: z.array(z.string()).optional(),
      runtimeConfig: z.object({}).optional(),
      visibility: z.enum(['private', 'organization', 'public']).optional(),
      isActive: z.boolean().optional(),
    });

    // Parse and validate request body
    const body = await request.json();
    const validation = updateAgentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 },
      );
    }

    const agentService = await getAgentService();

    // Verify agent exists and user has permission
    const existingAgent = await agentService.getAgentById(
      user.organizationId,
      params.id,
    );

    if (!existingAgent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Check if user can update this agent
    if (existingAgent.createdByUserId !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'You can only update agents you created' },
        { status: 403 },
      );
    }

    // Update the agent
    const updatedAgent = await agentService.updateAgent(
      user.organizationId,
      params.id,
      validation.data,
    );

    return NextResponse.json({
      success: true,
      data: { agent: updatedAgent },
    });
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/agents/[id] - Delete agent
 */
async function handleDELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Get current user session
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agentService = await getAgentService();

    // Verify agent exists and user has permission
    const existingAgent = await agentService.getAgentById(
      user.organizationId,
      params.id,
    );

    if (!existingAgent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Check if user can delete this agent
    if (existingAgent.createdByUserId !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'You can only delete agents you created' },
        { status: 403 },
      );
    }

    // Check if agent is currently running
    // TODO: Once deploymentStatus is added to schema, check if agent is deployed
    // if (existingAgent.deploymentStatus === 'deployed') {
    //   return NextResponse.json(
    //     { error: 'Cannot delete a deployed agent. Stop it first.' },
    //     { status: 400 },
    //   );
    // }

    // Delete the agent
    await agentService.deleteAgent(user.organizationId, params.id);

    return NextResponse.json({
      success: true,
      message: 'Agent deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent' },
      { status: 500 },
    );
  }
}

// Export with security headers and authentication
export const { GET, PUT, DELETE } = wrapHandlers({
  handleGET,
  handlePUT,
  handleDELETE,
});
