import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { RevenueSharing } from '@/lib/services/revenue-sharing';
import { auth } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { creatorProfiles } from '@/lib/database/marketplace-schema';
import { eq } from 'drizzle-orm';

const revenueService = new RevenueSharing();

async function handleGET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDatabase();

    // Get creator profile
    const profiles = await db
      .select()
      .from(creatorProfiles)
      .where(eq(creatorProfiles.userId, session.user.id))
      .limit(1);

    const profile = profiles[0] || null;

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('Failed to get creator profile:', error);
    return NextResponse.json(
      { error: 'Failed to get creator profile' },
      { status: 500 },
    );
  }
}

async function handlePOST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profileData = await request.json();

    // Validate required fields
    if (!profileData.displayName) {
      return NextResponse.json(
        { error: 'Display name is required' },
        { status: 400 },
      );
    }

    if (!profileData.payoutMethod) {
      return NextResponse.json(
        { error: 'Payout method is required' },
        { status: 400 },
      );
    }

    // Validate payout method
    const validMethods = ['stripe', 'crypto', 'bank'];
    if (!validMethods.includes(profileData.payoutMethod)) {
      return NextResponse.json(
        { error: 'Invalid payout method' },
        { status: 400 },
      );
    }

    // Validate payout method specific fields
    if (profileData.payoutMethod === 'stripe' && !profileData.stripeAccountId) {
      return NextResponse.json(
        { error: 'Stripe account ID is required for Stripe payouts' },
        { status: 400 },
      );
    }

    if (
      profileData.payoutMethod === 'crypto' &&
      !profileData.cryptoWalletAddress
    ) {
      return NextResponse.json(
        { error: 'Crypto wallet address is required for crypto payouts' },
        { status: 400 },
      );
    }

    // Validate field lengths
    if (profileData.displayName.length > 100) {
      return NextResponse.json(
        { error: 'Display name must be less than 100 characters' },
        { status: 400 },
      );
    }

    if (profileData.bio && profileData.bio.length > 1000) {
      return NextResponse.json(
        { error: 'Bio must be less than 1000 characters' },
        { status: 400 },
      );
    }

    // Setup creator profile
    await revenueService.setupCreatorProfile(
      session.user.id,
      session.organizationId,
      {
        displayName: profileData.displayName,
        bio: profileData.bio,
        website: profileData.website,
        githubUsername: profileData.githubUsername,
        twitterUsername: profileData.twitterUsername,
        payoutMethod: profileData.payoutMethod,
        stripeAccountId: profileData.stripeAccountId,
        cryptoWalletAddress: profileData.cryptoWalletAddress,
        cryptoWalletType: profileData.cryptoWalletType,
      },
    );

    return NextResponse.json({
      success: true,
      message: 'Creator profile updated successfully',
    });
  } catch (error) {
    console.error('Failed to update creator profile:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update creator profile',
      },
      { status: 500 },
    );
  }
}

export const { GET, POST } = wrapHandlers({ handleGET, handlePOST });
