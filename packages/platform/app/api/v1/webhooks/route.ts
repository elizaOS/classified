import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { getServerSession, authOptions } from '@/lib/auth/config';
import { z } from 'zod';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';

// Mock database - in a real app, this would be a proper database
const webhooksDB: any[] = [];

const createWebhookSchema = z.object({
  url: z.string().url('Invalid URL format'),
  events: z.array(z.string()).min(1, 'At least one event must be selected'),
});

async function handleGET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = session.user.organizationId;

    // Filter webhooks for the current organization
    const userWebhooks = webhooksDB.filter(
      (webhook) => webhook.organizationId === organizationId,
    );

    return NextResponse.json({
      success: true,
      webhooks: userWebhooks,
    });
  } catch (error: any) {
    console.error('Webhooks list error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load webhooks',
        message: error.message || 'Unknown error occurred',
      },
      { status: 500 },
    );
  }
}

async function handlePOST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createWebhookSchema.parse(body);

    // Generate a webhook secret
    const secret = `wh_${randomBytes(32).toString('hex')}`;

    const webhook = {
      id: `webhook_${randomBytes(16).toString('hex')}`,
      organizationId: session.user.organizationId,
      userId: session.user.id,
      url: validatedData.url,
      events: validatedData.events,
      active: true,
      secret,
      createdAt: new Date().toISOString(),
      lastTriggered: null,
    };

    // Add to mock database
    webhooksDB.push(webhook);

    return NextResponse.json({
      success: true,
      webhook,
      message: 'Webhook created successfully',
    });
  } catch (error: any) {
    console.error('Webhook creation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create webhook',
        message: error.message || 'Unknown error occurred',
      },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
