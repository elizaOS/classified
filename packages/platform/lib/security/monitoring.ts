/**
 * Security Monitoring Service
 *
 * Provides real-time security monitoring, threat detection,
 * and automated response capabilities for the platform.
 */

import { getSql } from '../database';
import { logger } from '../logger';
import { auditLogger, AuditEventType, AuditSeverity } from './audit-logger';
import { SessionData } from '../auth/session';

export interface SecurityThreat {
  id: string;
  type: ThreatType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  indicators: ThreatIndicator[];
  affectedUsers?: string[];
  affectedIPs?: string[];
  firstDetected: Date;
  lastSeen: Date;
  status: 'active' | 'investigating' | 'resolved' | 'false_positive';
  responseActions: ResponseAction[];
}

export enum ThreatType {
  BRUTE_FORCE = 'brute_force',
  CREDENTIAL_STUFFING = 'credential_stuffing',
  RATE_LIMIT_ABUSE = 'rate_limit_abuse',
  SUSPICIOUS_LOGIN = 'suspicious_login',
  DATA_EXFILTRATION = 'data_exfiltration',
  API_ABUSE = 'api_abuse',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  ACCOUNT_TAKEOVER = 'account_takeover',
  MALICIOUS_PAYLOAD = 'malicious_payload',
  GEOLOCATION_ANOMALY = 'geolocation_anomaly',
}

export interface ThreatIndicator {
  type: 'ip' | 'user_agent' | 'pattern' | 'timing' | 'volume';
  value: string;
  confidence: number; // 0-100
  metadata?: Record<string, any>;
}

export interface ResponseAction {
  type:
    | 'block_ip'
    | 'suspend_user'
    | 'require_mfa'
    | 'alert_admin'
    | 'log_event';
  timestamp: Date;
  parameters?: Record<string, any>;
  success: boolean;
  result?: string;
}

export interface SecurityMetrics {
  totalThreats: number;
  activeThreats: number;
  criticalThreats: number;
  threatsByType: Record<ThreatType, number>;
  failedLogins24h: number;
  suspiciousSessions: number;
  blockedIPs: number;
  averageRiskScore: number;
}

