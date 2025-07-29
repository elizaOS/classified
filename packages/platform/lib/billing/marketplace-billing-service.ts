/**
 * Marketplace Billing Service
 *
 * Integrates marketplace operations with the existing credit system:
 * - Container hosting billing
 * - Asset usage tracking
 * - Creator revenue sharing
 * - Marketplace transaction recording
 */

import { CreditService, UsageContext } from './credit-service';
import {
  getCreditBalance,
  deductCredits,
} from '../server/services/billing-service';
import { getDatabase } from '../database/connection';
import { creditTransactions } from '../database/schema';
import {
  assetUsageRecords,
  hostedContainers,
  marketplaceAssets,
  creatorPayouts,
} from '../database/marketplace-schema';
import { eq, and, desc, sum } from 'drizzle-orm';

export interface MarketplaceUsageContext extends UsageContext {
  // Marketplace-specific fields
  assetId?: string;
  containerId?: string;
  creatorId?: string;
  usageType:
    | 'asset_purchase'
    | 'container_hosting'
    | 'asset_usage'
    | 'subscription';
  marketplaceCategory?: string;

  // Billing details
  basePrice?: number;
  creatorShare?: number;
  platformShare?: number;
  markupPercentage?: number;
}

export interface MarketplaceBillingResult {
  success: boolean;
  remainingBalance: number;
  deductedAmount: number;
  creatorRevenue: number;
  platformRevenue: number;
  usageRecordId?: string;
  transactionId?: string;
  error?: string;
}

export class MarketplaceBillingService extends CreditService {
  private static readonly CREATOR_REVENUE_SHARE = 0.5; // 50% to creators
  private static readonly MARKETPLACE_MARKUP = 0.2; // 20% markup on e2b costs

  /**
   * Calculate marketplace-specific costs
   */
  static calculateMarketplaceCost(context: MarketplaceUsageContext): {
    totalCost: number;
    creatorRevenue: number;
    platformRevenue: number;
  } {
    let totalCost = 0;

    switch (context.usageType) {
      case 'asset_purchase':
        totalCost = context.basePrice || 0;
        break;

      case 'container_hosting':
        // Calculate hourly container costs with markup
        const baseCost = this.calculateContainerBaseCost(
          context.tokens || 512, // memory in MB
          1000, // default CPU units
          1, // default storage GB
        );
        totalCost = baseCost * (1 + this.MARKETPLACE_MARKUP);
        break;

      case 'asset_usage':
        // Per-usage billing for API calls, executions, etc.
        const perUsageCost = context.basePrice || 0.001;
        const quantity = context.tokens || 1;
        totalCost = perUsageCost * quantity;
        break;

      case 'subscription':
        totalCost = context.basePrice || 0;
        break;

      default:
        totalCost = 0;
    }

    // Calculate revenue split
    const creatorRevenue = totalCost * this.CREATOR_REVENUE_SHARE;
    const platformRevenue = totalCost - creatorRevenue;

    return {
      totalCost,
      creatorRevenue,
      platformRevenue,
    };
  }

  /**
   * Calculate base container hosting cost per hour
   */
  private static calculateContainerBaseCost(
    memory: number, // MB
    cpu: number, // CPU units (1000 = 1 vCPU)
    storage: number, // GB
  ): number {
    // Approximate e2b pricing
    const memoryCostPerMBHour = 0.000001; // $0.001 per GB-hour
    const cpuCostPerUnitHour = 0.00001; // $0.01 per vCPU-hour
    const storageCostPerGBHour = 0.0000001; // $0.0001 per GB-hour

    return (
      memory * memoryCostPerMBHour +
      cpu * cpuCostPerUnitHour +
      storage * storageCostPerGBHour
    );
  }

