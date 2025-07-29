/**
 * Inference Analytics Service
 * Provides analytics and logging for LLM inference usage
 */

import { getDatabase } from '@/lib/database';
import { inferenceLogs } from '@/lib/database/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

export interface AnalyticsQuery {
  organizationId: string;
  startDate: Date;
  endDate: Date;
  provider?: string;
  model?: string;
}

export interface AnalyticsData {
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  totalBaseCost: number;
  totalMarkup: number;
  successRate: number;
  averageLatency: number;

  byProvider: Array<{
    provider: string;
    requests: number;
    cost: number;
    tokens: number;
    percentage: number;
  }>;

  byModel: Array<{
    provider: string;
    model: string;
    requests: number;
    cost: number;
    tokens: number;
  }>;

  byDay: Array<{
    date: string;
    requests: number;
    cost: number;
    tokens: number;
    averageLatency: number;
  }>;

  trends: {
    requestsChange: number;
    costChange: number;
    tokensChange: number;
  };
}

export class InferenceAnalyticsService {
  /**
   * Get analytics data for the specified time period
   */
  async getAnalytics(query: AnalyticsQuery): Promise<AnalyticsData> {
    const db = await getDatabase();

    // Build base query conditions
    const conditions = [
      eq(inferenceLogs.organizationId, query.organizationId),
      gte(inferenceLogs.createdAt, query.startDate),
      lte(inferenceLogs.createdAt, query.endDate),
    ];

    if (query.provider) {
      conditions.push(eq(inferenceLogs.provider, query.provider));
    }

    if (query.model) {
      conditions.push(eq(inferenceLogs.model, query.model));
    }

    // Get total metrics
    const [totalsResult] = await db
      .select({
        totalRequests: sql<number>`count(*)::int`,
        totalCost: sql<number>`COALESCE(sum(${inferenceLogs.totalCost}), 0)`,
        totalBaseCost: sql<number>`COALESCE(sum(${inferenceLogs.baseCost}), 0)`,
        totalMarkup: sql<number>`COALESCE(sum(${inferenceLogs.markupAmount}), 0)`,
        totalTokens: sql<number>`COALESCE(sum(${inferenceLogs.totalTokens}), 0)`,
        successCount: sql<number>`count(*) filter (where ${inferenceLogs.status} = 'success')::int`,
        totalLatency: sql<number>`COALESCE(sum(${inferenceLogs.latency}), 0)`,
      })
      .from(inferenceLogs)
      .where(and(...conditions));

    const successRate =
      totalsResult.totalRequests > 0
        ? (totalsResult.successCount / totalsResult.totalRequests) * 100
        : 0;

    const averageLatency =
      totalsResult.totalRequests > 0
        ? totalsResult.totalLatency / totalsResult.totalRequests
        : 0;

    // Get by provider
    const byProviderResults = await db
      .select({
        provider: inferenceLogs.provider,
        requests: sql<number>`count(*)::int`,
        cost: sql<number>`COALESCE(sum(${inferenceLogs.totalCost}), 0)`,
        tokens: sql<number>`COALESCE(sum(${inferenceLogs.totalTokens}), 0)`,
      })
      .from(inferenceLogs)
      .where(and(...conditions))
      .groupBy(inferenceLogs.provider)
      .orderBy(desc(sql`count(*)`));

    const byProvider = byProviderResults.map((p) => ({
      ...p,
      percentage:
        totalsResult.totalRequests > 0
          ? (p.requests / totalsResult.totalRequests) * 100
          : 0,
    }));

    // Get by model
    const byModel = await db
      .select({
        provider: inferenceLogs.provider,
        model: inferenceLogs.model,
        requests: sql<number>`count(*)::int`,
        cost: sql<number>`COALESCE(sum(${inferenceLogs.totalCost}), 0)`,
        tokens: sql<number>`COALESCE(sum(${inferenceLogs.totalTokens}), 0)`,
      })
      .from(inferenceLogs)
      .where(and(...conditions))
      .groupBy(inferenceLogs.provider, inferenceLogs.model)
      .orderBy(desc(sql`count(*)`));

    // Get daily metrics
    const byDay = await db
      .select({
        date: sql<string>`DATE(${inferenceLogs.createdAt})::text`,
        requests: sql<number>`count(*)::int`,
        cost: sql<number>`COALESCE(sum(${inferenceLogs.totalCost}), 0)`,
        tokens: sql<number>`COALESCE(sum(${inferenceLogs.totalTokens}), 0)`,
        totalLatency: sql<number>`COALESCE(sum(${inferenceLogs.latency}), 0)`,
      })
      .from(inferenceLogs)
      .where(and(...conditions))
      .groupBy(sql`DATE(${inferenceLogs.createdAt})`)
      .orderBy(sql`DATE(${inferenceLogs.createdAt})`);

    // Calculate average latency per day
    const byDayWithAvgLatency = byDay.map((day) => ({
      date: day.date,
      requests: day.requests,
      cost: day.cost,
      tokens: day.tokens,
      averageLatency: day.requests > 0 ? day.totalLatency / day.requests : 0,
    }));

    // Calculate trends (compare to previous period)
    const trends = await this.calculateTrends(query);

    return {
      totalRequests: totalsResult.totalRequests,
      totalCost: totalsResult.totalCost,
      totalTokens: totalsResult.totalTokens,
      totalBaseCost: totalsResult.totalBaseCost,
      totalMarkup: totalsResult.totalMarkup,
      successRate,
      averageLatency,
      byProvider,
      byModel,
      byDay: byDayWithAvgLatency,
      trends,
    };
  }

