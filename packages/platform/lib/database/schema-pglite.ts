/**
 * PGlite-compatible database schema for ElizaOS Platform
 * PostgreSQL schema optimized for embedded PGlite usage
 */

import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  integer,
  real,
  json,
  boolean,
  timestamp,
  uuid,
  index,
  decimal,
} from 'drizzle-orm/pg-core';

// Organizations table - The root of multi-tenancy
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  domain: text('domain'), // Custom domain for white-labeling
  logoUrl: text('logo_url'),
  subscriptionTier: text('subscription_tier').notNull().default('free'), // free, pro, enterprise
  subscriptionStatus: text('subscription_status').notNull().default('active'), // active, cancelled, past_due
  maxUsers: integer('max_users').notNull().default(5),
  maxAgents: integer('max_agents').notNull().default(3),
  maxApiRequests: integer('max_api_requests').notNull().default(10000),
  maxTokensPerRequest: integer('max_tokens_per_request')
    .notNull()
    .default(4096),
  maxStorageGB: integer('max_storage_gb').notNull().default(1),

  // WorkOS integration
  workosOrganizationId: text('workos_organization_id').unique(),

  // Billing
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  billingEmail: text('billing_email'),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),

  // Credits system
  creditBalance: decimal('credit_balance', { precision: 10, scale: 2 })
    .notNull()
    .default('0'),
  creditThreshold: decimal('credit_threshold', { precision: 10, scale: 2 })
    .notNull()
    .default('10'),
  autoTopUpEnabled: boolean('auto_top_up_enabled').notNull().default(false),
  autoTopUpAmount: decimal('auto_top_up_amount', { precision: 10, scale: 2 })
    .notNull()
    .default('50'),

  // Settings (JSON)
  settings: json('settings')
    .$type<{
      allowedProviders?: string[];
      allowedModels?: string[];
      rateLimiting?: Record<string, number>;
      securitySettings?: Record<string, any>;
      branding?: Record<string, any>;
    }>()
    .notNull()
    .default({}),

  metadata: json('metadata').$type<Record<string, any>>().notNull().default({}),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Users table - Members of organizations
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    // WorkOS user data
    workosUserId: text('workos_user_id').unique(),
    email: text('email').notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    profilePictureUrl: text('profile_picture_url'),

    // Email verification
    emailVerified: boolean('email_verified').notNull().default(false),
    emailVerifiedAt: timestamp('email_verified_at'),

    // Platform-specific data
    role: text('role').notNull().default('member'), // owner, admin, member, viewer
    isActive: boolean('is_active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at'),

    // Preferences
    preferences: json('preferences')
      .$type<{
        theme?: 'light' | 'dark';
        notifications?: Record<string, boolean>;
        defaultModel?: string;
      }>()
      .notNull()
      .default({}),

    metadata: json('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
    orgUserIdx: index('users_org_user_idx').on(
      table.organizationId,
      table.email,
    ),
  }),
);

// User sessions table
export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    sessionToken: text('session_token').notNull().unique(),
    refreshToken: text('refresh_token').notNull().unique(),

    expiresAt: timestamp('expires_at').notNull(),
    lastActiveAt: timestamp('last_active_at').notNull().defaultNow(),

    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    sessionTokenIdx: index('user_sessions_session_token_idx').on(
      table.sessionToken,
    ),
    refreshTokenIdx: index('user_sessions_refresh_token_idx').on(
      table.refreshToken,
    ),
    userIdIdx: index('user_sessions_user_id_idx').on(table.userId),
  }),
);

// API Keys table
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    description: text('description'),
    keyHash: text('key_hash').notNull(), // Bcrypt hash of the API key
    keyPrefix: text('key_prefix').notNull(), // First 8 chars for display

    permissions: json('permissions').$type<string[]>().notNull().default([]),
    rateLimit: integer('rate_limit').notNull().default(100), // requests per minute

    isActive: boolean('is_active').notNull().default(true),
    expiresAt: timestamp('expires_at'),
    lastUsedAt: timestamp('last_used_at'),
    usageCount: integer('usage_count').notNull().default(0),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    keyPrefixIdx: index('api_keys_key_prefix_idx').on(table.keyPrefix),
    orgKeysIdx: index('api_keys_org_keys_idx').on(table.organizationId),
  }),
);

