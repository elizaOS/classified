/**
 * Revenue Sharing Service
 * Manages marketplace creator earnings, revenue splits, and payouts
 */

import { getDatabase } from '@/lib/database';
import {
  assetUsageRecords,
  creatorPayouts,
  marketplaceAssets,
} from '@/lib/database/marketplace-schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export interface RevenueShare {
  creatorShare: number; // Percentage (0-100)
  platformShare: number; // Percentage (0-100)
}

export interface CreatorEarnings {
  totalEarnings: number;
  pendingPayout: number;
  paidOut: number;
  transactions: number;
  lastPayout?: Date;
}

export interface PayoutRequest {
  amount: number;
  method: 'bank_transfer' | 'paypal' | 'crypto';
  details: Record<string, any>;
}

export interface TransactionSummary {
  period: string;
  revenue: number;
  transactions: number;
  averageTransaction: number;
}

export class RevenueShareService {
  private readonly DEFAULT_CREATOR_SHARE = 80; // 80% to creator
  private readonly DEFAULT_PLATFORM_SHARE = 20; // 20% to platform
  private readonly MINIMUM_PAYOUT = 10; // $10 minimum payout

  /**
   * Get revenue share configuration
   */
  getRevenueShare(assetType?: string): RevenueShare {
    // Could vary by asset type in the future
    return {
      creatorShare: this.DEFAULT_CREATOR_SHARE,
      platformShare: this.DEFAULT_PLATFORM_SHARE,
    };
  }

