/**
 * GET /api/billing/crypto-payment/[paymentId]/status
 * Check the status of a crypto payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { sessionService } from '@/lib/auth/session';
import { CryptoPaymentVerifier } from '@/lib/billing/crypto-payment-verifier';

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  try {
    // Get user session
    const session = await sessionService.getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentId } = await params;

    // Get payment status
    const status = await CryptoPaymentVerifier.getPaymentStatus(paymentId);

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('Failed to get crypto payment status:', error);
    return NextResponse.json(
      { error: 'Failed to get payment status' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
