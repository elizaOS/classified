import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { ContainerMonitoringService } from '@/lib/services/container-monitoring';
import { auth } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import {
  hostedContainers,
  assetUsageRecords,
} from '@/lib/database/marketplace-schema';
import { eq, and, gte, desc, sum } from 'drizzle-orm';

const monitoringService = new ContainerMonitoringService();

async function handleGET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const timeRange = url.searchParams.get('timeRange') || '24h'; // 24h, 7d, 30d

    // Calculate time range
    let startDate: Date;
    const now = new Date();

    switch (timeRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const db = await getDatabase();

    // Get user's containers
    const userContainers = await db
      .select()
      .from(hostedContainers)
      .where(
        and(
          eq(hostedContainers.userId, session.user.id),
          eq(hostedContainers.organizationId, session.organizationId),
        ),
      )
      .orderBy(desc(hostedContainers.createdAt));

    // Get container health summary
    const healthSummary = {
      total: userContainers.length,
      running: userContainers.filter((c: any) => c.status === 'running').length,
      stopped: userContainers.filter((c: any) => c.status === 'stopped').length,
      failed: userContainers.filter((c: any) => c.status === 'failed').length,
      healthy: userContainers.filter((c: any) => c.healthStatus === 'healthy')
        .length,
      unhealthy: userContainers.filter(
        (c: any) => c.healthStatus === 'unhealthy',
      ).length,
      unknown: userContainers.filter((c: any) => c.healthStatus === 'unknown')
        .length,
    };

    // Get usage statistics for the time period
    const containerIds = userContainers.map((c: any) => c.id);
    let usageStats = {
      totalCost: 0,
      totalHours: 0,
      creatorRevenue: 0,
      platformRevenue: 0,
    };

    if (containerIds.length > 0) {
      const usageRecords = await db
        .select({
          totalCost: sum(assetUsageRecords.totalCost),
          totalHours: sum(assetUsageRecords.quantity),
          creatorRevenue: sum(assetUsageRecords.creatorRevenue),
          platformRevenue: sum(assetUsageRecords.platformRevenue),
        })
        .from(assetUsageRecords)
        .where(
          and(
            eq(assetUsageRecords.userId, session.user.id),
            eq(assetUsageRecords.usageType, 'container_hour'),
            gte(assetUsageRecords.createdAt, startDate),
          ),
        );

      const stats = usageRecords[0];
      usageStats = {
        totalCost: parseFloat(stats.totalCost || '0'),
        totalHours: parseFloat(stats.totalHours || '0'),
        creatorRevenue: parseFloat(stats.creatorRevenue || '0'),
        platformRevenue: parseFloat(stats.platformRevenue || '0'),
      };
    }

    // Calculate current hourly cost
    const runningContainers = userContainers.filter(
      (c: any) => c.status === 'running',
    );
    const currentHourlyCost = runningContainers.reduce(
      (sum: number, container: any) =>
        sum + parseFloat(container.billedCostPerHour),
      0,
    );

    // Get recent container activity
    const recentActivity = userContainers
      .slice(0, 10)
      .map((container: any) => ({
        id: container.id,
        containerName: container.containerName,
        status: container.status,
        healthStatus: container.healthStatus,
        lastHealthCheck: container.lastHealthCheck,
        billedCostPerHour: parseFloat(container.billedCostPerHour),
        startedAt: container.startedAt,
        stoppedAt: container.stoppedAt,
        createdAt: container.createdAt,
      }));

    // Performance metrics (averages)
    const performanceMetrics = {
      averageUptime: calculateAverageUptime(userContainers),
      averageResponseTime: null, // Would need to track this separately
      totalRestarts: 0, // Would need to track this separately
      errorRate: calculateErrorRate(healthSummary),
    };

    return NextResponse.json({
      success: true,
      data: {
        timeRange,
        period: {
          startDate,
          endDate: now,
        },
        healthSummary,
        usageStats,
        currentHourlyCost,
        performance: performanceMetrics,
        recentActivity,
        recommendations: generateRecommendations(userContainers, usageStats),
      },
    });
  } catch (error) {
    console.error('Failed to get monitoring summary:', error);
    return NextResponse.json(
      { error: 'Failed to get monitoring summary' },
      { status: 500 },
    );
  }

  function calculateAverageUptime(containers: any[]): number {
    if (containers.length === 0) {
      return 0;
    }

    const runningContainers = containers.filter(
      (c) => c.status === 'running' && c.startedAt,
    );
    if (runningContainers.length === 0) {
      return 0;
    }

    const now = Date.now();
    const totalUptime = runningContainers.reduce((sum, container) => {
      const startTime = new Date(container.startedAt).getTime();
      return sum + (now - startTime);
    }, 0);

    const averageUptimeMs = totalUptime / runningContainers.length;
    return Math.round(averageUptimeMs / (1000 * 60 * 60)); // Convert to hours
  }

  function calculateErrorRate(healthSummary: any): number {
    if (healthSummary.total === 0) {
      return 0;
    }
    return (healthSummary.unhealthy / healthSummary.total) * 100;
  }

  function generateRecommendations(
    containers: any[],
    usageStats: any,
  ): string[] {
    const recommendations: string[] = [];

    // Cost optimization recommendations
    if (usageStats.totalCost > 50) {
      recommendations.push(
        'Consider optimizing container resource allocation to reduce costs',
      );
    }

    // Health recommendations
    const unhealthyContainers = containers.filter(
      (c) => c.healthStatus === 'unhealthy',
    );
    if (unhealthyContainers.length > 0) {
      recommendations.push(
        `${unhealthyContainers.length} container(s) are unhealthy and may need attention`,
      );
    }

    // Resource recommendations
    const runningContainers = containers.filter((c) => c.status === 'running');
    if (runningContainers.length > 10) {
      recommendations.push(
        'You have many running containers. Consider consolidating or stopping unused ones.',
      );
    }

    // Billing recommendations
    if (usageStats.totalHours > 100) {
      recommendations.push(
        'High usage detected. Consider optimizing container usage patterns.',
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('All containers are operating efficiently');
    }

    return recommendations;
  }
}

export const { GET } = wrapHandlers({ handleGET });
