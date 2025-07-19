import type { UUID } from '@elizaos/core';

/**
 * Environment types for role-based access control
 */
export type Environment =
  | 'development'
  | 'staging'
  | 'production'
  | 'testing'
  | 'sandbox'
  | 'local'
  | 'demo'
  | 'experimental';

/**
 * Role hierarchy levels
 */
export enum RoleLevel {
  GUEST = 0,
  USER = 10,
  CONTRIBUTOR = 20,
  MODERATOR = 30,
  TRUSTED_USER = 40,
  DEVELOPER = 50,
  ADMIN = 60,
  SUPER_ADMIN = 70,
  SYSTEM = 80,
  GOD_MODE = 90,
}

/**
 * Permission categories
 */
export enum PermissionCategory {
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  DELETE = 'delete',
  ADMIN = 'admin',
  SYSTEM = 'system',
  SECURITY = 'security',
  FINANCIAL = 'financial',
  USER_MANAGEMENT = 'user_management',
  PLUGIN_MANAGEMENT = 'plugin_management',
}

/**
 * Resource types that can be protected
 */
export enum ResourceType {
  FILE = 'file',
  DATABASE = 'database',
  SECRET = 'secret',
  API_ENDPOINT = 'api_endpoint',
  SHELL_COMMAND = 'shell_command',
  PLUGIN = 'plugin',
  USER_DATA = 'user_data',
  SYSTEM_CONFIG = 'system_config',
  FINANCIAL_DATA = 'financial_data',
  LOGS = 'logs',
  METRICS = 'metrics',
}

/**
 * Individual permission definition
 */
export interface Permission {
  id: string;
  name: string;
  description: string;
  category: PermissionCategory;
  resourceType: ResourceType;
  environments: Environment[];
  minimumTrustLevel: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresApproval?: boolean;
  timeLimit?: number; // In seconds
  ipRestricted?: boolean;
  mfaRequired?: boolean;
}

/**
 * Role definition with environment-specific configurations
 */
export interface Role {
  id: UUID;
  name: string; // Changed to string - human-readable name
  description: string; // Changed to string - human-readable description
  level: RoleLevel;
  environments: Environment[];
  permissions: Permission[];
  inheritsFrom?: UUID[]; // Role IDs this role inherits from
  constraints: RoleConstraints;
  metadata: RoleMetadata;
}

/**
 * Role constraints and limitations
 */
export interface RoleConstraints {
  maxConcurrentSessions: number;
  sessionTimeout: number; // In seconds
  allowedIpRanges?: string[]; // Changed to string[] - IP ranges
  timeRestrictions?: {
    allowedHours: number[]; // 0-23
    allowedDays: number[]; // 0-6 (Sunday = 0)
    timezone: string; // Changed to string - timezone name
  }[];
  trustRequirements: {
    minimumTrust: number;
    requiredDimensions?: {
      reliability?: number;
      competence?: number;
      integrity?: number;
      benevolence?: number;
      transparency?: number;
    };
  };
  rateLimits?: {
    actionsPerMinute: number;
    actionsPerHour: number;
    actionsPerDay: number;
  };
}

/**
 * Role metadata
 */
export interface RoleMetadata {
  createdAt: Date;
  createdBy: UUID;
  updatedAt: Date;
  updatedBy: UUID;
  version: number;
  deprecated?: boolean;
  expiresAt?: Date;
  approvalRequired: boolean;
  auditLevel: 'none' | 'basic' | 'detailed' | 'full';
}

/**
 * Role assignment to an entity
 */
export interface RoleAssignment {
  id: UUID;
  entityId: UUID;
  roleId: UUID;
  environment: Environment;
  assignedBy: UUID;
  assignedAt: Date;
  expiresAt?: Date;
  active: boolean;
  conditions?: RoleCondition[];
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  approvedBy?: UUID;
  approvedAt?: Date;
  metadata: {
    reason: string; // Changed to string - human-readable reason
    requestId?: UUID;
    trustScoreAtAssignment: number;
    ipAddress?: string; // Changed to string - IP address
    userAgent?: string; // Changed to string - user agent string
  };
}

