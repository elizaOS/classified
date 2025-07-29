import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { sessionService } from '@/lib/auth/session';
import { inferenceAnalytics } from '@/lib/services/inference-analytics';

async function handleGET(request: NextRequest) {
  try {
    const session = await sessionService.getSessionFromCookies();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || 'daily';
    const format = searchParams.get('format') || 'csv';
    const provider = searchParams.get('provider') || undefined;
    const model = searchParams.get('model') || undefined;

    // Calculate date range based on timeRange
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default: // daily
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
    }

    // Get real analytics data
    const analyticsData = await inferenceAnalytics.getAnalytics({
      organizationId: session.organizationId,
      startDate,
      endDate: now,
      provider,
      model,
    });

    // Transform data for export
    const exportData = analyticsData.byDay.map((day) => ({
      date: day.date,
      requests: day.requests,
      spent: day.cost,
      tokens: day.tokens,
      averageLatency: day.averageLatency,
      averageCostPerRequest: day.requests > 0 ? day.cost / day.requests : 0,
      averageTokensPerRequest: day.requests > 0 ? day.tokens / day.requests : 0,
    }));

    if (format === 'csv') {
      const csv = convertToCSV(exportData);

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    } else if (format === 'json') {
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.json"`,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported format' },
      { status: 400 },
    );
  } catch (error) {
    console.error('Failed to export analytics data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export analytics data' },
      { status: 500 },
    );
  }
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');

  const csvRows = data.map((row) =>
    headers
      .map((header) => {
        const value = row[header];
        // Escape commas and quotes in CSV values
        if (
          typeof value === 'string' &&
          (value.includes(',') || value.includes('"'))
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(','),
  );

  return [csvHeaders, ...csvRows].join('\n');
}

export const { GET } = wrapHandlers({ handleGET });