  /**
   * Get detailed inference logs with pagination
   */
  async getInferenceLogs(
    organizationId: string,
    page: number,
    limit: number,
    filters?: {
      provider?: string;
      model?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const db = await getDatabase();
    const offset = (page - 1) * limit;

    const conditions = [eq(inferenceLogs.organizationId, organizationId)];

    if (filters?.provider) {
      conditions.push(eq(inferenceLogs.provider, filters.provider));
    }

    if (filters?.model) {
      conditions.push(eq(inferenceLogs.model, filters.model));
    }

    if (filters?.status) {
      conditions.push(eq(inferenceLogs.status, filters.status));
    }

    if (filters?.startDate) {
      conditions.push(gte(inferenceLogs.createdAt, filters.startDate));
    }

    if (filters?.endDate) {
      conditions.push(lte(inferenceLogs.createdAt, filters.endDate));
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inferenceLogs)
      .where(and(...conditions));

    // Get paginated results
    const logs = await db
      .select()
      .from(inferenceLogs)
      .where(and(...conditions))
      .orderBy(desc(inferenceLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      logs,
      pagination: {
        page,
        limit,
        total: countResult.count,
        totalPages: Math.ceil(countResult.count / limit),
      },
    };
  }

  /**
   * Calculate trends by comparing to previous period
   */
  private async calculateTrends(query: AnalyticsQuery): Promise<{
    requestsChange: number;
    costChange: number;
    tokensChange: number;
  }> {
    const db = await getDatabase();

    // Calculate previous period
    const periodDuration = query.endDate.getTime() - query.startDate.getTime();
    const previousStartDate = new Date(
      query.startDate.getTime() - periodDuration,
    );
    const previousEndDate = query.startDate;

    // Get previous period metrics
    const [previousResult] = await db
      .select({
        requests: sql<number>`count(*)::int`,
        cost: sql<number>`COALESCE(sum(${inferenceLogs.totalCost}), 0)`,
        tokens: sql<number>`COALESCE(sum(${inferenceLogs.totalTokens}), 0)`,
      })
      .from(inferenceLogs)
      .where(
        and(
          eq(inferenceLogs.organizationId, query.organizationId),
          gte(inferenceLogs.createdAt, previousStartDate),
          lte(inferenceLogs.createdAt, previousEndDate),
        ),
      );

    // Get current period metrics
    const [currentResult] = await db
      .select({
        requests: sql<number>`count(*)::int`,
        cost: sql<number>`COALESCE(sum(${inferenceLogs.totalCost}), 0)`,
        tokens: sql<number>`COALESCE(sum(${inferenceLogs.totalTokens}), 0)`,
      })
      .from(inferenceLogs)
      .where(
        and(
          eq(inferenceLogs.organizationId, query.organizationId),
          gte(inferenceLogs.createdAt, query.startDate),
          lte(inferenceLogs.createdAt, query.endDate),
        ),
      );

    // Calculate percentage changes
    const requestsChange =
      previousResult.requests > 0
        ? ((currentResult.requests - previousResult.requests) /
            previousResult.requests) *
          100
        : 0;

    const costChange =
      previousResult.cost > 0
        ? ((currentResult.cost - previousResult.cost) / previousResult.cost) *
          100
        : 0;

    const tokensChange =
      previousResult.tokens > 0
        ? ((currentResult.tokens - previousResult.tokens) /
            previousResult.tokens) *
          100
        : 0;

    return {
      requestsChange,
      costChange,
      tokensChange,
    };
  }
}

// Export singleton instance
export const inferenceAnalytics = new InferenceAnalyticsService();
