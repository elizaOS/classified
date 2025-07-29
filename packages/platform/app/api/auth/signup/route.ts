import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { getDatabase } from '@/lib/database';
import { users, organizations, userSessions } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';
import { createTokenPair } from '@/lib/server/utils/jwt';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const signupSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  organizationName: z.string().min(1),
  password: z.string().min(8).optional(), // Optional for dev mode
});

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = signupSchema.safeParse(body);
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

    const { email, firstName, lastName, organizationName } = validation.data;

    const db = await getDatabase();

    // Check if user already exists
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'User already exists with this email',
          code: 'USER_EXISTS',
        },
        { status: 409 },
      );
    }

    // Create organization first
    const orgSlug = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
      .slice(0, 50); // Limit length

    // Ensure unique slug
    const uniqueSlug = `${orgSlug}-${Date.now()}`;

    const [organization] = await db
      .insert(organizations)
      .values({
        id: uuidv4(),
        name: organizationName,
        slug: uniqueSlug,
        subscriptionTier: 'free',
        creditBalance: '10.0', // Start with $10 in free credits
        maxAgents: 5,
        maxUsers: 10,
        subscriptionStatus: 'active',
      })
      .returning();

    // Create user
    const [user] = await db
      .insert(users)
      .values({
        id: uuidv4(),
        email,
        firstName,
        lastName: lastName || '',
        organizationId: organization.id,
        role: 'owner', // First user is owner
        workosUserId: `dev-${uuidv4()}`, // Dev mode WorkOS ID
        emailVerified: true, // Auto-verify in dev mode
      })
      .returning();

    // Create JWT token
    const { accessToken, refreshToken } = await createTokenPair({
      userId: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
    });

    // Create session record in database
    const sessionExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await db.insert(userSessions).values({
      id: uuidv4(),
      userId: user.id,
      organizationId: user.organizationId,
      sessionToken: accessToken,
      refreshToken,
      ipAddress:
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      expiresAt: sessionExpiry,
      lastActiveAt: new Date(),
    });

    // Return user data and tokens
    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            organizationId: user.organizationId,
            role: user.role,
            emailVerified: user.emailVerified,
          },
          organization: {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            creditBalance: organization.creditBalance,
            subscriptionTier: organization.subscriptionTier,
          },
          tokens: {
            accessToken,
            refreshToken,
          },
        },
      },
      {
        status: 201,
        headers: {
          'Set-Cookie': [
            `auth-token=${accessToken}; HttpOnly; ${(process.env.NODE_ENV as string) === 'production' ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=3600`,
            `refresh-token=${refreshToken}; HttpOnly; ${(process.env.NODE_ENV as string) === 'production' ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=604800`,
          ].join(', '),
        },
      },
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details:
          process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
