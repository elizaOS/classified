/**
 * Marketplace Database Schema
 *
 * Comprehensive schema for UGC marketplace supporting:
 * - Asset registry (MCPs, Agents, Workflows)
 * - Container hosting and billing
 * - Revenue sharing and creator payouts
 * - Discovery and social features
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
} from 'drizzle-orm/pg-core';
import { organizations, users } from './schema';

// Asset Categories
export type AssetType = 'mcp' | 'agent' | 'workflow' | 'plugin';
export type AssetStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'rejected'
  | 'archived';
export type VisibilityType = 'public' | 'private' | 'unlisted';
export type PricingModel = 'free' | 'one_time' | 'usage_based' | 'subscription';

// Core Asset Registry
export const marketplaceAssets = pgTable(
  'marketplace_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    creatorId: uuid('creator_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    // Asset Identity
    name: text('name').notNull(),
    slug: text('slug').notNull(), // URL-friendly identifier
    description: text('description').notNull(),
    longDescription: text('long_description'),

    // Asset Type and Configuration
    assetType: text('asset_type').$type<AssetType>().notNull(),
    category: text('category').notNull(), // e.g., 'productivity', 'finance', 'development'
    tags: text('tags').array().notNull().default([]),

    // Technical Configuration
    configuration: jsonb('configuration')
      .$type<{
        // MCP Configuration
        mcpConfig?: {
          entrypoint: string;
          capabilities: string[];
          dependencies: Record<string, string>;
          environment: Record<string, string>;
        };

        // Agent Configuration
        agentConfig?: {
          character: any; // Character object
          plugins: string[];
          defaultSettings: Record<string, any>;
        };

        // Workflow Configuration
        workflowConfig?: {
          nodes: any[];
          edges: any[];
          triggers: any[];
          actions: any[];
        };

        // Container Configuration
        containerConfig?: {
          image: string;
          ports: number[];
          memory: number; // MB
          cpu: number; // CPU units
          environment: Record<string, string>;
        };
      }>()
      .notNull(),

    // Publishing and Discovery
    status: text('status').$type<AssetStatus>().notNull().default('draft'),
    visibility: text('visibility')
      .$type<VisibilityType>()
      .notNull()
      .default('private'),

    // Pricing and Monetization
    pricingModel: text('pricing_model')
      .$type<PricingModel>()
      .notNull()
      .default('free'),
    basePrice: decimal('base_price', { precision: 10, scale: 2 }).default(
      '0.00',
    ), // One-time price
    usagePrice: decimal('usage_price', { precision: 10, scale: 6 }).default(
      '0.000000',
    ), // Per-usage price
    subscriptionPrice: decimal('subscription_price', {
      precision: 10,
      scale: 2,
    }).default('0.00'), // Monthly subscription
    currency: text('currency').notNull().default('USD'),

    // Content and Media
    icon: text('icon'), // Icon URL
    images: text('images').array().default([]), // Screenshot URLs
    readme: text('readme'), // Markdown documentation
    changelog: text('changelog'), // Version history

    // Repository and Source
    repositoryUrl: text('repository_url'),
    sourceArchiveUrl: text('source_archive_url'), // Uploaded source code

    // Metrics and Social
    installCount: integer('install_count').notNull().default(0),
    usageCount: integer('usage_count').notNull().default(0),
    favoriteCount: integer('favorite_count').notNull().default(0),
    rating: decimal('rating', { precision: 3, scale: 2 }).default('0.00'), // Average rating
    ratingCount: integer('rating_count').notNull().default(0),

    // Version Management
    version: text('version').notNull().default('1.0.0'),
    latestVersionId: uuid('latest_version_id'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    publishedAt: timestamp('published_at'),
    lastUsedAt: timestamp('last_used_at'),
  },
  (table) => ({
    slugIndex: uniqueIndex('marketplace_assets_slug_idx').on(table.slug),
    creatorIndex: index('marketplace_assets_creator_idx').on(table.creatorId),
    categoryIndex: index('marketplace_assets_category_idx').on(table.category),
    statusIndex: index('marketplace_assets_status_idx').on(table.status),
    typeIndex: index('marketplace_assets_type_idx').on(table.assetType),
  }),
);

// Asset Versions for Version Control
export const assetVersions = pgTable(
  'asset_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assetId: uuid('asset_id')
      .references(() => marketplaceAssets.id, { onDelete: 'cascade' })
      .notNull(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),

    version: text('version').notNull(), // Semantic version
    changelog: text('changelog'),
    configuration: jsonb('configuration').notNull(),
    sourceArchiveUrl: text('source_archive_url'),

    // Container Deployment Info
    containerImageUrl: text('container_image_url'),
    deploymentStatus: text('deployment_status').default('pending'), // pending, building, deployed, failed
    deploymentId: text('deployment_id'), // e2b deployment ID

    isActive: boolean('is_active').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    assetVersionIndex: index('asset_versions_asset_idx').on(table.assetId),
    activeIndex: index('asset_versions_active_idx').on(table.isActive),
  }),
);

// Container Hosting and Billing
export const hostedContainers = pgTable(
  'hosted_containers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    assetId: uuid('asset_id')
      .references(() => marketplaceAssets.id, { onDelete: 'cascade' })
      .notNull(),
    versionId: uuid('version_id')
      .references(() => assetVersions.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    // Hosting Configuration
    containerName: text('container_name').notNull(),
    e2bDeploymentId: text('e2b_deployment_id').notNull(),
    endpoint: text('endpoint'), // Public URL
    internalEndpoint: text('internal_endpoint'), // Private URL

    // Resource Allocation
    memory: integer('memory').notNull(), // MB
    cpu: integer('cpu').notNull(), // CPU units
    storage: integer('storage').notNull(), // GB

    // Status and Health
    status: text('status').notNull().default('pending'), // pending, starting, running, stopping, stopped, failed
    healthStatus: text('health_status').default('unknown'), // healthy, unhealthy, unknown
    lastHealthCheck: timestamp('last_health_check'),

    // Billing
    baseCostPerHour: decimal('base_cost_per_hour', {
      precision: 10,
      scale: 6,
    }).notNull(),
    markupPercentage: decimal('markup_percentage', { precision: 5, scale: 2 })
      .notNull()
      .default('20.00'),
    billedCostPerHour: decimal('billed_cost_per_hour', {
      precision: 10,
      scale: 6,
    }).notNull(),

    // Lifecycle
    startedAt: timestamp('started_at'),
    stoppedAt: timestamp('stopped_at'),
    lastBillingAt: timestamp('last_billing_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    deploymentIndex: uniqueIndex('hosted_containers_deployment_idx').on(
      table.e2bDeploymentId,
    ),
    userIndex: index('hosted_containers_user_idx').on(table.userId),
    statusIndex: index('hosted_containers_status_idx').on(table.status),
  }),
);

// Usage Tracking and Billing
export const assetUsageRecords = pgTable(
  'asset_usage_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    assetId: uuid('asset_id')
      .references(() => marketplaceAssets.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    containerId: uuid('container_id').references(() => hostedContainers.id, {
      onDelete: 'set null',
    }),

    // Usage Metrics
    usageType: text('usage_type').notNull(), // 'api_call', 'container_hour', 'execution', 'storage'
    quantity: decimal('quantity', { precision: 15, scale: 6 }).notNull(), // Amount used
    unit: text('unit').notNull(), // 'calls', 'hours', 'executions', 'gb_hours'

    // Billing
    unitCost: decimal('unit_cost', { precision: 10, scale: 6 }).notNull(), // Cost per unit
    totalCost: decimal('total_cost', { precision: 10, scale: 2 }).notNull(), // Total cost for this usage
    creatorRevenue: decimal('creator_revenue', {
      precision: 10,
      scale: 2,
    }).notNull(), // 50% to creator
    platformRevenue: decimal('platform_revenue', {
      precision: 10,
      scale: 2,
    }).notNull(), // 50% to platform

    // Metadata
    metadata: jsonb('metadata').$type<{
      source?: string; // Where usage originated
      sessionId?: string;
      requestId?: string;
      userAgent?: string;
      ipAddress?: string;
    }>(),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    assetUserIndex: index('asset_usage_asset_user_idx').on(
      table.assetId,
      table.userId,
    ),
    userDateIndex: index('asset_usage_user_date_idx').on(
      table.userId,
      table.createdAt,
    ),
    assetDateIndex: index('asset_usage_asset_date_idx').on(
      table.assetId,
      table.createdAt,
    ),
  }),
);

// Creator Payouts and Revenue Sharing
export const creatorPayouts = pgTable(
  'creator_payouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    creatorId: uuid('creator_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    // Payout Period
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),

    // Revenue Breakdown
    totalRevenue: decimal('total_revenue', {
      precision: 12,
      scale: 2,
    }).notNull(),
    creatorShare: decimal('creator_share', {
      precision: 12,
      scale: 2,
    }).notNull(), // 50%
    platformFee: decimal('platform_fee', { precision: 12, scale: 2 }).notNull(), // 50%

    // Payout Details
    payoutMethod: text('payout_method').notNull(), // 'stripe', 'crypto_wallet', 'bank_transfer'
    payoutAddress: text('payout_address'), // Stripe account, wallet address, etc.

    // Status
    status: text('status').notNull().default('pending'), // pending, processing, completed, failed
    processedAt: timestamp('processed_at'),
    failureReason: text('failure_reason'),

    // External References
    stripeTransferId: text('stripe_transfer_id'),
    cryptoTransactionId: text('crypto_transaction_id'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    creatorPeriodIndex: index('creator_payouts_creator_period_idx').on(
      table.creatorId,
      table.periodStart,
    ),
    statusIndex: index('creator_payouts_status_idx').on(table.status),
  }),
);

// Asset Reviews and Ratings
export const assetReviews = pgTable(
  'asset_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    assetId: uuid('asset_id')
      .references(() => marketplaceAssets.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    rating: integer('rating').notNull(), // 1-5 stars
    title: text('title'),
    review: text('review'),

    // Moderation
    isVerifiedPurchase: boolean('is_verified_purchase')
      .notNull()
      .default(false),
    isHidden: boolean('is_hidden').notNull().default(false),
    moderationReason: text('moderation_reason'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    assetIndex: index('asset_reviews_asset_idx').on(table.assetId),
    userAssetIndex: uniqueIndex('asset_reviews_user_asset_idx').on(
      table.userId,
      table.assetId,
    ),
  }),
);

// User Favorites and Collections
export const userFavorites = pgTable(
  'user_favorites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    assetId: uuid('asset_id')
      .references(() => marketplaceAssets.id, { onDelete: 'cascade' })
      .notNull(),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userAssetIndex: uniqueIndex('user_favorites_user_asset_idx').on(
      table.userId,
      table.assetId,
    ),
    assetIndex: index('user_favorites_asset_idx').on(table.assetId),
  }),
);

// Asset Installations and Subscriptions
export const assetInstallations = pgTable(
  'asset_installations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    assetId: uuid('asset_id')
      .references(() => marketplaceAssets.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    versionId: uuid('version_id')
      .references(() => assetVersions.id, { onDelete: 'cascade' })
      .notNull(),

    // Purchase Info
    purchaseType: text('purchase_type').notNull(), // 'free', 'one_time', 'subscription'
    purchasePrice: decimal('purchase_price', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    currency: text('currency').notNull().default('USD'),

    // Subscription Info (if applicable)
    subscriptionStatus: text('subscription_status'), // 'active', 'cancelled', 'expired'
    subscriptionEndsAt: timestamp('subscription_ends_at'),

    // Installation Status
    isActive: boolean('is_active').notNull().default(true),
    installationConfig: jsonb('installation_config'),

    // Payment References
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    cryptoTransactionId: text('crypto_transaction_id'),

    installedAt: timestamp('installed_at').notNull().defaultNow(),
    uninstalledAt: timestamp('uninstalled_at'),
  },
  (table) => ({
    userAssetIndex: index('asset_installations_user_asset_idx').on(
      table.userId,
      table.assetId,
    ),
    assetIndex: index('asset_installations_asset_idx').on(table.assetId),
    activeIndex: index('asset_installations_active_idx').on(table.isActive),
  }),
);

// Creator Profile and KYC Information
export const creatorProfiles = pgTable(
  'creator_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .references(() => organizations.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    // Public Profile
    displayName: text('display_name').notNull(),
    bio: text('bio'),
    website: text('website'),
    githubUsername: text('github_username'),
    twitterUsername: text('twitter_username'),
    avatarUrl: text('avatar_url'),

    // Creator Stats
    totalEarnings: decimal('total_earnings', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    totalAssets: integer('total_assets').notNull().default(0),
    totalInstalls: integer('total_installs').notNull().default(0),
    averageRating: decimal('average_rating', {
      precision: 3,
      scale: 2,
    }).default('0.00'),

    // Payout Configuration
    payoutMethod: text('payout_method'), // 'stripe', 'crypto', 'bank'
    stripeAccountId: text('stripe_account_id'),
    cryptoWalletAddress: text('crypto_wallet_address'),
    cryptoWalletType: text('crypto_wallet_type'), // 'ethereum', 'bitcoin', etc.

    // KYC and Verification
    isVerified: boolean('is_verified').notNull().default(false),
    kycStatus: text('kyc_status').default('pending'), // pending, approved, rejected
    kycVerifiedAt: timestamp('kyc_verified_at'),

    // Tax Information
    taxId: text('tax_id'), // Encrypted SSN/EIN
    w9Submitted: boolean('w9_submitted').notNull().default(false),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIndex: uniqueIndex('creator_profiles_user_idx').on(table.userId),
    verifiedIndex: index('creator_profiles_verified_idx').on(table.isVerified),
  }),
);

// Re-export users from main schema for convenience
export { users } from './schema';
