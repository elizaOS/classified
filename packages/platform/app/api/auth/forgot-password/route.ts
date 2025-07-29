import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { z } from 'zod';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    // For testing purposes, always return success
    // In production, this would send an actual password reset email
    console.log(`Password reset requested for: ${email}`);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Password reset email sent',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'validation_error',
            message: 'Invalid email address',
          },
        },
        { status: 400 },
      );
    }

    console.error('Forgot password error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'internal_error',
          message: 'Failed to process password reset request',
        },
      },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
