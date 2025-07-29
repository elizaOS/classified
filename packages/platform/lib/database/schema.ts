/**
 * Database schema for ElizaOS Platform
 * Multi-tenant schema with Row Level Security (RLS)
 */

import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  integer,
  decimal,
  timestamp,
  boolean,
  jsonb,
  uuid,
  index,
  uniqueIndex,
  pgPolicy,
  pgRole,
  date,
} from 'drizzle-orm/pg-core';

// Organizations table - The root of multi-tenancy
export const organizations = pgTable(
  'organizations',
  {
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
    creditBalance: decimal('credit_balance', { precision: 10, scale: 6 })
      .notNull()
      .default('0'),
    creditThreshold: decimal('credit_threshold', { precision: 10, scale: 6 })
      .notNull()
      .default('10'), // Auto top-up threshold
    autoTopUpEnabled: boolean('auto_top_up_enabled').notNull().default(false),
    autoTopUpAmount: decimal('auto_top_up_amount', { precision: 10, scale: 6 })
      .notNull()
      .default('50'),

    // Settings
    settings: jsonb('settings')
      .$type<{
        allowedProviders?: string[];
        allowedModels?: string[];
        rateLimiting?: Record<string, number>;
        securitySettings?: Record<string, any>;
        branding?: Record<string, any>;
        notifications?: {
          lowBalance?: boolean;
          email?: boolean;
          weeklyReports?: boolean;
        };
      }>()
      .notNull()
      .default({}),

    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: index('organizations_slug_idx').on(table.slug),
    workosOrgIdx: index('organizations_workos_org_idx').on(
      table.workosOrganizationId,
    ),
    stripeCustomerIdx: index('organizations_stripe_customer_idx').on(
      table.stripeCustomerId,
    ),
  }),
);

// Users table with WorkOS integration
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),

    // WorkOS user data
    workosUserId: text('workos_user_id').unique(),
    email: text('email').notNull(),
    firstName: text('first_name'),
    lastName: text('last_name'),
    profilePictureUrl: text('profile_picture_url'),

    // Platform specific
    role: text('role').notNull().default('member'), // owner, admin, member, viewer
    isActive: boolean('is_active').notNull().default(true),
    emailVerified: boolean('email_verified').notNull().default(false),
    emailVerifiedAt: timestamp('email_verified_at'),

    // Preferences
    preferences: jsonb('preferences')
      .$type<{
        theme?: 'light' | 'dark' | 'system';
        notifications?: Record<string, boolean>;
        timezone?: string;
        language?: string;
      }>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('users_organization_id_idx').on(
      table.organizationId,
    ),
    emailIdx: index('users_email_idx').on(table.email),
    workosUserIdx: index('users_workos_user_idx').on(table.workosUserId),
    orgEmailUnique: uniqueIndex('users_org_email_unique').on(
      table.organizationId,
      table.email,
    ),
  }),
);

// User sessions for session management
export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    sessionToken: text('session_token').notNull().unique(),
    refreshToken: text('refresh_token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at').notNull(),
    lastActiveAt: timestamp('last_active_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('user_sessions_user_id_idx').on(table.userId),
    sessionTokenIdx: index('user_sessions_session_token_idx').on(
      table.sessionToken,
    ),
    refreshTokenIdx: index('user_sessions_refresh_token_idx').on(
      table.refreshToken,
    ),
  }),
);

// Anonymous sessions for onboarding flow
export const anonymousSessions = pgTable(
  'anonymous_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: text('session_id').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),

    // Session data
    chatHistory: jsonb('chat_history')
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

    workflowProgress: jsonb('workflow_progress')
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

    userPreferences: jsonb('user_preferences')
      .$type<{
        theme?: 'light' | 'dark' | 'system';
        language?: string;
        notifications?: boolean;
      }>()
      .notNull()
      .default({}),

    generatedContent: jsonb('generated_content')
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
      .default(sql`now() + interval '7 days'`),

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

// API Keys for programmatic access
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    keyHash: text('key_hash').notNull().unique(),
    keyPrefix: text('key_prefix').notNull(), // First 8 chars for display (e.g., "sk-proj-")

    // Permissions and limits
    permissions: jsonb('permissions').$type<string[]>().notNull().default([]), // ['agents:read', 'agents:write', 'billing:read']
    rateLimit: integer('rate_limit').notNull().default(100), // requests per minute

    isActive: boolean('is_active').notNull().default(true),
    expiresAt: timestamp('expires_at'),
    lastUsedAt: timestamp('last_used_at'),
    usageCount: integer('usage_count').notNull().default(0),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('api_keys_organization_id_idx').on(
      table.organizationId,
    ),
    keyHashIdx: index('api_keys_key_hash_idx').on(table.keyHash),
    userIdIdx: index('api_keys_user_id_idx').on(table.userId),
  }),
);

