/**
 * Dashboard Stats API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { authService } from '@/lib/auth/session';
import { getDatabase } from '@/lib/database';
import {
  users,
  organizations,
  agents,
  userSessions,
} from '@/lib/database/schema';
import { eq, count, and, gte } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * GET /api/dashboard/stats - Get dashboard statistics
 */
async function handleGET(request: NextRequest) {
  try {
    // Get current user session
    const user = await authService.getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get organization
    const organization = await authService.getCurrentOrganization();
    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 },
      );
    }

    // Get organization stats
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const db = await getDatabase();

    // Count agents in organization
    const [agentStats] = await db
      .select({
        total: count(),
      })
      .from(agents)
      .where(eq(agents.organizationId, organization.id));

    // Count active agents (simplified - just count all for now)
    const activeAgents = agentStats?.total || 0;

    // Count users in organization
    const [userStats] = await db
      .select({
        total: count(),
      })
      .from(users)
      .where(
        and(
          eq(users.organizationId, organization.id),
          eq(users.isActive, true),
        ),
      );

    // Count pending invites (simplified - assume 0 for now)
    const pendingInvites = 0;

    // Get recent API usage (simplified - use session count as proxy)
    const [sessionStats] = await db
      .select({
        count: count(),
      })
      .from(userSessions)
      .where(
        and(
          eq(userSessions.organizationId, organization.id),
          gte(userSessions.createdAt, yesterday),
        ),
      );

    const apiRequests24h = sessionStats?.count || 0;

    // Calculate estimated cost (simplified)
    const estimatedCost = (apiRequests24h * 0.001).toFixed(2);

    const stats = {
      agentCount: agentStats?.total || 0,
      userCount: userStats?.total || 0,
      creditBalance: organization.creditBalance || '0.00',
      subscriptionTier: organization.subscriptionTier || 'free',
      apiRequests24h,
      totalCost24h: estimatedCost,
      activeAgents,
      pendingInvites,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
