import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { ContainerMonitoringService } from '@/lib/services/container-monitoring';
import { auth } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { hostedContainers } from '@/lib/database/marketplace-schema';
import { eq, and } from 'drizzle-orm';

const monitoringService = new ContainerMonitoringService();

async function handleGET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const containerId = url.searchParams.get('containerId');

    if (containerId) {
      // Get health status for specific container
      // First verify user owns the container
      const db = await getDatabase();
      const containers = await db
        .select()
        .from(hostedContainers)
        .where(
          and(
            eq(hostedContainers.id, containerId),
            eq(hostedContainers.userId, session.user.id),
          ),
        )
        .limit(1);

      if (!containers[0]) {
        return NextResponse.json(
          { error: 'Container not found or access denied' },
          { status: 404 },
        );
      }

      const container = containers[0];
      const health = await monitoringService.checkContainerHealth(container);

      return NextResponse.json({
        success: true,
        data: health,
      });
    } else {
      // Get health status for all user's containers
      const db = await getDatabase();
      const userContainers = await db
        .select()
        .from(hostedContainers)
        .where(
          and(
            eq(hostedContainers.userId, session.user.id),
            eq(hostedContainers.organizationId, session.organizationId),
          ),
        );

      const healthStatuses = await Promise.all(
        userContainers.map((container: any) =>
          monitoringService.checkContainerHealth(container),
        ),
      );

      return NextResponse.json({
        success: true,
        data: healthStatuses,
      });
    }
  } catch (error) {
    console.error('Failed to get container health:', error);
    return NextResponse.json(
      { error: 'Failed to get container health' },
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

    const { containerId, action } = await request.json();

    if (!containerId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: containerId, action' },
        { status: 400 },
      );
    }

    const db = await getDatabase();

    // Verify user owns the container
    const containers = await db
      .select()
      .from(hostedContainers)
      .where(
        and(
          eq(hostedContainers.id, containerId),
          eq(hostedContainers.userId, session.user.id),
        ),
      )
      .limit(1);

    if (!containers[0]) {
      return NextResponse.json(
        { error: 'Container not found or access denied' },
        { status: 404 },
      );
    }

    const container = containers[0];

    switch (action) {
      case 'health_check':
        const health = await monitoringService.checkContainerHealth(container);
        return NextResponse.json({
          success: true,
          data: health,
        });

      case 'force_billing':
        // Force a billing cycle for this container
        const billingResult =
          await monitoringService['processContainerBilling'](container);
        return NextResponse.json({
          success: true,
          data: billingResult,
        });

      default:
        return NextResponse.json(
          {
            error:
              'Invalid action. Supported actions: health_check, force_billing',
          },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('Failed to perform container action:', error);
    return NextResponse.json(
      { error: 'Failed to perform container action' },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
