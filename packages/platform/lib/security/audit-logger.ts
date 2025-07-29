/**
 * Advanced Audit Logging System
 *
 * Provides comprehensive audit trails for security events, user actions,
 * and system operations to ensure compliance and security monitoring.
 */

import { logger } from '../logger';
import { getSql } from '../database';
import { SessionData } from '../auth/session';

export enum AuditEventType {
  // Authentication Events
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILED = 'auth.login.failed',
  LOGOUT = 'auth.logout',
  TOKEN_REFRESH = 'auth.token.refresh',
  SESSION_EXPIRED = 'auth.session.expired',
  DEVICE_AUTH_START = 'auth.device.start',
  DEVICE_AUTH_COMPLETE = 'auth.device.complete',

  // User Management
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  USER_ROLE_CHANGED = 'user.role.changed',
  USER_ACTIVATED = 'user.activated',
  USER_DEACTIVATED = 'user.deactivated',

  // Organization Management
  ORG_CREATED = 'org.created',
  ORG_UPDATED = 'org.updated',
  ORG_DELETED = 'org.deleted',
  ORG_MEMBER_ADDED = 'org.member.added',
  ORG_MEMBER_REMOVED = 'org.member.removed',
  ORG_SETTINGS_CHANGED = 'org.settings.changed',

  // API Key Management
  API_KEY_CREATED = 'api_key.created',
  API_KEY_DELETED = 'api_key.deleted',
  API_KEY_USED = 'api_key.used',
  API_KEY_FAILED = 'api_key.failed',

  // Data Access
  DATA_EXPORTED = 'data.exported',
  DATA_IMPORTED = 'data.imported',
  SENSITIVE_DATA_ACCESSED = 'data.sensitive.accessed',

  // Security Events
  SUSPICIOUS_ACTIVITY = 'security.suspicious',
  RATE_LIMIT_EXCEEDED = 'security.rate_limit',
  INVALID_TOKEN = 'security.invalid_token',
  UNAUTHORIZED_ACCESS = 'security.unauthorized',
  PERMISSION_DENIED = 'security.permission_denied',

  // System Events
  SYSTEM_ERROR = 'system.error',
  SYSTEM_MAINTENANCE = 'system.maintenance',
  BACKUP_CREATED = 'system.backup.created',
  BACKUP_RESTORED = 'system.backup.restored',

  // Plugin/Agent Events
  AGENT_CREATED = 'agent.created',
  AGENT_UPDATED = 'agent.updated',
  AGENT_DELETED = 'agent.deleted',
  AGENT_STARTED = 'agent.started',
  AGENT_STOPPED = 'agent.stopped',
  PLUGIN_INSTALLED = 'plugin.installed',
  PLUGIN_REMOVED = 'plugin.removed',

  // Analytics Events
  ANALYTICS_ACCESSED = 'analytics.accessed',
  REPORT_GENERATED = 'report.generated',
  EXPORT_REQUESTED = 'export.requested',
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface AuditEvent {
  id?: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  organizationId?: string;
  entityId?: string;
  entityType?: string;
  details: Record<string, any>;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    sessionId?: string;
    source?: string;
    timestamp: Date;
  };
}

export interface AuditQueryOptions {
  organizationId?: string;
  userId?: string;
  eventTypes?: AuditEventType[];
  severity?: AuditSeverity[];
  startDate?: Date;
  endDate?: Date;
  entityId?: string;
  entityType?: string;
  limit?: number;
  offset?: number;
}

/**
 * Audit Logger Service
 */
export class AuditLogger {
  private static instance: AuditLogger;
  private sql: any = null;

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  private getSqlClient() {
    if (!this.sql) {
      this.sql = getSql();
    }
    return this.sql;
  }

  /**
   * Log an audit event
   */
  async logEvent(
    event: Omit<AuditEvent, 'id' | 'metadata.timestamp'>,
  ): Promise<void> {
    try {
      const auditEvent: AuditEvent = {
        ...event,
        metadata: {
          ...event.metadata,
          timestamp: new Date(),
        },
      };

      // Store in database
      await this.storeEvent(auditEvent);

      // Log to application logger based on severity
      const logData = {
        eventType: auditEvent.eventType,
        userId: auditEvent.userId,
        organizationId: auditEvent.organizationId,
        entityId: auditEvent.entityId,
        entityType: auditEvent.entityType,
        details: auditEvent.details,
        ipAddress: auditEvent.metadata.ipAddress,
        userAgent: auditEvent.metadata.userAgent,
      };

      switch (auditEvent.severity) {
        case AuditSeverity.CRITICAL:
          logger.error(
            `AUDIT [CRITICAL]: ${auditEvent.eventType}`,
            new Error('Audit event'),
            logData,
          );
          break;
        case AuditSeverity.HIGH:
          logger.warn(`AUDIT [HIGH]: ${auditEvent.eventType}`, logData);
          break;
        case AuditSeverity.MEDIUM:
          logger.info(`AUDIT [MEDIUM]: ${auditEvent.eventType}`, logData);
          break;
        case AuditSeverity.LOW:
        default:
          logger.debug(`AUDIT [LOW]: ${auditEvent.eventType}`, logData);
          break;
      }

      // Send alerts for critical events
      if (auditEvent.severity === AuditSeverity.CRITICAL) {
        await this.sendSecurityAlert(auditEvent);
      }
    } catch (error) {
      logger.error('Failed to log audit event', error as Error, {
        eventType: event.eventType,
        severity: event.severity,
      });
      // Don't throw - audit logging failures shouldn't break the main flow
    }
  }