export interface AnimalyDetectionRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  ruleType: 'threshold' | 'pattern' | 'ml' | 'behavioral';
  conditions: Record<string, any>;
  actions: ResponseActionConfig[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ResponseActionConfig {
  type: string;
  parameters: Record<string, any>;
  delay?: number; // Delay in seconds before action
  conditions?: Record<string, any>;
}

/**
 * Security Monitoring Service
 */
export class SecurityMonitoringService {
  private static instance: SecurityMonitoringService;
  private sql: any = null;
  private activeThreats = new Map<string, SecurityThreat>();
  private blockedIPs = new Set<string>();
  private suspendedUsers = new Set<string>();
  private detectionRules: AnimalyDetectionRule[] = [];

  static getInstance(): SecurityMonitoringService {
    if (!SecurityMonitoringService.instance) {
      SecurityMonitoringService.instance = new SecurityMonitoringService();
    }
    return SecurityMonitoringService.instance;
  }

  private getSqlClient() {
    if (!this.sql) {
      this.sql = getSql();
    }
    return this.sql;
  }

  constructor() {
    this.initializeDetectionRules();
    // Delay monitoring start to avoid database access during build
    if (
      typeof window === 'undefined' &&
      process.env.NODE_ENV !== 'production'
    ) {
      // Don't start monitoring during build
      return;
    }
    this.startMonitoring();
  }

  /**
   * Initialize default detection rules
   */
  private initializeDetectionRules(): void {
    this.detectionRules = [
      {
        id: 'brute-force-detection',
        name: 'Brute Force Detection',
        description: 'Detect multiple failed login attempts from same IP',
        enabled: true,
        ruleType: 'threshold',
        conditions: {
          failedAttemptsThreshold: 5,
          timeWindowMinutes: 15,
          targetType: 'ip_address',
        },
        actions: [
          { type: 'block_ip', parameters: { duration: 3600 } },
          { type: 'alert_admin', parameters: { severity: 'high' } },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'credential-stuffing-detection',
        name: 'Credential Stuffing Detection',
        description:
          'Detect login attempts across multiple accounts from same IP',
        enabled: true,
        ruleType: 'threshold',
        conditions: {
          distinctAccountsThreshold: 10,
          timeWindowMinutes: 60,
          targetType: 'ip_address',
        },
        actions: [
          { type: 'block_ip', parameters: { duration: 7200 } },
          { type: 'alert_admin', parameters: { severity: 'critical' } },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'geolocation-anomaly',
        name: 'Geolocation Anomaly Detection',
        description: 'Detect login from unusual geographic location',
        enabled: true,
        ruleType: 'behavioral',
        conditions: {
          distanceThresholdKm: 1000,
          timeWindowHours: 1,
        },
        actions: [
          { type: 'require_mfa', parameters: {} },
          { type: 'alert_admin', parameters: { severity: 'medium' } },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'api-abuse-detection',
        name: 'API Abuse Detection',
        description: 'Detect excessive API usage patterns',
        enabled: true,
        ruleType: 'threshold',
        conditions: {
          requestsThreshold: 1000,
          timeWindowMinutes: 5,
          errorRateThreshold: 0.5,
        },
        actions: [
          { type: 'block_ip', parameters: { duration: 1800 } },
          { type: 'alert_admin', parameters: { severity: 'high' } },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  /**
   * Start continuous monitoring
   */
  private startMonitoring(): void {
    // Run monitoring checks every 30 seconds
    setInterval(() => {
      this.runDetectionRules().catch((error) => {
        logger.error('Error running detection rules', error as Error);
      });
    }, 30000);

    // Cleanup old data every hour
    setInterval(() => {
      this.cleanupOldData().catch((error) => {
        logger.error('Error cleaning up old security data', error as Error);
      });
    }, 3600000);
  }

  /**
   * Run all active detection rules
   */
  private async runDetectionRules(): Promise<void> {
    for (const rule of this.detectionRules) {
      if (!rule.enabled) {
        continue;
      }

      try {
        await this.runDetectionRule(rule);
      } catch (error) {
        logger.error(`Error running detection rule ${rule.id}`, error as Error);
      }
    }
  }

  /**
   * Run a specific detection rule
   */
  private async runDetectionRule(rule: AnimalyDetectionRule): Promise<void> {
    switch (rule.id) {
      case 'brute-force-detection':
        await this.detectBruteForce(rule);
        break;
      case 'credential-stuffing-detection':
        await this.detectCredentialStuffing(rule);
        break;
      case 'geolocation-anomaly':
        await this.detectGeolocationAnomaly(rule);
        break;
      case 'api-abuse-detection':
        await this.detectAPIAbuse(rule);
        break;
    }
  }

  /**
   * Detect brute force attacks
   */
  private async detectBruteForce(rule: AnimalyDetectionRule): Promise<void> {
    const { failedAttemptsThreshold, timeWindowMinutes } = rule.conditions;
    const windowStart = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

    const result = await this.getSqlClient().query(
      `
      SELECT ip_address, COUNT(*) as attempt_count
      FROM failed_login_attempts 
      WHERE last_attempt >= $1
      GROUP BY ip_address
      HAVING COUNT(*) >= $2
    `,
      [windowStart, failedAttemptsThreshold],
    );

    for (const row of result) {
      const threat: SecurityThreat = {
        id: `brute-force-${row.ip_address}-${Date.now()}`,
        type: ThreatType.BRUTE_FORCE,
        severity: 'high',
        description: `Brute force attack detected from IP ${row.ip_address}`,
        indicators: [
          {
            type: 'ip',
            value: row.ip_address,
            confidence: 90,
            metadata: { attemptCount: row.attempt_count },
          },
        ],
        affectedIPs: [row.ip_address],
        firstDetected: new Date(),
        lastSeen: new Date(),
        status: 'active',
        responseActions: [],
      };

      await this.processThreat(threat, rule.actions);
    }
  }

  /**
   * Detect credential stuffing attacks
   */
  private async detectCredentialStuffing(
    rule: AnimalyDetectionRule,
  ): Promise<void> {
    const { distinctAccountsThreshold, timeWindowMinutes } = rule.conditions;
    const windowStart = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

    const result = await this.getSqlClient().query(
      `
      SELECT ip_address, COUNT(DISTINCT email) as distinct_accounts
      FROM failed_login_attempts 
      WHERE last_attempt >= $1
      GROUP BY ip_address
      HAVING COUNT(DISTINCT email) >= $2
    `,
      [windowStart, distinctAccountsThreshold],
    );

    for (const row of result) {
      const threat: SecurityThreat = {
        id: `credential-stuffing-${row.ip_address}-${Date.now()}`,
        type: ThreatType.CREDENTIAL_STUFFING,
        severity: 'critical',
        description: `Credential stuffing attack detected from IP ${row.ip_address}`,
        indicators: [
          {
            type: 'ip',
            value: row.ip_address,
            confidence: 95,
            metadata: { distinctAccounts: row.distinct_accounts },
          },
        ],
        affectedIPs: [row.ip_address],
        firstDetected: new Date(),
        lastSeen: new Date(),
        status: 'active',
        responseActions: [],
      };

      await this.processThreat(threat, rule.actions);
    }
  }

  /**
   * Detect geolocation anomalies
   */
  private async detectGeolocationAnomaly(
    rule: AnimalyDetectionRule,
  ): Promise<void> {
    // This would integrate with a geolocation service
    // For now, we'll check for rapid IP changes
    const { timeWindowHours } = rule.conditions;
    const windowStart = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);

    const result = await this.getSqlClient().query(
      `
      SELECT user_id, COUNT(DISTINCT ip_address) as ip_count
      FROM session_security 
      WHERE created_at >= $1
      GROUP BY user_id
      HAVING COUNT(DISTINCT ip_address) > 3
    `,
      [windowStart],
    );

    for (const row of result) {
      const threat: SecurityThreat = {
        id: `geo-anomaly-${row.user_id}-${Date.now()}`,
        type: ThreatType.GEOLOCATION_ANOMALY,
        severity: 'medium',
        description: `Geolocation anomaly detected for user ${row.user_id}`,
        indicators: [
          {
            type: 'pattern',
            value: 'rapid_location_change',
            confidence: 75,
            metadata: { ipCount: row.ip_count },
          },
        ],
        affectedUsers: [row.user_id],
        firstDetected: new Date(),
        lastSeen: new Date(),
        status: 'active',
        responseActions: [],
      };

      await this.processThreat(threat, rule.actions);
    }
  }

  /**
   * Detect API abuse
   */
  private async detectAPIAbuse(rule: AnimalyDetectionRule): Promise<void> {
    const { requestsThreshold, timeWindowMinutes, errorRateThreshold } =
      rule.conditions;
    const windowStart = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

    const result = await this.getSqlClient().query(
      `
      SELECT 
        ip_address,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN response_status >= 400 THEN 1 END) as error_requests
      FROM api_key_usage 
      WHERE created_at >= $1
      GROUP BY ip_address
      HAVING COUNT(*) >= $2
        AND (COUNT(CASE WHEN response_status >= 400 THEN 1 END)::float / COUNT(*)) >= $3
    `,
      [windowStart, requestsThreshold, errorRateThreshold],
    );

    for (const row of result) {
      const errorRate = row.error_requests / row.total_requests;

      const threat: SecurityThreat = {
        id: `api-abuse-${row.ip_address}-${Date.now()}`,
        type: ThreatType.API_ABUSE,
        severity: 'high',
        description: `API abuse detected from IP ${row.ip_address}`,
        indicators: [
          {
            type: 'volume',
            value: row.total_requests.toString(),
            confidence: 85,
            metadata: {
              totalRequests: row.total_requests,
              errorRate,
            },
          },
        ],
        affectedIPs: [row.ip_address],
        firstDetected: new Date(),
        lastSeen: new Date(),
        status: 'active',
        responseActions: [],
      };

      await this.processThreat(threat, rule.actions);
    }
  }

  /**
   * Process detected threat and execute response actions
   */
  private async processThreat(
    threat: SecurityThreat,
    actions: ResponseActionConfig[],
  ): Promise<void> {
    // Store threat in active threats
    this.activeThreats.set(threat.id, threat);

    // Log security event
    await this.logSecurityEvent(threat);

    // Execute response actions
    for (const actionConfig of actions) {
      try {
        const action = await this.executeResponseAction(threat, actionConfig);
        threat.responseActions.push(action);
      } catch (error) {
        logger.error('Failed to execute response action', error as Error, {
          threatId: threat.id,
          actionType: actionConfig.type,
        });
      }
    }

    // Store threat in database
    await this.storeThreat(threat);
  }

  /**
   * Execute a response action
   */
  private async executeResponseAction(
    threat: SecurityThreat,
    actionConfig: ResponseActionConfig,
  ): Promise<ResponseAction> {
    const action: ResponseAction = {
      type: actionConfig.type as any,
      timestamp: new Date(),
      parameters: actionConfig.parameters,
      success: false,
    };

    try {
      switch (actionConfig.type) {
        case 'block_ip':
          await this.blockIP(
            threat.affectedIPs?.[0] || '',
            actionConfig.parameters,
          );
          action.success = true;
          break;

        case 'suspend_user':
          if (threat.affectedUsers?.[0]) {
            await this.suspendUser(
              threat.affectedUsers[0],
              actionConfig.parameters,
            );
            action.success = true;
          }
          break;

        case 'require_mfa':
          if (threat.affectedUsers?.[0]) {
            await this.requireMFA(threat.affectedUsers[0]);
            action.success = true;
          }
          break;

        case 'alert_admin':
          await this.alertAdmins(threat, actionConfig.parameters);
          action.success = true;
          break;

        case 'log_event':
          await this.logSecurityEvent(threat);
          action.success = true;
          break;

        default:
          action.result = `Unknown action type: ${actionConfig.type}`;
      }
    } catch (error) {
      action.result = error instanceof Error ? error.message : 'Unknown error';
    }

    return action;
  }

  /**
   * Block an IP address
   */
  private async blockIP(
    ipAddress: string,
    parameters: Record<string, any>,
  ): Promise<void> {
    const duration = parameters.duration || 3600; // Default 1 hour
    const expiresAt = new Date(Date.now() + duration * 1000);

    this.blockedIPs.add(ipAddress);

    // Store in database
    await this.getSqlClient().query(
      `
      INSERT INTO security_events (
        event_type, severity, source_ip, details, created_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `,
      [
        'ip_blocked',
        'high',
        ipAddress,
        JSON.stringify({
          duration,
          expiresAt,
          reason: 'Automated security response',
        }),
      ],
    );

    // Schedule unblock
    setTimeout(() => {
      this.blockedIPs.delete(ipAddress);
    }, duration * 1000);

    logger.warn('IP address blocked', { ipAddress, duration, expiresAt });
  }

  /**
   * Suspend a user account
   */
  private async suspendUser(
    userId: string,
    parameters: Record<string, any>,
  ): Promise<void> {
    const duration = parameters.duration || 86400; // Default 24 hours

    this.suspendedUsers.add(userId);

    await this.getSqlClient().query(
      `
      UPDATE users 
      SET is_active = FALSE, 
          metadata = metadata || $1
      WHERE id = $2
    `,
      [
        JSON.stringify({
          suspendedAt: new Date().toISOString(),
          suspendedUntil: new Date(Date.now() + duration * 1000).toISOString(),
          suspensionReason: 'Automated security response',
        }),
        userId,
      ],
    );

    // Schedule reactivation
    setTimeout(async () => {
      this.suspendedUsers.delete(userId);
      await this.getSqlClient().query(
        `
        UPDATE users 
        SET is_active = TRUE 
        WHERE id = $1
      `,
        [userId],
      );
    }, duration * 1000);

    logger.warn('User account suspended', { userId, duration });
  }

  /**
   * Require MFA for user
   */
  private async requireMFA(userId: string): Promise<void> {
    await this.getSqlClient().query(
      `
      UPDATE users 
      SET metadata = metadata || $1
      WHERE id = $2
    `,
      [
        JSON.stringify({
          mfaRequired: true,
          mfaRequiredAt: new Date().toISOString(),
          mfaRequiredReason: 'Security anomaly detected',
        }),
        userId,
      ],
    );

    logger.info('MFA required for user', { userId });
  }

  /**
   * Alert administrators
   */
  private async alertAdmins(
    threat: SecurityThreat,
    parameters: Record<string, any>,
  ): Promise<void> {
    const severity = parameters.severity || 'medium';

    // Log as critical audit event
    await auditLogger.logEvent({
      eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
      severity:
        severity === 'critical' ? AuditSeverity.CRITICAL : AuditSeverity.HIGH,
      userId: threat.affectedUsers?.[0],
      details: {
        message: `Threat detected: ${threat.type} - ${threat.description}`,
        threatType: threat.type,
        threatDescription: threat.description,
      },
      metadata: {
        source: 'security-monitoring',
        timestamp: new Date(),
        ipAddress: threat.affectedIPs?.[0],
      },
    });

    // In production, this would send real alerts via email, Slack, etc.
    logger.error(
      '🚨 SECURITY ALERT 🚨',
      new Error('Security threat detected'),
      {
        threatType: threat.type,
        severity: threat.severity,
        description: threat.description,
        indicators: threat.indicators,
      },
    );
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(threat: SecurityThreat): Promise<void> {
    await this.getSqlClient().query(
      `
      INSERT INTO security_events (
        event_type, severity, source_ip, user_id, details, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
    `,
      [
        `threat_detected_${threat.type}`,
        threat.severity,
        threat.affectedIPs?.[0] || null,
        threat.affectedUsers?.[0] || null,
        JSON.stringify({
          threatId: threat.id,
          description: threat.description,
          indicators: threat.indicators,
          responseActions: threat.responseActions,
        }),
      ],
    );
  }

  /**
   * Store threat in database
   */
  private async storeThreat(threat: SecurityThreat): Promise<void> {
    // Store threat details in audit logs
    await auditLogger.logEvent({
      eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
      severity:
        threat.severity === 'critical'
          ? AuditSeverity.CRITICAL
          : threat.severity === 'high'
            ? AuditSeverity.HIGH
            : threat.severity === 'medium'
              ? AuditSeverity.MEDIUM
              : AuditSeverity.LOW,
      userId: threat.affectedUsers?.[0],
      details: {
        threatType: threat.type,
        threatId: threat.id,
        description: threat.description,
        indicators: threat.indicators,
        responseActions: threat.responseActions,
        status: threat.status,
      },
      metadata: {
        source: 'security-monitoring',
        timestamp: new Date(),
        ipAddress: threat.affectedIPs?.[0],
      },
    });
  }

  /**
   * Get security metrics
   */
  async getSecurityMetrics(): Promise<SecurityMetrics> {
    const [threatCounts, failedLogins, suspiciousSessions, avgRiskScore] =
      await Promise.all([
        this.getThreatCounts(),
        this.getFailedLoginsCount(),
        this.getSuspiciousSessionsCount(),
        this.getAverageRiskScore(),
      ]);

    return {
      totalThreats: this.activeThreats.size,
      activeThreats: Array.from(this.activeThreats.values()).filter(
        (t) => t.status === 'active',
      ).length,
      criticalThreats: Array.from(this.activeThreats.values()).filter(
        (t) => t.severity === 'critical',
      ).length,
      threatsByType: threatCounts,
      failedLogins24h: failedLogins,
      suspiciousSessions,
      blockedIPs: this.blockedIPs.size,
      averageRiskScore: avgRiskScore,
    };
  }

  /**
   * Get threat counts by type
   */
  private getThreatCounts(): Record<ThreatType, number> {
    const counts = {} as Record<ThreatType, number>;

    Object.values(ThreatType).forEach((type) => {
      counts[type] = 0;
    });

    Array.from(this.activeThreats.values()).forEach((threat) => {
      counts[threat.type]++;
    });

    return counts;
  }

  /**
   * Get failed logins count in last 24 hours
   */
  private async getFailedLoginsCount(): Promise<number> {
    const result = await this.getSqlClient().query(`
      SELECT COUNT(*) as count
      FROM failed_login_attempts 
      WHERE last_attempt > NOW() - INTERVAL '24 hours'
    `);

    return parseInt(result[0]?.count || '0', 10);
  }

  /**
   * Get suspicious sessions count
   */
  private async getSuspiciousSessionsCount(): Promise<number> {
    const result = await this.getSqlClient().query(`
      SELECT COUNT(*) as count
      FROM session_security 
      WHERE is_suspicious = TRUE
      AND created_at > NOW() - INTERVAL '24 hours'
    `);

    return parseInt(result[0]?.count || '0', 10);
  }

  /**
   * Get average risk score
   */
  private async getAverageRiskScore(): Promise<number> {
    const result = await this.getSqlClient().query(`
      SELECT AVG(risk_score) as avg_score
      FROM session_security 
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);

    return parseFloat(result[0]?.avg_score || '0');
  }

  /**
   * Check if IP is blocked
   */
  isIPBlocked(ipAddress: string): boolean {
    return this.blockedIPs.has(ipAddress);
  }

  /**
   * Check if user is suspended
   */
  isUserSuspended(userId: string): boolean {
    return this.suspendedUsers.has(userId);
  }

  /**
   * Clean up old data
   */
  private async cleanupOldData(): Promise<void> {
    try {
      await this.getSqlClient().query('SELECT cleanup_old_audit_data()');

      // Clean up old active threats
      const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
      for (const [id, threat] of this.activeThreats.entries()) {
        if (threat.lastSeen.getTime() < cutoff) {
          this.activeThreats.delete(id);
        }
      }

      logger.debug('Security data cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup old security data', error as Error);
    }
  }

  /**
   * Report login attempt
   */
  async reportLoginAttempt(
    email: string,
    success: boolean,
    ipAddress: string,
    userAgent?: string,
  ): Promise<void> {
    if (success) {
      // Clear any failed attempts for this email/IP
      await this.getSqlClient().query(
        `
        DELETE FROM failed_login_attempts 
        WHERE email = $1 OR ip_address = $2
      `,
        [email, ipAddress],
      );
    } else {
      // Record failed attempt
      await this.getSqlClient().query(
        `
        INSERT INTO failed_login_attempts (
          email, ip_address, user_agent, attempt_count, first_attempt, last_attempt
        ) VALUES ($1, $2, $3, 1, NOW(), NOW())
        ON CONFLICT (email, ip_address) 
        DO UPDATE SET 
          attempt_count = failed_login_attempts.attempt_count + 1,
          last_attempt = NOW()
      `,
        [email, ipAddress, userAgent],
      );
    }
  }
}

// Export singleton getter instead of instance to avoid early initialization
export const securityMonitoring = {
  getSecurityMetrics: () =>
    SecurityMonitoringService.getInstance().getSecurityMetrics(),
  isIPBlocked: (ipAddress: string) =>
    SecurityMonitoringService.getInstance().isIPBlocked(ipAddress),
  isUserSuspended: (userId: string) =>
    SecurityMonitoringService.getInstance().isUserSuspended(userId),
  reportLoginAttempt: (
    email: string,
    success: boolean,
    ipAddress: string,
    userAgent?: string,
  ) =>
    SecurityMonitoringService.getInstance().reportLoginAttempt(
      email,
      success,
      ipAddress,
      userAgent,
    ),
};
