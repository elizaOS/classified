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

async function handleHEAD() {
  return new NextResponse(null, { status: 200 });
}

// Export with security headers but no authentication required
// The route-wrapper automatically knows /api/ping doesn't need auth
export const { GET, HEAD } = wrapHandlers({ handleGET, handleHEAD });
