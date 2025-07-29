/**
 * Database initialization middleware
 * Ensures database is initialized before handling requests
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDatabaseClientAsync } from '../database/client';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

async function ensureDatabaseInitialized() {
  if (isInitialized) {
    return;
  }

  if (!initPromise) {
    initPromise = getDatabaseClientAsync()
      .then(() => {
        isInitialized = true;
        console.log('✅ Database initialized via middleware');
      })
      .catch((error) => {
        console.error(
          '❌ Failed to initialize database via middleware:',
          error,
        );
        initPromise = null; // Allow retry
        throw error;
      });
  }

  await initPromise;
}

export async function withDatabaseInit(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    await ensureDatabaseInitialized();
    return await handler(request);
  } catch (error) {
    console.error('Database initialization failed:', error);
    return NextResponse.json(
      { error: 'Service temporarily unavailable. Please try again.' },
      { status: 503 },
    );
  }
}
