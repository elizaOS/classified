import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { ContainerHostingService } from '@/lib/services/container-hosting';
import { auth } from '@/lib/auth';

const containerService = new ContainerHostingService();

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const containerId = resolvedParams.id;
    const url = new URL(request.url);

    // Parse date range
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    const startParam = url.searchParams.get('startDate');
    const endParam = url.searchParams.get('endDate');

    if (startParam) {
      startDate = new Date(startParam);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid startDate format' },
          { status: 400 },
        );
      }
    }

    if (endParam) {
      endDate = new Date(endParam);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid endDate format' },
          { status: 400 },
        );
      }
    }

    // Get container usage metrics
    const usage = await containerService.getContainerUsage(
      containerId,
      session.user.id,
      startDate,
      endDate,
    );

    return NextResponse.json({
      success: true,
      data: usage,
    });
  } catch (error) {
    console.error('Failed to get container usage:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get container usage',
      },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