/**
 * Conditional role assignment
 */
export interface RoleCondition {
  type: 'trust_threshold' | 'time_based' | 'location_based' | 'context_based';
  condition: any;
  active: boolean;
}

/**
 * Role escalation request
 */
export interface RoleEscalationRequest {
  id: UUID;
  requesterId: UUID;
  currentRole: UUID;
  requestedRole: UUID;
  environment: Environment;
  reason: string; // Changed to string - human-readable reason
  justification: string; // Changed to string - human-readable justification
  urgency: 'low' | 'medium' | 'high' | 'critical';
  requestedAt: Date;
  expiresAt?: Date;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reviewedBy?: UUID;
  reviewedAt?: Date;
  reviewNotes?: string; // Changed to string - human-readable notes
  autoApprovalEligible: boolean;
  trustScoreRequired: number;
  currentTrustScore: number;
}

/**
 * Environment-specific role configuration
 */
export interface EnvironmentRoleConfig {
  environment: Environment;
  defaultRole: string; // Changed to string - role name
  autoEscalationEnabled: boolean;
  maxRoleLevel: RoleLevel;
  trustRequirementMultiplier: number; // Multiply base trust requirements
  approvalRequired: boolean;
  auditLevel: 'none' | 'basic' | 'detailed' | 'full';
  sessionTimeout: number;
  mfaRequired: boolean;
  ipWhitelist?: string[]; // Changed to string[] - IP addresses
  allowedTimeWindows?: {
    start: string; // Changed to string - HH:MM format
    end: string; // Changed to string - HH:MM format
    timezone: string; // Changed to string - timezone name
  }[];
}

/**
 * Permission evaluation context
 */
