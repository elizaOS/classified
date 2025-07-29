/**
 * Security Configuration API Endpoints
 *
 * Allows administrators to manage security settings and configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import { sessionService } from '@/lib/auth/session';
import { getSql } from '@/lib/database';
import { withSecurityHeaders } from '@/lib/security/headers';
import {
  auditLogger,
  AuditEventType,
  AuditSeverity,
} from '@/lib/security/audit-logger';

async function handleGET(request: NextRequest) {
  try {
    const sql = getSql();

    // Verify authentication and admin access
    const session = await sessionService.getSessionFromCookies();
    if (!session || !session.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const configType = searchParams.get('type');

    let query = `
      SELECT config_type, config_data, enabled, created_at, updated_at
      FROM security_configurations 
      WHERE organization_id = $1
    `;
    const params = [session.organizationId];

    if (configType) {
      query += ' AND config_type = $2';
      params.push(configType);
    }

    query += ' ORDER BY config_type';

    const result = await sql.query(query, params);

    const configurations = result.map((row: any) => ({
      type: row.config_type,
      data: row.config_data,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data: {
        configurations: configType ? configurations : configurations,
        organization: session.organizationId,
      },
    });
  } catch (error) {
    console.error('Failed to fetch security configurations:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch security configurations',
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
    const sql = getSql();

    // Verify authentication and admin access
    const session = await sessionService.getSessionFromCookies();
    if (!session || !session.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { configType, configData, enabled = true } = body;

    // Validate required fields
    if (!configType || !configData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: configType, configData',
        },
        { status: 400 },
      );
    }

    // Validate configuration types
    const validConfigTypes = [
      'rate_limiting',
      'authentication',
      'password_policy',
      'session_security',
      'api_security',
      'audit_logging',
      'threat_detection',
      'access_control',
      'encryption',
      'compliance',
    ];

    if (!validConfigTypes.includes(configType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid config type. Must be one of: ${validConfigTypes.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // Validate configuration data based on type
    const validationResult = validateConfigData(configType, configData);
    if (!validationResult.valid) {
      return NextResponse.json(
        { success: false, error: validationResult.error },
        { status: 400 },
      );
    }

    // Insert or update configuration
    await sql.query(
      `
      INSERT INTO security_configurations (
        organization_id, config_type, config_data, enabled, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (organization_id, config_type)
      DO UPDATE SET 
        config_data = $3,
        enabled = $4,
        updated_at = NOW()
    `,
      [
        session.organizationId,
        configType,
        JSON.stringify(configData),
        enabled,
        session.userId,
      ],
    );

    // Log configuration change
    await auditLogger.logEvent({
      eventType: AuditEventType.ORG_SETTINGS_CHANGED,
      severity: AuditSeverity.MEDIUM,
      userId: session.userId,
      organizationId: session.organizationId,
      details: {
        configType,
        configData,
        enabled,
        action: 'security_config_updated',
      },
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
      message: 'Security configuration updated successfully',
      data: {
        configType,
        enabled,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to update security configuration:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update security configuration',
        details:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      },
      { status: 500 },
    );
  }
}

async function handleDELETE(request: NextRequest) {
  try {
    const sql = getSql();

    // Verify authentication and admin access
    const session = await sessionService.getSessionFromCookies();
    if (!session || !session.isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin access required' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const configType = searchParams.get('type');

    if (!configType) {
      return NextResponse.json(
        { success: false, error: 'Configuration type is required' },
        { status: 400 },
      );
    }

    // Delete configuration
    const result = await sql.query(
      `
      DELETE FROM security_configurations 
      WHERE organization_id = $1 AND config_type = $2
    `,
      [session.organizationId, configType],
    );

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Configuration not found' },
        { status: 404 },
      );
    }

    // Log configuration deletion
    await auditLogger.logEvent({
      eventType: AuditEventType.ORG_SETTINGS_CHANGED,
      severity: AuditSeverity.MEDIUM,
      userId: session.userId,
      organizationId: session.organizationId,
      details: {
        configType,
        action: 'security_config_deleted',
      },
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
      message: 'Security configuration deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete security configuration:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete security configuration',
        details:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      },
      { status: 500 },
    );
  }
}

/**
 * Validate configuration data based on type
 */
function validateConfigData(
  configType: string,
  configData: any,
): { valid: boolean; error?: string } {
  try {
    switch (configType) {
      case 'rate_limiting':
        return validateRateLimitingConfig(configData);
      case 'authentication':
        return validateAuthenticationConfig(configData);
      case 'password_policy':
        return validatePasswordPolicyConfig(configData);
      case 'session_security':
        return validateSessionSecurityConfig(configData);
      case 'api_security':
        return validateApiSecurityConfig(configData);
      default:
        // For other config types, just ensure it's an object
        if (typeof configData !== 'object' || configData === null) {
          return {
            valid: false,
            error: 'Configuration data must be an object',
          };
        }
        return { valid: true };
    }
  } catch (error) {
    return { valid: false, error: 'Invalid configuration data format' };
  }
}

function validateRateLimitingConfig(config: any): {
  valid: boolean;
  error?: string;
} {
  const required = ['windowMs', 'maxRequests'];
  for (const field of required) {
    if (
      !(field in config) ||
      typeof config[field] !== 'number' ||
      config[field] <= 0
    ) {
      return { valid: false, error: `Invalid or missing ${field}` };
    }
  }
  return { valid: true };
}

function validateAuthenticationConfig(config: any): {
  valid: boolean;
  error?: string;
} {
  if (
    config.mfaRequired !== undefined &&
    typeof config.mfaRequired !== 'boolean'
  ) {
    return { valid: false, error: 'mfaRequired must be a boolean' };
  }
  if (
    config.sessionTimeout !== undefined &&
    (typeof config.sessionTimeout !== 'number' || config.sessionTimeout <= 0)
  ) {
    return { valid: false, error: 'sessionTimeout must be a positive number' };
  }
  return { valid: true };
}

function validatePasswordPolicyConfig(config: any): {
  valid: boolean;
  error?: string;
} {
  if (
    config.minLength !== undefined &&
    (typeof config.minLength !== 'number' || config.minLength < 8)
  ) {
    return { valid: false, error: 'minLength must be at least 8' };
  }
  if (
    config.requireUppercase !== undefined &&
    typeof config.requireUppercase !== 'boolean'
  ) {
    return { valid: false, error: 'requireUppercase must be a boolean' };
  }
  return { valid: true };
}

function validateSessionSecurityConfig(config: any): {
  valid: boolean;
  error?: string;
} {
  if (
    config.maxConcurrentSessions !== undefined &&
    (typeof config.maxConcurrentSessions !== 'number' ||
      config.maxConcurrentSessions <= 0)
  ) {
    return {
      valid: false,
      error: 'maxConcurrentSessions must be a positive number',
    };
  }
  return { valid: true };
}

function validateApiSecurityConfig(config: any): {
  valid: boolean;
  error?: string;
} {
  if (
    config.requireApiKey !== undefined &&
    typeof config.requireApiKey !== 'boolean'
  ) {
    return { valid: false, error: 'requireApiKey must be a boolean' };
  }
  return { valid: true };
}

export const GET = withSecurityHeaders(handleGET);
export const POST = withSecurityHeaders(handlePOST);
export const DELETE = withSecurityHeaders(handleDELETE);