// Anonymous Sessions table for visitor sessions
export const anonymousSessions = pgTable(
  'anonymous_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: text('session_id').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),

    // Session data (stored as JSON)
    chatHistory: json('chat_history')
      .$type<
        {
          id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          timestamp: Date;
          metadata?: Record<string, any>;
        }[]
      >()
      .notNull()
      .default([]),

    workflowProgress: json('workflow_progress')
      .$type<{
        currentStep: string;
        workflowType: string | null;
        requirements: Record<string, any>;
        generatedAssets: any[];
        customizations: any[];
      }>()
      .notNull()
      .default({
        currentStep: 'discovery',
        workflowType: null,
        requirements: {},
        generatedAssets: [],
        customizations: [],
      }),

    userPreferences: json('user_preferences')
      .$type<{
        theme?: 'light' | 'dark' | 'system';
        language?: string;
        notifications?: boolean;
      }>()
      .notNull()
      .default({}),

    generatedContent: json('generated_content')
      .$type<
        {
          type: 'n8n_workflow' | 'mcp' | 'agent_config';
          name: string;
          description: string;
          data: any;
          preview?: string;
          downloadUrl?: string;
          createdAt: Date;
        }[]
      >()
      .notNull()
      .default([]),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    lastActivity: timestamp('last_activity').notNull().defaultNow(),
    expiresAt: timestamp('expires_at')
      .notNull()
      .default(sql`NOW() + INTERVAL '7 days'`),

    // Migration tracking
    migratedToUserId: uuid('migrated_to_user_id').references(() => users.id),
    migratedAt: timestamp('migrated_at'),
  },
  (table) => ({
    sessionIdIdx: index('anonymous_sessions_session_id_idx').on(
      table.sessionId,
    ),
    expiresAtIdx: index('anonymous_sessions_expires_at_idx').on(
      table.expiresAt,
    ),
    lastActivityIdx: index('anonymous_sessions_last_activity_idx').on(
      table.lastActivity,
    ),
  }),
);

// Agents table
export const agents = pgTable(
  'agents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    type: text('type').notNull().default('agent'), // 'agent' or 'character'
    avatarUrl: text('avatar_url'),
    characterConfig: json('character_config')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),
    plugins: json('plugins').$type<string[]>().notNull().default([]),
    runtimeConfig: json('runtime_config')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),
    visibility: text('visibility').notNull().default('private'), // 'private', 'organization', 'public'
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    orgSlugIdx: index('agents_org_slug_idx').on(
      table.organizationId,
      table.slug,
    ),
    typeIdx: index('agents_type_idx').on(table.type),
    visibilityIdx: index('agents_visibility_idx').on(table.visibility),
  }),
);

// Character conversations table for tracking chat sessions
export const characterConversations = pgTable(
  'character_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    characterId: uuid('character_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title'),
    messages: json('messages')
      .$type<
        {
          id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          timestamp: number;
          metadata?: Record<string, any>;
        }[]
      >()
      .notNull()
      .default([]),
    metadata: json('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    characterUserIdx: index('character_conversations_character_user_idx').on(
      table.characterId,
      table.userId,
    ),
    createdAtIdx: index('character_conversations_created_at_idx').on(
      table.createdAt,
    ),
  }),
);

export const plugins = pgTable('plugins', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  version: text('version').notNull(),
  description: text('description'),
  isPublic: boolean('is_public').notNull().default(false),
  configSchema: json('config_schema')
    .$type<Record<string, any>>()
    .notNull()
    .default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const organizationPlugins = pgTable(
  'organization_plugins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    pluginId: uuid('plugin_id')
      .notNull()
      .references(() => plugins.id, { onDelete: 'cascade' }),
    config: json('config').$type<Record<string, any>>().notNull().default({}),
    isEnabled: boolean('is_enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    orgPluginIdx: index('organization_plugins_org_plugin_idx').on(
      table.organizationId,
      table.pluginId,
    ),
  }),
);

export const uploads = pgTable('uploads', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  path: text('path').notNull(),
  url: text('url').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const creditTransactions = pgTable('credit_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  type: text('type').notNull(), // 'purchase', 'usage', 'refund'
  description: text('description'),
  metadata: json('metadata').$type<Record<string, any>>().notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    resource: text('resource').notNull(),
    resourceId: text('resource_id'),
    metadata: json('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    orgActionIdx: index('audit_logs_org_action_idx').on(
      table.organizationId,
      table.action,
    ),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  }),
);

