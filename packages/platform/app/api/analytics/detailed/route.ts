import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { sessionService } from '@/lib/auth/session';
import { inferenceAnalytics } from '@/lib/services/inference-analytics';

async function handleGET(request: NextRequest) {
  try {
    const session = await sessionService.getSessionFromCookies();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const provider = searchParams.get('provider') || undefined;
    const model = searchParams.get('model') || undefined;
    const status = searchParams.get('status') || undefined;

    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;

    const result = await inferenceAnalytics.getInferenceLogs(
      session.organizationId,
      page,
      limit,
      {
        provider,
        model,
        status,
        startDate,
        endDate,
      },
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Failed to fetch detailed analytics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch detailed analytics' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
