import { NextRequest, NextResponse } from 'next/server';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    name: string;
    organizationId: string;
  };
}

export function withAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>,
) {
  return async (request: NextRequest) => {
    // During build time, return a stub response to prevent database access
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return NextResponse.json(
        { error: 'API not available during build time' },
        { status: 503 },
      );
    }

    // Dynamic imports to avoid database connection during build
    const { verifyJWT } = await import('./auth');
    const { UserRepository } = await import('../database/repositories/user');
    const { validateApiKey } = await import(
      '../server/services/api-key-service'
    );

    // Check for Bearer token
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = await verifyJWT(token);

      if (payload) {
        const userRepo = new UserRepository();
        const user = await userRepo.getByIdGlobal(payload.sub);
        if (user) {
          (request as AuthenticatedRequest).user = {
            id: user.id,
            email: user.email,
            name:
              `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
              user.email,
            organizationId: user.organizationId,
          };
          return handler(request as AuthenticatedRequest);
        }
      }
    }

    // Check for API key
    const apiKey = request.headers.get('x-api-key');
    if (apiKey) {
      const key = await validateApiKey(apiKey);
      if (key && key.userId) {
        const userRepo = new UserRepository();
        const user = await userRepo.getByIdGlobal(key.userId);
        if (user) {
          (request as AuthenticatedRequest).user = {
            id: user.id,
            email: user.email,
            name:
              `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
              user.email,
            organizationId: user.organizationId,
          };
          return handler(request as AuthenticatedRequest);
        }
      }
    }

    return NextResponse.json(
      { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  };
}