export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  events: json('events').$type<string[]>().notNull().default([]),
  secret: text('secret').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const usageRecords = pgTable(
  'usage_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    agentId: uuid('agent_id').references(() => agents.id, {
      onDelete: 'set null',
    }),
    resource: text('resource').notNull(), // 'api_call', 'tokens', 'storage'
    amount: decimal('amount', { precision: 10, scale: 4 }).notNull(),
    cost: decimal('cost', { precision: 10, scale: 4 }).notNull(),
    metadata: json('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    orgResourceIdx: index('usage_records_org_resource_idx').on(
      table.organizationId,
      table.resource,
    ),
    createdAtIdx: index('usage_records_created_at_idx').on(table.createdAt),
  }),
);

// OAuth Clients table for configurable OAuth client management
export const oauthClients = pgTable(
  'oauth_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),

    clientId: text('client_id').notNull().unique(),
    clientSecret: text('client_secret'), // Only for confidential clients
    clientName: text('client_name').notNull(),
    clientDescription: text('client_description'),
    clientType: text('client_type').notNull().default('public'), // 'public' or 'confidential'

    grantTypes: json('grant_types')
      .$type<string[]>()
      .notNull()
      .default(['authorization_code']),
    scopes: json('scopes').$type<string[]>().notNull().default(['read']),
    redirectUris: json('redirect_uris').$type<string[]>().notNull().default([]),
    allowedOrigins: json('allowed_origins')
      .$type<string[]>()
      .notNull()
      .default([]),

    isActive: boolean('is_active').notNull().default(true),
    isTrusted: boolean('is_trusted').notNull().default(false),

    // Usage tracking
    lastUsedAt: timestamp('last_used_at'),
    usageCount: integer('usage_count').notNull().default(0),

    metadata: json('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    clientIdIdx: index('oauth_clients_client_id_idx').on(table.clientId),
    orgClientIdx: index('oauth_clients_org_client_idx').on(
      table.organizationId,
    ),
  }),
);

// Autocoder tables for compatibility
export const autocoderProjects = pgTable('autocoder_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(),
  specification: json('specification').$type<Record<string, any>>(),
  buildResult: json('build_result').$type<Record<string, any>>(),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const autocoderBuilds = pgTable('autocoder_builds', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => autocoderProjects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  specification: json('specification').$type<Record<string, any>>().notNull(),
  result: json('result').$type<Record<string, any>>(),
  status: text('status').notNull().default('queued'),
  error: text('error'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const autocoderBuildLogs = pgTable('autocoder_build_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => autocoderProjects.id, { onDelete: 'cascade' }),
  buildId: uuid('build_id')
    .notNull()
    .references(() => autocoderBuilds.id, { onDelete: 'cascade' }),
  level: text('level').notNull(),
  message: text('message').notNull(),
  source: text('source').notNull().default('system'),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});

// Type definitions
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type AnonymousSession = typeof anonymousSessions.$inferSelect;
export type NewAnonymousSession = typeof anonymousSessions.$inferInsert;

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

export type CharacterConversation = typeof characterConversations.$inferSelect;
export type NewCharacterConversation =
  typeof characterConversations.$inferInsert;

export type Plugin = typeof plugins.$inferSelect;
export type NewPlugin = typeof plugins.$inferInsert;

export type OrganizationPlugin = typeof organizationPlugins.$inferSelect;
export type NewOrganizationPlugin = typeof organizationPlugins.$inferInsert;

export type Upload = typeof uploads.$inferSelect;
export type NewUpload = typeof uploads.$inferInsert;

export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type NewCreditTransaction = typeof creditTransactions.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;

export type UsageRecord = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;

export type AutocoderProject = typeof autocoderProjects.$inferSelect;
export type NewAutocoderProject = typeof autocoderProjects.$inferInsert;

export type AutocoderBuild = typeof autocoderBuilds.$inferSelect;
export type NewAutocoderBuild = typeof autocoderBuilds.$inferInsert;

export type AutocoderBuildLog = typeof autocoderBuildLogs.$inferSelect;
export type NewAutocoderBuildLog = typeof autocoderBuildLogs.$inferInsert;

export type OAuthClient = typeof oauthClients.$inferSelect;
export type NewOAuthClient = typeof oauthClients.$inferInsert;

// Re-export schema object for compatibility
export const schema = {
  organizations,
  users,
  userSessions,
  apiKeys,
  anonymousSessions,
  agents,
  characterConversations,
  plugins,
  organizationPlugins,
  uploads,
  creditTransactions,
  auditLogs,
  webhooks,
  usageRecords,
  oauthClients,
  autocoderProjects,
  autocoderBuilds,
  autocoderBuildLogs,
};
