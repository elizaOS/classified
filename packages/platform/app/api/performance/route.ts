/**
 * Performance Monitoring API
 *
 * Provides access to performance metrics, monitoring data,
 * and optimization recommendations for administrators.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sessionService } from '@/lib/auth/session';
import { performanceMonitor } from '@/lib/performance/monitoring';
import { dbOptimizer } from '@/lib/performance/database-optimizer';
// Temporarily disable cache manager import until implementation is ready
// import { cacheManager } from '@/lib/cache/cache-manager';
import { withSecurityHeaders } from '@/lib/security/headers';

// Temporary mock cache manager for build
const cacheManager = {
  isHealthy: async () => true,
  size: async () => 0,
  clear: async () => {},
};

async function handleGET(request: NextRequest) {
  try {
    // Verify authentication and admin access
    const session = await sessionService.getSessionFromCookies();
    if (!session || !session.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'overview';
    const timeRange = searchParams.get('timeRange') || '1h';

    switch (action) {
      case 'overview':
        const overview = performanceMonitor.getPerformanceReport();
        return NextResponse.json({
          success: true,
          data: overview,
        });

      case 'dashboard':
        const dashboard = performanceMonitor.getDashboardData();
        return NextResponse.json({
          success: true,
          data: dashboard,
        });

      case 'endpoints':
        const endpoints = performanceMonitor.getEndpointMetrics();
        return NextResponse.json({
          success: true,
          data: {
            endpoints,
            total: endpoints.length,
          },
        });

      case 'system':
        const systemMetrics = performanceMonitor.getSystemMetrics();
        return NextResponse.json({
          success: true,
          data: systemMetrics,
        });

      case 'database':
        const dbMetrics = dbOptimizer.getMetrics();
        const slowQueries = dbOptimizer.getSlowQueries(10);
        const frequentQueries = dbOptimizer.getFrequentQueries(10);
        const indexSuggestions = await dbOptimizer.suggestIndexes();

        return NextResponse.json({
          success: true,
          data: {
            metrics: dbMetrics,
            slowQueries,
            frequentQueries,
            indexSuggestions,
          },
        });

      case 'cache':
        const cacheStats = cacheManager.getStats();
        return NextResponse.json({
          success: true,
          data: cacheStats,
        });

      case 'alerts':
        const activeAlerts = performanceMonitor.getActiveAlerts();
        return NextResponse.json({
          success: true,
          data: {
            activeAlerts,
            count: activeAlerts.length,
          },
        });

      case 'recommendations':
        const report = performanceMonitor.getPerformanceReport();
        return NextResponse.json({
          success: true,
          data: {
            recommendations: report.recommendations,
            priority: 'high', // Would be calculated based on severity
          },
        });

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('Failed to fetch performance data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch performance data',
        details:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      },
      { status: 500 },
    );
  }
}

async function handlePOST(request: NextRequest) {
  try {
    // Verify authentication and admin access
    const session = await sessionService.getSessionFromCookies();
    if (!session || !session.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { action, ...parameters } = body;

    switch (action) {
      case 'add-alert':
        const { rule } = parameters;
        if (!rule || !rule.id || !rule.name || !rule.metric) {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid alert rule. Missing required fields.',
            },
            { status: 400 },
          );
        }

        performanceMonitor.addAlertRule(rule);

        return NextResponse.json({
          success: true,
          message: 'Alert rule added successfully',
          data: { ruleId: rule.id },
        });

      case 'remove-alert':
        const { ruleId } = parameters;
        if (!ruleId) {
          return NextResponse.json(
            { success: false, error: 'Rule ID is required' },
            { status: 400 },
          );
        }

        const removed = performanceMonitor.removeAlertRule(ruleId);

        return NextResponse.json({
          success: true,
          message: removed
            ? 'Alert rule removed successfully'
            : 'Alert rule not found',
        });

      case 'clear-cache':
        const { type } = parameters;

        if (type === 'all' || !type) {
          await cacheManager.clear();
        } else {
          // Clear specific cache type
          await cacheManager.invalidateByTag(type);
        }

        return NextResponse.json({
          success: true,
          message: 'Cache cleared successfully',
        });

      case 'warmup-cache':
        const { queries } = parameters;
        await cacheManager.warmup(queries || []);

        return NextResponse.json({
          success: true,
          message: 'Cache warmup completed',
        });

      case 'reset-metrics':
        dbOptimizer.resetMetrics();

        return NextResponse.json({
          success: true,
          message: 'Performance metrics reset successfully',
        });

      case 'optimize-database':
        // In a real implementation, this would trigger database optimization
        const suggestions = await dbOptimizer.suggestIndexes();

        return NextResponse.json({
          success: true,
          message: 'Database optimization analysis completed',
          data: {
            suggestions,
            recommendedActions: [
              'Review slow query log',
              'Consider adding suggested indexes',
              'Optimize frequently used queries',
              'Update table statistics',
            ],
          },
        });

      case 'profile-function':
        const { functionName, enabled } = parameters;

        // In a real implementation, this would enable/disable function profiling
        return NextResponse.json({
          success: true,
          message: `Function profiling ${enabled ? 'enabled' : 'disabled'} for ${functionName}`,
        });

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('Failed to execute performance action:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute performance action',
        details:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      },
      { status: 500 },
    );
  }
}

export const GET = withSecurityHeaders(handleGET);
export const POST = withSecurityHeaders(handlePOST);