  /**
   * Store audit event in database
   */
  private async storeEvent(event: AuditEvent): Promise<void> {
    const eventId = crypto.randomUUID();

    await this.getSqlClient().query(
      `
      INSERT INTO audit_logs (
        id, event_type, severity, user_id, organization_id,
        entity_id, entity_type, details, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
      [
        eventId,
        event.eventType,
        event.severity,
        event.userId || null,
        event.organizationId || null,
        event.entityId || null,
        event.entityType || null,
        JSON.stringify(event.details),
        JSON.stringify(event.metadata),
        event.metadata.timestamp,
      ],
    );
  }

  /**
   * Query audit events
   */
  async queryEvents(options: AuditQueryOptions = {}): Promise<{
    events: AuditEvent[];
    total: number;
  }> {
    let query = `
      SELECT id, event_type, severity, user_id, organization_id,
             entity_id, entity_type, details, metadata, created_at
      FROM audit_logs
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Build WHERE clause
    if (options.organizationId) {
      query += ` AND organization_id = $${paramIndex++}`;
      params.push(options.organizationId);
    }

    if (options.userId) {
      query += ` AND user_id = $${paramIndex++}`;
      params.push(options.userId);
    }

    if (options.eventTypes && options.eventTypes.length > 0) {
      query += ` AND event_type = ANY($${paramIndex++})`;
      params.push(options.eventTypes);
    }

    if (options.severity && options.severity.length > 0) {
      query += ` AND severity = ANY($${paramIndex++})`;
      params.push(options.severity);
    }

    if (options.startDate) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(options.startDate);
    }

    if (options.endDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(options.endDate);
    }

    if (options.entityId) {
      query += ` AND entity_id = $${paramIndex++}`;
      params.push(options.entityId);
    }

    if (options.entityType) {
      query += ` AND entity_type = $${paramIndex++}`;
      params.push(options.entityType);
    }

    // Get total count
    const countQuery = query.replace(
      'SELECT id, event_type, severity, user_id, organization_id, entity_id, entity_type, details, metadata, created_at',
      'SELECT COUNT(*)',
    );

    const countResult = await this.getSqlClient().query(countQuery, params);
    const total = parseInt(countResult[0]?.count || '0', 10);

    // Add ordering and pagination
    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    if (options.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(options.offset);
    }

    const result = await this.getSqlClient().query(query, params);

    const events: AuditEvent[] = result.map((row: any) => ({
      id: row.id,
      eventType: row.event_type,
      severity: row.severity,
      userId: row.user_id,
      organizationId: row.organization_id,
      entityId: row.entity_id,
      entityType: row.entity_type,
      details: JSON.parse(row.details || '{}'),
      metadata: JSON.parse(row.metadata || '{}'),
    }));

    return { events, total };
  }

  /**
   * Send security alert for critical events
   */
  private async sendSecurityAlert(event: AuditEvent): Promise<void> {
    try {
      // In a real implementation, this would send alerts via email, Slack, PagerDuty, etc.
      logger.warn('🚨 SECURITY ALERT 🚨', {
        eventType: event.eventType,
        severity: event.severity,
        userId: event.userId,
        organizationId: event.organizationId,
        details: event.details,
        timestamp: event.metadata.timestamp,
        ipAddress: event.metadata.ipAddress,
      });

      // TODO: Implement actual alerting mechanisms:
      // - Email notifications
      // - Slack webhooks
      // - PagerDuty integration
      // - SMS alerts
    } catch (error) {
      logger.error('Failed to send security alert', error as Error);
    }
  }

  /**
   * Helper methods for common audit events
   */

