/**
 * Database schema for API service
 */

import { sql as _sql } from 'drizzle-orm';
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
} from 'drizzle-orm/pg-core';

// Type definitions for jsonb fields
export type OrganizationSettings = {
  webhookUrl?: string;
  customHeaders?: Record<string, string>;
  rateLimit?: number;
  allowedIps?: string[];
  [key: string]: unknown;
};

export type UsageMetadata = {
  endpoint?: string;
  userAgent?: string;
  ip?: string;
  duration?: number;
  userId?: string;
  apiKeyId?: string;
  requestId?: string;
  processingTime?: number;
  [key: string]: unknown;
};

export type ProviderHealthMetadata = {
  region?: string;
  version?: string;
  features?: string[];
  lastResponseTime?: number;
  [key: string]: unknown;
};

// Organizations table
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  subscriptionTier: text('subscription_tier').notNull().default('free'),
  maxApiRequests: integer('max_api_requests').notNull().default(1000),
  maxTokensPerRequest: integer('max_tokens_per_request')
    .notNull()
    .default(4096),
  allowedModels: jsonb('allowed_models')
    .$type<string[]>()
    .notNull()
    .default([]),
  allowedProviders: jsonb('allowed_providers')
    .$type<string[]>()
    .notNull()
    .default([]),
  settings: jsonb('settings')
    .$type<OrganizationSettings>()
    .notNull()
    .default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Users table
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id)
      .notNull(),
    email: text('email').notNull().unique(),
    name: text('name'),
    role: text('role').notNull().default('member'),
    isActive: boolean('is_active').notNull().default(true),
    lastSeenAt: timestamp('last_seen_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('users_organization_id_idx').on(
      table.organizationId
    ),
    emailIdx: index('users_email_idx').on(table.email),
  })
);

// API Keys table
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id)
      .notNull(),
    userId: uuid('user_id').references(() => users.id),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull().unique(), // Hashed version of the key
    keyPrefix: text('key_prefix').notNull(), // First 8 chars for display
    permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
    isActive: boolean('is_active').notNull().default(true),
    expiresAt: timestamp('expires_at'),
    lastUsedAt: timestamp('last_used_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('api_keys_organization_id_idx').on(
      table.organizationId
    ),
    keyHashIdx: index('api_keys_key_hash_idx').on(table.keyHash),
  })
);

// Usage records table
export const usageRecords = pgTable(
  'usage_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id)
      .notNull(),
    userId: uuid('user_id').references(() => users.id),
    apiKeyId: uuid('api_key_id').references(() => apiKeys.id),
    requestId: text('request_id').notNull(),
    model: text('model').notNull(),
    provider: text('provider').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    inputCost: decimal('input_cost', { precision: 10, scale: 6 })
      .notNull()
      .default('0'),
    outputCost: decimal('output_cost', { precision: 10, scale: 6 })
      .notNull()
      .default('0'),
    totalCost: decimal('total_cost', { precision: 10, scale: 6 })
      .notNull()
      .default('0'),
    markup: decimal('markup', { precision: 10, scale: 6 })
      .notNull()
      .default('0'),
    finalCost: decimal('final_cost', { precision: 10, scale: 6 })
      .notNull()
      .default('0'),
    processingTime: integer('processing_time'), // milliseconds
    isSuccessful: boolean('is_successful').notNull().default(true),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').$type<UsageMetadata>().notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    organizationIdIdx: index('usage_records_organization_id_idx').on(
      table.organizationId
    ),
    modelIdx: index('usage_records_model_idx').on(table.model),
    providerIdx: index('usage_records_provider_idx').on(table.provider),
    createdAtIdx: index('usage_records_created_at_idx').on(table.createdAt),
    requestIdIdx: index('usage_records_request_id_idx').on(table.requestId),
  })
);

// Model pricing table (for real-time pricing updates)
export const modelPricing = pgTable(
  'model_pricing',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    modelId: text('model_id').notNull(),
    inputCostPerToken: decimal('input_cost_per_token', {
      precision: 12,
      scale: 8,
    }).notNull(),
    outputCostPerToken: decimal('output_cost_per_token', {
      precision: 12,
      scale: 8,
    }).notNull(),
    currency: text('currency').notNull().default('USD'),
    effectiveDate: timestamp('effective_date').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    sourceUrl: text('source_url'),
    lastUpdated: timestamp('last_updated').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    providerModelIdx: index('model_pricing_provider_model_idx').on(
      table.provider,
      table.modelId
    ),
    effectiveDateIdx: index('model_pricing_effective_date_idx').on(
      table.effectiveDate
    ),
  })
);

// Rate limiting table (Redis alternative for simple setups)
export const rateLimits = pgTable(
  'rate_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: text('identifier').notNull(), // user_id, org_id, api_key_id, or IP
    type: text('type').notNull(), // 'user', 'organization', 'api_key', 'ip'
    windowStart: timestamp('window_start').notNull(),
    windowEnd: timestamp('window_end').notNull(),
    requestCount: integer('request_count').notNull().default(0),
    tokenCount: integer('token_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    identifierTypeIdx: index('rate_limits_identifier_type_idx').on(
      table.identifier,
      table.type
    ),
    windowEndIdx: index('rate_limits_window_end_idx').on(table.windowEnd),
  })
);

// Provider health status
export const providerHealth = pgTable(
  'provider_health',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    isHealthy: boolean('is_healthy').notNull().default(true),
    lastChecked: timestamp('last_checked').notNull().defaultNow(),
    errorRate: decimal('error_rate', { precision: 5, scale: 4 })
      .notNull()
      .default('0'),
    averageLatency: integer('average_latency'), // milliseconds
    lastError: text('last_error'),
    metadata: jsonb('metadata')
      .$type<ProviderHealthMetadata>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    providerIdx: index('provider_health_provider_idx').on(table.provider),
    lastCheckedIdx: index('provider_health_last_checked_idx').on(
      table.lastChecked
    ),
  })
);

// Type exports for TypeScript
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type UsageRecord = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;

export type ModelPricing = typeof modelPricing.$inferSelect;
export type NewModelPricing = typeof modelPricing.$inferInsert;

export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;

export type ProviderHealth = typeof providerHealth.$inferSelect;
export type NewProviderHealth = typeof providerHealth.$inferInsert;
