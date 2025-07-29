/**
 * Core types for the ElizaOS Platform
 */

import type {
  User as WorkOSUser,
  Organization as WorkOSOrganization,
} from '@workos-inc/node';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  metadata: Record<string, any>;

  // WorkOS specific
  workosUserId?: string;
  workosOrganizationId?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  subscriptionTier: SubscriptionTier;
  maxAgents: number;
  maxUsers: number;
  maxApiRequests: number;
  settings: OrganizationSettings;
  createdAt: Date;
  updatedAt: Date;

  // WorkOS specific
  workosOrganizationId: string;
}

export interface OrganizationSettings {
  allowCustomDomains: boolean;
  ssoRequired: boolean;
  maxStorageGB: number;
  features: string[];
  webhookUrl?: string;
  logoUrl?: string;
}

export type SubscriptionTier = 'free' | 'pro' | 'premium' | 'enterprise';

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: MemberRole;
  permissions: string[];
  invitedAt: Date;
  joinedAt?: Date;
  invitedBy: string;
}

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface ApiKey {
  id: string;
  name: string;
  keyHash: string;
  prefix: string;
  userId: string;
  organizationId?: string;
  permissions: ApiKeyPermission[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  isActive: boolean;
  metadata: Record<string, any>;
}

export interface ApiKeyPermission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  workosSessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  createdAt: Date;
  isActive: boolean;
}

export interface BillingAccount {
  id: string;
  organizationId: string;
  stripeCustomerId: string;
  subscriptionId?: string;
  paymentMethodId?: string;
  billingEmail: string;
  taxId?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Usage {
  id: string;
  organizationId: string;
  userId?: string;
  apiKeyId?: string;
  resource: string;
  action: string;
  provider?: string;
  model?: string;
  tokens?: number;
  cost: number;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface WorkOSConfig {
  apiKey: string;
  clientId: string;
  redirectUri: string;
  environment: 'staging' | 'production';
}

export interface StripeConfig {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  priceIds: {
    basic: string;
    pro: string;
    premium: string;
    enterprise: string;
  };
}

export interface PlatformConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  jwtSecret: string;
  workos: WorkOSConfig;
  stripe: StripeConfig;
  database: {
    url: string;
    maxConnections: number;
  };
  redis: {
    url: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  organization?: Organization;
  session?: Session;
  apiKey?: ApiKey;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface CreateUserRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  metadata?: Record<string, any>;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  metadata?: Record<string, any>;
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  domain?: string;
  subscriptionTier?: SubscriptionTier;
  settings?: Partial<OrganizationSettings>;
}

export interface UpdateOrganizationRequest {
  name?: string;
  domain?: string;
  settings?: Partial<OrganizationSettings>;
}

export interface CreateApiKeyRequest {
  name: string;
  permissions: ApiKeyPermission[];
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface InviteMemberRequest {
  email: string;
  role: MemberRole;
  permissions?: string[];
}

export interface UpdateMemberRequest {
  role?: MemberRole;
  permissions?: string[];
}

// WorkOS webhook event types
export interface WorkOSWebhookEvent {
  id: string;
  event: string;
  data: {
    object: any;
  };
  created_at: string;
}

// Stripe webhook event types
export interface StripeWebhookEvent {
  id: string;
  object: string;
  type: string;
  data: {
    object: any;
  };
  created: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface AuthorizationCodeExchange {
  code: string;
  state?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// API Key types
export interface ApiKeyResponse {
  id: string;
  name: string;
  key?: string; // Only returned on creation
  keyPreview: string;
  permissions: ApiKeyPermission[];
  organizationId?: string;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

// Auth types
export interface LoginRequest {
  email?: string;
  password?: string;
  organizationId?: string;
  redirectUri?: string;
}

export interface LoginResponse {
  authUrl?: string;
  state?: string;
  user?: User;
  organization?: Organization;
  accessToken?: string;
  expiresAt?: string;
}

// Billing types
export interface SubscriptionResponse {
  id: string;
  organizationId: string;
  tier: SubscriptionTier;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  features: string[];
  usage: {
    apiCalls: number;
    storage: number;
    users: number;
  };
}

export interface CreateSubscriptionRequest {
  priceId: string;
  paymentMethodId?: string;
}

export interface UpdateSubscriptionRequest {
  priceId?: string;
  cancelAtPeriodEnd?: boolean;
}
