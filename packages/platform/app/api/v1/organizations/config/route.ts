/**
 * Organization Configuration API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/api/middleware';

// Use dynamic imports to avoid database connection during build
const getAgentService = () =>
  import('@/lib/agents/service').then((m) => m.AgentService);

/**
 * GET /api/v1/organizations/config - Get organization configuration
 */
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const user = request.user!;

    const AgentService = await getAgentService();
    const agentService = new AgentService();
    const config = await agentService.getOrganizationConfig(
      user.organizationId,
      user.id,
    );

    return NextResponse.json({
      config,
      requiredPlugins: config.requiredPlugins,
      allowedPlugins: config.allowedPlugins,
    });
  } catch (error) {
    console.error('GET /api/v1/organizations/config error:', error);
    return NextResponse.json(
      { error: 'Failed to get organization configuration' },
      { status: 500 },
    );
  }
});
