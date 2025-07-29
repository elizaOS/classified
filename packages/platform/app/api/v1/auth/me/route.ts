import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/api/middleware';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const user = request.user!;

  return NextResponse.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    },
  });
});
