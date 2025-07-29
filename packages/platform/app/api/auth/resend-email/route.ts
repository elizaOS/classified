import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { z } from 'zod';

const resendEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

async function handlePOST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = resendEmailSchema.parse(body);

    // For testing purposes, always return success
    // In production, this would resend the actual confirmation email
    console.log(`Resending confirmation email to: ${email}`);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Email resent',
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

    console.error('Resend email error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'internal_error',
          message: 'Failed to resend email',
        },
      },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
