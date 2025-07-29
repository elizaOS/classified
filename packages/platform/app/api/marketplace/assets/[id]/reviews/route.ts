import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { MarketplaceService } from '@/lib/services/marketplace';
import { auth } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import {
  assetReviews,
  users,
  creatorProfiles,
} from '@/lib/database/marketplace-schema';
import { eq, and, desc } from 'drizzle-orm';

const marketplaceService = new MarketplaceService();

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params;
    const assetId = resolvedParams.id;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const db = await getDatabase();

    // Get reviews with user information
    const reviews = await db
      .select({
        review: assetReviews,
        user: users,
        creator: creatorProfiles,
      })
      .from(assetReviews)
      .leftJoin(users, eq(assetReviews.userId, users.id))
      .leftJoin(
        creatorProfiles,
        eq(assetReviews.userId, creatorProfiles.userId),
      )
      .where(
        and(
          eq(assetReviews.assetId, assetId),
          eq(assetReviews.isHidden, false),
        ),
      )
      .orderBy(desc(assetReviews.createdAt))
      .limit(limit)
      .offset(offset);

    const formattedReviews = reviews.map(({ review, user, creator }: any) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      review: review.review,
      isVerifiedPurchase: review.isVerifiedPurchase,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      user: {
        id: user?.id,
        name: creator?.displayName || user?.name || 'Anonymous',
        avatarUrl: creator?.avatarUrl,
      },
    }));

    return NextResponse.json({
      success: true,
      data: formattedReviews,
    });
  } catch (error) {
    console.error('Failed to get asset reviews:', error);
    return NextResponse.json(
      { error: 'Failed to get reviews' },
      { status: 500 },
    );
  }
}

async function handlePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const assetId = resolvedParams.id;
    const reviewData = await request.json();

    // Validate review data
    if (!reviewData.rating || reviewData.rating < 1 || reviewData.rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 },
      );
    }

    if (reviewData.title && reviewData.title.length > 200) {
      return NextResponse.json(
        { error: 'Title must be less than 200 characters' },
        { status: 400 },
      );
    }

    if (reviewData.review && reviewData.review.length > 2000) {
      return NextResponse.json(
        { error: 'Review must be less than 2000 characters' },
        { status: 400 },
      );
    }

    // Submit the review
    await marketplaceService.submitReview(
      assetId,
      session.user.id,
      session.organizationId,
      {
        rating: parseInt(reviewData.rating, 10),
        title: reviewData.title,
        review: reviewData.review,
      },
    );

    return NextResponse.json({
      success: true,
      message: 'Review submitted successfully',
    });
  } catch (error) {
    console.error('Failed to submit review:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to submit review',
      },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
