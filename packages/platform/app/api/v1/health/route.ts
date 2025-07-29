import { NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';

async function handleGET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
}

export const { GET } = wrapHandlers({ handleGET });
