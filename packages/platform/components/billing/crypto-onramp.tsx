/**
 * Crypto Onramp Component
 * Handles crypto payments via Stripe's crypto onramp
 */

'use client';

import { useState } from 'react';
import { CreditCard, Loader2, Shield, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';

interface CryptoOnrampProps {
  amount: number;
  organizationId: string;
  onPaymentComplete?: () => void;
  onCancel?: () => void;
}

interface SupportedCrypto {
  symbol: string;
  name: string;
  network: string;
  icon: string;
}

const supportedCryptos: SupportedCrypto[] = [
  { symbol: 'ETH', name: 'Ethereum', network: 'ethereum', icon: '⟠' },
  { symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin', icon: '₿' },
  { symbol: 'USDC', name: 'USD Coin', network: 'ethereum', icon: '💳' },
  { symbol: 'USDT', name: 'Tether', network: 'ethereum', icon: '₮' },
];

export function CryptoOnramp({
  amount,
  organizationId: _organizationId,
  onPaymentComplete,
  onCancel,
}: CryptoOnrampProps) {
  const [selectedCrypto, setSelectedCrypto] = useState<string>('ethereum');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const handleCryptoPayment = async () => {
    setIsProcessing(true);

    try {
      // Create crypto onramp session
      const response = await fetch('/api/billing/crypto-onramp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency: 'usd',
          cryptoCurrency: selectedCrypto,
          successUrl: `${window.location.origin}/dashboard/billing?crypto_success=true&amount=${amount}`,
          cancelUrl: `${window.location.origin}/dashboard/billing?crypto_canceled=true`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || 'Failed to create crypto onramp session',
        );
      }

      const data = await response.json();

      if (data.success && data.data.url) {
        setPaymentUrl(data.data.url);
        // Open in new window or redirect
        window.open(
          data.data.url,
          '_blank',
          'width=600,height=800,scrollbars=yes,resizable=yes',
        );

        toast.success(
          'Crypto payment window opened! Complete your payment to add credits.',
        );

        // Start polling for payment completion
        startPaymentPolling(data.data.sessionId);
      } else {
        throw new Error('Invalid response from crypto onramp service');
      }
    } catch (error) {
      console.error('Crypto payment failed:', error);
      toast.error(
        error instanceof Error ? error.message : 'Crypto payment failed',
      );
      setIsProcessing(false);
    }
  };

  const startPaymentPolling = (sessionId: string) => {
    // Poll for real payment completion using session ID
    const pollInterval = setInterval(async () => {
      try {
        // Check payment status using the session ID
        const statusResponse = await fetch(
          `/api/billing/crypto-onramp/${sessionId}/status`,
        );
        if (!statusResponse.ok) {
          throw new Error('Failed to check payment status');
        }

        const statusData = await statusResponse.json();

        if (statusData.status === 'completed') {
          clearInterval(pollInterval);
          setIsProcessing(false);
          toast.success(
            'Crypto payment confirmed! Credits have been added to your account.',
          );
          if (onPaymentComplete) {
            onPaymentComplete();
          }
        } else if (
          statusData.status === 'failed' ||
          statusData.status === 'expired'
        ) {
          clearInterval(pollInterval);
          setIsProcessing(false);
          toast.error('Crypto payment failed or expired. Please try again.');
        }
        // Continue polling if status is still 'pending'
      } catch (error) {
        console.error('Error polling payment status:', error);
      }
    }, 5000);

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setIsProcessing(false);
    }, 300000);
  };

  const selectedCryptoData = supportedCryptos.find(
    (crypto) => crypto.network === selectedCrypto,
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center">
        <CreditCard className="mr-2 h-5 w-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Pay with Cryptocurrency
        </h3>
      </div>

      <div className="space-y-6">
        {/* Crypto Selection */}
        <div>
          <label className="mb-3 block text-sm font-medium text-gray-700">
            Select Cryptocurrency
          </label>
          <div className="grid grid-cols-2 gap-2">
            {supportedCryptos.map((crypto) => (
              <button
                key={crypto.network}
                onClick={() => setSelectedCrypto(crypto.network)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  selectedCrypto === crypto.network
                    ? 'border-purple-300 bg-purple-50 text-purple-900'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
                data-testid={`crypto-${crypto.symbol.toLowerCase()}`}
              >
                <div className="flex items-center">
                  <span className="mr-3 text-2xl">{crypto.icon}</span>
                  <div>
                    <div className="font-medium">{crypto.symbol}</div>
                    <div className="text-xs text-gray-500">{crypto.name}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Payment Summary */}
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-purple-800">Purchase Amount:</span>
            <span className="font-semibold text-purple-900">
              ${amount.toFixed(2)} USD
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-purple-800">Payment Method:</span>
            <span className="flex items-center font-semibold text-purple-900">
              {selectedCryptoData?.icon} {selectedCryptoData?.symbol}
            </span>
          </div>
        </div>

        {/* Security Notice */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start">
            <Shield className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                Secure Crypto Payment
              </p>
              <p className="mt-1 text-xs text-blue-600">
                Powered by Stripe's secure crypto onramp. Your crypto will be
                converted to USD and added as platform credits.
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 gap-2 text-sm text-gray-600">
          <div className="flex items-center">
            <div className="mr-2 h-2 w-2 rounded-full bg-green-500"></div>
            <span>Instant credit conversion</span>
          </div>
          <div className="flex items-center">
            <div className="mr-2 h-2 w-2 rounded-full bg-green-500"></div>
            <span>Multiple cryptocurrencies supported</span>
          </div>
          <div className="flex items-center">
            <div className="mr-2 h-2 w-2 rounded-full bg-green-500"></div>
            <span>Secure blockchain transactions</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={handleCryptoPayment}
            disabled={isProcessing}
            className="flex flex-1 items-center justify-center rounded-lg bg-purple-600 px-4 py-3 font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="crypto-pay-button"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Pay ${amount} with {selectedCryptoData?.symbol}
              </>
            )}
          </button>

          {onCancel && (
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className="rounded-lg border border-gray-300 px-4 py-3 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Payment URL Display (for testing) */}
        {paymentUrl && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-xs text-gray-600">Payment URL:</p>
            <a
              href={paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-xs text-blue-600 hover:text-blue-800"
            >
              {paymentUrl}
            </a>
          </div>
        )}

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            🔒 Payments are securely processed by Stripe's crypto infrastructure
          </p>
        </div>
      </div>
    </div>
  );
}
