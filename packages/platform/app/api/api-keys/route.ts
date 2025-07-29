/**
 * API Keys Management Routes
 * Handles creation and management of API keys for organizations
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { wrapHandlers } from '@/lib/api/route-wrapper';

// Use dynamic imports to avoid database connection during build
const getApiKeyService = () =>
  import('@/lib/api-keys/service').then((m) => m.apiKeyService);
const getAuthService = () =>
  import('@/lib/auth/session').then((m) => m.authService);
const getPermissions = () => import('@/lib/auth/permissions');

/**
 * GET /api/api-keys - List API keys for organization
 */
async function handleGET(request: NextRequest) {
  try {
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    const permissions = await getPermissions();
    if (!permissions.hasPermission(user.role as any, 'api_keys', 'read')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const apiKeyService = await getApiKeyService();
    const apiKeys = await apiKeyService.getApiKeys(user.organizationId);

    // Don't return the actual key values for security
    const sanitizedKeys = apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      description: key.description,
      permissions: key.permissions,
      lastUsedAt: key.lastUsedAt,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      isActive: key.isActive,
      // Only show prefix for security
      keyPreview: key.keyPrefix,
    }));

    return NextResponse.json({ apiKeys: sanitizedKeys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/api-keys - Create new API key
 */
async function handlePOST(request: NextRequest) {
  try {
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    const permissions = await getPermissions();
    if (!permissions.hasPermission(user.role as any, 'api_keys', 'create')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    // Validate request body
    const createKeySchema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      scopes: z.array(z.string()).min(1),
      expiresIn: z.number().min(1).max(365).optional(), // Days
    });

    const body = await request.json();
    const validation = createKeySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 },
      );
    }

    const apiKeyService = await getApiKeyService();
    const result = await apiKeyService.createApiKey(
      user.organizationId,
      user.id,
      {
        name: validation.data.name,
        description: validation.data.description,
        permissions: validation.data.scopes, // Map scopes to permissions
        rateLimit: 100, // Default rate limit
        expiresAt: validation.data.expiresIn
          ? new Date(
              Date.now() + validation.data.expiresIn * 24 * 60 * 60 * 1000,
            )
          : undefined,
      },
    );

    // Return the full key only once on creation
    return NextResponse.json(
      {
        apiKey: {
          id: result.apiKey.id,
          key: result.key, // Full key shown only on creation
          name: result.apiKey.name,
          description: result.apiKey.description,
          permissions: result.apiKey.permissions,
          expiresAt: result.apiKey.expiresAt,
          createdAt: result.apiKey.createdAt,
        },
        warning:
          'Please save this API key securely. You will not be able to see it again.',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/api-keys - Bulk delete API keys
 */
async function handleDELETE(request: NextRequest) {
  try {
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    const permissions = await getPermissions();
    if (!permissions.hasPermission(user.role as any, 'api_keys', 'delete')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    // Validate request body
    const deleteSchema = z.object({
      ids: z.array(z.string().uuid()).min(1),
    });

    const body = await request.json();
    const validation = deleteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 },
      );
    }

    const apiKeyService = await getApiKeyService();

    // Delete each key individually
    const deleted: string[] = [];
    const failed: string[] = [];

    for (const id of validation.data.ids) {
      try {
        const success = await apiKeyService.deleteApiKey(
          user.organizationId,
          id,
        );
        if (success) {
          deleted.push(id);
        } else {
          failed.push(id);
        }
      } catch (error) {
        console.error(`Failed to delete API key ${id}:`, error);
        failed.push(id);
      }
    }

    return NextResponse.json({
      deleted,
      failed,
    });
  } catch (error) {
    console.error('Error deleting API keys:', error);
    return NextResponse.json(
      { error: 'Failed to delete API keys' },
      { status: 500 },
    );
  }
}

// Export with security headers and authentication
export const { GET, POST, DELETE } = wrapHandlers({
  handleGET,
  handlePOST,
  handleDELETE,
});
