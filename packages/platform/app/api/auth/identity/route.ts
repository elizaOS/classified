/**
 * Identity API Route - Get current user identity
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { authService } from '@/lib/auth/session';
import { handleApiError, AuthenticationError } from '@/lib/errors';
import { apiLogger } from '@/lib/logger';

// Configure runtime to use Node.js instead of Edge Runtime for database compatibility
export const runtime = 'nodejs';

/**
 * GET /api/auth/identity - Get current user and organization information
 */
async function handleGET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const userAgent = request.headers.get('user-agent');

    // Skip excessive logging for Next.js middleware requests
    if (!userAgent?.includes('Next.js Middleware')) {
      apiLogger.debug('Identity request received', {
        userAgent,
        ip:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip'),
      });
    }

    // Get current user session
    const user = await authService.getCurrentUser();

    if (!user) {
      // Only log auth failures from non-middleware requests to reduce noise
      if (!userAgent?.includes('Next.js Middleware')) {
        apiLogger.debug('Identity request failed: no user session');
      }
      throw new AuthenticationError('No valid session found');
    }

    // Get organization
    const organization = await authService.getCurrentOrganization();
    if (!organization) {
      apiLogger.warn('Identity request failed: organization not found', {
        userId: user.id,
      });
      throw new AuthenticationError('Organization not found');
    }

    const responseData = {
      id: user.id,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      role: user.role,
      is_active: user.isActive,
      email_confirmed: true, // Assuming users are email verified since they're in the database
      email_verified: true,
      profile_picture_url: user.profilePictureUrl,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        subscription_tier: organization.subscriptionTier,
        credit_balance: organization.creditBalance,
        subscription_status: organization.subscriptionStatus,
        created_at: organization.createdAt,
        updated_at: organization.updatedAt,
      },
      permissions: {
        canCreateAgents: true,
        canEditAgents: true,
        canDeleteAgents: ['owner', 'admin'].includes(user.role),
        canManageUsers: ['owner', 'admin'].includes(user.role),
        canManageOrganization: user.role === 'owner',
        canAccessBilling: ['owner', 'admin'].includes(user.role),
      },
    };

    const duration = Date.now() - startTime;
    apiLogger.logRequest('GET', '/api/auth/identity', 200, duration, {
      userId: user.id,
      organizationId: organization.id,
      role: user.role,
    });

    return NextResponse.json(responseData);
  } catch (error) {
    const duration = Date.now() - startTime;
    apiLogger.logRequest('GET', '/api/auth/identity', 401, duration, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return handleApiError(error);
  }
}

export const { GET } = wrapHandlers({ handleGET });
