/**
 * Device Authorization Flow - Initiation Endpoint
 * Implements OAuth 2.0 Device Authorization Grant (RFC 8628)
 * https://tools.ietf.org/html/rfc8628
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
    const { client_id, scope = 'read write' } = body;

    // Get client IP for rate limiting
    const clientIP =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || '';

    // Rate limiting: max 10 requests per minute per IP
    const rateLimitKey = RateLimitRepository.createKey(clientIP, 'device-auth');
    const rateLimit = await rateLimitRepository.checkRateLimit(
      rateLimitKey,
      10,
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
            'X-RateLimit-Remaining': rateLimit.remainingRequests.toString(),
            'X-RateLimit-Reset': rateLimit.resetTime.toISOString(),
          },
        },
      );
    }

    // Validate client_id
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

    // Parse and validate requested scopes
    const requestedScopes = scope
      .split(' ')
      .filter((s: string) => s.length > 0);
    const scopeValidation = await oauthClientRepository.validateScope(
      client_id,
      requestedScopes,
    );

    if (!scopeValidation.isValid) {
      return NextResponse.json(
        {
          error: scopeValidation.error || 'invalid_scope',
          error_description: 'One or more requested scopes are not allowed',
        },
        { status: 400 },
      );
    }

    // Create device authorization using the new service
    const expires_in = 600; // 10 minutes
    const deviceAuth = await deviceFlowService.createDeviceAuth(
      client_id,
      scope,
      expires_in,
      userAgent,
      clientIP,
    );

    const baseUrl =
      process.env.NEXT_PUBLIC_PLATFORM_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : `http://localhost:${process.env.PORT || 3333}`;

    const verification_uri = `${baseUrl}/auth/device`;
    const verification_uri_complete = `${verification_uri}?user_code=${deviceAuth.user_code}`;

    console.log(
      `[DEVICE AUTH] Created for client: ${client.clientName} (${client_id}), user code: ${deviceAuth.user_code}`,
    );

    return NextResponse.json({
      device_code: deviceAuth.device_code,
      user_code: deviceAuth.user_code,
      verification_uri,
      verification_uri_complete,
      expires_in: deviceAuth.expires_in,
      interval: deviceAuth.interval,
    });
  } catch (error) {
    console.error('Device auth initiation error:', error);
    return NextResponse.json(
      {
        error: 'server_error',
        error_description: 'Internal server error',
      },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
