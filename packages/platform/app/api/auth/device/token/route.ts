/**
 * Device Authorization Flow - Token Endpoint
 * Polls for device authorization completion
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { deviceFlowService } from '@/lib/auth/device-flow';
import { oauthClientRepository } from '@/lib/database/repositories/oauth-client';
import {
  rateLimitRepository,
  RateLimitRepository,
} from '@/lib/database/repositories/rate-limit';

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { device_code, client_id, grant_type } = body;

    // Get client IP for rate limiting
    const clientIP =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Rate limiting: max 60 requests per minute per IP (polling endpoint)
    const rateLimitKey = RateLimitRepository.createKey(
      clientIP,
      'device-token',
    );
    const rateLimit = await rateLimitRepository.checkRateLimit(
      rateLimitKey,
      60,
      60,
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'rate_limit_exceeded',
          error_description: 'Too many requests. Please try again later.',
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

    // Validate grant type
    if (grant_type !== 'urn:ietf:params:oauth:grant-type:device_code') {
      return NextResponse.json(
        {
          error: 'unsupported_grant_type',
          error_description:
            'Grant type must be urn:ietf:params:oauth:grant-type:device_code',
        },
        { status: 400 },
      );
    }

    // Validate required parameters
    if (!device_code) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          error_description: 'device_code is required',
        },
        { status: 400 },
      );
    }

    if (!client_id) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          error_description: 'client_id is required',
        },
        { status: 400 },
      );
    }

    // Validate client with database
    const clientValidation = await oauthClientRepository.validateClient(
      client_id,
      'device_code',
    );

    if (!clientValidation.isValid) {
      return NextResponse.json(
        {
          error: clientValidation.error || 'invalid_client',
          error_description: 'Invalid or inactive client_id',
        },
        { status: 400 },
      );
    }

    const client = clientValidation.client!;

    // Check device authorization status using the new service
    const authResult = await deviceFlowService.checkDeviceAuth(device_code);

    if (!authResult.success) {
      return NextResponse.json(
        {
          error: authResult.error,
          error_description: getErrorDescription(authResult.error),
        },
        { status: 400 },
      );
    }

    // Authorization complete - return tokens
    console.log(
      `[TOKEN SUCCESS] Device authorization completed for client: ${client.clientName}`,
    );

    return NextResponse.json({
      success: true,
      data: {
        access_token: authResult.data!.access_token,
        token_type: 'Bearer',
        user: authResult.data!.user,
      },
    });
  } catch (error) {
    console.error('Device token polling error:', error);
    return NextResponse.json(
      {
        error: 'server_error',
        error_description: 'Internal server error',
      },
      { status: 500 },
    );
  }
}

/**
 * Get human-readable error descriptions
 */
function getErrorDescription(error?: string): string {
  switch (error) {
    case 'invalid_grant':
      return 'Invalid or expired device_code';
    case 'expired_token':
      return 'The device code has expired';
    case 'authorization_pending':
      return 'User has not yet completed authorization';
    default:
      return 'Unknown error occurred';
  }
}

export const { POST } = wrapHandlers({ handlePOST });