// Agents table
export const agents = pgTable(
  'agents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    createdByUserId: uuid('created_by_user_id')
      .references(() => users.id)
      .notNull(),

    name: text('name').notNull(),
    description: text('description'),
    slug: text('slug').notNull(), // URL-friendly name
    avatarUrl: text('avatar_url'),

    // Agent configuration
    character: jsonb('character').$type<Record<string, any>>().notNull(), // ElizaOS character JSON
    plugins: jsonb('plugins').$type<string[]>().notNull().default([]), // Plugin names

    // Runtime configuration
    runtimeConfig: jsonb('runtime_config')
      .$type<{
        models?: Record<string, string>; // model types -> specific models
        providers?: string[];
        maxTokens?: number;
        temperature?: number;
        environment?: Record<string, string>;
      }>()
      .notNull()
      .default({}),

    // Deployment status
    deploymentStatus: text('deployment_status').notNull().default('draft'), // draft, deploying, deployed, failed
    deploymentUrl: text('deployment_url'),
    deploymentError: text('deployment_error'),
    lastDeployedAt: timestamp('last_deployed_at'),
    runtimeAgentId: text('runtime_agent_id'), // ElizaOS runtime agent UUID

    // Visibility and sharing
    visibility: text('visibility').notNull().default('private'), // private, organization, public
    isPublished: boolean('is_published').notNull().default(false),

    // Analytics
    totalInteractions: integer('total_interactions').notNull().default(0),
    totalCost: decimal('total_cost', { precision: 10, scale: 6 })
      .notNull()
      .default('0'),

    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('agents_organization_id_idx').on(
      table.organizationId,
    ),
    createdByUserIdx: index('agents_created_by_user_idx').on(
      table.createdByUserId,
    ),
    orgSlugUnique: uniqueIndex('agents_org_slug_unique').on(
      table.organizationId,
      table.slug,
    ),
    deploymentStatusIdx: index('agents_deployment_status_idx').on(
      table.deploymentStatus,
    ),
    visibilityIdx: index('agents_visibility_idx').on(table.visibility),
  }),
);

// Plugin whitelist and management
export const plugins = pgTable(
  'plugins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    displayName: text('display_name').notNull(),
    description: text('description'),
    version: text('version').notNull(),
    author: text('author'),
    repositoryUrl: text('repository_url'),
    documentationUrl: text('documentation_url'),

    // Package information
    npmPackage: text('npm_package'),
    packageVersion: text('package_version'),

    // Security and approval
    isApproved: boolean('is_approved').notNull().default(false),
    isPublic: boolean('is_public').notNull().default(false),
    securityReviewStatus: text('security_review_status')
      .notNull()
      .default('pending'), // pending, approved, rejected
    securityReviewNotes: text('security_review_notes'),

    // Capabilities and requirements
    capabilities: jsonb('capabilities').$type<string[]>().notNull().default([]),
    requiredPermissions: jsonb('required_permissions')
      .$type<string[]>()
      .notNull()
      .default([]),
    dependencies: jsonb('dependencies').$type<string[]>().notNull().default([]),

    // Usage statistics
    installCount: integer('install_count').notNull().default(0),
    rating: decimal('rating', { precision: 3, scale: 2 }),

    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: index('plugins_name_idx').on(table.name),
    isApprovedIdx: index('plugins_is_approved_idx').on(table.isApproved),
    isPublicIdx: index('plugins_is_public_idx').on(table.isPublic),
  }),
);

// Organization plugin permissions
export const organizationPlugins = pgTable(
  'organization_plugins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    pluginId: uuid('plugin_id')
      .references(() => plugins.id, { onDelete: 'cascade' })
      .notNull(),

    isEnabled: boolean('is_enabled').notNull().default(true),
    configuration: jsonb('configuration')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),
    permissions: jsonb('permissions').$type<string[]>().notNull().default([]),

    installedByUserId: uuid('installed_by_user_id').references(() => users.id),
    installedAt: timestamp('installed_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('organization_plugins_organization_id_idx').on(
      table.organizationId,
    ),
    pluginIdIdx: index('organization_plugins_plugin_id_idx').on(table.pluginId),
    orgPluginUnique: uniqueIndex('organization_plugins_org_plugin_unique').on(
      table.organizationId,
      table.pluginId,
    ),
  }),
);

// File uploads and storage
export const uploads = pgTable(
  'uploads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    uploadedByUserId: uuid('uploaded_by_user_id')
      .references(() => users.id)
      .notNull(),

    filename: text('filename').notNull(),
    originalFilename: text('original_filename').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSize: integer('file_size').notNull(), // bytes

    // Storage information
    storageProvider: text('storage_provider').notNull().default('r2'), // r2, s3, local
    storagePath: text('storage_path').notNull(),
    storageUrl: text('storage_url'),

    // File metadata
    metadata: jsonb('metadata')
      .$type<{
        width?: number;
        height?: number;
        duration?: number;
        checksum?: string;
        thumbnailUrl?: string;
      }>()
      .notNull()
      .default({}),

    // Usage tracking
    downloadCount: integer('download_count').notNull().default(0),
    isPublic: boolean('is_public').notNull().default(false),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('uploads_organization_id_idx').on(
      table.organizationId,
    ),
    uploadedByUserIdx: index('uploads_uploaded_by_user_idx').on(
      table.uploadedByUserId,
    ),
    storagePathIdx: index('uploads_storage_path_idx').on(table.storagePath),
    mimeTypeIdx: index('uploads_mime_type_idx').on(table.mimeType),
  }),
);

