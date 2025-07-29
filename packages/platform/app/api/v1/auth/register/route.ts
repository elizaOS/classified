import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { db } from '@/lib/api/database';
import { hashPassword, createJWT } from '@/lib/api/auth';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = registerSchema.safeParse(body);
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

    const { email, password, name } = validation.data;

    // Check if user already exists
    const existingUser = await db.users.findByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'User already exists', code: 'USER_EXISTS' },
        { status: 409 },
      );
    }

    // Create user
    const hashedPassword = await hashPassword(password);
    const user = await db.users.create({
      email,
      name,
      password: hashedPassword,
    });

    // Create JWT token
    const token = await createJWT({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    // Return user and token
    return NextResponse.json(
      {
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
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