export interface PermissionContext {
  entityId: UUID;
  environment: Environment;
  resource: string; // Changed to string - resource identifier
  action: string; // Changed to string - action name
  ipAddress?: string; // Changed to string - IP address
  userAgent?: string; // Changed to string - user agent string
  sessionId?: UUID;
  trustScore: number;
  timestamp: Date;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Permission evaluation result
 */
export interface PermissionEvaluationResult {
  allowed: boolean;
  roleUsed?: UUID;
  permissionUsed?: UUID;
  reason: string; // Changed to string - human-readable reason
  constraints: string[]; // Changed to string[] - constraint descriptions
  requiresApproval: boolean;
  approvalWorkflow?: UUID;
  expiresAt?: Date;
  conditions: string[]; // Changed to string[] - condition descriptions
  auditEventId?: UUID;
  trustScoreUsed: number;
  escalationSuggested?: {
    role: UUID;
    reason: string; // Changed to string - human-readable reason
    autoEligible: boolean;
  };
}

/**
 * Audit event for role and permission actions
 */
export interface RoleAuditEvent {
  id: UUID;
  entityId: UUID;
  action: string; // Changed to string - action name
  resource?: string; // Changed to string - resource identifier
  roleId?: UUID;
  permissionId?: UUID;
  environment: Environment;
  result: 'allowed' | 'denied' | 'escalated' | 'error';
  reason: string; // Changed to string - human-readable reason
  trustScore: number;
  ipAddress?: string; // Changed to string - IP address
  userAgent?: string; // Changed to string - user agent string
  sessionId?: UUID;
  timestamp: Date;
  metadata: any;
}

/**
 * Built-in permission definitions
 */
export const BUILT_IN_PERMISSIONS: Record<string, Permission> = {
  // File System Permissions
  'file.read.logs': {
    id: 'file.read.logs',
    name: 'Read Log Files',
    description: 'Read application and system log files',
    category: PermissionCategory.READ,
    resourceType: ResourceType.FILE,
    environments: ['development', 'staging', 'production'],
    minimumTrustLevel: 30,
    riskLevel: 'low',
  },
  'file.write.config': {
    id: 'file.write.config',
    name: 'Write Configuration Files',
    description: 'Modify application configuration files',
    category: PermissionCategory.WRITE,
    resourceType: ResourceType.FILE,
    environments: ['development', 'staging'],
    minimumTrustLevel: 60,
    riskLevel: 'high',
    requiresApproval: true,
  },
  'file.delete.user_data': {
    id: 'file.delete.user_data',
    name: 'Delete User Data',
    description: 'Permanently delete user data files',
    category: PermissionCategory.DELETE,
    resourceType: ResourceType.USER_DATA,
    environments: ['development', 'staging'],
    minimumTrustLevel: 80,
    riskLevel: 'critical',
    requiresApproval: true,
    mfaRequired: true,
  },

  // Database Permissions
  'db.read.user_data': {
    id: 'db.read.user_data',
    name: 'Read User Database',
    description: 'Query user data from database',
    category: PermissionCategory.READ,
    resourceType: ResourceType.DATABASE,
    environments: ['development', 'staging', 'production'],
    minimumTrustLevel: 40,
    riskLevel: 'medium',
  },
  'db.write.user_data': {
    id: 'db.write.user_data',
    name: 'Modify User Database',
    description: 'Insert, update, or modify user data',
    category: PermissionCategory.WRITE,
    resourceType: ResourceType.DATABASE,
    environments: ['development', 'staging'],
    minimumTrustLevel: 60,
    riskLevel: 'high',
  },
  'db.admin.schema': {
    id: 'db.admin.schema',
    name: 'Database Schema Administration',
    description: 'Modify database schema, create/drop tables',
    category: PermissionCategory.ADMIN,
    resourceType: ResourceType.DATABASE,
    environments: ['development'],
    minimumTrustLevel: 85,
    riskLevel: 'critical',
    requiresApproval: true,
  },

  // Shell Command Permissions
  'shell.execute.safe': {
    id: 'shell.execute.safe',
    name: 'Execute Safe Shell Commands',
    description: 'Run whitelisted safe shell commands',
    category: PermissionCategory.EXECUTE,
    resourceType: ResourceType.SHELL_COMMAND,
    environments: ['development', 'staging', 'production'],
    minimumTrustLevel: 50,
    riskLevel: 'medium',
  },
  'shell.execute.admin': {
    id: 'shell.execute.admin',
    name: 'Execute Administrative Commands',
    description: 'Run administrative shell commands with elevated privileges',
    category: PermissionCategory.EXECUTE,
    resourceType: ResourceType.SHELL_COMMAND,
    environments: ['development', 'staging'],
    minimumTrustLevel: 80,
    riskLevel: 'critical',
    requiresApproval: true,
    timeLimit: 3600, // 1 hour
  },

  // Secret Management
  'secret.read.development': {
    id: 'secret.read.development',
    name: 'Read Development Secrets',
    description: 'Access development environment secrets',
    category: PermissionCategory.READ,
    resourceType: ResourceType.SECRET,
    environments: ['development'],
    minimumTrustLevel: 40,
    riskLevel: 'medium',
  },
  'secret.read.production': {
    id: 'secret.read.production',
    name: 'Read Production Secrets',
    description: 'Access production environment secrets',
    category: PermissionCategory.READ,
    resourceType: ResourceType.SECRET,
    environments: ['production'],
    minimumTrustLevel: 85,
    riskLevel: 'critical',
    requiresApproval: true,
    mfaRequired: true,
    timeLimit: 1800, // 30 minutes
  },

  // Plugin Management
  'plugin.install': {
    id: 'plugin.install',
    name: 'Install Plugins',
    description: 'Install new plugins into the system',
    category: PermissionCategory.ADMIN,
    resourceType: ResourceType.PLUGIN,
    environments: ['development', 'staging'],
    minimumTrustLevel: 70,
    riskLevel: 'high',
    requiresApproval: true,
  },
  'plugin.configure': {
    id: 'plugin.configure',
    name: 'Configure Plugins',
    description: 'Modify plugin configurations',
    category: PermissionCategory.WRITE,
    resourceType: ResourceType.PLUGIN,
    environments: ['development', 'staging', 'production'],
    minimumTrustLevel: 60,
    riskLevel: 'medium',
  },

  // User Management
  'user.read.profiles': {
    id: 'user.read.profiles',
    name: 'Read User Profiles',
    description: 'View user profile information',
    category: PermissionCategory.READ,
    resourceType: ResourceType.USER_DATA,
    environments: ['development', 'staging', 'production'],
    minimumTrustLevel: 35,
    riskLevel: 'low',
  },
  'user.admin.roles': {
    id: 'user.admin.roles',
    name: 'Manage User Roles',
    description: 'Assign and modify user roles',
    category: PermissionCategory.ADMIN,
    resourceType: ResourceType.USER_DATA,
    environments: ['development', 'staging'],
    minimumTrustLevel: 75,
    riskLevel: 'high',
    requiresApproval: true,
  },

  // Financial Operations
  'financial.read.transactions': {
    id: 'financial.read.transactions',
    name: 'Read Financial Transactions',
    description: 'View financial transaction data',
    category: PermissionCategory.READ,
    resourceType: ResourceType.FINANCIAL_DATA,
    environments: ['development', 'staging', 'production'],
    minimumTrustLevel: 70,
    riskLevel: 'high',
    mfaRequired: true,
  },
  'financial.execute.payments': {
    id: 'financial.execute.payments',
    name: 'Execute Payments',
    description: 'Process financial payments and transfers',
    category: PermissionCategory.EXECUTE,
    resourceType: ResourceType.FINANCIAL_DATA,
    environments: ['production'],
    minimumTrustLevel: 90,
    riskLevel: 'critical',
    requiresApproval: true,
    mfaRequired: true,
    timeLimit: 900, // 15 minutes
  },
};

/**
 * Built-in role definitions for different environments
 */
export const BUILT_IN_ROLES: Record<string, any> = {
  // Guest Role - Very Limited Access
  guest: {
    id: 'guest',
    name: 'Guest',
    description: 'Limited read-only access for unauthenticated users',
    level: RoleLevel.GUEST,
    environments: ['development', 'staging', 'production', 'demo'],
    permissions: [BUILT_IN_PERMISSIONS['user.read.profiles']],
    constraints: {
      maxConcurrentSessions: 1,
      sessionTimeout: 3600, // 1 hour
      trustRequirements: {
        minimumTrust: 0,
      },
      rateLimits: {
        actionsPerMinute: 10,
        actionsPerHour: 100,
        actionsPerDay: 500,
      },
    },
    metadata: {
      createdAt: new Date(),
      createdBy: 'system' as UUID,
      updatedAt: new Date(),
      updatedBy: 'system' as UUID,
      version: 1,
      approvalRequired: false,
      auditLevel: 'basic',
    },
  },

  // Regular User Role
  user: {
    id: 'user',
    name: 'User',
    description: 'Standard user with basic application access',
    level: RoleLevel.USER,
    environments: ['development', 'staging', 'production'],
    permissions: [
      BUILT_IN_PERMISSIONS['file.read.logs'],
      BUILT_IN_PERMISSIONS['db.read.user_data'],
      BUILT_IN_PERMISSIONS['user.read.profiles'],
      BUILT_IN_PERMISSIONS['plugin.configure'],
    ],
    inheritsFrom: ['guest'],
    constraints: {
      maxConcurrentSessions: 3,
      sessionTimeout: 7200, // 2 hours
      trustRequirements: {
        minimumTrust: 25,
        requiredDimensions: {
          integrity: 20,
        },
      },
      rateLimits: {
        actionsPerMinute: 30,
        actionsPerHour: 500,
        actionsPerDay: 2000,
      },
    },
    metadata: {
      createdAt: new Date(),
      createdBy: 'system' as UUID,
      updatedAt: new Date(),
      updatedBy: 'system' as UUID,
      version: 1,
      approvalRequired: false,
      auditLevel: 'basic',
    },
  },

  // Developer Role
  developer: {
    id: 'developer',
    name: 'Developer',
    description: 'Development access with code and config permissions',
    level: RoleLevel.DEVELOPER,
    environments: ['development', 'staging'],
    permissions: [
      BUILT_IN_PERMISSIONS['file.write.config'],
      BUILT_IN_PERMISSIONS['db.write.user_data'],
      BUILT_IN_PERMISSIONS['shell.execute.safe'],
      BUILT_IN_PERMISSIONS['secret.read.development'],
      BUILT_IN_PERMISSIONS['plugin.install'],
      BUILT_IN_PERMISSIONS['plugin.configure'],
    ],
    inheritsFrom: ['user'],
    constraints: {
      maxConcurrentSessions: 5,
      sessionTimeout: 14400, // 4 hours
      trustRequirements: {
        minimumTrust: 55,
        requiredDimensions: {
          competence: 50,
          integrity: 40,
        },
      },
      rateLimits: {
        actionsPerMinute: 60,
        actionsPerHour: 1000,
        actionsPerDay: 5000,
      },
    },
    metadata: {
      createdAt: new Date(),
      createdBy: 'system' as UUID,
      updatedAt: new Date(),
      updatedBy: 'system' as UUID,
      version: 1,
      approvalRequired: true,
      auditLevel: 'detailed',
    },
  },

  // Admin Role
  admin: {
    id: 'admin',
    name: 'Administrator',
    description: 'Administrative access with user management capabilities',
    level: RoleLevel.ADMIN,
    environments: ['development', 'staging', 'production'],
    permissions: [
      BUILT_IN_PERMISSIONS['file.delete.user_data'],
      BUILT_IN_PERMISSIONS['db.admin.schema'],
      BUILT_IN_PERMISSIONS['shell.execute.admin'],
      BUILT_IN_PERMISSIONS['user.admin.roles'],
      BUILT_IN_PERMISSIONS['financial.read.transactions'],
    ],
    inheritsFrom: ['developer'],
    constraints: {
      maxConcurrentSessions: 3,
      sessionTimeout: 10800, // 3 hours
      allowedIpRanges: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
      trustRequirements: {
        minimumTrust: 75,
        requiredDimensions: {
          reliability: 70,
          competence: 70,
          integrity: 80,
          transparency: 60,
        },
      },
      rateLimits: {
        actionsPerMinute: 100,
        actionsPerHour: 2000,
        actionsPerDay: 10000,
      },
    },
    metadata: {
      createdAt: new Date(),
      createdBy: 'system' as UUID,
      updatedAt: new Date(),
      updatedBy: 'system' as UUID,
      version: 1,
      approvalRequired: true,
      auditLevel: 'full',
    },
  },

  // Super Admin Role - Production Access
  super_admin: {
    id: 'super_admin',
    name: 'Super Administrator',
    description: 'Full system access including production environments',
    level: RoleLevel.SUPER_ADMIN,
    environments: ['production'],
    permissions: [
      BUILT_IN_PERMISSIONS['secret.read.production'],
      BUILT_IN_PERMISSIONS['financial.execute.payments'],
    ],
    inheritsFrom: ['admin'],
    constraints: {
      maxConcurrentSessions: 2,
      sessionTimeout: 7200, // 2 hours
      allowedIpRanges: ['10.0.0.0/8'], // Very restricted IP range
      timeRestrictions: [
        {
          allowedHours: [9, 10, 11, 12, 13, 14, 15, 16, 17], // Business hours only
          allowedDays: [1, 2, 3, 4, 5], // Weekdays only
          timezone: 'UTC',
        },
      ],
      trustRequirements: {
        minimumTrust: 90,
        requiredDimensions: {
          reliability: 85,
          competence: 85,
          integrity: 95,
          benevolence: 80,
          transparency: 80,
        },
      },
      rateLimits: {
        actionsPerMinute: 20,
        actionsPerHour: 500,
        actionsPerDay: 2000,
      },
    },
    metadata: {
      createdAt: new Date(),
      createdBy: 'system' as UUID,
      updatedAt: new Date(),
      updatedBy: 'system' as UUID,
      version: 1,
      approvalRequired: true,
      auditLevel: 'full',
    },
  },
};

/**
 * Environment-specific configurations
 */
export const ENVIRONMENT_CONFIGS: Record<Environment, EnvironmentRoleConfig> = {
  development: {
    environment: 'development',
    defaultRole: 'developer',
    autoEscalationEnabled: true,
    maxRoleLevel: RoleLevel.SUPER_ADMIN,
    trustRequirementMultiplier: 0.8, // Lower requirements for dev
    approvalRequired: false,
    auditLevel: 'basic',
    sessionTimeout: 28800, // 8 hours
    mfaRequired: false,
  },
  staging: {
    environment: 'staging',
    defaultRole: 'user',
    autoEscalationEnabled: true,
    maxRoleLevel: RoleLevel.ADMIN,
    trustRequirementMultiplier: 0.9,
    approvalRequired: true,
    auditLevel: 'detailed',
    sessionTimeout: 14400, // 4 hours
    mfaRequired: false,
  },
  production: {
    environment: 'production',
    defaultRole: 'user',
    autoEscalationEnabled: false,
    maxRoleLevel: RoleLevel.SUPER_ADMIN,
    trustRequirementMultiplier: 1.0,
    approvalRequired: true,
    auditLevel: 'full',
    sessionTimeout: 10800, // 3 hours
    mfaRequired: true,
    ipWhitelist: ['10.0.0.0/8', '172.16.0.0/12'],
    allowedTimeWindows: [
      {
        start: '08:00',
        end: '20:00',
        timezone: 'UTC',
      },
    ],
  },
  testing: {
    environment: 'testing',
    defaultRole: 'developer',
    autoEscalationEnabled: true,
    maxRoleLevel: RoleLevel.GOD_MODE,
    trustRequirementMultiplier: 0.5,
    approvalRequired: false,
    auditLevel: 'none',
    sessionTimeout: 7200,
    mfaRequired: false,
  },
  sandbox: {
    environment: 'sandbox',
    defaultRole: 'user',
    autoEscalationEnabled: true,
    maxRoleLevel: RoleLevel.DEVELOPER,
    trustRequirementMultiplier: 0.7,
    approvalRequired: false,
    auditLevel: 'basic',
    sessionTimeout: 14400,
    mfaRequired: false,
  },
  local: {
    environment: 'local',
    defaultRole: 'developer',
    autoEscalationEnabled: true,
    maxRoleLevel: RoleLevel.GOD_MODE,
    trustRequirementMultiplier: 0.0, // No trust requirements locally
    approvalRequired: false,
    auditLevel: 'none',
    sessionTimeout: 28800, // 8 hours
    mfaRequired: false,
  },
  demo: {
    environment: 'demo',
    defaultRole: 'guest',
    autoEscalationEnabled: false,
    maxRoleLevel: RoleLevel.USER,
    trustRequirementMultiplier: 1.2,
    approvalRequired: true,
    auditLevel: 'basic',
    sessionTimeout: 3600, // 1 hour
    mfaRequired: false,
  },
  experimental: {
    environment: 'experimental',
    defaultRole: 'developer',
    autoEscalationEnabled: true,
    maxRoleLevel: RoleLevel.ADMIN,
    trustRequirementMultiplier: 0.6,
    approvalRequired: false,
    auditLevel: 'detailed',
    sessionTimeout: 21600, // 6 hours
    mfaRequired: false,
  },
};