// Billing and credit transactions
export const creditTransactions = pgTable(
  'credit_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id').references(() => users.id),

    type: text('type').notNull(), // purchase, usage, refund, adjustment, auto_topup
    amount: decimal('amount', { precision: 10, scale: 6 }).notNull(), // positive for credits added, negative for usage
    description: text('description').notNull(),

    // Payment information
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    stripeChargeId: text('stripe_charge_id'),
    cryptoTransactionHash: text('crypto_transaction_hash'),
    paymentMethod: text('payment_method'), // stripe, crypto, manual

    // Usage context (for debit transactions)
    agentId: uuid('agent_id').references(() => agents.id),
    usageRecordId: text('usage_record_id'), // Reference to API service usage records

    // Balance tracking
    balanceAfter: decimal('balance_after', {
      precision: 10,
      scale: 6,
    }).notNull(),

    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('credit_transactions_organization_id_idx').on(
      table.organizationId,
    ),
    typeIdx: index('credit_transactions_type_idx').on(table.type),
    createdAtIdx: index('credit_transactions_created_at_idx').on(
      table.createdAt,
    ),
    stripePaymentIntentIdx: index(
      'credit_transactions_stripe_payment_intent_idx',
    ).on(table.stripePaymentIntentId),
    agentIdIdx: index('credit_transactions_agent_id_idx').on(table.agentId),
  }),
);

// Audit logs for compliance and security
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id').references(() => users.id),

    action: text('action').notNull(), // create, update, delete, login, logout, deploy, etc.
    resource: text('resource').notNull(), // agent, user, api_key, plugin, etc.
    resourceId: uuid('resource_id'),

    // Request context
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    requestId: text('request_id'),

    // Changes (for update actions)
    oldValues: jsonb('old_values').$type<Record<string, any>>(),
    newValues: jsonb('new_values').$type<Record<string, any>>(),

    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('audit_logs_organization_id_idx').on(
      table.organizationId,
    ),
    userIdIdx: index('audit_logs_user_id_idx').on(table.userId),
    actionIdx: index('audit_logs_action_idx').on(table.action),
    resourceIdx: index('audit_logs_resource_idx').on(table.resource),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  }),
);

// Usage tracking for API calls and billing
export const usageRecords = pgTable(
  'usage_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    apiKeyId: uuid('api_key_id')
      .references(() => apiKeys.id, { onDelete: 'cascade' })
      .notNull(),

    // Provider and model information
    provider: text('provider').notNull(), // openai, anthropic, r2, etc.
    model: text('model').notNull(), // gpt-4o-mini, claude-3-sonnet, storage, etc.

    // Usage metrics
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),

    // Cost and billing
    cost: decimal('cost', { precision: 10, scale: 6 }).notNull(),
    duration: integer('duration').notNull(), // milliseconds

    // Status and error tracking
    success: boolean('success').notNull().default(true),
    errorMessage: text('error_message'),

    // Request context
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    requestId: text('request_id'),

    // Additional metadata
    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('usage_records_organization_id_idx').on(
      table.organizationId,
    ),
    apiKeyIdIdx: index('usage_records_api_key_id_idx').on(table.apiKeyId),
    providerIdx: index('usage_records_provider_idx').on(table.provider),
    createdAtIdx: index('usage_records_created_at_idx').on(table.createdAt),
    successIdx: index('usage_records_success_idx').on(table.success),
    // Composite index for common queries
    orgProviderDateIdx: index('usage_records_org_provider_date_idx').on(
      table.organizationId,
      table.provider,
      table.createdAt,
    ),
  }),
);

// Detailed inference logs for legal compliance and analytics
export const inferenceLogs = pgTable(
  'inference_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    agentId: uuid('agent_id').references(() => agents.id, {
      onDelete: 'cascade',
    }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    apiKeyId: uuid('api_key_id').references(() => apiKeys.id, {
      onDelete: 'cascade',
    }),

    // Request identification
    requestId: text('request_id').notNull().unique(),
    sessionId: text('session_id'),
    conversationId: uuid('conversation_id_ref').references(
      () => conversations.id,
      { onDelete: 'cascade' },
    ),

    // Provider and model details
    provider: text('provider').notNull(), // openai, anthropic, gemini, etc.
    model: text('model').notNull(), // gpt-4o-mini, claude-3-5-sonnet, etc.
    modelVersion: text('model_version'),
    endpoint: text('endpoint').notNull(), // /v1/chat/completions, /v1/messages, etc.

    // Full request context (for legal compliance)
    requestPayload: jsonb('request_payload')
      .$type<{
        messages?: any[];
        prompt?: string;
        system?: string;
        temperature?: number;
        max_tokens?: number;
        tools?: any[];
        [key: string]: any;
      }>()
      .notNull(),

    // Response data
    responsePayload: jsonb('response_payload').$type<{
      choices?: any[];
      content?: any[];
      message?: any;
      usage?: any;
      [key: string]: any;
    }>(),

    // Token usage
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    cachedTokens: integer('cached_tokens').notNull().default(0),

    // Cost breakdown
    baseCost: decimal('base_cost', { precision: 10, scale: 6 }).notNull(), // Provider's raw cost
    markupPercentage: decimal('markup_percentage', { precision: 5, scale: 2 })
      .notNull()
      .default('20.00'), // Our markup %
    markupAmount: decimal('markup_amount', { precision: 10, scale: 6 })
      .notNull()
      .default('0'), // Calculated markup
    totalCost: decimal('total_cost', { precision: 10, scale: 6 }).notNull(), // Final cost with markup

    // Performance metrics
    latency: integer('latency').notNull(), // Total request latency in ms
    timeToFirstToken: integer('time_to_first_token'), // TTFT in ms
    processingTime: integer('processing_time'), // Server processing time in ms
    queueTime: integer('queue_time'), // Time spent in queue in ms

    // Status and errors
    status: text('status').notNull().default('success'), // success, error, timeout, rate_limited
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    httpStatusCode: integer('http_status_code'),

    // Request source and context
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    referer: text('referer'),
    origin: text('origin'),

    // Content analysis (for analytics)
    contentType: text('content_type'), // chat, completion, embedding, image, etc.
    language: text('language'), // Detected language
    contentLength: integer('content_length'), // Character count of input
    responseLength: integer('response_length'), // Character count of output

    // Business context
    feature: text('feature'), // Which product feature used this
    workflowStep: text('workflow_step'), // Step in multi-step workflow
    retryAttempt: integer('retry_attempt').notNull().default(0),

    // Compliance and retention
    retentionPolicy: text('retention_policy').notNull().default('standard'), // standard, extended, minimal
    isPersonalData: boolean('is_personal_data').notNull().default(false),
    dataClassification: text('data_classification').notNull().default('public'), // public, internal, confidential, restricted

    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('inference_logs_organization_id_idx').on(
      table.organizationId,
    ),
    agentIdIdx: index('inference_logs_agent_id_idx').on(table.agentId),
    userIdIdx: index('inference_logs_user_id_idx').on(table.userId),
    providerIdx: index('inference_logs_provider_idx').on(table.provider),
    modelIdx: index('inference_logs_model_idx').on(table.model),
    statusIdx: index('inference_logs_status_idx').on(table.status),
    createdAtIdx: index('inference_logs_created_at_idx').on(table.createdAt),
    requestIdIdx: index('inference_logs_request_id_idx').on(table.requestId),
    // Composite indexes for analytics queries
    orgProviderModelDateIdx: index(
      'inference_logs_org_provider_model_date_idx',
    ).on(table.organizationId, table.provider, table.model, table.createdAt),
    orgDateStatusIdx: index('inference_logs_org_date_status_idx').on(
      table.organizationId,
      table.createdAt,
      table.status,
    ),
    providerModelIdx: index('inference_logs_provider_model_idx').on(
      table.provider,
      table.model,
    ),
  }),
);

