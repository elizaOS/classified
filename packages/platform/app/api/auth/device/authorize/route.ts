/**
 * Device Authorization Completion Endpoint
 * Completes device authorization after user approval
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { deviceFlowService } from '@/lib/auth/device-flow';
import {
  rateLimitRepository,
  RateLimitRepository,
} from '@/lib/database/repositories/rate-limit';
import { UserRepository } from '@/lib/database/repositories/user';

interface AuthorizeBody {
  user_code: string;
  authorize: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

async function handlePOST(request: NextRequest) {
  try {
    const body = (await request.json()) as AuthorizeBody;
    const { user_code, authorize, user } = body;

    // Get client IP for rate limiting
    const clientIP =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Rate limiting: max 30 requests per minute per IP
    const rateLimitKey = RateLimitRepository.createKey(
      clientIP,
      'device-authorize',
    );
    const rateLimit = await rateLimitRepository.checkRateLimit(
      rateLimitKey,
      30,
      60,
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'rate_limit_exceeded',
          retry_after: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimit.retryAfter.toString(),
          },
        },
      );
    }

    if (!user_code) {
      return NextResponse.json(
        {
          success: false,
          error: 'user_code is required',
        },
        { status: 400 },
      );
    }

    if (typeof authorize !== 'boolean') {
      return NextResponse.json(
        {
          success: false,
          error: 'authorize must be a boolean',
        },
        { status: 400 },
      );
    }

    if (!user || !user.id || !user.email || !user.name) {
      return NextResponse.json(
        {
          success: false,
          error: 'User information is required',
        },
        { status: 400 },
      );
    }

    // Validate user exists in database and is active
    const userRepository = new UserRepository();
    const userValidation = await userRepository.validateUserForDeviceAuth(
      user.id,
    );

    if (!userValidation.isValid) {
      console.error(
        `[DEVICE AUTHORIZE] User validation failed: ${userValidation.error} for user: ${user.id}`,
      );
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid user account',
        },
        { status: 400 },
      );
    }

    const dbUser = userValidation.user!;

    // Verify the provided user information matches database records
    if (dbUser.email !== user.email) {
      console.error(
        `[DEVICE AUTHORIZE] Email mismatch - DB: ${dbUser.email}, Provided: ${user.email}`,
      );
      return NextResponse.json(
        {
          success: false,
          error: 'User information mismatch',
        },
        { status: 400 },
      );
    }

    // Validate user code exists and is not expired
    const isValid = await deviceFlowService.isUserCodeValid(user_code);
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired user code',
        },
        { status: 400 },
      );
    }

    if (!authorize) {
      // User denied authorization - we should delete the device code
      // For now, we'll just return an error since deletion requires device_code
      return NextResponse.json(
        {
          success: false,
          error: 'Authorization denied by user',
        },
        { status: 400 },
      );
    }

    // Authorize the device using the new service
    const result = await deviceFlowService.authorizeDevice(user_code, user.id, {
      id: user.id,
      name: user.name,
      email: user.email,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Authorization failed',
        },
        { status: 400 },
      );
    }

    console.log(
      `[DEVICE AUTHORIZE] Device authorized successfully for user: ${user.email}, code: ${user_code}`,
    );

    return NextResponse.json({
      success: true,
      message: 'Device authorized successfully',
    });
  } catch (error) {
    console.error('Device authorization error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
