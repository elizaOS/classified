import type { UUID } from '@elizaos/core';
// Temporary type definitions for disabled services

export enum AuditCategory {
  TRUST = 'trust',
  SECURITY = 'security',
  PERMISSION = 'permission',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  ACCESS = 'access',
  SYSTEM = 'system',
  DATA = 'data',
  COMMUNICATION = 'communication',
  INTEGRATION = 'integration',
  TRUST_MANAGEMENT = 'trust_management',
  SECURITY_EVENT = 'security_event',
  DATA_ACCESS = 'data_access',
  CONFIGURATION = 'configuration',
  EMERGENCY_ACTION = 'emergency_action',
  SYSTEM_EVENT = 'system_event',
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
  INFO = 'info',
}

export enum AuditResult {
  SUCCESS = 'success',
  FAILURE = 'failure',
  BLOCKED = 'blocked',
  WARNING = 'warning',
  ERROR = 'error',
  PARTIAL = 'partial',
}

export interface AuditEntry {
  id: UUID;
  timestamp: Date;
  entityId: UUID;
  action: UUID;
  category: AuditCategory;
  severity: AuditSeverity;
  result: AuditResult;
  context: {
    service: UUID;
    method: UUID;
    resource?: UUID;
    targetEntityId?: UUID;
  };
  metadata: Record<string, any>;
  tags: UUID[];
}

// Stub AuditLogger interface
export interface AuditLogger {
  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<string>;
}
