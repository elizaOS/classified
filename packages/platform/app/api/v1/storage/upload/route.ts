import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  validateApiKey,
  checkApiKeyPermission,
} from '@/lib/server/services/api-key-service';
import { deductCredits } from '@/lib/server/services/billing-service';
import { trackUsage } from '@/lib/server/services/usage-tracking-service';

// Cloudflare R2 configuration
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;

// Pricing: R2 storage is very cheap - $0.015/GB/month for storage, $0.36/million requests
const R2_PRICING = {
  storagePerGBMonth: 0.015,
  requestPer1M: 0.36,
  egressPerGB: 0.0, // Free egress to internet
};

async function handlePOST(request: NextRequest) {
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid API key' },
        { status: 401 },
      );
    }

    const apiKeyValue = authHeader.substring(7);
    const apiKey = await validateApiKey(apiKeyValue);

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Invalid or expired API key' },
        { status: 401 },
      );
    }

    // Check permissions
    if (!(await checkApiKeyPermission(apiKey, 'storage:write'))) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const path = (formData.get('path') as string) || '';
    const isPublic = formData.get('public') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
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

    // Generate unique filename
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop() || '';
    const filename = `${timestamp}_${randomSuffix}${fileExtension ? `.${fileExtension}` : ''}`;

    // Construct full path
    const orgPrefix = `org_${apiKey.organizationId}`;
    const fullPath = path
      ? `${orgPrefix}/${path}/${filename}`
      : `${orgPrefix}/${filename}`;

    const startTime = Date.now();

    // Upload to R2
    const uploadCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fullPath,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type || 'application/octet-stream',
      ContentLength: file.size,
      Metadata: {
        'original-filename': file.name,
        'uploaded-by': apiKey.userId || 'system',
        'organization-id': apiKey.organizationId,
        'upload-timestamp': timestamp.toString(),
      },
    });

    await r2Client.send(uploadCommand);
    const duration = Date.now() - startTime;

    // Calculate costs
    const fileSizeGB = file.size / (1024 * 1024 * 1024);
    const storageCostPerMonth = fileSizeGB * R2_PRICING.storagePerGBMonth;
    const requestCost = R2_PRICING.requestPer1M / 1000000; // Cost per single request

    // For billing, we'll charge a base amount for the upload operation
    // Storage costs would typically be billed monthly
    const uploadCharge = Math.max(0.001, requestCost * 1.1); // Minimum $0.001 charge

    // Deduct credits for the upload operation
    const usageRecord = await deductCredits({
      organizationId: apiKey.organizationId,
      userId: apiKey.userId || undefined,
      amount: uploadCharge,
      description: `R2 Storage Upload - ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`,
      metadata: {
        provider: 'r2',
        operation: 'upload',
        filename: file.name,
        filePath: fullPath,
        fileSize: file.size,
        fileSizeGB,
        storageCostPerMonth,
        requestCost,
        duration,
      },
    });

    // Track usage statistics
    await trackUsage({
      organizationId: apiKey.organizationId,
      apiKeyId: apiKey.id,
      provider: 'r2',
      model: 'storage',
      inputTokens: 0, // Not applicable for storage
      outputTokens: Math.round(file.size / 1024), // Use KB as token equivalent
      cost: uploadCharge,
      duration,
      success: true,
      usageRecordId: usageRecord?.id,
      metadata: {
        operation: 'upload',
        filename: file.name,
        fileSize: file.size,
      },
    });

    // Generate public URL if requested
    let publicUrl = null;
    if (isPublic) {
      publicUrl = `${process.env.R2_PUBLIC_URL}/${fullPath}`;
    }

    // Generate signed URL for private access (valid for 1 hour)
    const getCommand = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fullPath,
    });
    const signedUrl = await getSignedUrl(r2Client, getCommand, {
      expiresIn: 3600,
    });

    return NextResponse.json({
      success: true,
      data: {
        filename,
        originalFilename: file.name,
        path: fullPath,
        size: file.size,
        contentType: file.type,
        publicUrl,
        signedUrl,
        uploadedAt: new Date().toISOString(),
        billing: {
          uploadCharge,
          estimatedMonthlyCost: storageCostPerMonth,
          fileSize: file.size,
          fileSizeGB,
        },
      },
    });
  } catch (error: any) {
    console.error('R2 upload error:', error);

    // Track failed usage
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const apiKeyValue = authHeader.substring(7);
      const apiKey = await validateApiKey(apiKeyValue);

      if (apiKey) {
        await trackUsage({
          organizationId: apiKey.organizationId,
          apiKeyId: apiKey.id,
          provider: 'r2',
          model: 'storage',
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          duration: 0,
          success: false,
          errorMessage: error.message,
        });
      }
    }

    if (error.message.includes('Insufficient credit balance')) {
      return NextResponse.json(
        {
          error: 'Insufficient credits',
          message:
            'Please add more credits to your account to continue using the API',
        },
        { status: 402 },
      );
    }

    return NextResponse.json(
      {
        error: 'Upload failed',
        message: error.message || 'Unknown error occurred',
      },
      { status: 500 },
    );
  }
}

export const { POST } = wrapHandlers({ handlePOST });
