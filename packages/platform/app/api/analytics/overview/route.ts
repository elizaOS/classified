import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';

// Use dynamic imports to avoid database connection during build
const getSessionService = () =>
  import('@/lib/auth/session').then((m) => m.sessionService);
const getInferenceAnalytics = () =>
  import('@/lib/services/inference-analytics').then(
    (m) => m.inferenceAnalytics,
  );

async function handleGET(request: NextRequest) {
  try {
    // During build time, return a stub response to prevent database access
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return NextResponse.json(
        { error: 'API not available during build time' },
        { status: 503 },
      );
    }

    const sessionService = await getSessionService();
    const session = await sessionService.getSessionFromCookies();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || 'daily';
    const provider = searchParams.get('provider') || undefined;
    const model = searchParams.get('model') || undefined;

    // Calculate date range based on timeRange
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default: // daily
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
    }

    // Get real analytics data
    const inferenceAnalytics = await getInferenceAnalytics();
    const analyticsData = await inferenceAnalytics.getAnalytics({
      organizationId: session.organizationId,
      startDate,
      endDate: now,
      provider,
      model,
    });

    // Transform the data to match the frontend interface
    const transformedData = {
      totalRequests: analyticsData.totalRequests,
      totalSpent: analyticsData.totalCost,
      totalTokens: analyticsData.totalTokens,
      averageRequestCost:
        analyticsData.totalRequests > 0
          ? analyticsData.totalCost / analyticsData.totalRequests
          : 0,

      topProviders: analyticsData.byProvider.slice(0, 5).map((p) => ({
        name: p.provider,
        requests: p.requests,
        spent: p.cost,
        tokens: p.tokens,
        percentage: p.percentage,
      })),

      timeSeriesData: analyticsData.byDay.map((d) => ({
        date: d.date,
        requests: d.requests,
        spent: d.cost,
        tokens: d.tokens,
      })),

      requestsByModel: analyticsData.byModel.map((m) => ({
        model: `${m.provider}/${m.model}`,
        requests: m.requests,
        spent: m.cost,
        tokens: m.tokens,
      })),

      trends: analyticsData.trends,

      // Additional analytics data
      totalBaseCost: analyticsData.totalBaseCost,
      totalMarkup: analyticsData.totalMarkup,
      successRate: analyticsData.successRate,
      averageLatency: analyticsData.averageLatency,
    };

    return NextResponse.json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error('Failed to fetch analytics data:', error);

    // In development, provide mock analytics data for testing
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Using mock analytics data for development');

      const mockData = {
        totalRequests: 1250,
        totalSpent: 89.47,
        totalTokens: 245000,
        averageRequestCost: 0.0716,

        topProviders: [
          {
            name: 'OpenAI',
            requests: 850,
            spent: 64.2,
            tokens: 180000,
            percentage: 68,
          },
          {
            name: 'Anthropic',
            requests: 300,
            spent: 18.5,
            tokens: 45000,
            percentage: 24,
          },
          {
            name: 'Google',
            requests: 100,
            spent: 6.77,
            tokens: 20000,
            percentage: 8,
          },
        ],

        timeSeriesData: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
          requests: Math.floor(Math.random() * 50) + 20,
          spent: Math.random() * 5 + 1,
          tokens: Math.floor(Math.random() * 5000) + 1000,
        })),

        requestsByModel: [
          { model: 'OpenAI/gpt-4', requests: 500, spent: 35.2, tokens: 80000 },
          {
            model: 'OpenAI/gpt-3.5-turbo',
            requests: 350,
            spent: 29.0,
            tokens: 100000,
          },
          {
            model: 'Anthropic/claude-3-sonnet',
            requests: 300,
            spent: 18.5,
            tokens: 45000,
          },
          {
            model: 'Google/gemini-pro',
            requests: 100,
            spent: 6.77,
            tokens: 20000,
          },
        ],

        trends: {
          requestsChange: 12.5,
          costChange: -3.2,
          tokensChange: 8.7,
        },

        totalBaseCost: 75.3,
        totalMarkup: 14.17,
        successRate: 98.4,
        averageLatency: 1.2,
      };

      return NextResponse.json({
        success: true,
        data: mockData,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch analytics data',
        details:
          process.env.NODE_ENV !== 'production'
            ? (error as Error).message
            : undefined,
      },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
