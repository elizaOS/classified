/**
 * Security Audit API Endpoints
 *
 * Provides access to audit logs and security events for administrators
 */

import { NextRequest, NextResponse } from 'next/server';
import { sessionService } from '@/lib/auth/session';
import { auditLogger, AuditQueryOptions } from '@/lib/security/audit-logger';
import { withSecurityHeaders } from '@/lib/security/headers';

async function handleGET(request: NextRequest) {
  try {
    // Verify authentication and admin access
    const session = await sessionService.getSessionFromCookies();
    if (!session || !session.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const options: AuditQueryOptions = {
      organizationId: session.organizationId,
      eventTypes: searchParams.get('eventTypes')?.split(',') as any[],
      severity: searchParams.get('severity')?.split(',') as any[],
      startDate: searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : undefined,
      endDate: searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : undefined,
      userId: searchParams.get('userId') || undefined,
      entityId: searchParams.get('entityId') || undefined,
      entityType: searchParams.get('entityType') || undefined,
      limit: searchParams.get('limit')
        ? parseInt(searchParams.get('limit')!, 10)
        : 50,
      offset: searchParams.get('offset')
        ? parseInt(searchParams.get('offset')!, 10)
        : 0,
    };

    // Validate parameters
    if (options.limit && (options.limit < 1 || options.limit > 1000)) {
      return NextResponse.json(
        { success: false, error: 'Limit must be between 1 and 1000' },
        { status: 400 },
      );
    }

    if (
      options.startDate &&
      options.endDate &&
      options.startDate > options.endDate
    ) {
      return NextResponse.json(
        { success: false, error: 'Start date cannot be after end date' },
        { status: 400 },
      );
    }

    // Get audit events
    const result = await auditLogger.queryEvents(options);

    return NextResponse.json({
      success: true,
      data: {
        events: result.events,
        total: result.total,
        pagination: {
          limit: options.limit || 50,
          offset: options.offset || 0,
          hasMore: (options.offset || 0) + (options.limit || 50) < result.total,
        },
        filters: options,
      },
    });
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch audit logs',
        details:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      },
      { status: 500 },
    );
  }
}

async function handlePOST(request: NextRequest) {
  try {
    // Verify authentication and admin access
    const session = await sessionService.getSessionFromCookies();
    if (!session || !session.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { eventType, severity, details, entityId, entityType } = body;

    // Validate required fields
    if (!eventType || !severity || !details) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: eventType, severity, details',
        },
        { status: 400 },
      );
    }

    // Log the audit event
    await auditLogger.logEvent({
      eventType,
      severity,
      userId: session.userId,
      organizationId: session.organizationId,
      entityId,
      entityType,
      details,
      metadata: {
        ipAddress:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          'unknown',
        userAgent: request.headers.get('user-agent') || undefined,
        source: 'api',
        timestamp: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Audit event logged successfully',
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to log audit event',
        details:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      },
      { status: 500 },
    );
  }
}

export const GET = withSecurityHeaders(handleGET);
export const POST = withSecurityHeaders(handlePOST);
