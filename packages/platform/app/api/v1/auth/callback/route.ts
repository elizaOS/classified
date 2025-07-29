import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { z } from 'zod';
import { WorkOSClient } from '@/lib/server/auth/workos';
import { SessionManager } from '@/lib/server/auth/session';
import { db } from '@/lib/server/database';
import { loadConfig } from '@/lib/server/utils/config';
import { createTokenPair } from '@/lib/server/utils/jwt';
import type {
  ApiResponse,
  AuthorizationCodeExchange,
  LoginResponse,
  User,
} from '@/lib/server/types';

const callbackSchema = z.object({
  code: z.string(),
  state: z.string().optional(),
});

async function handlePOST(request: NextRequest) {
  try {
    const config = loadConfig();
    const workosClient = new WorkOSClient(config.workos);
    const sessionManager = new SessionManager();

    const body = await request.json();
    const validation = callbackSchema.safeParse(body);

    if (!validation.success) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: validation.error.errors,
        },
      };
      return NextResponse.json(response, { status: 400 });
    }

    const { code, state } = validation.data;

    // TODO: Validate state parameter against stored value

    // Exchange code for user profile
    const {
      user: workosUser,
      organization: workosOrg,
      accessToken,
    } = await workosClient.exchangeCodeForProfile(code);

    // Convert WorkOS user to our user format
    const userProfile = workosClient.convertWorkOSUser(workosUser);

    // Create or update user
    let user = await db.getUserByWorkOSId(workosUser.id);

    if (!user) {
      user = await db.createUser({
        ...userProfile,
        workosUserId: workosUser.id,
      });
    } else {
      user = await db.updateUser(user.id, {
        ...userProfile,
        lastLoginAt: new Date(),
      });
    }

    if (!user) {
      throw new Error('Failed to create or update user');
    }

    // Handle organization membership
    let organization;
    if (workosOrg) {
      const orgProfile = workosClient.convertWorkOSOrganization(workosOrg);

      // Create or update organization
      let org = await db.getOrganizationByWorkOSId(workosOrg.id);

      if (!org) {
        org = await db.createOrganization({
          ...orgProfile,
          workosOrganizationId: workosOrg.id,
        });
      } else {
        org = await db.updateOrganization(org.id, orgProfile);
      }

      if (org) {
        organization = org;

        // Add user to organization if not already a member
        const members = await db.getOrganizationMembers(org.id);
        const isMember = members.some((m) => m.userId === user.id);

        if (!isMember) {
          await db.addUserToOrganization(user.id, org.id, 'member');
        }
      }
    }

    // Create session
    const { sessionToken, refreshToken } = await sessionManager.createSession(
      user.id,
      {
        ipAddress:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    );

    // Create JWT token pair (using sessionToken as the session identifier)
    const mockSession = {
      id: sessionToken,
      userId: user.id,
      tokenHash: sessionToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      createdAt: new Date(),
      isActive: true,
    };

    const {
      accessToken: jwtToken,
      refreshToken: jwtRefreshToken,
      expiresAt,
    } = await createTokenPair(
      user,
      mockSession,
      config.jwtSecret,
      organization?.id,
    );

    // Set secure cookies
    const isProduction = process.env.NODE_ENV === 'production';

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        user,
        organization,
        accessToken: jwtToken,
        expiresAt: expiresAt.toISOString(),
      },
    };

    const nextResponse = NextResponse.json(response);

    // Set cookies
    nextResponse.cookies.set('auth-token', jwtToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60, // 15 minutes
      path: '/',
    });

    nextResponse.cookies.set('refresh-token', jwtRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return nextResponse;
  } catch (error) {
    console.error('OAuth callback error:', error);

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'OAUTH_CALLBACK_FAILED',
        message: 'Failed to process OAuth callback',
      },
    };

    return NextResponse.json(response, { status: 500 });
  }
}

export const { POST } = wrapHandlers({ handlePOST });
