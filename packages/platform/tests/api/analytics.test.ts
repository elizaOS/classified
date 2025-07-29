/**
 * Analytics API Tests
 * Tests the analytics endpoints to ensure proper functionality
 */

import { describe, it, expect, vi } from 'bun:test';
import { NextRequest } from 'next/server';
import { GET as getAnalyticsOverview } from '@/app/api/analytics/overview/route';
import {
  GET as getAnalyticsConfig,
  POST as updateAnalyticsConfig,
} from '@/app/api/analytics/config/route';
import { GET as exportAnalyticsData } from '@/app/api/analytics/export/route';

// Mock session service
mock.module('@/lib/auth/session', () => ({
  sessionService: {
    getSessionFromCookies: mock(() =>
      Promise.resolve({
        organizationId: 'test-org-123',
        user: { id: 'test-user', email: 'test@example.com' },
      }),
    ),
  },
}));

// Mock inference analytics service
mock.module('@/lib/services/inference-analytics', () => ({
  inferenceAnalytics: {
    getAnalytics: mock(() =>
      Promise.resolve({
        totalRequests: 500,
        totalCost: 28.67,
        totalTokens: 95000,
        totalBaseCost: 23.89,
        totalMarkup: 4.78,
        successRate: 98.7,
        averageLatency: 845,
        byProvider: [
          {
            provider: 'OpenAI',
            requests: 270,
            cost: 15.47,
            tokens: 55000,
            percentage: 54.0,
          },
          {
            provider: 'Anthropic',
            requests: 135,
            cost: 8.33,
            tokens: 29000,
            percentage: 27.0,
          },
        ],
        byDay: [
          {
            date: '2025-01-25',
            requests: 500,
            cost: 28.67,
            tokens: 95000,
            averageLatency: 845,
          },
        ],
        byModel: [
          {
            provider: 'OpenAI',
            model: 'gpt-4o-mini',
            requests: 270,
            cost: 15.47,
            tokens: 55000,
          },
        ],
        trends: {
          requestsChange: 12.5,
          spentChange: 8.7,
          tokensChange: 15.2,
        },
      }),
    ),
    getMarkupPercentage: mock(() => Promise.resolve(20.0)),
    setMarkupPercentage: mock(() => Promise.resolve()),
  },
}));