  /**
   * Process marketplace billing and record usage
   */
  static async processMarketplaceBilling(
    organizationId: string,
    userId: string,
    context: MarketplaceUsageContext,
  ): Promise<MarketplaceBillingResult> {
    const db = getDatabase();

    try {
      // Calculate costs
      const { totalCost, creatorRevenue, platformRevenue } =
        this.calculateMarketplaceCost(context);

      if (totalCost <= 0) {
        return {
          success: true,
          remainingBalance: await getCreditBalance(organizationId),
          deductedAmount: 0,
          creatorRevenue: 0,
          platformRevenue: 0,
        };
      }

      // Check sufficient balance
      const currentBalance = await getCreditBalance(organizationId);
      if (currentBalance < totalCost) {
        return {
          success: false,
          remainingBalance: currentBalance,
          deductedAmount: 0,
          creatorRevenue: 0,
          platformRevenue: 0,
          error: 'Insufficient credit balance',
        };
      }

      // Deduct credits from user's account
      const description = this.generateMarketplaceDescription(context);

      try {
        await deductCredits({
          organizationId,
          userId,
          amount: totalCost,
          description,
          metadata: {
            ...context,
            marketplace: true,
            costBreakdown: {
              totalCost,
              creatorRevenue,
              platformRevenue,
              usageType: context.usageType,
              assetId: context.assetId,
              containerId: context.containerId,
            },
          },
        });

        // Record marketplace usage
        const usageRecordData = {
          organizationId,
          assetId: context.assetId!,
          userId,
          containerId: context.containerId || null,
          usageType: this.mapUsageTypeToDb(context.usageType),
          quantity: (context.tokens || 1).toString(),
          unit: this.getUsageUnit(context.usageType),
          unitCost: (totalCost / (context.tokens || 1)).toString(),
          totalCost: totalCost.toString(),
          creatorRevenue: creatorRevenue.toString(),
          platformRevenue: platformRevenue.toString(),
          metadata: {
            source: 'marketplace_billing' as const,
            requestId: context.requestId || undefined,
            sessionId: undefined,
            userAgent: undefined,
            ipAddress: undefined,
          },
        };

        const usageRecord = await db
          .insert(assetUsageRecords)
          .values(usageRecordData)
          .returning();

        const remainingBalance = await getCreditBalance(organizationId);

        return {
          success: true,
          remainingBalance,
          deductedAmount: totalCost,
          creatorRevenue,
          platformRevenue,
          usageRecordId: usageRecord[0].id,
        };
      } catch (deductError) {
        console.error(
          'Failed to deduct credits for marketplace usage:',
          deductError,
        );
        return {
          success: false,
          remainingBalance: currentBalance,
          deductedAmount: 0,
          creatorRevenue: 0,
          platformRevenue: 0,
          error: 'Failed to process payment',
        };
      }
    } catch (error) {
      console.error('Failed to process marketplace billing:', error);
      return {
        success: false,
        remainingBalance: 0,
        deductedAmount: 0,
        creatorRevenue: 0,
        platformRevenue: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Record container hosting usage (called periodically)
   */
  static async recordContainerUsage(
    containerId: string,
    hoursUsed: number,
  ): Promise<void> {
    const db = getDatabase();

    try {
      // Get container details
      const containers = await db
        .select()
        .from(hostedContainers)
        .where(eq(hostedContainers.id, containerId))
        .limit(1);

      if (!containers[0]) {
        throw new Error('Container not found');
      }

      const container = containers[0];
      const billedCost = parseFloat(container.billedCostPerHour) * hoursUsed;

      // Process billing
      const billingResult = await this.processMarketplaceBilling(
        container.organizationId,
        container.userId,
        {
          service: 'marketplace', // Required by UsageContext parent interface
          operation: 'container_hosting', // Required by UsageContext parent interface
          usageType: 'container_hosting',
          assetId: container.assetId,
          containerId: container.id,
          tokens: hoursUsed, // Hours used
          basePrice: billedCost,
        } as MarketplaceUsageContext,
      );

      if (!billingResult.success) {
        console.error(
          `Failed to bill container usage for ${containerId}: ${billingResult.error}`,
        );

        // If billing fails, we should stop the container to prevent runaway costs
        // This would integrate with the ContainerHostingService
      }
    } catch (error) {
      console.error(
        `Failed to record container usage for ${containerId}:`,
        error,
      );
    }
  }

  /**
   * Get marketplace usage summary for organization
   */
  static async getMarketplaceUsageSummary(
    organizationId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const db = getDatabase();

    try {
      const start =
        startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate || new Date();

      // Get marketplace transactions
      const transactions = await db
        .select()
        .from(creditTransactions)
        .where(
          and(
            eq(creditTransactions.organizationId, organizationId),
            eq(creditTransactions.type, 'usage'),
            desc(creditTransactions.createdAt),
          ),
        )
        .limit(100);

      // Filter marketplace transactions
      const marketplaceTransactions = transactions.filter(
        (t: any) => t.metadata?.marketplace === true,
      );

      // Get usage records for detailed breakdown
      const usageRecords = await db
        .select({
          usageType: assetUsageRecords.usageType,
          totalCost: sum(assetUsageRecords.totalCost),
          creatorRevenue: sum(assetUsageRecords.creatorRevenue),
          platformRevenue: sum(assetUsageRecords.platformRevenue),
          quantity: sum(assetUsageRecords.quantity),
        })
        .from(assetUsageRecords)
        .where(
          and(
            eq(assetUsageRecords.organizationId, organizationId),
            // Add date filters if we had timestamp fields
          ),
        )
        .groupBy(assetUsageRecords.usageType);

      // Calculate totals
      const totalSpent = marketplaceTransactions.reduce(
        (sum: number, t: any) => sum + Math.abs(parseFloat(t.amount)),
        0,
      );

      const totalCreatorRevenue = usageRecords.reduce(
        (sum: number, r: any) => sum + parseFloat(r.creatorRevenue || '0'),
        0,
      );

      const totalPlatformRevenue = usageRecords.reduce(
        (sum: number, r: any) => sum + parseFloat(r.platformRevenue || '0'),
        0,
      );

      return {
        period: { startDate: start, endDate: end },
        totalSpent,
        totalCreatorRevenue,
        totalPlatformRevenue,
        transactionCount: marketplaceTransactions.length,
        usageBreakdown: usageRecords.map((r: any) => ({
          usageType: r.usageType,
          totalCost: parseFloat(r.totalCost || '0'),
          creatorRevenue: parseFloat(r.creatorRevenue || '0'),
          platformRevenue: parseFloat(r.platformRevenue || '0'),
          quantity: parseFloat(r.quantity || '0'),
        })),
        recentTransactions: marketplaceTransactions.slice(0, 10),
      };
    } catch (error) {
      console.error('Failed to get marketplace usage summary:', error);
      throw new Error('Failed to get marketplace usage summary');
    }
  }

  /**
   * Estimate cost for marketplace operation
   */
  static estimateMarketplaceCost(context: MarketplaceUsageContext): number {
    const { totalCost } = this.calculateMarketplaceCost(context);
    return totalCost;
  }

  /**
   * Check if organization can afford marketplace operation
   */
  static async canAffordMarketplaceOperation(
    organizationId: string,
    context: MarketplaceUsageContext,
  ): Promise<boolean> {
    try {
      const estimatedCost = this.estimateMarketplaceCost(context);
      return await this.checkSufficientCredits(organizationId, estimatedCost);
    } catch (error) {
      console.error('Failed to check marketplace affordability:', error);
      return false;
    }
  }

  private static generateMarketplaceDescription(
    context: MarketplaceUsageContext,
  ): string {
    const { usageType, service, operation, assetId } = context;

    let description = `Marketplace - ${usageType}`;

    if (service && operation) {
      description += ` (${service}/${operation})`;
    }

    if (assetId) {
      description += ` - Asset: ${assetId.slice(0, 8)}...`;
    }

    return description;
  }

  private static mapUsageTypeToDb(usageType: string): string {
    switch (usageType) {
      case 'asset_purchase':
        return 'purchase';
      case 'container_hosting':
        return 'container_hour';
      case 'asset_usage':
        return 'api_call';
      case 'subscription':
        return 'subscription';
      default:
        return 'usage';
    }
  }

  private static getUsageUnit(usageType: string): string {
    switch (usageType) {
      case 'asset_purchase':
        return 'purchase';
      case 'container_hosting':
        return 'hours';
      case 'asset_usage':
        return 'calls';
      case 'subscription':
        return 'months';
      default:
        return 'units';
    }
  }
}

export default MarketplaceBillingService;