// Platform fee configuration
export const platformConfig = pgTable(
  'platform_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),

    // Configuration key-value pairs
    configKey: text('config_key').notNull(),
    configValue: text('config_value'),
    configType: text('config_type').notNull().default('string'), // string, number, boolean, json

    // For markup/fee configuration
    numericValue: decimal('numeric_value', { precision: 10, scale: 6 }),
    booleanValue: boolean('boolean_value'),
    jsonValue: jsonb('json_value').$type<Record<string, any>>(),

    // Metadata
    description: text('description'),
    category: text('category').notNull().default('general'), // pricing, features, limits, etc.
    isEditable: boolean('is_editable').notNull().default(true),
    isPublic: boolean('is_public').notNull().default(false),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    configKeyIdx: index('platform_config_config_key_idx').on(table.configKey),
    organizationIdIdx: index('platform_config_organization_id_idx').on(
      table.organizationId,
    ),
    categoryIdx: index('platform_config_category_idx').on(table.category),
    // Unique constraint for global or per-org config
    orgKeyUnique: uniqueIndex('platform_config_org_key_unique').on(
      table.organizationId,
      table.configKey,
    ),
  }),
);

// Webhook endpoints for integrations
export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    createdByUserId: uuid('created_by_user_id')
      .references(() => users.id)
      .notNull(),

    name: text('name').notNull(),
    url: text('url').notNull(),
    secret: text('secret').notNull(),

    // Event configuration
    events: jsonb('events').$type<string[]>().notNull().default([]), // ['agent.deployed', 'user.created', etc.]
    isActive: boolean('is_active').notNull().default(true),

    // Delivery status
    lastDeliveryAt: timestamp('last_delivery_at'),
    lastDeliveryStatus: text('last_delivery_status'), // success, failed, pending
    failureCount: integer('failure_count').notNull().default(0),

    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('webhooks_organization_id_idx').on(
      table.organizationId,
    ),
    createdByUserIdx: index('webhooks_created_by_user_idx').on(
      table.createdByUserId,
    ),
    isActiveIdx: index('webhooks_is_active_idx').on(table.isActive),
  }),
);

// Conversations table - for chat sessions
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    agentId: uuid('agent_id')
      .references(() => agents.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    title: text('title'),
    participantIds: jsonb('participant_ids')
      .$type<string[]>()
      .notNull()
      .default([]),

    // Context and settings
    context: jsonb('context')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),
    settings: jsonb('settings')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    // Status
    isActive: boolean('is_active').notNull().default(true),
    lastMessageAt: timestamp('last_message_at'),
    messageCount: integer('message_count').notNull().default(0),

    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('conversations_organization_id_idx').on(
      table.organizationId,
    ),
    agentIdIdx: index('conversations_agent_id_idx').on(table.agentId),
    userIdIdx: index('conversations_user_id_idx').on(table.userId),
    isActiveIdx: index('conversations_is_active_idx').on(table.isActive),
    lastMessageAtIdx: index('conversations_last_message_at_idx').on(
      table.lastMessageAt,
    ),
  }),
);

