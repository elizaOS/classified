import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { z } from 'zod';

// Use dynamic imports to avoid database connection during build
const getDb = () => import('@/lib/api/database').then((m) => m.db);
const getAuthUtils = () =>
  import('@/lib/api/auth').then((m) => ({
    verifyPassword: m.verifyPassword,
    createJWT: m.createJWT,
  }));

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

async function handlePOST(request: NextRequest) {
  try {
    // During build time, return a stub response to prevent database access
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return NextResponse.json(
        { error: 'API not available during build time' },
        { status: 503 },
      );
    }

    const body = await request.json();

    // Validate input
    const validation = loginSchema.safeParse(body);
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

    const { email, password } = validation.data;

    // Get services using dynamic imports
    const db = await getDb();
    const { verifyPassword, createJWT } = await getAuthUtils();

    // Find user
    const user = await db.users.findByEmail(email);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 },
      );
    }

    // Verify password
    const validPassword = await verifyPassword(password, user.password);
    if (!validPassword) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 },
      );
    }

    // Create JWT token
    const token = await createJWT({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    // Return user and token
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
