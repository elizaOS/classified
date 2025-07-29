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

    // Get container status
    const container = await containerService.getContainerStatus(
      containerId,
      session.user.id,
    );

    return NextResponse.json({
      success: true,
      data: container,
    });
  } catch (error) {
    console.error('Failed to get container status:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get container status',
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    // Stop container
    await containerService.stopContainer(containerId, session.user.id);

    return NextResponse.json({
      success: true,
      message: 'Container stopped successfully',
    });
  } catch (error) {
    console.error('Failed to stop container:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to stop container',
      },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
