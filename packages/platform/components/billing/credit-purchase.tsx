/**
 * Credit Purchase Component
 * Handles credit purchases via Stripe with real payment processing
 */

'use client';

import { useState } from 'react';
import { Plus, CreditCard, Loader2, ExternalLink, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { CryptoOnramp } from './crypto-onramp';

interface CreditPurchaseProps {
  currentBalance: number;
  organizationId: string;
}

export function CreditPurchase({
  currentBalance,
  organizationId: _organizationId,
}: CreditPurchaseProps) {
  const [amount, setAmount] = useState(25);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'crypto'>(
    'stripe',
  );
  const [showCryptoOnramp, setShowCryptoOnramp] = useState(false);

  const predefinedAmounts = [10, 25, 50, 100, 250];

  const handlePurchase = async () => {
    if (paymentMethod === 'crypto') {
      handleCryptoPurchase();
      return;
    }

    setIsProcessing(true);

    try {
      // Create Stripe checkout session
      const response = await fetch('/api/billing/checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency: 'usd',
          successUrl: `${window.location.origin}/dashboard/billing?success=true`,
          cancelUrl: `${window.location.origin}/dashboard/billing?canceled=true`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error('Payment failed:', error);
      toast.error(error instanceof Error ? error.message : 'Payment failed');
      setIsProcessing(false);
    }
  };

  const handleCryptoPurchase = () => {
    setShowCryptoOnramp(true);
  };

  const handleCryptoPaymentComplete = () => {
    setShowCryptoOnramp(false);
    toast.success(
      'Crypto payment completed! Your credits will be added shortly.',
    );
    // Refresh the page to show updated balance
    window.location.reload();
  };

  const handleCryptoCancel = () => {
    setShowCryptoOnramp(false);
  };

  return (
    <div
      className="rounded-lg border border-stroke-weak bg-background p-6 dark:border-stroke-weak-dark dark:bg-background-dark"
      data-testid="credit-purchase"
      id="credit-purchase"
    >
      <div className="mb-4 flex items-center">
        <Plus className="mr-2 h-5 w-5 text-brand dark:text-brand-dark" />
        <h3
          className="text-lg font-semibold text-typography-strong dark:text-typography-strong-dark"
          data-testid="purchase-title"
        >
          Add Credits
        </h3>
      </div>

      <div className="space-y-6">
        {/* Current Balance Display */}
        <div className="rounded-lg bg-fill p-4 dark:bg-fill">
          <p className="text-sm text-typography-weak dark:text-typography-weak-dark">
            Current Balance
          </p>
          <p
            className="text-2xl font-bold text-typography-strong dark:text-typography-strong-dark"
            data-testid="current-balance"
          >
            ${currentBalance.toFixed(2)}
          </p>
        </div>

        {/* Amount Selection */}
        <div>
          <label className="mb-3 block text-sm font-medium text-typography-strong dark:text-typography-strong-dark">
            Select Amount
          </label>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {predefinedAmounts.map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(preset)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  amount === preset
                    ? 'border-brand bg-brand text-white dark:border-brand-dark dark:bg-brand-dark'
                    : 'border-stroke-weak bg-background text-typography-strong hover:bg-background-hover dark:border-stroke-weak-dark dark:bg-background-dark dark:text-typography-strong-dark dark:hover:bg-background-hover-dark'
                }`}
                data-testid={`amount-${preset}`}
              >
                ${preset}
              </button>
            ))}
          </div>

          {/* Custom Amount Input */}
          <div>
            <label className="mb-1 block text-xs text-typography-weak dark:text-typography-weak-dark">
              Custom Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 transform text-typography-weak dark:text-typography-weak-dark">
                $
              </span>
              <input
                type="number"
                min="5"
                max="10000"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full rounded-lg border border-stroke-weak bg-background py-2 pl-8 pr-3 text-typography-strong focus:border-brand focus:ring-2 focus:ring-brand dark:border-stroke-weak-dark dark:bg-background-dark dark:text-typography-strong-dark"
                data-testid="custom-amount-input"
              />
            </div>
            <p className="mt-1 text-xs text-typography-weak dark:text-typography-weak-dark">
              Minimum $5, Maximum $10,000
            </p>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div>
          <label className="mb-3 block text-sm font-medium text-typography-strong dark:text-typography-strong-dark">
            Payment Method
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                value="stripe"
                checked={paymentMethod === 'stripe'}
                onChange={(e) => setPaymentMethod(e.target.value as 'stripe')}
                className="mr-3"
                data-testid="payment-method-stripe"
              />
              <CreditCard className="mr-2 h-4 w-4" />
              <span className="text-sm text-typography-strong dark:text-typography-strong-dark">
                Credit/Debit Card
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="crypto"
                checked={paymentMethod === 'crypto'}
                onChange={(e) => setPaymentMethod(e.target.value as 'crypto')}
                className="mr-3"
                data-testid="payment-method-crypto"
              />
              <Coins className="mr-2 h-4 w-4" />
              <span className="text-sm text-typography-strong dark:text-typography-strong-dark">
                Cryptocurrency
              </span>
            </label>
          </div>
        </div>

        {/* Payment Notice */}
        {paymentMethod === 'stripe' && (
          <div className="rounded-lg border border-secondary-stroke-weak bg-secondary-fill p-4 dark:border-secondary-stroke-weak dark:bg-secondary-fill">
            <p className="text-sm text-secondary-typography-strong dark:text-secondary-typography-strong-dark">
              💳 Secure payment processing powered by Stripe
            </p>
            <p className="mt-1 text-xs text-secondary-typography-weak dark:text-secondary-typography-weak-dark">
              You'll be redirected to Stripe Checkout to complete your payment
            </p>
          </div>
        )}

        {paymentMethod === 'crypto' && (
          <div className="rounded-lg border border-info-stroke-weak bg-info-fill p-4 dark:border-info-stroke-weak dark:bg-info-fill">
            <p className="text-sm text-info dark:text-info">
              🪙 Cryptocurrency payment via Stripe Crypto Onramp
            </p>
            <p className="mt-1 text-xs text-info-stroke-strong dark:text-info-stroke-strong">
              Pay with Bitcoin, Ethereum, USDC, or other supported
              cryptocurrencies
            </p>
          </div>
        )}

        {/* Purchase Summary */}
        <div className="rounded-lg border border-secondary-stroke-weak bg-secondary-fill p-4 dark:border-secondary-stroke-weak dark:bg-secondary-fill">
          <div className="flex justify-between text-sm">
            <span className="text-secondary-typography-strong dark:text-secondary-typography-strong-dark">
              Credit Amount:
            </span>
            <span
              className="font-semibold text-secondary-typography-strong dark:text-secondary-typography-strong-dark"
              data-testid="purchase-amount"
            >
              ${amount.toFixed(2)}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-secondary-typography-strong dark:text-secondary-typography-strong-dark">
              New Balance:
            </span>
            <span
              className="font-semibold text-secondary-typography-strong dark:text-secondary-typography-strong-dark"
              data-testid="new-balance"
            >
              ${(currentBalance + amount).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Purchase Button */}
        <button
          onClick={handlePurchase}
          disabled={isProcessing || amount < 5}
          className="hover:bg-brand/90 flex w-full items-center justify-center rounded-lg bg-brand px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="purchase-button"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Add ${amount} Credits
            </>
          )}
        </button>

        {/* Security Notice */}
        <div className="text-center">
          <p className="text-xs text-typography-weak dark:text-typography-weak-dark">
            🔒 Payments are securely processed by Stripe
          </p>
        </div>
      </div>

      {/* Crypto Onramp Modal */}
      {showCryptoOnramp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 max-h-screen w-full max-w-md overflow-y-auto rounded-lg bg-background dark:bg-background-dark">
            <CryptoOnramp
              amount={amount}
              organizationId={_organizationId}
              onPaymentComplete={handleCryptoPaymentComplete}
              onCancel={handleCryptoCancel}
            />
          </div>
        </div>
      )}
    </div>
  );
}
