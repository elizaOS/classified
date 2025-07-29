/**
 * Application Metrics Collection
 * Provides performance and business metrics for monitoring
 */

interface MetricData {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

interface DatabaseMetrics {
  queryDuration: number;
  connectionPool: {
    active: number;
    idle: number;
    total: number;
  };
  queryCount: number;
}

interface APIMetrics {
  requestDuration: number;
  statusCode: number;
  method: string;
  path: string;
  errorRate: number;
}

interface BusinessMetrics {
  activeUsers: number;
  totalAgents: number;
  apiRequestsPerHour: number;
  creditBalance: number;
  revenuePerHour: number;
}

// In-memory metrics store (in production, this would be Redis or similar)
class MetricsCollector {
  private metrics: Map<string, MetricData[]> = new Map();
  private readonly maxMetricsPerType = 1000; // Prevent memory leaks

  recordMetric(name: string, value: number, labels?: Record<string, string>) {
    const metric: MetricData = {
      name,
      value,
      timestamp: Date.now(),
      labels,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricsList = this.metrics.get(name)!;
    metricsList.push(metric);

    // Keep only recent metrics to prevent memory issues
    if (metricsList.length > this.maxMetricsPerType) {
      metricsList.splice(0, metricsList.length - this.maxMetricsPerType);
    }
  }

  getMetrics(name: string, since?: number): MetricData[] {
    const metrics = this.metrics.get(name) || [];
    if (since) {
      return metrics.filter((m) => m.timestamp >= since);
    }
    return [...metrics]; // Return copy
  }

  getAllMetrics(): Record<string, MetricData[]> {
    const result: Record<string, MetricData[]> = {};
    for (const [name, metrics] of this.metrics.entries()) {
      result[name] = [...metrics]; // Return copies
    }
    return result;
  }

  getAggregatedMetrics(
    name: string,
    windowMs: number = 60000,
  ): {
    count: number;
    avg: number;
    min: number;
    max: number;
    sum: number;
  } {
    const since = Date.now() - windowMs;
    const metrics = this.getMetrics(name, since);

    if (metrics.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, sum: 0 };
    }

    const values = metrics.map((m) => m.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      sum,
    };
  }

  clearOldMetrics(olderThanMs: number = 3600000) {
    // Default: 1 hour
    const cutoff = Date.now() - olderThanMs;

    for (const [name, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter((m) => m.timestamp >= cutoff);
      this.metrics.set(name, filtered);
    }
  }
}

// Singleton metrics collector
export const metrics = new MetricsCollector();

// Helper functions for common metrics
export const recordDatabaseQuery = (
  duration: number,
  operation: string,
  table?: string,
) => {
  metrics.recordMetric('database_query_duration_ms', duration, {
    operation,
    table: table || 'unknown',
  });
  metrics.recordMetric('database_query_count', 1, {
    operation,
    table: table || 'unknown',
  });
};

export const recordAPIRequest = (
  duration: number,
  statusCode: number,
  method: string,
  path: string,
) => {
  metrics.recordMetric('api_request_duration_ms', duration, {
    method,
    path,
    status_code: statusCode.toString(),
  });

  metrics.recordMetric('api_request_count', 1, {
    method,
    path,
    status_code: statusCode.toString(),
  });

  // Record error rate
  const isError = statusCode >= 400;
  metrics.recordMetric('api_error_rate', isError ? 1 : 0, { method, path });
};

export const recordBusinessMetric = (
  name: string,
  value: number,
  labels?: Record<string, string>,
) => {
  metrics.recordMetric(`business_${name}`, value, labels);
};

export const recordCreditTransaction = (
  amount: number,
  type: string,
  organizationId: string,
) => {
  metrics.recordMetric('credit_transaction_amount', amount, {
    type,
    organization_id: organizationId,
  });
  metrics.recordMetric('credit_transaction_count', 1, { type });
};

export const recordAgentOperation = (
  operation: string,
  agentId: string,
  duration?: number,
) => {
  metrics.recordMetric('agent_operation_count', 1, {
    operation,
    agent_id: agentId,
  });

  if (duration !== undefined) {
    metrics.recordMetric('agent_operation_duration_ms', duration, {
      operation,
      agent_id: agentId,
    });
  }
};

// Cleanup old metrics periodically
setInterval(() => {
  metrics.clearOldMetrics();
}, 300000); // Every 5 minutes

export type { MetricData, DatabaseMetrics, APIMetrics, BusinessMetrics };
