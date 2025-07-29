/**
 * Payment Methods Component
 * Manages saved payment methods for the organization
 */

'use client';

import { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Trash2,
  Star,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface PaymentMethod {
  id: string;
  type: 'card';
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  isDefault: boolean;
  created: number;
}

interface PaymentMethodsProps {
  organizationId: string;
}

export function PaymentMethods({ organizationId }: PaymentMethodsProps) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingMethod, setAddingMethod] = useState(false);

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch('/api/billing/payment-methods');
      if (!response.ok) {
        throw new Error('Failed to fetch payment methods');
      }
      const data = await response.json();
      setPaymentMethods(data.paymentMethods || []);
    } catch (error) {
      console.error('Failed to fetch payment methods:', error);
      toast.error('Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const addPaymentMethod = async () => {
    setAddingMethod(true);
    try {
      // Create Stripe setup intent for adding payment method
      const response = await fetch('/api/billing/setup-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create setup intent');
      }

      const { clientSecret } = await response.json();

      // In a real implementation, you would:
      // 1. Load Stripe.js
      // 2. Create elements
      // 3. Show a payment form modal
      // 4. Confirm the setup intent
      // For now, we'll just show a placeholder

      toast.info('Payment method setup would open here');
    } catch (error) {
      console.error('Failed to add payment method:', error);
      toast.error('Failed to add payment method');
    } finally {
      setAddingMethod(false);
    }
  };

  const setDefaultPaymentMethod = async (paymentMethodId: string) => {
    try {
      const response = await fetch('/api/billing/payment-methods/default', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentMethodId }),
      });

      if (!response.ok) {
        throw new Error('Failed to set default payment method');
      }

      // Update local state
      setPaymentMethods((methods) =>
        methods.map((method) => ({
          ...method,
          isDefault: method.id === paymentMethodId,
        })),
      );

      toast.success('Default payment method updated');
    } catch (error) {
      console.error('Failed to set default payment method:', error);
      toast.error('Failed to update default payment method');
    }
  };

  const deletePaymentMethod = async (paymentMethodId: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/billing/payment-methods/${paymentMethodId}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        throw new Error('Failed to delete payment method');
      }

      // Remove from local state
      setPaymentMethods((methods) =>
        methods.filter((method) => method.id !== paymentMethodId),
      );

      toast.success('Payment method deleted');
    } catch (error) {
      console.error('Failed to delete payment method:', error);
      toast.error('Failed to delete payment method');
    }
  };

  const getCardIcon = (brand: string) => {
    // You could replace this with actual card brand icons
    return <CreditCard className="h-6 w-6" />;
  };

  const formatCardBrand = (brand: string) => {
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="animate-pulse">
          <div className="mb-4 h-6 w-1/3 rounded bg-gray-200"></div>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 rounded bg-gray-200"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Payment Methods
          </h3>
          <p className="text-sm text-gray-600">
            Manage your saved payment methods
          </p>
        </div>

        <button
          onClick={addPaymentMethod}
          disabled={addingMethod}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {addingMethod ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Add Payment Method
            </>
          )}
        </button>
      </div>

      {/* Payment Methods List */}
      <div className="space-y-4">
        {paymentMethods.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
            <CreditCard className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <h4 className="mb-2 text-lg font-medium text-gray-900">
              No payment methods
            </h4>
            <p className="mb-4 text-sm text-gray-600">
              Add a payment method to enable automatic billing and faster
              checkouts
            </p>
            <button
              onClick={addPaymentMethod}
              disabled={addingMethod}
              className="mx-auto flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {addingMethod ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add Payment Method
                </>
              )}
            </button>
          </div>
        ) : (
          paymentMethods.map((method) => (
            <div
              key={method.id}
              className={`rounded-lg border bg-white p-4 ${
                method.isDefault
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-gray-700">
                    {getCardIcon(method.card.brand)}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {formatCardBrand(method.card.brand)} ending in{' '}
                        {method.card.last4}
                      </span>
                      {method.isDefault && (
                        <span className="flex items-center gap-1 text-sm text-blue-600">
                          <Star className="h-4 w-4 fill-current" />
                          Default
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      Expires{' '}
                      {method.card.exp_month.toString().padStart(2, '0')}/
                      {method.card.exp_year}
                    </div>
                    <div className="text-xs text-gray-500">
                      Added{' '}
                      {new Date(method.created * 1000).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!method.isDefault && (
                    <button
                      onClick={() => setDefaultPaymentMethod(method.id)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      Set as Default
                    </button>
                  )}

                  <button
                    onClick={() => deletePaymentMethod(method.id)}
                    className="p-1 text-red-600 hover:text-red-800"
                    title="Delete payment method"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Security Notice */}
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-800">
              Your payment information is secure
            </p>
            <p className="text-sm text-green-700">
              All payment data is encrypted and stored securely by Stripe. We
              never store your full card details.
            </p>
          </div>
        </div>
      </div>

      {/* Billing Notice */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-800">
              Automatic Billing
            </p>
            <p className="text-sm text-blue-700">
              Your default payment method will be used for automatic top-ups and
              subscription charges.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