  async logAuthSuccess(
    userId: string,
    organizationId: string,
    metadata: any,
  ): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.LOGIN_SUCCESS,
      severity: AuditSeverity.LOW,
      userId,
      organizationId,
      details: {
        loginMethod: metadata.loginMethod || 'unknown',
        deviceInfo: metadata.deviceInfo,
      },
      metadata,
    });
  }

  async logAuthFailure(
    email: string,
    reason: string,
    metadata: any,
  ): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.LOGIN_FAILED,
      severity: AuditSeverity.MEDIUM,
      details: {
        email,
        reason,
        attemptCount: metadata.attemptCount || 1,
      },
      metadata,
    });
  }

  async logUnauthorizedAccess(
    userId: string | undefined,
    resource: string,
    metadata: any,
  ): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.UNAUTHORIZED_ACCESS,
      severity: AuditSeverity.HIGH,
      userId,
      details: {
        resource,
        action: metadata.action,
        reason: metadata.reason || 'Insufficient permissions',
      },
      metadata,
    });
  }

  async logSuspiciousActivity(
    userId: string | undefined,
    activity: string,
    details: Record<string, any>,
    metadata: any,
  ): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
      severity: AuditSeverity.CRITICAL,
      userId,
      details: {
        activity,
        ...details,
      },
      metadata,
    });
  }

  async logDataAccess(
    userId: string,
    organizationId: string,
    dataType: string,
    entityId: string,
    metadata: any,
  ): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESSED,
      severity: AuditSeverity.MEDIUM,
      userId,
      organizationId,
      entityId,
      entityType: dataType,
      details: {
        dataType,
        operation: metadata.operation || 'read',
      },
      metadata,
    });
  }

  async logRateLimitExceeded(
    userId: string | undefined,
    endpoint: string,
    limit: number,
    metadata: any,
  ): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
      severity: AuditSeverity.HIGH,
      userId,
      details: {
        endpoint,
        limit,
        attempts: metadata.attempts,
      },
      metadata,
    });
  }
}

/**
 * Audit Logger Middleware Factory
 */
export function createAuditMiddleware(
  eventType: AuditEventType,
  severity: AuditSeverity = AuditSeverity.LOW,
) {
  return function auditMiddleware(
    handler: (req: any, res: any) => Promise<any>,
  ) {
    return async function (req: any, res: any) {
      const auditLogger = AuditLogger.getInstance();
      const startTime = Date.now();

      try {
        const result = await handler(req, res);

        // Log successful operation
        await auditLogger.logEvent({
          eventType,
          severity,
          userId: req.session?.userId,
          organizationId: req.session?.organizationId,
          details: {
            success: true,
            duration: Date.now() - startTime,
            endpoint: req.url,
            method: req.method,
          },
          metadata: {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.headers['x-request-id'],
            source: 'api',
            timestamp: new Date(),
          },
        });

        return result;
      } catch (error) {
        // Log failed operation
        await auditLogger.logEvent({
          eventType,
          severity: AuditSeverity.HIGH,
          userId: req.session?.userId,
          organizationId: req.session?.organizationId,
          details: {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: Date.now() - startTime,
            endpoint: req.url,
            method: req.method,
          },
          metadata: {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: req.headers['x-request-id'],
            source: 'api',
            timestamp: new Date(),
          },
        });

        throw error;
      }
    };
  };
}

// Export singleton getter instead of instance to avoid early initialization
export const auditLogger = {
  logEvent: (event: Omit<AuditEvent, 'id' | 'metadata.timestamp'>) =>
    AuditLogger.getInstance().logEvent(event),
  queryEvents: (options: AuditQueryOptions = {}) =>
    AuditLogger.getInstance().queryEvents(options),
  logAuthSuccess: (userId: string, organizationId: string, metadata: any) =>
    AuditLogger.getInstance().logAuthSuccess(userId, organizationId, metadata),
  logAuthFailure: (email: string, reason: string, metadata: any) =>
    AuditLogger.getInstance().logAuthFailure(email, reason, metadata),
  logUnauthorizedAccess: (
    userId: string | undefined,
    resource: string,
    metadata: any,
  ) =>
    AuditLogger.getInstance().logUnauthorizedAccess(userId, resource, metadata),
  logSuspiciousActivity: (
    userId: string | undefined,
    activity: string,
    details: Record<string, any>,
    metadata: any,
  ) =>
    AuditLogger.getInstance().logSuspiciousActivity(
      userId,
      activity,
      details,
      metadata,
    ),
  logDataAccess: (
    userId: string,
    organizationId: string,
    dataType: string,
    entityId: string,
    metadata: any,
  ) =>
    AuditLogger.getInstance().logDataAccess(
      userId,
      organizationId,
      dataType,
      entityId,
      metadata,
    ),
  logRateLimitExceeded: (
    userId: string | undefined,
    endpoint: string,
    limit: number,
    metadata: any,
  ) =>
    AuditLogger.getInstance().logRateLimitExceeded(
      userId,
      endpoint,
      limit,
      metadata,
    ),
};
