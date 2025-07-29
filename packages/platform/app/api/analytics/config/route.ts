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

    const inferenceAnalytics = await getInferenceAnalytics();
    const markupPercentage = await inferenceAnalytics.getMarkupPercentage(
      session.organizationId,
    );

    return NextResponse.json({
      success: true,
      data: {
        markupPercentage,
      },
    });
  } catch (error) {
    console.error('Failed to get analytics config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get analytics config' },
      { status: 500 },
    );
  }
}

async function handlePOST(request: NextRequest) {
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

    const body = await request.json();
    const { markupPercentage } = body;

    if (
      typeof markupPercentage !== 'number' ||
      markupPercentage < 0 ||
      markupPercentage > 100
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid markup percentage. Must be between 0 and 100.',
        },
        { status: 400 },
      );
    }

    const inferenceAnalytics = await getInferenceAnalytics();
    await inferenceAnalytics.setMarkupPercentage(
      session.organizationId,
      markupPercentage,
    );

    return NextResponse.json({
      success: true,
      message: 'Markup percentage updated successfully',
    });
  } catch (error) {
    console.error('Failed to update analytics config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update analytics config' },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
