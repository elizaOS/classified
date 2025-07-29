/**
 * Metrics API Routes
 * Provides system metrics and performance data for administrators
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';

// Use dynamic imports to avoid database connection during build
const getMetricsService = () =>
  import('@/lib/monitoring/metrics-service').then((m) => m.metricsService);
const getAuthService = () =>
  import('@/lib/auth/session').then((m) => m.authService);

/**
 * GET /api/metrics - Get system metrics
 */
async function handleGET(request: NextRequest) {
  try {
    // Get current user session
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin permissions
    if (!['admin', 'owner'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 },
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const windowMinutes = parseInt(searchParams.get('window') || '60', 10);
    const metric = searchParams.get('metric') || 'summary';

    // Get metrics service
    const metricsService = await getMetricsService();

    // Fetch metrics based on parameters
    let data;
    if (metric === 'summary') {
      data = metricsService.getMetricsSummary(windowMinutes);
    } else {
      // Get specific metric by name
      data = metricsService.getMetricsByName(metric, windowMinutes);
    }

    return NextResponse.json({
      success: true,
      data,
      metadata: {
        windowMinutes,
        metric,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 },
    );
  }
}

/**
 * HEAD /api/metrics - Check metrics endpoint availability
 */
async function handleHEAD(request: NextRequest) {
  try {
    // Get current user session
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();

    if (!user) {
      return new NextResponse(null, { status: 401 });
    }

    // Check admin permissions
    if (!['admin', 'owner'].includes(user.role)) {
      return new NextResponse(null, { status: 403 });
    }

    // Check if metrics service is available
    const metricsService = await getMetricsService();

    // Simple health check - if we can get here, the service is healthy
    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Metrics-Status': 'healthy',
        'X-Metrics-Version': '1.0.0',
      },
    });
  } catch (error) {
    console.error('Error checking metrics health:', error);
    return new NextResponse(null, { status: 503 });
  }
}

// Export with security headers and admin authentication requirement
// The route-wrapper automatically knows /api/metrics requires admin access
export const { GET, HEAD } = wrapHandlers({ handleGET, handleHEAD });
