import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { getDatabase } from '@/lib/database';
import { users, organizations } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';
import { createTokenPair } from '@/lib/server/utils/jwt';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          code: 'validation_error',
          error: 'Invalid input',
          details: validation.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { email, password } = validation.data;

    // Find user by email
    const db = await getDatabase();
    const userResult = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        organizationId: users.organizationId,
        role: users.role,
        // hashedPassword field not available in WorkOS schema
        orgName: organizations.name,
        orgSlug: organizations.slug,
        creditBalance: organizations.creditBalance,
      })
      .from(users)
      .innerJoin(organizations, eq(users.organizationId, organizations.id))
      .where(eq(users.email, email))
      .limit(1);

    if (userResult.length === 0) {
      return NextResponse.json(
        { code: 'invalid_credentials', error: 'Invalid email or password' },
        { status: 401 },
      );
    }

    const user = userResult[0];

    // SECURITY: This endpoint is disabled for security reasons
    // Use WorkOS authentication or implement proper password hashing
    return NextResponse.json(
      {
        code: 'endpoint_disabled',
        error:
          'This endpoint has been disabled for security reasons. Use WorkOS authentication.',
      },
      { status: 501 },
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { code: 'internal_server_error', error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
