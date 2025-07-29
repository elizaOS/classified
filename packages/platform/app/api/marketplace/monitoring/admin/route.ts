import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { backgroundJobs } from '@/lib/services/background-jobs';
import { auth } from '@/lib/auth';

async function handleGET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For now, allow any authenticated user to check status
    // In production, you'd want to restrict this to admins
    const status = backgroundJobs.getStatus();
    const healthCheck = await backgroundJobs.healthCheck();

    return NextResponse.json({
      success: true,
      data: {
        ...status,
        health: healthCheck,
      },
    });
  } catch (error) {
    console.error('Failed to get background jobs status:', error);
    return NextResponse.json(
      { error: 'Failed to get service status' },
      { status: 500 },
    );
  }
}

async function handlePOST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // In production, restrict this to admin users only
    // if (!session.user.isAdmin) {
    //   return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    // }

    const { action } = await request.json();

    if (!action) {
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 },
      );
    }

    switch (action) {
      case 'start':
        await backgroundJobs.start();
        return NextResponse.json({
          success: true,
          message: 'Background jobs started successfully',
        });

      case 'stop':
        await backgroundJobs.stop();
        return NextResponse.json({
          success: true,
          message: 'Background jobs stopped successfully',
        });

      case 'restart':
        await backgroundJobs.restart();
        return NextResponse.json({
          success: true,
          message: 'Background jobs restarted successfully',
        });

      case 'health_check':
        const healthCheck = await backgroundJobs.healthCheck();
        return NextResponse.json({
          success: true,
          data: healthCheck,
        });

      default:
        return NextResponse.json(
          {
            error:
              'Invalid action. Supported actions: start, stop, restart, health_check',
          },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('Failed to manage background jobs:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to manage background jobs',
      },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