// Messages table - individual messages in conversations
export const messages: any = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    conversationId: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    agentId: uuid('agent_id')
      .references(() => agents.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),

    // Message content
    content: jsonb('content')
      .$type<{
        text?: string;
        thought?: string;
        actions?: string[];
        providers?: string[];
        attachments?: Array<{
          type: string;
          url: string;
          name?: string;
          size?: number;
        }>;
        [key: string]: any;
      }>()
      .notNull(),

    // Message metadata
    role: text('role').notNull(), // 'user', 'agent', 'system'
    parentMessageId: uuid('parent_message_id').references(() => messages.id),
    embedding: text('embedding'), // Vector embedding as JSON string

    // Processing information
    tokenCount: integer('token_count').notNull().default(0),
    cost: decimal('cost', { precision: 10, scale: 6 }).notNull().default('0'),
    processingTime: integer('processing_time').notNull().default(0), // milliseconds

    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('messages_organization_id_idx').on(
      table.organizationId,
    ),
    conversationIdIdx: index('messages_conversation_id_idx').on(
      table.conversationId,
    ),
    agentIdIdx: index('messages_agent_id_idx').on(table.agentId),
    userIdIdx: index('messages_user_id_idx').on(table.userId),
    roleIdx: index('messages_role_idx').on(table.role),
    createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
    parentMessageIdIdx: index('messages_parent_message_id_idx').on(
      table.parentMessageId,
    ),
  }),
);

// Memories table - for long-term agent memory
export const memories = pgTable(
  'memories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    agentId: uuid('agent_id')
      .references(() => agents.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'cascade',
    }),

    // Memory content
    content: jsonb('content')
      .$type<{
        text?: string;
        thought?: string;
        actions?: string[];
        providers?: string[];
        source?: string;
        inReplyTo?: string;
        attachments?: any[];
        [key: string]: any;
      }>()
      .notNull(),

    // Vector search
    embedding: text('embedding'), // Vector embedding as JSON string
    similarity: decimal('similarity', { precision: 5, scale: 4 }),

    // Memory type and importance
    type: text('type').notNull().default('conversation'), // conversation, fact, preference, skill
    importance: integer('importance').notNull().default(5), // 1-10 scale
    isUnique: boolean('is_unique').notNull().default(false),

    // Context
    roomId: text('room_id'), // ElizaOS room identifier
    worldId: text('world_id'), // ElizaOS world identifier
    entityId: text('entity_id'), // Associated entity

    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('memories_organization_id_idx').on(
      table.organizationId,
    ),
    agentIdIdx: index('memories_agent_id_idx').on(table.agentId),
    userIdIdx: index('memories_user_id_idx').on(table.userId),
    conversationIdIdx: index('memories_conversation_id_idx').on(
      table.conversationId,
    ),
    typeIdx: index('memories_type_idx').on(table.type),
    importanceIdx: index('memories_importance_idx').on(table.importance),
    roomIdIdx: index('memories_room_id_idx').on(table.roomId),
    entityIdIdx: index('memories_entity_id_idx').on(table.entityId),
    createdAtIdx: index('memories_created_at_idx').on(table.createdAt),
  }),
);

// Entities table - for named entities and relationships
export const entities = pgTable(
  'entities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    agentId: uuid('agent_id')
      .references(() => agents.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),

    // Entity information
    name: text('name').notNull(),
    names: jsonb('names').$type<string[]>().notNull().default([]), // Alternative names
    type: text('type').notNull().default('person'), // person, place, thing, concept

    // Entity data
    components: jsonb('components')
      .$type<
        Array<{
          type: string;
          data: Record<string, any>;
        }>
      >()
      .notNull()
      .default([]),

    // Relationships and context
    relationshipSummary: text('relationship_summary'),
    lastInteractionAt: timestamp('last_interaction_at'),
    interactionCount: integer('interaction_count').notNull().default(0),

    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('entities_organization_id_idx').on(
      table.organizationId,
    ),
    agentIdIdx: index('entities_agent_id_idx').on(table.agentId),
    userIdIdx: index('entities_user_id_idx').on(table.userId),
    nameIdx: index('entities_name_idx').on(table.name),
    typeIdx: index('entities_type_idx').on(table.type),
    lastInteractionAtIdx: index('entities_last_interaction_at_idx').on(
      table.lastInteractionAt,
    ),
    // Unique constraint on agent + name to prevent duplicates
    agentNameUnique: uniqueIndex('entities_agent_name_unique').on(
      table.agentId,
      table.name,
    ),
  }),
);

// Agent tasks table - for scheduled and recurring tasks
export const agentTasks = pgTable(
  'agent_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    agentId: uuid('agent_id')
      .references(() => agents.id, { onDelete: 'cascade' })
      .notNull(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),

    // Task information
    name: text('name').notNull(),
    description: text('description'),
    type: text('type').notNull(), // scheduled, recurring, one_time

    // Task configuration
    roomId: text('room_id'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),

    // Execution settings
    scheduledFor: timestamp('scheduled_for'),
    recurringInterval: integer('recurring_interval'), // seconds
    maxRetries: integer('max_retries').notNull().default(3),
    retryCount: integer('retry_count').notNull().default(0),

    // Status
    status: text('status').notNull().default('pending'), // pending, running, completed, failed, cancelled
    lastExecutedAt: timestamp('last_executed_at'),
    nextExecutionAt: timestamp('next_execution_at'),
    completedAt: timestamp('completed_at'),

    // Results
    result: jsonb('result').$type<Record<string, any>>(),
    errorMessage: text('error_message'),

    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('agent_tasks_organization_id_idx').on(
      table.organizationId,
    ),
    agentIdIdx: index('agent_tasks_agent_id_idx').on(table.agentId),
    statusIdx: index('agent_tasks_status_idx').on(table.status),
    scheduledForIdx: index('agent_tasks_scheduled_for_idx').on(
      table.scheduledFor,
    ),
    nextExecutionAtIdx: index('agent_tasks_next_execution_at_idx').on(
      table.nextExecutionAt,
    ),
    roomIdIdx: index('agent_tasks_room_id_idx').on(table.roomId),
  }),
);

