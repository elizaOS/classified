/**
 * Dashboard Activity API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { authService } from '@/lib/auth/session';
import { getDatabase } from '@/lib/database';
import { users, agents, userSessions } from '@/lib/database';
import { eq, desc, and, gte } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * GET /api/dashboard/activity - Get recent dashboard activity
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

    // Get limit from query params
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    // For now, create some sample activity based on recent data
    const recentActivity = [];

    const db = await getDatabase();

    // Get recent user sessions as activity
    const recentSessions = await db
      .select({
        id: userSessions.id,
        createdAt: userSessions.createdAt,
        userEmail: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .where(
        and(
          eq(users.organizationId, organization.id),
          gte(
            userSessions.createdAt,
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          ),
        ),
      )
      .orderBy(desc(userSessions.createdAt))
      .limit(Math.min(limit, 10));

    // Convert sessions to activity items
    for (const session of recentSessions) {
      const timeAgo = getTimeAgo(session.createdAt);
      recentActivity.push({
        id: `session-${session.id}`,
        type: 'user_joined',
        title: 'User signed in',
        description: `${session.firstName} ${session.lastName} (${session.userEmail}) signed in`,
        timestamp: timeAgo,
      });
    }

    // Get recent agents as activity
    const recentAgents = await db
      .select({
        id: agents.id,
        name: agents.name,
        createdAt: agents.createdAt,
        // deploymentStatus: agents.deploymentStatus, // TODO: Add to schema
        isActive: agents.isActive, // Using isActive as proxy
      })
      .from(agents)
      .where(
        and(
          eq(agents.organizationId, organization.id),
          gte(agents.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
        ),
      )
      .orderBy(desc(agents.createdAt))
      .limit(Math.min(limit, 5));

    // Convert agents to activity items
    for (const agent of recentAgents) {
      const timeAgo = getTimeAgo(agent.createdAt);
      recentActivity.push({
        id: `agent-${agent.id}`,
        type: agent.isActive ? 'agent_deployed' : 'agent_created',
        title: agent.isActive ? 'Agent deployed' : 'Agent created',
        description: `Agent "${agent.name}" was ${agent.isActive ? 'deployed' : 'created'}`,
        timestamp: timeAgo,
      });
    }

    // Sort by timestamp and limit
    recentActivity.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    const limitedActivity = recentActivity.slice(0, limit);

    // If no real activity, add some placeholder activity for development
    if (limitedActivity.length === 0) {
      const now = new Date();
      limitedActivity.push(
        {
          id: 'dev-1',
          type: 'user_joined',
          title: 'Development user created',
          description: 'Developer account was set up for testing',
          timestamp: getTimeAgo(now),
        },
        {
          id: 'dev-2',
          type: 'credit_added',
          title: 'Credits added',
          description: 'Development credits were added to account',
          timestamp: getTimeAgo(new Date(now.getTime() - 5 * 60 * 1000)),
        },
      );
    }

    return NextResponse.json({
      success: true,
      data: limitedActivity,
    });
  } catch (error) {
    console.error('Error fetching dashboard activity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch activity' },
      { status: 500 },
    );
  }
}

/**
 * Helper function to format time ago
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }
}

export const { GET } = wrapHandlers({ handleGET });
