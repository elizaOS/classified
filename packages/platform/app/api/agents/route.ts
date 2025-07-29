/**
 * Agents API Routes - CRUD operations for agents
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { wrapHandlers } from '@/lib/api/route-wrapper';

// Use dynamic imports to avoid database connection during build
const getAgentService = () =>
  import('@/lib/agents/service').then((m) => m.agentService);
const getAuthService = () =>
  import('@/lib/auth/session').then((m) => m.authService);
import {
  createAgentSchema,
  sanitizeRequestBody,
} from '@/lib/security/sanitization';

// Using imported validation schema with sanitization

/**
 * GET /api/agents - List agents for current organization
 */
async function handleGET(request: NextRequest) {
  try {
    // Get current user session
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const visibility = searchParams.get('visibility') || undefined;
    const createdBy = searchParams.get('createdBy') || undefined;

    // Get agent service dynamically
    const agentService = await getAgentService();

    // Get agents and stats
    const agents = await agentService.getAgents(user.organizationId, {
      limit,
      offset,
      search,
      status,
      visibility,
      createdBy,
    });

    const stats = await agentService.getAgentStats(user.organizationId);

    return NextResponse.json({
      success: true,
      data: {
        agents,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch agents',
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/agents - Create new agent
 */
async function handlePOST(request: NextRequest) {
  try {
    // Get current user session
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    // TODO: Re-enable sanitization when dependencies are fixed
    const rawBody = await request.json();

    // Basic validation schema (temporarily simplified)
    const simpleSchema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      slug: z.string().min(1).max(50),
      character: z.object({
        name: z.string().min(1).max(100),
        bio: z.string().min(1).max(1000),
      }),
      plugins: z.array(z.string()),
      runtimeConfig: z.object({}).optional(),
      visibility: z.enum(['private', 'organization', 'public']),
    });

    const validation = simpleSchema.safeParse(rawBody);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validation.error.errors,
        },
        { status: 400 },
      );
    }

    const data = validation.data;

    // Get agent service dynamically
    const agentService = await getAgentService();

    // Validate character configuration
    const characterValidation = agentService.validateCharacterConfig(
      data.character,
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

    // Create the agent
    const agent = await agentService.createAgent(user.organizationId, user.id, {
      name: data.name,
      description: data.description,
      slug: data.slug,
      character: data.character,
      plugins: data.plugins,
      runtimeConfig: data.runtimeConfig || {},
      visibility: data.visibility,
    });

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    console.error('Error creating agent:', error);

    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 },
    );
  }
}

// Export with security headers and authentication
// These routes require auth by default via ROUTE_OVERRIDES in route-wrapper
export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
