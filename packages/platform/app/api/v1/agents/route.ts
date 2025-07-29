/**
 * V1 API - Agents Routes
 * Provides backward compatibility for v1 API consumers
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';

// Dynamic imports to avoid build-time database connections
const getAgentService = () =>
  import('@/lib/agents/service').then((m) => m.agentService);
const getAuthService = () =>
  import('@/lib/auth/session').then((m) => m.authService);

interface V1AgentResponse {
  id: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/v1/agents - List agents (v1 format)
 */
async function handleGET(request: NextRequest) {
  try {
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    const agentService = await getAgentService();
    const agents = await agentService.getAgents(user.organizationId);

    // Transform to v1 format
    const v1Agents: V1AgentResponse[] = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      status: 'active', // Default status until added to agent schema
      created_at: agent.createdAt.toISOString(),
      updated_at: agent.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      status: 'success',
      data: v1Agents,
      meta: {
        total: v1Agents.length,
        version: 'v1',
      },
    });
  } catch (error) {
    console.error('V1 API Error - List agents:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve agents',
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/agents - Create agent (v1 format)
 */
async function handlePOST(request: NextRequest) {
  try {
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    const body = await request.json();

    // Basic v1 validation
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        {
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          message: 'Name is required',
        },
        { status: 400 },
      );
    }

    const agentService = await getAgentService();

    // Transform v1 request to current format
    const agent = await agentService.createAgent(user.organizationId, user.id, {
      name: body.name,
      description: body.description,
      slug: body.slug || body.name.toLowerCase().replace(/\s+/g, '-'),
      character: body.character || {
        name: body.name,
        bio: body.bio || `AI agent ${body.name}`,
      },
      plugins: body.plugins || [],
      runtimeConfig: body.config || {},
      visibility: body.visibility || 'private',
    });

    // Transform to v1 response format
    const v1Response: V1AgentResponse = {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      status: 'active', // Default status until added to agent schema
      created_at: agent.createdAt.toISOString(),
      updated_at: agent.updatedAt.toISOString(),
    };

    return NextResponse.json(
      {
        status: 'success',
        data: v1Response,
        meta: {
          version: 'v1',
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('V1 API Error - Create agent:', error);

    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json(
        {
          error: 'Conflict',
          code: 'ALREADY_EXISTS',
          message: 'Agent with this name already exists',
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: 'Failed to create agent',
      },
      { status: 500 },
    );
  }
}

// Export with security headers and authentication
// Authentication is automatically required for /api/v1/agents routes
export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
