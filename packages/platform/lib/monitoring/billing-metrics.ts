/**
 * Billing System Monitoring and Metrics
 * Comprehensive observability for production billing operations
 */

import { getDatabase } from '../database/connection';
import {
  creditTransactions,
  organizations,
  auditLogs,
} from '../database/schema';
import { eq, and, gte, lte, desc, count, sum } from 'drizzle-orm';

export interface BillingMetrics {
  totalTransactions: number;
  totalRevenue: number;
  averageTransactionValue: number;
  successfulPayments: number;
  failedPayments: number;
  totalCreditsIssued: number;
  activeOrganizations: number;
  autoTopUpsTriggered: number;
  webhookProcessingTime: number;
  errorRate: number;
}

export interface RevenueMetrics {
  daily: number;
  weekly: number;
  monthly: number;
  yearToDate: number;
}

export interface PaymentMethodMetrics {
  stripe: number;
  crypto: number;
  test: number;
}

export interface ErrorMetrics {
  paymentFailures: number;
  webhookFailures: number;
  autoTopUpFailures: number;
  apiErrors: number;
  totalErrors: number;
}

export class BillingMetricsCollector {
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private static cache = new Map<string, { data: any; timestamp: number }>();

  /**
   * Get comprehensive billing metrics for a time period
   */
  static async getBillingMetrics(
    startDate: Date,
    endDate: Date,
    organizationId?: string,
  ): Promise<BillingMetrics> {
    const cacheKey = `billing-metrics-${startDate.getTime()}-${endDate.getTime()}-${organizationId || 'all'}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    const db = getDatabase();

    try {
      // Build base query conditions
      const baseConditions = [
        gte(creditTransactions.createdAt, startDate),
        lte(creditTransactions.createdAt, endDate),
      ];

      if (organizationId) {
        baseConditions.push(
          eq(creditTransactions.organizationId, organizationId),
        );
      }

      // Get transaction counts and totals
      const [transactionStats] = await db
        .select({
          totalTransactions: count(),
          totalRevenue: sum(creditTransactions.amount),
        })
        .from(creditTransactions)
        .where(and(...baseConditions, eq(creditTransactions.type, 'purchase')));

      // Get successful payments
      const [successfulPayments] = await db
        .select({ count: count() })
        .from(creditTransactions)
        .where(
          and(
            ...baseConditions,
            eq(creditTransactions.type, 'purchase'),
            // Add success criteria based on payment method
          ),
        );

      // Get failed payments
      const [failedPayments] = await db
        .select({ count: count() })
        .from(creditTransactions)
        .where(
          and(
            ...baseConditions,
            eq(creditTransactions.type, 'auto_topup_failed'),
          ),
        );

      // Get auto top-ups
      const [autoTopUps] = await db
        .select({ count: count() })
        .from(creditTransactions)
        .where(
          and(...baseConditions, eq(creditTransactions.type, 'auto_topup')),
        );

      // Get active organizations count
      const [activeOrgs] = await db
        .select({ count: count() })
        .from(organizations)
        .where(
          organizationId ? eq(organizations.id, organizationId) : undefined,
        );

      const totalRevenue = parseFloat(transactionStats.totalRevenue || '0');
      const totalTxns = transactionStats.totalTransactions || 0;

      const metrics: BillingMetrics = {
        totalTransactions: totalTxns,
        totalRevenue,
        averageTransactionValue: totalTxns > 0 ? totalRevenue / totalTxns : 0,
        successfulPayments: successfulPayments.count || 0,
        failedPayments: failedPayments.count || 0,
        totalCreditsIssued: totalRevenue, // Assuming 1:1 USD to credit ratio
        activeOrganizations: activeOrgs.count || 0,
        autoTopUpsTriggered: autoTopUps.count || 0,
        webhookProcessingTime: await this.getAverageWebhookProcessingTime(
          startDate,
          endDate,
        ),
        errorRate: this.calculateErrorRate(
          successfulPayments.count || 0,
          failedPayments.count || 0,
        ),
      };

      this.setCachedData(cacheKey, metrics);
      return metrics;
    } catch (error) {
      console.error('Failed to collect billing metrics:', error);
      throw new Error('Billing metrics collection failed');
    }
  }

  /**
   * Get revenue metrics broken down by time periods
   */
  static async getRevenueMetrics(
    organizationId?: string,
  ): Promise<RevenueMetrics> {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [daily, weekly, monthly, yearToDate] = await Promise.all([
      this.getRevenueBetween(startOfDay, now, organizationId),
      this.getRevenueBetween(startOfWeek, now, organizationId),
      this.getRevenueBetween(startOfMonth, now, organizationId),
      this.getRevenueBetween(startOfYear, now, organizationId),
    ]);

    return { daily, weekly, monthly, yearToDate };
  }

  /**
   * Get payment method breakdown
   */
  static async getPaymentMethodMetrics(
    startDate: Date,
    endDate: Date,
    organizationId?: string,
  ): Promise<PaymentMethodMetrics> {
    const db = getDatabase();

    const baseConditions = [
      gte(creditTransactions.createdAt, startDate),
      lte(creditTransactions.createdAt, endDate),
      eq(creditTransactions.type, 'purchase'),
    ];

    if (organizationId) {
      baseConditions.push(
        eq(creditTransactions.organizationId, organizationId),
      );
    }

    const transactions = await db
      .select({
        paymentMethod: creditTransactions.paymentMethod,
        amount: creditTransactions.amount,
      })
      .from(creditTransactions)
      .where(and(...baseConditions));

    const metrics = {
      stripe: 0,
      crypto: 0,
      test: 0,
    };

    transactions.forEach((tx: any) => {
      const amount = parseFloat(tx.amount);
      switch (tx.paymentMethod) {
        case 'stripe':
          metrics.stripe += amount;
          break;
        case 'crypto':
          metrics.crypto += amount;
          break;
        case 'test':
          metrics.test += amount;
          break;
      }
    });

    return metrics;
  }

  /**
   * Get error metrics for monitoring
   */
  static async getErrorMetrics(
    startDate: Date,
    endDate: Date,
    organizationId?: string,
  ): Promise<ErrorMetrics> {
    const db = getDatabase();

    const baseConditions = [
      gte(auditLogs.createdAt, startDate),
      lte(auditLogs.createdAt, endDate),
    ];

    if (organizationId) {
      baseConditions.push(eq(auditLogs.organizationId, organizationId));
    }

    const [paymentFailures] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(and(...baseConditions, eq(auditLogs.action, 'payment_failed')));

    const [webhookFailures] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(and(...baseConditions, eq(auditLogs.action, 'webhook_failed')));

    const [autoTopUpFailures] = await db
      .select({ count: count() })
      .from(creditTransactions)
      .where(
        and(
          gte(creditTransactions.createdAt, startDate),
          lte(creditTransactions.createdAt, endDate),
          eq(creditTransactions.type, 'auto_topup_failed'),
          organizationId
            ? eq(creditTransactions.organizationId, organizationId)
            : undefined,
        ),
      );

    const paymentFailureCount = paymentFailures.count || 0;
    const webhookFailureCount = webhookFailures.count || 0;
    const autoTopUpFailureCount = autoTopUpFailures.count || 0;

    return {
      paymentFailures: paymentFailureCount,
      webhookFailures: webhookFailureCount,
      autoTopUpFailures: autoTopUpFailureCount,
      apiErrors: 0, // Would need to track API errors separately
      totalErrors:
        paymentFailureCount + webhookFailureCount + autoTopUpFailureCount,
    };
  }

  /**
   * Get real-time billing dashboard data
   */
  static async getDashboardMetrics(organizationId?: string): Promise<{
    metrics: BillingMetrics;
    revenue: RevenueMetrics;
    paymentMethods: PaymentMethodMetrics;
    errors: ErrorMetrics;
    trends: {
      transactionGrowth: number;
      revenueGrowth: number;
      errorTrend: number;
    };
  }> {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const previous30Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [currentMetrics, previousMetrics, revenue, paymentMethods, errors] =
      await Promise.all([
        this.getBillingMetrics(last30Days, now, organizationId),
        this.getBillingMetrics(previous30Days, last30Days, organizationId),
        this.getRevenueMetrics(organizationId),
        this.getPaymentMethodMetrics(last30Days, now, organizationId),
        this.getErrorMetrics(last30Days, now, organizationId),
      ]);

    // Calculate trends
    const transactionGrowth = this.calculateGrowthRate(
      currentMetrics.totalTransactions,
      previousMetrics.totalTransactions,
    );

    const revenueGrowth = this.calculateGrowthRate(
      currentMetrics.totalRevenue,
      previousMetrics.totalRevenue,
    );

    const errorTrend = this.calculateGrowthRate(
      errors.totalErrors,
      0, // Would calculate previous period errors
    );

    return {
      metrics: currentMetrics,
      revenue,
      paymentMethods,
      errors,
      trends: {
        transactionGrowth,
        revenueGrowth,
        errorTrend,
      },
    };
  }

  /**
   * Health check for billing system
   */
  static async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<
      string,
      { status: boolean; message: string; responseTime?: number }
    >;
  }> {
    const checks: Record<
      string,
      { status: boolean; message: string; responseTime?: number }
    > = {};

    // Database health
    try {
      const startTime = Date.now();
      const db = getDatabase();
      await db.select().from(organizations).limit(1);
      checks.database = {
        status: true,
        message: 'Database connection healthy',
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      checks.database = {
        status: false,
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }

    // Stripe API health
    try {
      const startTime = Date.now();
      // Simple Stripe API call
      const stripe = await import('stripe');
      if (process.env.STRIPE_SECRET_KEY) {
        const stripeClient = new stripe.default(process.env.STRIPE_SECRET_KEY, {
          apiVersion: '2025-02-24.acacia',
        });
        await stripeClient.balance.retrieve();
        checks.stripe = {
          status: true,
          message: 'Stripe API healthy',
          responseTime: Date.now() - startTime,
        };
      } else {
        checks.stripe = {
          status: false,
          message: 'Stripe API key not configured',
        };
      }
    } catch (error) {
      checks.stripe = {
        status: false,
        message: `Stripe API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }

    // Error rate check
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    const recentErrors = await this.getErrorMetrics(lastHour, now);
    const errorRate = recentErrors.totalErrors / 60; // errors per minute

    checks.errorRate = {
      status: errorRate < 1, // Less than 1 error per minute
      message: `Error rate: ${errorRate.toFixed(2)} errors/minute`,
    };

    // Overall health status
    const healthyChecks = Object.values(checks).filter(
      (check) => check.status,
    ).length;
    const totalChecks = Object.keys(checks).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyChecks === totalChecks) {
      status = 'healthy';
    } else if (healthyChecks >= totalChecks * 0.5) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, checks };
  }

  // Helper methods
  private static async getRevenueBetween(
    startDate: Date,
    endDate: Date,
    organizationId?: string,
  ): Promise<number> {
    const db = getDatabase();

    const conditions = [
      gte(creditTransactions.createdAt, startDate),
      lte(creditTransactions.createdAt, endDate),
      eq(creditTransactions.type, 'purchase'),
    ];

    if (organizationId) {
      conditions.push(eq(creditTransactions.organizationId, organizationId));
    }

    const [result] = await db
      .select({ total: sum(creditTransactions.amount) })
      .from(creditTransactions)
      .where(and(...conditions));

    return parseFloat(result.total || '0');
  }

  private static async getAverageWebhookProcessingTime(
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    // This would require tracking webhook processing times
    // For now, return a mock value
    return 150; // milliseconds
  }

  private static calculateErrorRate(
    successful: number,
    failed: number,
  ): number {
    const total = successful + failed;
    return total > 0 ? (failed / total) * 100 : 0;
  }

  private static calculateGrowthRate(
    current: number,
    previous: number,
  ): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  }

  private static getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }
    return null;
  }

  private static setCachedData(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Clean up old cache entries
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
  }
}

/**
 * Real-time metrics event emitter
 */
export class BillingMetricsEmitter {
  private static listeners = new Map<string, Array<(data: any) => void>>();

  static on(event: string, listener: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  static emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error('Metrics listener error:', error);
        }
      });
    }
  }

  static off(event: string, listener: (data: any) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }
}

// Event constants
export const BILLING_EVENTS = {
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  AUTO_TOPUP_TRIGGERED: 'auto_topup.triggered',
  WEBHOOK_PROCESSED: 'webhook.processed',
  ERROR_OCCURRED: 'error.occurred',
} as const;