// Device authorization codes for OAuth 2.0 Device Flow
export const deviceCodes = pgTable(
  'device_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // OAuth 2.0 Device Flow fields
    deviceCode: text('device_code').notNull().unique(),
    userCode: text('user_code').notNull().unique(),
    clientId: text('client_id').notNull(),
    scope: text('scope').notNull(),

    // Timing and expiration
    expiresAt: timestamp('expires_at').notNull(),
    interval: integer('interval').notNull().default(5), // Polling interval in seconds

    // Authorization status
    isAuthorized: boolean('is_authorized').notNull().default(false),
    authorizedAt: timestamp('authorized_at'),
    authorizedByUserId: uuid('authorized_by_user_id').references(
      () => users.id,
    ),

    // Access token (stored when authorization completes)
    accessToken: text('access_token'),

    // Metadata
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    deviceCodeIdx: index('device_codes_device_code_idx').on(table.deviceCode),
    userCodeIdx: index('device_codes_user_code_idx').on(table.userCode),
    clientIdIdx: index('device_codes_client_id_idx').on(table.clientId),
    expiresAtIdx: index('device_codes_expires_at_idx').on(table.expiresAt),
    isAuthorizedIdx: index('device_codes_is_authorized_idx').on(
      table.isAuthorized,
    ),
  }),
);

// Rate limiting storage for production use
export const rateLimits = pgTable(
  'rate_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Rate limiting key (IP + endpoint combination)
    limitKey: text('limit_key').notNull().unique(),

    // Counters and timing
    requestCount: integer('request_count').notNull().default(1),
    windowStart: timestamp('window_start').notNull().defaultNow(),
    windowEnd: timestamp('window_end').notNull(),

    // Configuration
    maxRequests: integer('max_requests').notNull(),
    windowDuration: integer('window_duration').notNull(), // seconds

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    limitKeyIdx: index('rate_limits_limit_key_idx').on(table.limitKey),
    windowEndIdx: index('rate_limits_window_end_idx').on(table.windowEnd),
  }),
);

// OAuth 2.0 Client Configurations for configurable client management
export const oauthClients = pgTable(
  'oauth_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),

    // Client identification
    clientId: text('client_id').notNull().unique(),
    clientSecret: text('client_secret'), // For confidential clients
    clientName: text('client_name').notNull(),
    clientDescription: text('client_description'),

    // Client type and configuration
    clientType: text('client_type').notNull().default('public'), // public, confidential
    grantTypes: jsonb('grant_types')
      .$type<string[]>()
      .notNull()
      .default(['authorization_code', 'device_code']),
    scopes: jsonb('scopes')
      .$type<string[]>()
      .notNull()
      .default(['read', 'write']),

    // Redirect URIs for authorization code flow
    redirectUris: jsonb('redirect_uris')
      .$type<string[]>()
      .notNull()
      .default([]),

    // Client metadata
    logoUrl: text('logo_url'),
    homepageUrl: text('homepage_url'),
    termsUrl: text('terms_url'),
    privacyUrl: text('privacy_url'),

    // Security settings
    isActive: boolean('is_active').notNull().default(true),
    isTrusted: boolean('is_trusted').notNull().default(false), // Skip consent for trusted clients
    allowedOrigins: jsonb('allowed_origins')
      .$type<string[]>()
      .notNull()
      .default([]),

    // Usage tracking
    lastUsedAt: timestamp('last_used_at'),
    usageCount: integer('usage_count').notNull().default(0),

    // Access token settings
    accessTokenTtl: integer('access_token_ttl').notNull().default(3600), // seconds
    refreshTokenTtl: integer('refresh_token_ttl').notNull().default(86400), // seconds

    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    clientIdIdx: index('oauth_clients_client_id_idx').on(table.clientId),
    organizationIdIdx: index('oauth_clients_organization_id_idx').on(
      table.organizationId,
    ),
    isActiveIdx: index('oauth_clients_is_active_idx').on(table.isActive),
    clientTypeIdx: index('oauth_clients_client_type_idx').on(table.clientType),
  }),
);

// Type exports for TypeScript
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

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

export type UsageRecord = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;

export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;

export type AgentTask = typeof agentTasks.$inferSelect;
export type NewAgentTask = typeof agentTasks.$inferInsert;

export type DeviceCode = typeof deviceCodes.$inferSelect;
export type NewDeviceCode = typeof deviceCodes.$inferInsert;

export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;

export type OAuthClient = typeof oauthClients.$inferSelect;
export type NewOAuthClient = typeof oauthClients.$inferInsert;

export type InferenceLog = typeof inferenceLogs.$inferSelect;
export type NewInferenceLog = typeof inferenceLogs.$inferInsert;

export type PlatformConfig = typeof platformConfig.$inferSelect;
export type NewPlatformConfig = typeof platformConfig.$inferInsert;

export type AnonymousSession = typeof anonymousSessions.$inferSelect;
export type NewAnonymousSession = typeof anonymousSessions.$inferInsert;

