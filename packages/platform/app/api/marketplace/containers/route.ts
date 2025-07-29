import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { ContainerHostingService } from '@/lib/services/container-hosting';
import { MarketplaceBillingService } from '@/lib/billing/marketplace-billing-service';
import { auth } from '@/lib/auth';

const containerService = new ContainerHostingService();

async function handleGET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // List user's containers
    const containers = await containerService.listUserContainers(
      session.user.id,
      session.organizationId,
    );

    return NextResponse.json({
      success: true,
      data: containers,
    });
  } catch (error) {
    console.error('Failed to list containers:', error);
    return NextResponse.json(
      { error: 'Failed to list containers' },
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

    const deploymentConfig = await request.json();

    // Validate required fields
    if (!deploymentConfig.assetId || !deploymentConfig.versionId) {
      return NextResponse.json(
        { error: 'Missing required fields: assetId, versionId' },
        { status: 400 },
      );
    }

    // Set defaults
    const config = {
      userId: session.user.id,
      organizationId: session.organizationId,
      memory: deploymentConfig.memory || 512,
      cpu: deploymentConfig.cpu || 1000,
      storage: deploymentConfig.storage || 1,
      environment: deploymentConfig.environment || {},
      estimatedUsageHours: deploymentConfig.estimatedUsageHours || 24,
      ...deploymentConfig,
    };

    // Check if user can afford the estimated container costs
    const estimatedHours = config.estimatedUsageHours;
    const canAfford =
      await MarketplaceBillingService.canAffordMarketplaceOperation(
        session.organizationId,
        {
          service: 'container_hosting',
          operation: 'deployment',
          usageType: 'container_hosting',
          assetId: config.assetId,
          tokens: estimatedHours, // Hours
          basePrice: 0, // Will be calculated based on resource requirements
        },
      );

    if (!canAfford) {
      return NextResponse.json(
        {
          error:
            'Insufficient credits for container deployment. Please add credits to your account.',
        },
        { status: 402 }, // Payment Required
      );
    }

    // Deploy container
    const container = await containerService.deployContainer(config);

    // Provide cost estimate to user
    const hourlyRate = container.billedCostPerHour;
    const estimatedCost = hourlyRate * estimatedHours;

    return NextResponse.json({
      success: true,
      data: {
        ...container,
        billing: {
          hourlyRate,
          estimatedHours,
          estimatedCost,
          note: 'You will be billed hourly based on actual usage',
        },
      },
    });
  } catch (error) {
    console.error('Failed to deploy container:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to deploy container',
      },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
