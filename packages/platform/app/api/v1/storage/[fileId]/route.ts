import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, authOptions } from '@/lib/auth/config';

export const runtime = 'nodejs';

// Import the mock files database
const filesDB: any[] = [];

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const resolvedParams = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fileId = resolvedParams.fileId;

    // Find the file and ensure it belongs to the user's organization
    const fileIndex = filesDB.findIndex(
      (file) =>
        file.id === fileId &&
        file.organizationId === session.user.organizationId,
    );

    if (fileIndex === -1) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 },
      );
    }

    // Remove the file from the database
    filesDB.splice(fileIndex, 1);

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error: any) {
    console.error('Storage delete error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete file',
        message: error.message || 'Unknown error occurred',
      },
      { status: 500 },
    );
  }
}
