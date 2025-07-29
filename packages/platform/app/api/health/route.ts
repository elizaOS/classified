/**
 * Health Check API Routes
 * Provides health status for monitoring and load balancers
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';

// Use dynamic imports to avoid database connection during build
const getDatabase = () => import('@/lib/database').then((m) => m.getSql);

/**
 * GET /api/health - Get health status
 */
async function handleGET(request: NextRequest) {
  try {
    const checks = {
      api: 'healthy',
      database: 'unknown',
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    };

    // Try database connection
    try {
      const getSql = await getDatabase();
      const sql = getSql();
      const result = await sql`SELECT 1 as healthy`;
      checks.database = result[0]?.healthy === 1 ? 'healthy' : 'unhealthy';
    } catch (dbError) {
      console.error('Database health check failed:', dbError);
      checks.database = 'unhealthy';
    }

    // Determine overall health
    const isHealthy = checks.api === 'healthy' && checks.database === 'healthy';

    return NextResponse.json(
      {
        status: isHealthy ? 'healthy' : 'degraded',
        checks,
        environment: process.env.NODE_ENV,
      },
      {
        status: isHealthy ? 200 : 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      },
    );
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}

/**
 * HEAD /api/health - Quick health check
 */
async function handleHEAD(request: NextRequest) {
  try {
    // Quick check without database
    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Health-Status': 'healthy',
        'X-API-Version': process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      },
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}

// Export with security headers but no authentication
// The route-wrapper automatically knows /api/health is public
export const { GET, HEAD } = wrapHandlers({ handleGET, handleHEAD });