// Crypto payment tracking
export const cryptoPayments = pgTable(
  'crypto_payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    // Payment details
    walletAddress: text('wallet_address').notNull(),
    tokenAddress: text('token_address').notNull(),
    tokenSymbol: text('token_symbol').notNull(),
    amountCrypto: text('amount_crypto').notNull(), // BigNumber as string
    amountUsd: decimal('amount_usd', { precision: 10, scale: 2 }).notNull(),
    amountCredits: integer('amount_credits').notNull(),
    chainId: integer('chain_id').notNull(),

    // Transaction tracking
    transactionHash: text('transaction_hash'),
    blockNumber: integer('block_number'),
    blockConfirmations: integer('block_confirmations').default(0),

    // Status and timing
    status: text('status').notNull(), // pending, confirmed, failed, expired
    createdAt: timestamp('created_at').notNull().defaultNow(),
    confirmedAt: timestamp('confirmed_at'),
    expiresAt: timestamp('expires_at').notNull(),

    // Additional metadata
    walletType: text('wallet_type'), // metamask, walletconnect, etc
    slippageTolerance: decimal('slippage_tolerance', {
      precision: 3,
      scale: 1,
    }),
    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),
  },
  (table) => ({
    organizationIdIdx: index('crypto_payments_organization_id_idx').on(
      table.organizationId,
    ),
    userIdIdx: index('crypto_payments_user_id_idx').on(table.userId),
    walletAddressIdx: index('crypto_payments_wallet_address_idx').on(
      table.walletAddress,
    ),
    statusIdx: index('crypto_payments_status_idx').on(table.status),
    transactionHashIdx: index('crypto_payments_transaction_hash_idx').on(
      table.transactionHash,
    ),
    chainIdIdx: index('crypto_payments_chain_id_idx').on(table.chainId),
    createdAtIdx: index('crypto_payments_created_at_idx').on(table.createdAt),
    expiresAtIdx: index('crypto_payments_expires_at_idx').on(table.expiresAt),
  }),
);

// Wallet connections for user authentication
export const walletConnections = pgTable(
  'wallet_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),

    // Wallet details
    walletAddress: text('wallet_address').notNull(),
    chainId: integer('chain_id').notNull(),
    walletType: text('wallet_type').notNull(), // metamask, walletconnect, coinbase, rainbow

    // Authentication data
    signatureMessage: text('signature_message').notNull(),
    signature: text('signature').notNull(),
    nonce: text('nonce').notNull(),

    // Status and tracking
    isActive: boolean('is_active').notNull().default(true),
    isVerified: boolean('is_verified').notNull().default(false),
    lastUsedAt: timestamp('last_used_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),

    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),
  },
  (table) => ({
    userIdIdx: index('wallet_connections_user_id_idx').on(table.userId),
    organizationIdIdx: index('wallet_connections_organization_id_idx').on(
      table.organizationId,
    ),
    walletAddressIdx: index('wallet_connections_wallet_address_idx').on(
      table.walletAddress,
    ),
    chainIdIdx: index('wallet_connections_chain_id_idx').on(table.chainId),
    isActiveIdx: index('wallet_connections_is_active_idx').on(table.isActive),
    // Unique constraint to prevent duplicate wallet connections per user
    userWalletUnique: uniqueIndex('wallet_connections_user_wallet_unique').on(
      table.userId,
      table.walletAddress,
      table.chainId,
    ),
  }),
);

// Generation requests tracking
export const generations = pgTable(
  'generations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    projectId: uuid('project_id'), // Optional project grouping

    // Generation request details
    type: text('type').notNull(), // image, video, audio, text, music, three_d, avatar, code, document
    provider: text('provider').notNull(), // openai, anthropic, fal, google_veo, etc
    model: text('model'), // specific model used
    prompt: text('prompt').notNull(),

    // Request parameters
    parameters: jsonb('parameters')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    // Processing status
    status: text('status').notNull(), // queued, processing, completed, failed, cancelled
    queuedAt: timestamp('queued_at').notNull().defaultNow(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),

    // Results and outputs
    outputs: jsonb('outputs')
      .$type<
        Array<{
          id: string;
          url: string;
          format: string;
          metadata?: Record<string, any>;
        }>
      >()
      .default([]),

    // Cost and billing
    estimatedCost: decimal('estimated_cost', { precision: 10, scale: 6 }),
    actualCost: decimal('actual_cost', { precision: 10, scale: 6 }),
    creditsUsed: integer('credits_used'),

    // Performance metrics
    processingTime: integer('processing_time'), // milliseconds
    queueTime: integer('queue_time'), // milliseconds

    // Error handling
    error: text('error'),
    retryCount: integer('retry_count').notNull().default(0),
    maxRetries: integer('max_retries').notNull().default(3),

    // Request context
    idempotencyKey: text('idempotency_key').notNull(),
    callbackUrl: text('callback_url'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),

    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('generations_organization_id_idx').on(
      table.organizationId,
    ),
    userIdIdx: index('generations_user_id_idx').on(table.userId),
    projectIdIdx: index('generations_project_id_idx').on(table.projectId),
    typeIdx: index('generations_type_idx').on(table.type),
    providerIdx: index('generations_provider_idx').on(table.provider),
    statusIdx: index('generations_status_idx').on(table.status),
    idempotencyKeyIdx: index('generations_idempotency_key_idx').on(
      table.idempotencyKey,
    ),
    createdAtIdx: index('generations_created_at_idx').on(table.createdAt),
    queuedAtIdx: index('generations_queued_at_idx').on(table.queuedAt),
    // Composite indexes for common queries
    orgTypeProviderIdx: index('generations_org_type_provider_idx').on(
      table.organizationId,
      table.type,
      table.provider,
    ),
    statusQueuedIdx: index('generations_status_queued_idx').on(
      table.status,
      table.queuedAt,
    ),
  }),
);

