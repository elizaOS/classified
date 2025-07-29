import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, authOptions } from '@/lib/auth/config';
import { z } from 'zod';

export const runtime = 'nodejs';

// Mock database - in a real app, this would be a proper database
const webhooksDB: any[] = [];

const updateWebhookSchema = z.object({
  active: z.boolean().optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> },
) {
  try {
    const resolvedParams = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const webhookId = resolvedParams.webhookId;
    const body = await request.json();
    const validatedData = updateWebhookSchema.parse(body);

    // Find the webhook
    const webhookIndex = webhooksDB.findIndex(
      (webhook) =>
        webhook.id === webhookId &&
        webhook.organizationId === session.user.organizationId,
    );

    if (webhookIndex === -1) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Update the webhook
    const webhook = webhooksDB[webhookIndex];
    Object.assign(webhook, validatedData);
    webhook.updatedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      webhook,
      message: 'Webhook updated successfully',
    });
  } catch (error: any) {
    console.error('Webhook update error:', error);

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
        error: 'Failed to update webhook',
        message: error.message || 'Unknown error occurred',
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> },
) {
  try {
    const resolvedParams = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const webhookId = resolvedParams.webhookId;

    // Find and remove the webhook
    const webhookIndex = webhooksDB.findIndex(
      (webhook) =>
        webhook.id === webhookId &&
        webhook.organizationId === session.user.organizationId,
    );

    if (webhookIndex === -1) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    webhooksDB.splice(webhookIndex, 1);

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully',
    });
  } catch (error: any) {
    console.error('Webhook deletion error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete webhook',
        message: error.message || 'Unknown error occurred',
      },
      { status: 500 },
    );
  }
}
