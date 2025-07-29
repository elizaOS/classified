/**
 * Simple ping endpoint for health checks
 * Returns pong without authentication requirements
 */

import { NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';

async function handleGET() {
  return NextResponse.json(
    {
      pong: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    { status: 200 },
  );
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export const { GET } = wrapHandlers({ handleGET });
