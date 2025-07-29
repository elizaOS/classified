import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/api/middleware';
import { db } from '@/lib/api/database';
import { generateApiKey } from '@/lib/api/auth';
import { z } from 'zod';

const createApiKeySchema = z.object({
  name: z.string().min(1),
  expiresIn: z.enum(['30d', '90d', '1y', 'never']).optional(),
});

// GET /api/v1/api-keys - List API keys
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const user = request.user!;
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  const apiKeys = await db.apiKeys.findByUserId(user.id);

  // Sort by creation date (newest first)
  apiKeys.sort(
    (a, b) =>
      (b.createdAt ? b.createdAt.getTime() : 0) -
      (a.createdAt ? a.createdAt.getTime() : 0),
  );

  // Paginate
  const start = (page - 1) * limit;
  const paginatedKeys = apiKeys.slice(start, start + limit);

  // Hide the actual key value, only show last 4 characters
  const safeKeys = paginatedKeys.map((key) => ({
    id: key.id,
    name: key.name,
    key: `sk_live_...${key.key.slice(-4)}`,
    lastUsed: key.lastUsed,
    createdAt: key.createdAt,
    expiresAt: key.expiresAt,
  }));

  return NextResponse.json({
    success: true,
    data: {
      apiKeys: safeKeys,
      pagination: {
        page,
        limit,
        total: apiKeys.length,
        totalPages: Math.ceil(apiKeys.length / limit),
      },
    },
  });
});

// POST /api/v1/api-keys - Create API key
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const user = request.user!;

  try {
    const body = await request.json();

    // Validate input
    const validation = createApiKeySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid input',
          details: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { name, expiresIn } = validation.data;

    // Calculate expiration date
    let expiresAt: Date | undefined;
    if (expiresIn && expiresIn !== 'never') {
      const now = new Date();
      switch (expiresIn) {
        case '30d':
          expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    // Generate API key
    const key = generateApiKey();

    // Create API key in database
    const apiKey = await db.apiKeys.create({
      userId: user.id,
      name,
      key,
      expiresAt,
    });

    // Return the full key only on creation
    return NextResponse.json(
      {
        success: true,
        data: {
          apiKey: {
            id: apiKey.id,
            name: apiKey.name,
            key: apiKey.key, // Full key shown only once
            lastUsed: apiKey.lastUsed,
            createdAt: apiKey.createdAt,
            expiresAt: apiKey.expiresAt,
          },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Create API key error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
});