  /**
   * Record a marketplace transaction
   */
  async recordTransaction(
    assetId: string,
    buyerId: string,
    amount: number,
    transactionType: 'purchase' | 'subscription' | 'usage',
  ) {
    const db = await getDatabase();

    // Get asset to find creator
    const [asset] = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.id, assetId))
      .limit(1);

    if (!asset) {
      throw new Error('Asset not found');
    }

    const revenueShare = this.getRevenueShare(asset.assetType);
    const creatorRevenue = (amount * revenueShare.creatorShare) / 100;
    const platformRevenue = (amount * revenueShare.platformShare) / 100;

    const usageRecord = {
      organizationId: asset.organizationId,
      assetId,
      userId: buyerId,
      usageType:
        transactionType === 'purchase'
          ? 'api_call'
          : transactionType === 'subscription'
            ? 'container_hour'
            : 'execution',
      quantity: 1,
      unit:
        transactionType === 'purchase'
          ? 'calls'
          : transactionType === 'subscription'
            ? 'hours'
            : 'executions',
      unitCost: amount,
      totalCost: amount,
      creatorRevenue,
      platformRevenue,
      metadata: {
        transactionType,
      },
    };

    const [created] = await db
      .insert(assetUsageRecords)
      .values(usageRecord)
      .returning();

    logger.info('Recorded marketplace transaction', {
      recordId: created.id,
      assetId,
      amount,
      creatorRevenue,
      platformRevenue,
    });

    return created;
  }

  /**
   * Get creator earnings summary
   */
  async getCreatorEarnings(creatorId: string): Promise<CreatorEarnings> {
    const db = await getDatabase();

    // Get total earnings from usage records
    const creatorAssets = await db
      .select({ id: marketplaceAssets.id })
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.creatorId, creatorId));

    const assetIds = creatorAssets.map((a) => a.id);

    if (assetIds.length === 0) {
      return {
        totalEarnings: 0,
        pendingPayout: 0,
        paidOut: 0,
        transactions: 0,
      };
    }

    // Get total earnings from usage records
    const [earnings] = await db
      .select({
        totalEarnings: sql<number>`COALESCE(SUM(${assetUsageRecords.creatorRevenue}), 0)`,
        transactions: sql<number>`COUNT(*)::int`,
      })
      .from(assetUsageRecords)
      .where(sql`${assetUsageRecords.assetId} = ANY(${assetIds})`);

    // Get paid out amount
    const [payouts] = await db
      .select({
        paidOut: sql<number>`COALESCE(SUM(${creatorPayouts.creatorShare}), 0)`,
        lastPayout: sql<Date>`MAX(${creatorPayouts.createdAt})`,
      })
      .from(creatorPayouts)
      .where(
        and(
          eq(creatorPayouts.creatorId, creatorId),
          eq(creatorPayouts.status, 'completed'),
        ),
      );

    const pendingPayout = earnings.totalEarnings - payouts.paidOut;

    return {
      totalEarnings: earnings.totalEarnings,
      pendingPayout,
      paidOut: payouts.paidOut,
      transactions: earnings.transactions,
      lastPayout: payouts.lastPayout,
    };
  }

  /**
   * Request a payout
   */
  async requestPayout(creatorId: string, request: PayoutRequest) {
    const db = await getDatabase();

    // Check pending balance
    const earnings = await this.getCreatorEarnings(creatorId);

    if (earnings.pendingPayout < request.amount) {
      throw new Error('Insufficient balance for payout');
    }

    if (request.amount < this.MINIMUM_PAYOUT) {
      throw new Error(`Minimum payout amount is $${this.MINIMUM_PAYOUT}`);
    }

    // Get organization ID from creator's first asset
    const [creatorAsset] = await db
      .select({ organizationId: marketplaceAssets.organizationId })
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.creatorId, creatorId))
      .limit(1);

    if (!creatorAsset) {
      throw new Error('Creator has no assets');
    }

    const now = new Date();
    const payout = {
      organizationId: creatorAsset.organizationId,
      creatorId,
      periodStart: new Date(now.getFullYear(), now.getMonth(), 1), // Start of month
      periodEnd: now,
      totalRevenue: request.amount,
      creatorShare: request.amount,
      platformFee: 0, // Platform fee already deducted in usage records
      payoutMethod: request.method,
      payoutAddress: request.details.address || '',
      status: 'pending' as const,
    };

    const [created] = await db
      .insert(creatorPayouts)
      .values(payout)
      .returning();

    logger.info('Created payout request', {
      payoutId: created.id,
      creatorId,
      amount: request.amount,
      method: request.method,
    });

    // In a real implementation, this would trigger the actual payout process
    // For now, simulate processing
    setTimeout(() => {
      this.processPayout(created.id);
    }, 5000);

    return created;
  }

  /**
   * Get transaction history for a creator
   */
  async getTransactionHistory(
    creatorId: string,
    startDate?: Date,
    endDate?: Date,
    limit = 100,
  ) {
    const db = await getDatabase();

    // Get creator's assets
    const creatorAssets = await db
      .select({ id: marketplaceAssets.id })
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.creatorId, creatorId));

    const assetIds = creatorAssets.map((a) => a.id);

    if (assetIds.length === 0) {
      return [];
    }

    const conditions = [sql`${assetUsageRecords.assetId} = ANY(${assetIds})`];

    if (startDate) {
      conditions.push(gte(assetUsageRecords.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(assetUsageRecords.createdAt, endDate));
    }

    const transactions = await db
      .select({
        usage: assetUsageRecords,
        asset: marketplaceAssets,
      })
      .from(assetUsageRecords)
      .innerJoin(
        marketplaceAssets,
        eq(assetUsageRecords.assetId, marketplaceAssets.id),
      )
      .where(and(...conditions))
      .orderBy(desc(assetUsageRecords.createdAt))
      .limit(limit);

    return transactions;
  }

  /**
   * Get revenue analytics for a creator
   */
  async getRevenueAnalytics(
    creatorId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'monthly',
  ): Promise<TransactionSummary[]> {
    const db = await getDatabase();

    // Get creator's assets
    const creatorAssets = await db
      .select({ id: marketplaceAssets.id })
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.creatorId, creatorId));

    const assetIds = creatorAssets.map((a) => a.id);

    if (assetIds.length === 0) {
      return [];
    }

    // Determine date format based on period
    const dateFormat = {
      daily: '%Y-%m-%d',
      weekly: '%Y-%W',
      monthly: '%Y-%m',
    }[period];

    const results = await db
      .select({
        period: sql<string>`TO_CHAR(${assetUsageRecords.createdAt}, '${dateFormat}')`,
        revenue: sql<number>`SUM(${assetUsageRecords.creatorRevenue})`,
        transactions: sql<number>`COUNT(*)::int`,
      })
      .from(assetUsageRecords)
      .where(sql`${assetUsageRecords.assetId} = ANY(${assetIds})`)
      .groupBy(sql`TO_CHAR(${assetUsageRecords.createdAt}, '${dateFormat}')`)
      .orderBy(
        sql`TO_CHAR(${assetUsageRecords.createdAt}, '${dateFormat}') DESC`,
      )
      .limit(12); // Last 12 periods

    return results.map((r) => ({
      period: r.period,
      revenue: r.revenue,
      transactions: r.transactions,
      averageTransaction: r.transactions > 0 ? r.revenue / r.transactions : 0,
    }));
  }

  /**
   * Process a payout (internal method)
   */
  private async processPayout(payoutId: string) {
    const db = await getDatabase();

    // In a real implementation, this would integrate with payment providers
    // For now, just mark as completed
    await db
      .update(creatorPayouts)
      .set({
        status: 'completed',
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(creatorPayouts.id, payoutId));

    logger.info('Processed payout', { payoutId });
  }

  /**
   * Get platform revenue summary
   */
  async getPlatformRevenue(startDate?: Date, endDate?: Date) {
    const db = await getDatabase();

    const conditions = [];

    if (startDate) {
      conditions.push(gte(assetUsageRecords.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(assetUsageRecords.createdAt, endDate));
    }

    const [revenue] = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(${assetUsageRecords.platformRevenue}), 0)`,
        totalTransactions: sql<number>`COUNT(*)::int`,
        totalVolume: sql<number>`COALESCE(SUM(${assetUsageRecords.totalCost}), 0)`,
      })
      .from(assetUsageRecords)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return revenue;
  }
}
