import { eq, and, desc, gte, sql, lt, sum, count, avg } from 'drizzle-orm';
import { getDatabase } from '@/lib/database';
import { usageRecords, type NewUsageRecord } from '@/lib/database/schema';

interface TrackUsageData {
  organizationId: string;
  apiKeyId: string;
  agentId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  duration: number;
  success: boolean;
  errorMessage?: string;
  usageRecordId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export async function trackUsage(data: TrackUsageData): Promise<string> {
  const totalTokens = data.inputTokens + data.outputTokens;

  const newUsageRecord: NewUsageRecord = {
    organizationId: data.organizationId,
    apiKeyId: data.apiKeyId,
    provider: data.provider,
    model: data.model,
    inputTokens: data.inputTokens,
    outputTokens: data.outputTokens,
    totalTokens,
    cost: data.cost.toString(),
    duration: data.duration,
    success: data.success,
    errorMessage: data.errorMessage || null,
    ipAddress: data.ipAddress || null,
    userAgent: data.userAgent || null,
    requestId: data.requestId || null,
    metadata: data.metadata || {},
  };

  const db = await getDatabase();
  const [record] = await db
    .insert(usageRecords)
    .values(newUsageRecord)
    .returning();

  return record.id;
}

export async function getUsageStatistics(
  organizationId: string,
  options: {
    period?: 'hour' | 'day' | 'week' | 'month';
    provider?: string;
    model?: string;
    apiKeyId?: string;
    limit?: number;
  } = {},
): Promise<{
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  totalCost: number;
  averageLatency: number;
  breakdown: {
    provider: string;
    model: string;
    requests: number;
    tokens: number;
    cost: number;
  }[];
}> {
  const { period = 'day' } = options;

  // Calculate time range
  const now = new Date();
  const startTime = new Date();

  switch (period) {
    case 'hour':
      startTime.setHours(now.getHours() - 1);
      break;
    case 'day':
      startTime.setDate(now.getDate() - 1);
      break;
    case 'week':
      startTime.setDate(now.getDate() - 7);
      break;
    case 'month':
      startTime.setMonth(now.getMonth() - 1);
      break;
  }

  // Build filter conditions
  const conditions = [
    eq(usageRecords.organizationId, organizationId),
    gte(usageRecords.createdAt, startTime),
  ];

  if (options.provider) {
    conditions.push(eq(usageRecords.provider, options.provider));
  }
  if (options.model) {
    conditions.push(eq(usageRecords.model, options.model));
  }
  if (options.apiKeyId) {
    conditions.push(eq(usageRecords.apiKeyId, options.apiKeyId));
  }

  // Get aggregate statistics
  const db = await getDatabase();
  const [statsResult] = await db
    .select({
      totalRequests: count().as('total_requests'),
      successfulRequests: count(usageRecords.success).as('successful_requests'),
      totalTokens: sum(usageRecords.totalTokens).as('total_tokens'),
      totalCost: sum(usageRecords.cost).as('total_cost'),
      averageLatency: avg(usageRecords.duration).as('average_latency'),
    })
    .from(usageRecords)
    .where(and(...conditions));

  // Get failed requests count separately
  const db2 = await getDatabase();
  const [failedResult] = await db2
    .select({
      failedRequests: count().as('failed_requests'),
    })
    .from(usageRecords)
    .where(and(...conditions, eq(usageRecords.success, false)));

  // Get breakdown by provider and model
  const db3 = await getDatabase();
  const breakdownResults = await db3
    .select({
      provider: usageRecords.provider,
      model: usageRecords.model,
      requests: count().as('requests'),
      tokens: sum(usageRecords.totalTokens).as('tokens'),
      cost: sum(usageRecords.cost).as('cost'),
    })
    .from(usageRecords)
    .where(and(...conditions))
    .groupBy(usageRecords.provider, usageRecords.model)
    .orderBy(desc(count()));

  return {
    totalRequests: parseInt(statsResult?.totalRequests || '0', 10),
    successfulRequests:
      parseInt(statsResult?.totalRequests || '0', 10) -
      parseInt(failedResult?.failedRequests || '0', 10),
    failedRequests: parseInt(failedResult?.failedRequests || '0', 10),
    totalTokens: parseInt(statsResult?.totalTokens || '0', 10),
    totalCost: parseFloat(statsResult?.totalCost || '0'),
    averageLatency: parseFloat(statsResult?.averageLatency || '0'),
    breakdown: breakdownResults.map(
      (result: {
        provider: string;
        model: string;
        requests: any;
        tokens: any;
        cost: any;
      }) => ({
        provider: result.provider,
        model: result.model,
        requests: parseInt(result.requests, 10),
        tokens: parseInt(result.tokens || '0', 10),
        cost: parseFloat(result.cost || '0'),
      }),
    ),
  };
}

export async function getUsageTimeSeries(
  organizationId: string,
  options: {
    period?: 'hour' | 'day' | 'week' | 'month';
    provider?: string;
    model?: string;
    apiKeyId?: string;
    granularity?: 'minute' | 'hour' | 'day';
  } = {},
): Promise<{
  timestamps: string[];
  requests: number[];
  tokens: number[];
  costs: number[];
}> {
  const { period = 'day', granularity = 'hour' } = options;

  // Calculate time range
  const now = new Date();
  const startTime = new Date();

  switch (period) {
    case 'hour':
      startTime.setHours(now.getHours() - 1);
      break;
    case 'day':
      startTime.setDate(now.getDate() - 1);
      break;
    case 'week':
      startTime.setDate(now.getDate() - 7);
      break;
    case 'month':
      startTime.setMonth(now.getMonth() - 1);
      break;
  }

  // Build filter conditions
  const conditions = [
    eq(usageRecords.organizationId, organizationId),
    gte(usageRecords.createdAt, startTime),
  ];

  if (options.provider) {
    conditions.push(eq(usageRecords.provider, options.provider));
  }
  if (options.model) {
    conditions.push(eq(usageRecords.model, options.model));
  }
  if (options.apiKeyId) {
    conditions.push(eq(usageRecords.apiKeyId, options.apiKeyId));
  }

  // Get time-series data using PostgreSQL date_trunc
  let truncateFormat: string;
  switch (granularity) {
    case 'minute':
      truncateFormat = 'minute';
      break;
    case 'hour':
      truncateFormat = 'hour';
      break;
    case 'day':
      truncateFormat = 'day';
      break;
    default:
      truncateFormat = 'hour';
  }

  const db = await getDatabase();
  const timeSeriesResults = await db
    .select({
      timestamp:
        sql`date_trunc(${truncateFormat}, ${usageRecords.createdAt})`.as(
          'timestamp',
        ),
      requests: count().as('requests'),
      tokens: sum(usageRecords.totalTokens).as('tokens'),
      cost: sum(usageRecords.cost).as('cost'),
    })
    .from(usageRecords)
    .where(and(...conditions))
    .groupBy(sql`date_trunc(${truncateFormat}, ${usageRecords.createdAt})`)
    .orderBy(sql`date_trunc(${truncateFormat}, ${usageRecords.createdAt})`);

  return {
    timestamps: timeSeriesResults.map(
      (result: { timestamp: Date; requests: any; tokens: any; cost: any }) =>
        result.timestamp.toISOString(),
    ),
    requests: timeSeriesResults.map(
      (result: { timestamp: Date; requests: any; tokens: any; cost: any }) =>
        parseInt(result.requests, 10),
    ),
    tokens: timeSeriesResults.map(
      (result: { timestamp: Date; requests: any; tokens: any; cost: any }) =>
        parseInt(result.tokens || '0', 10),
    ),
    costs: timeSeriesResults.map(
      (result: { timestamp: Date; requests: any; tokens: any; cost: any }) =>
        parseFloat(result.cost || '0'),
    ),
  };
}

export async function getRateLimitStatus(
  organizationId: string,
  apiKeyId: string,
  windowMs: number = 60000, // 1 minute default
): Promise<{
  requestCount: number;
  limit: number;
  remaining: number;
  resetTime: Date;
}> {
  const windowStart = new Date(Date.now() - windowMs);

  // Count recent requests for this API key
  const db = await getDatabase();
  const [result] = await db
    .select({
      requestCount: count().as('request_count'),
    })
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.organizationId, organizationId),
        eq(usageRecords.apiKeyId, apiKeyId),
        gte(usageRecords.createdAt, windowStart),
      ),
    );

  // Get the API key's rate limit from the database
  // This would need to be implemented based on your API key schema
  const defaultLimit = 100; // Fallback limit

  const requestCount = parseInt(result?.requestCount || '0', 10);

  return {
    requestCount,
    limit: defaultLimit,
    remaining: Math.max(0, defaultLimit - requestCount),
    resetTime: new Date(Date.now() + windowMs),
  };
}
