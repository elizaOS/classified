import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { authService } from '@/lib/auth/session';
import {
  getApiKeyById,
  regenerateApiKey,
} from '@/lib/server/services/api-key-service';
import { auditLog } from '@/lib/server/services/audit-service';

async function handlePOST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const params = await props.params;

    // Get current user session
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingApiKey = await getApiKeyById(params.id, user.organizationId);
    if (!existingApiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    const { apiKey, keyValue } = await regenerateApiKey(
      params.id,
      user.organizationId,
    );

    await auditLog({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'regenerate',
      resource: 'api_key',
      resourceId: params.id,
      metadata: {
        oldKeyPrefix: existingApiKey.keyPrefix,
        newKeyPrefix: apiKey.keyPrefix,
      },
      ipAddress:
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      data: {
        id: apiKey.id,
        name: apiKey.name,
        description: apiKey.description,
        keyPrefix: apiKey.keyPrefix,
        permissions: apiKey.permissions,
        rateLimit: apiKey.rateLimit,
        isActive: apiKey.isActive,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
        updatedAt: apiKey.updatedAt,
        key: keyValue, // Only returned once during regeneration
      },
    });
  } catch (error) {
    console.error('POST /api/v1/api-keys/[id]/regenerate error:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate API key' },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
