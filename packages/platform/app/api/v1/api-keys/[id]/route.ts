import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/api/middleware';
import { db } from '@/lib/api/database';

// DELETE /api/v1/api-keys/:id - Delete API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async (req: AuthenticatedRequest) => {
    const user = req.user!;
    const { id: apiKeyId } = await params;

    // Check if the API key belongs to the user
    const apiKeys = await db.apiKeys.findByUserId(user.id);
    const apiKey = apiKeys.find((key) => key.id === apiKeyId);

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    // Delete the API key
    await db.apiKeys.delete(apiKeyId);

    return NextResponse.json({
      success: true,
      message: 'API key deleted successfully',
    });
  })(request);
}
