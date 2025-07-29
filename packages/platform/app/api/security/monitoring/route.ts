/**
 * Security Monitoring API Endpoints
 *
 * Provides real-time security monitoring data and threat management
 */

import { NextRequest, NextResponse } from 'next/server';
import { sessionService } from '@/lib/auth/session';
import { securityMonitoring } from '@/lib/security/monitoring';
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
    const action = searchParams.get('action');

    switch (action) {
      case 'metrics':
        const metrics = await securityMonitoring.getSecurityMetrics();
        return NextResponse.json({
          success: true,
          data: metrics,
        });

      case 'threats':
        // Return active threats (in a real implementation, this would query the database)
        return NextResponse.json({
          success: true,
          data: {
            threats: [], // Would be populated from database
            total: 0,
          },
        });

      case 'blocked-ips':
        // Return list of blocked IPs
        return NextResponse.json({
          success: true,
          data: {
            blockedIPs: [], // Would be populated from security monitoring
            total: 0,
          },
        });

      default:
        // Return overview data
        const overviewData = await securityMonitoring.getSecurityMetrics();
        return NextResponse.json({
          success: true,
          data: {
            metrics: overviewData,
            status: 'monitoring',
            lastUpdate: new Date().toISOString(),
          },
        });
    }
  } catch (error) {
    console.error('Failed to fetch security monitoring data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch security monitoring data',
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
    const { action, ...parameters } = body;

    switch (action) {
      case 'block-ip':
        const { ipAddress, duration = 3600, reason } = parameters;
        if (!ipAddress) {
          return NextResponse.json(
            { success: false, error: 'IP address is required' },
            { status: 400 },
          );
        }

        // In a real implementation, this would call securityMonitoring.blockIP()
        return NextResponse.json({
          success: true,
          message: `IP ${ipAddress} blocked for ${duration} seconds`,
          data: {
            ipAddress,
            duration,
            reason: reason || 'Manual admin action',
            blockedAt: new Date().toISOString(),
          },
        });

      case 'unblock-ip':
        const { ipAddress: unblockIP } = parameters;
        if (!unblockIP) {
          return NextResponse.json(
            { success: false, error: 'IP address is required' },
            { status: 400 },
          );
        }

        // In a real implementation, this would remove the IP from blocked list
        return NextResponse.json({
          success: true,
          message: `IP ${unblockIP} unblocked`,
          data: {
            ipAddress: unblockIP,
            unblockedAt: new Date().toISOString(),
          },
        });

      case 'suspend-user':
        const {
          userId,
          suspensionDuration = 86400,
          suspensionReason,
        } = parameters;
        if (!userId) {
          return NextResponse.json(
            { success: false, error: 'User ID is required' },
            { status: 400 },
          );
        }

        // In a real implementation, this would call securityMonitoring.suspendUser()
        return NextResponse.json({
          success: true,
          message: `User ${userId} suspended for ${suspensionDuration} seconds`,
          data: {
            userId,
            duration: suspensionDuration,
            reason: suspensionReason || 'Manual admin action',
            suspendedAt: new Date().toISOString(),
          },
        });

      case 'require-mfa':
        const { userId: mfaUserId } = parameters;
        if (!mfaUserId) {
          return NextResponse.json(
            { success: false, error: 'User ID is required' },
            { status: 400 },
          );
        }

        // In a real implementation, this would call securityMonitoring.requireMFA()
        return NextResponse.json({
          success: true,
          message: `MFA required for user ${mfaUserId}`,
          data: {
            userId: mfaUserId,
            requiredAt: new Date().toISOString(),
          },
        });

      case 'resolve-threat':
        const { threatId, resolution } = parameters;
        if (!threatId) {
          return NextResponse.json(
            { success: false, error: 'Threat ID is required' },
            { status: 400 },
          );
        }

        // In a real implementation, this would mark the threat as resolved
        return NextResponse.json({
          success: true,
          message: `Threat ${threatId} resolved`,
          data: {
            threatId,
            resolution: resolution || 'Manual admin resolution',
            resolvedAt: new Date().toISOString(),
            resolvedBy: session.userId,
          },
        });

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('Failed to execute security action:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute security action',
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
