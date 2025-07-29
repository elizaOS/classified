/**
 * V1 API - Organizations Routes
 * Manages organization settings and configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { wrapHandlers } from '@/lib/api/route-wrapper';

// Use dynamic imports to avoid database connection during build
const getOrganizationService = () =>
  import('@/lib/organizations/service').then((m) => m.organizationService);
const getAuthService = () =>
  import('@/lib/auth/session').then((m) => m.authService);

// Validation schemas
const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  settings: z
    .object({
      defaultModel: z.string().optional(),
      defaultProvider: z.string().optional(),
      maxAgents: z.number().min(1).max(100).optional(),
      features: z.record(z.boolean()).optional(),
    })
    .optional(),
  billing: z
    .object({
      email: z.string().email().optional(),
      taxId: z.string().optional(),
      address: z
        .object({
          line1: z.string(),
          line2: z.string().optional(),
          city: z.string(),
          state: z.string().optional(),
          postalCode: z.string(),
          country: z.string().length(2),
        })
        .optional(),
    })
    .optional(),
});

/**
 * GET /api/v1/organizations - Get current organization details
 */
async function handleGET(request: NextRequest) {
  try {
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    const organizationService = await getOrganizationService();
    const organization = await organizationService.getOrganization(
      user.organizationId,
    );

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    // Format for v1 API
    const v1Response = {
      id: organization.id,
      name: organization.name,
      description: organization.name, // Use name as description until added to schema
      created_at: organization.createdAt.toISOString(),
      updated_at: organization.updatedAt.toISOString(),
      settings: organization.settings || {},
      member_count: 1,
      plan: organization.subscriptionTier || 'free',
      credits: organization.creditBalance || 0,
    };

    return NextResponse.json({
      status: 'success',
      data: v1Response,
      meta: {
        version: 'v1',
      },
    });
  } catch (error) {
    console.error('V1 API Error - Get organization:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve organization',
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/organizations - Create new organization (if user doesn't have one)
 */
async function handlePOST(request: NextRequest) {
  try {
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    // Check if user already has an organization
    if (user.organizationId) {
      return NextResponse.json(
        {
          error: 'Conflict',
          code: 'ALREADY_EXISTS',
          message: 'User already belongs to an organization',
        },
        { status: 409 },
      );
    }

    const body = await request.json();

    // Basic validation
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        {
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          message: 'Organization name is required',
        },
        { status: 400 },
      );
    }

    const organizationService = await getOrganizationService();
    // Generate slug from name
    const slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 50);

    const organization = await organizationService.createOrganization({
      name: body.name,
      slug,
      // description: body.description, // Not supported by createOrganization params
      ownerId: user.id,
    });

    // Update user's organization
    // await authService.updateUserOrganization(user.id, organization.id); // TODO: Method doesn't exist

    // Format for v1 API
    const v1Response = {
      id: organization.id,
      name: organization.name,
      description: organization.name, // Use name as description until added to schema
      created_at: organization.createdAt.toISOString(),
      updated_at: organization.updatedAt.toISOString(),
      owner_id: user.id,
    };

    return NextResponse.json(
      {
        status: 'success',
        data: v1Response,
        meta: {
          version: 'v1',
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('V1 API Error - Create organization:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: 'Failed to create organization',
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/v1/organizations - Update organization settings
 */
async function handlePUT(request: NextRequest) {
  try {
    const authService = await getAuthService();
    const user = await authService.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }

    // Check if user has permission to update organization
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Only organization owners and admins can update settings',
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const validation = updateOrganizationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: validation.error.errors,
        },
        { status: 400 },
      );
    }

    const organizationService = await getOrganizationService();
    const updatedOrg = await organizationService.updateOrganization(
      user.organizationId,
      validation.data,
    );

    // Format for v1 API
    const v1Response = {
      id: updatedOrg.id,
      name: updatedOrg.name,
      description: updatedOrg.name, // Use name as description until added to schema
      updated_at: updatedOrg.updatedAt.toISOString(),
      settings: updatedOrg.settings || {},
    };

    return NextResponse.json({
      status: 'success',
      data: v1Response,
      meta: {
        version: 'v1',
      },
    });
  } catch (error) {
    console.error('V1 API Error - Update organization:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: 'Failed to update organization',
      },
      { status: 500 },
    );
  }
}

// Export with security headers and authentication
export const { GET, POST, PUT } = wrapHandlers({
  handleGET,
  handlePOST,
  handlePUT,
});
