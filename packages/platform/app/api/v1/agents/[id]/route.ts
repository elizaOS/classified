/**
 * Individual Agent Management API
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { z } from 'zod';

// Use dynamic imports to avoid database connection during build
const getAuthService = () =>
  import('@/lib/auth/session').then((m) => m.authService);
const getAgentService = () =>
  import('@/lib/agents/service').then((m) => m.AgentService);

const updateAgentSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  slug: z.string().optional(),
  avatarUrl: z.string().optional(),
  character: z.record(z.any()).optional(),
  plugins: z.array(z.string()).optional(),
  runtimeConfig: z
    .object({
      models: z.record(z.string()).optional(),
      providers: z.array(z.string()).optional(),
      maxTokens: z.number().optional(),
      temperature: z.number().optional(),
      environment: z.record(z.string()).optional(),
    })
    .optional(),
  visibility: z.enum(['private', 'organization', 'public']).optional(),
});

/**
 * GET /api/v1/agents/[id] - Get agent by ID
 */
async function handleGET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  // During build time, return a stub response to prevent database access
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json(
      { error: 'API not available during build time' },
      { status: 503 },
    );
  }

  try {
    const params = await props.params;

    // Get current user session
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const AgentService = await getAgentService();
    const agentService = new AgentService();
    const agent = await agentService.getAgentById(
      user.organizationId,
      params.id,
    );

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('GET /api/v1/agents/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/v1/agents/[id] - Update agent
 */
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  // During build time, return a stub response to prevent database access
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json(
      { error: 'API not available during build time' },
      { status: 503 },
    );
  }

  try {
    const params = await props.params;

    // Get current user session
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const validationResult = updateAgentSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validationResult.error.errors,
        },
        { status: 400 },
      );
    }

    const updateData = validationResult.data;

    const AgentService = await getAgentService();

    // Validate character config if provided
    if (updateData.character) {
      const agentService = new AgentService();
      const characterValidation = agentService.validateCharacterConfig(
        updateData.character,
      );
      if (!characterValidation.isValid) {
        return NextResponse.json(
          {
            error: 'Invalid character configuration',
            details: characterValidation.errors,
          },
          { status: 400 },
        );
      }
    }

    const agentService = new AgentService();
    const agent = await agentService.updateAgent(
      user.organizationId,
      params.id,
      updateData,
      user.id,
    );

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('PUT /api/v1/agents/[id] error:', error);

    if (
      error instanceof Error &&
      error.message.includes('slug already exists')
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/v1/agents/[id] - Delete agent
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  // During build time, return a stub response to prevent database access
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return NextResponse.json(
      { error: 'API not available during build time' },
      { status: 503 },
    );
  }

  try {
    const params = await props.params;

    // Get current user session
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 },
      );
    }

    const AgentService = await getAgentService();
    const agentService = new AgentService();
    const deleted = await agentService.deleteAgent(
      user.organizationId,
      params.id,
    );

    if (!deleted) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/v1/agents/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
