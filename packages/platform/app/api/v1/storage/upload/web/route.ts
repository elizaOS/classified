import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { getServerSession, authOptions } from '@/lib/auth/config';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';

// Mock storage for demo purposes - in a real app, this would be actual file storage
const filesDB: any[] = [];

async function handlePOST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (max 10MB for demo)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error: 'File too large',
          maxSize,
          actualSize: file.size,
        },
        { status: 413 },
      );
    }

    // Generate unique file ID and mock URL
    const fileId = `file_${randomBytes(16).toString('hex')}`;
    const mockUrl = `/api/v1/storage/files/${fileId}`;

    const fileRecord = {
      id: fileId,
      filename: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      uploadedAt: new Date().toISOString(),
      url: mockUrl,
      organizationId: session.user.organizationId,
      userId: session.user.id,
    };

    // Store in mock database
    filesDB.push(fileRecord);

    return NextResponse.json({
      success: true,
      data: {
        id: fileRecord.id,
        filename: fileRecord.filename,
        size: fileRecord.size,
        type: fileRecord.type,
        url: fileRecord.url,
        uploadedAt: fileRecord.uploadedAt,
      },
    });
  } catch (error: any) {
    console.error('File upload error:', error);
    return NextResponse.json(
      {
        error: 'Upload failed',
        message: error.message || 'Unknown error occurred',
      },
      { status: 500 },
    );
  }
}

// Note: In a real app, this would use a proper database or file storage service

export const { POST } = wrapHandlers({ handlePOST });