describe('Analytics API Endpoints', () => {
  describe('GET /api/analytics/overview', () => {
    it('should return analytics overview with correct structure', async () => {
      const request = new NextRequest(
        'http://localhost:3333/api/analytics/overview?timeRange=daily',
      );
      const response = await getAnalyticsOverview(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('totalRequests');
      expect(data.data).toHaveProperty('totalSpent');
      expect(data.data).toHaveProperty('totalTokens');
      expect(data.data).toHaveProperty('totalBaseCost');
      expect(data.data).toHaveProperty('totalMarkup');
      expect(data.data).toHaveProperty('successRate');
      expect(data.data).toHaveProperty('averageLatency');
      expect(data.data).toHaveProperty('topProviders');
      expect(data.data).toHaveProperty('timeSeriesData');
      expect(data.data).toHaveProperty('requestsByModel');
      expect(data.data).toHaveProperty('trends');
    });

    it('should handle time range parameters correctly', async () => {
      const request = new NextRequest(
        'http://localhost:3333/api/analytics/overview?timeRange=weekly&provider=OpenAI',
      );
      const response = await getAnalyticsOverview(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should calculate averageRequestCost correctly', async () => {
      const request = new NextRequest(
        'http://localhost:3333/api/analytics/overview',
      );
      const response = await getAnalyticsOverview(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.averageRequestCost).toBe(28.67 / 500); // totalCost / totalRequests
    });
  });

  describe('GET /api/analytics/config', () => {
    it('should return current markup configuration', async () => {
      const request = new NextRequest(
        'http://localhost:3333/api/analytics/config',
      );
      const response = await getAnalyticsConfig(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('markupPercentage');
      expect(data.data.markupPercentage).toBe(20.0);
    });
  });

  describe('POST /api/analytics/config', () => {
    it('should update markup percentage successfully', async () => {
      const request = new NextRequest(
        'http://localhost:3333/api/analytics/config',
        {
          method: 'POST',
          body: JSON.stringify({ markupPercentage: 25.0 }),
        },
      );

      const response = await updateAnalyticsConfig(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Markup percentage updated successfully');
    });

    it('should validate markup percentage range', async () => {
      const request = new NextRequest(
        'http://localhost:3333/api/analytics/config',
        {
          method: 'POST',
          body: JSON.stringify({ markupPercentage: 150 }),
        },
      );

      const response = await updateAnalyticsConfig(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid markup percentage');
    });

    it('should validate negative markup percentage', async () => {
      const request = new NextRequest(
        'http://localhost:3333/api/analytics/config',
        {
          method: 'POST',
          body: JSON.stringify({ markupPercentage: -5 }),
        },
      );

      const response = await updateAnalyticsConfig(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid markup percentage');
    });
  });

  describe('GET /api/analytics/export', () => {
    it('should export CSV data with correct headers', async () => {
      const request = new NextRequest(
        'http://localhost:3333/api/analytics/export?format=csv&timeRange=daily',
      );
      const response = await exportAnalyticsData(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/csv');
      expect(response.headers.get('content-disposition')).toContain(
        'attachment',
      );
      expect(response.headers.get('content-disposition')).toContain(
        'analytics-daily',
      );

      const csvContent = await response.text();
      expect(csvContent).toContain('date,requests,spent,tokens');
      expect(csvContent).toContain('2025-01-25,500,28.67,95000');
    });

    it('should export JSON data with correct structure', async () => {
      const request = new NextRequest(
        'http://localhost:3333/api/analytics/export?format=json&timeRange=weekly',
      );
      const response = await exportAnalyticsData(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/json');
      expect(response.headers.get('content-disposition')).toContain(
        'attachment',
      );

      const jsonContent = await response.text();
      const data = JSON.parse(jsonContent);
      expect(Array.isArray(data)).toBe(true);
      expect(data[0]).toHaveProperty('date');
      expect(data[0]).toHaveProperty('requests');
      expect(data[0]).toHaveProperty('spent');
      expect(data[0]).toHaveProperty('tokens');
    });

    it('should handle unsupported export format', async () => {
      const request = new NextRequest(
        'http://localhost:3333/api/analytics/export?format=xml',
      );
      const response = await exportAnalyticsData(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unsupported format');
    });
  });

  describe('Analytics Data Validation', () => {
    it('should validate cost calculations', async () => {
      const request = new NextRequest(
        'http://localhost:3333/api/analytics/overview',
      );
      const response = await getAnalyticsOverview(request);
      const data = await response.json();

      // Verify total cost = base cost + markup
      expect(data.data.totalSpent).toBe(
        data.data.totalBaseCost + data.data.totalMarkup,
      );

      // Verify markup calculation (20% of base cost)
      expect(data.data.totalMarkup).toBeCloseTo(
        data.data.totalBaseCost * 0.2,
        2,
      );
    });

    it('should validate provider percentages', async () => {
      const request = new NextRequest(
        'http://localhost:3333/api/analytics/overview',
      );
      const response = await getAnalyticsOverview(request);
      const data = await response.json();

      const totalPercentage = data.data.topProviders.reduce(
        (sum: number, provider: any) => sum + provider.percentage,
        0,
      );
      expect(totalPercentage).toBeCloseTo(81.0, 1); // OpenAI (54%) + Anthropic (27%) = 81%
    });

    it('should validate model naming convention', async () => {
      const request = new NextRequest(
        'http://localhost:3333/api/analytics/overview',
      );
      const response = await getAnalyticsOverview(request);
      const data = await response.json();

      data.data.requestsByModel.forEach((model: any) => {
        expect(model.model).toMatch(/^[A-Za-z]+\//); // Should contain provider prefix like "OpenAI/"
      });
    });
  });
});