// Batch generation tracking
export const batchGenerations = pgTable(
  'batch_generations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    // Batch details
    name: text('name').notNull(),
    description: text('description'),

    // Status tracking
    status: text('status').notNull(), // pending, processing, completed, failed, cancelled
    totalGenerations: integer('total_generations').notNull(),
    completedGenerations: integer('completed_generations').notNull().default(0),
    failedGenerations: integer('failed_generations').notNull().default(0),

    // Progress tracking
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    estimatedCompletionAt: timestamp('estimated_completion_at'),

    // Configuration
    batchConfig: jsonb('batch_config')
      .$type<{
        concurrency?: number;
        retryPolicy?: Record<string, any>;
        priority?: number;
      }>()
      .notNull()
      .default({}),

    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('batch_generations_organization_id_idx').on(
      table.organizationId,
    ),
    userIdIdx: index('batch_generations_user_id_idx').on(table.userId),
    statusIdx: index('batch_generations_status_idx').on(table.status),
    createdAtIdx: index('batch_generations_created_at_idx').on(table.createdAt),
  }),
);

// Provider performance metrics for optimization
export const providerMetrics = pgTable(
  'provider_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Provider and model details
    provider: text('provider').notNull(),
    model: text('model'),
    type: text('type').notNull(), // image, video, audio, text, etc

    // Time period for aggregation
    date: date('date').notNull(),
    hour: integer('hour'), // 0-23 for hourly metrics

    // Performance metrics
    totalRequests: integer('total_requests').notNull().default(0),
    successfulRequests: integer('successful_requests').notNull().default(0),
    failedRequests: integer('failed_requests').notNull().default(0),
    cancelledRequests: integer('cancelled_requests').notNull().default(0),

    // Timing metrics
    averageProcessingTime: integer('average_processing_time').default(0), // milliseconds
    p95ProcessingTime: integer('p95_processing_time').default(0),
    averageQueueTime: integer('average_queue_time').default(0),

    // Cost metrics
    totalCost: decimal('total_cost', { precision: 10, scale: 6 }).default('0'),
    averageCost: decimal('average_cost', { precision: 10, scale: 6 }).default(
      '0',
    ),

    // Quality metrics (if available)
    qualityScore: decimal('quality_score', { precision: 3, scale: 2 }).default(
      '0',
    ), // 0-10 scale
    userSatisfactionScore: decimal('user_satisfaction_score', {
      precision: 3,
      scale: 2,
    }).default('0'),

    // Error analysis
    errorTypes: jsonb('error_types')
      .$type<Record<string, number>>()
      .default({}),

    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    providerIdx: index('provider_metrics_provider_idx').on(table.provider),
    typeIdx: index('provider_metrics_type_idx').on(table.type),
    dateIdx: index('provider_metrics_date_idx').on(table.date),
    hourIdx: index('provider_metrics_hour_idx').on(table.hour),
    // Unique constraint for aggregation periods
    providerDateHourUnique: uniqueIndex(
      'provider_metrics_provider_date_hour_unique',
    ).on(table.provider, table.type, table.date, table.hour),
    providerDateUnique: uniqueIndex('provider_metrics_provider_date_unique').on(
      table.provider,
      table.type,
      table.date,
    ),
  }),
);

// Generation queue management
export const generationQueue = pgTable(
  'generation_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Queue item details
    generationId: uuid('generation_id')
      .references(() => generations.id, { onDelete: 'cascade' })
      .notNull(),
    queueName: text('queue_name').notNull(), // image-queue, video-queue, etc

    // Priority and scheduling
    priority: integer('priority').notNull().default(0), // Higher numbers = higher priority
    scheduledFor: timestamp('scheduled_for').notNull().defaultNow(),

    // Processing status
    status: text('status').notNull().default('pending'), // pending, processing, completed, failed
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),

    // Worker assignment
    workerId: text('worker_id'), // Which worker is processing this
    claimedAt: timestamp('claimed_at'),

    // Error tracking
    lastError: text('last_error'),
    lastAttemptAt: timestamp('last_attempt_at'),

    metadata: jsonb('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    generationIdIdx: index('generation_queue_generation_id_idx').on(
      table.generationId,
    ),
    queueNameIdx: index('generation_queue_queue_name_idx').on(table.queueName),
    statusIdx: index('generation_queue_status_idx').on(table.status),
    priorityIdx: index('generation_queue_priority_idx').on(table.priority),
    scheduledForIdx: index('generation_queue_scheduled_for_idx').on(
      table.scheduledFor,
    ),
    workerIdIdx: index('generation_queue_worker_id_idx').on(table.workerId),
    // Composite index for queue processing
    queueStatusPriorityIdx: index(
      'generation_queue_queue_status_priority_idx',
    ).on(table.queueName, table.status, table.priority, table.scheduledFor),
  }),
);

export type CryptoPayment = typeof cryptoPayments.$inferSelect;
export type NewCryptoPayment = typeof cryptoPayments.$inferInsert;

export type WalletConnection = typeof walletConnections.$inferSelect;
export type NewWalletConnection = typeof walletConnections.$inferInsert;

export type Generation = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;

export type BatchGeneration = typeof batchGenerations.$inferSelect;
export type NewBatchGeneration = typeof batchGenerations.$inferInsert;

export type ProviderMetric = typeof providerMetrics.$inferSelect;
export type NewProviderMetric = typeof providerMetrics.$inferInsert;

export type GenerationQueueItem = typeof generationQueue.$inferSelect;
export type NewGenerationQueueItem = typeof generationQueue.$inferInsert;
